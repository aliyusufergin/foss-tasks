import { exportPKCS8, generateKeyPair, SignJWT } from "jose";
import type { KeyLike } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { signAccessToken } from "../src/domain/jwt.js";
import { verifyHeldToken } from "../src/domain/verify-held-token.js";
import { loadSigningKey } from "../src/keys.js";
import type { SigningKey } from "../src/keys.js";

const ISSUER = "foss-tasks-auth";
const AUDIENCE = "powersync";
const KID = "kid-1";
const MAX_AGE = 30 * 24 * 60 * 60; // 30 days

const ISSUED_AT = new Date("2026-07-19T12:00:00.000Z");

/** `base` shifted by `seconds`, for expressing "an hour after issuance". */
function shift(base: Date, seconds: number): Date {
  return new Date(base.getTime() + seconds * 1000);
}

describe("verifyHeldToken", () => {
  let key: SigningKey;

  beforeEach(async () => {
    const { privateKey } = await generateKeyPair("RS256", { extractable: true });
    key = await loadSigningKey(await exportPKCS8(privateKey), KID);
  });

  /** A token this service would itself have issued at {@link ISSUED_AT}. */
  function heldToken(subject = "account-123"): Promise<string> {
    return signAccessToken({
      privateKey: key.privateKey,
      kid: KID,
      issuer: ISSUER,
      audience: AUDIENCE,
      subject,
      ttlSeconds: 900,
      now: () => ISSUED_AT,
      extraClaims: { personal_space_id: "space-9" },
    });
  }

  function verify(token: string, at: Date) {
    return verifyHeldToken({
      token,
      publicKey: key.publicKey,
      issuer: ISSUER,
      audience: AUDIENCE,
      maxAgeSeconds: MAX_AGE,
      now: () => at,
    });
  }

  it("accepts a still-valid token", async () => {
    const result = await verify(await heldToken(), shift(ISSUED_AT, 60));
    expect(result).toEqual({ ok: true, subject: "account-123" });
  });

  // The whole point of the endpoint: a user who closed the app overnight comes
  // back to an expired token and must still be able to mint a fresh one.
  it("accepts a token whose exp has passed but is within the session max age", async () => {
    const oneDayLater = shift(ISSUED_AT, 24 * 60 * 60);
    const result = await verify(await heldToken(), oneDayLater);
    expect(result).toEqual({ ok: true, subject: "account-123" });
  });

  it("rejects a token issued longer ago than the session max age", async () => {
    const past = shift(ISSUED_AT, MAX_AGE + 1);
    const result = await verify(await heldToken(), past);
    expect(result).toEqual({ ok: false, error: "session_expired" });
  });

  it("rejects a token signed by a different key", async () => {
    const { privateKey: attacker } = await generateKeyPair("RS256", {
      extractable: true,
    });
    const forged = await signAccessToken({
      privateKey: attacker,
      kid: KID,
      issuer: ISSUER,
      audience: AUDIENCE,
      subject: "account-123",
      ttlSeconds: 900,
      now: () => ISSUED_AT,
    });
    const result = await verify(forged, shift(ISSUED_AT, 60));
    expect(result).toEqual({ ok: false, error: "invalid_token" });
  });

  it("rejects a token for another issuer or audience", async () => {
    const wrongAudience = await signAccessToken({
      privateKey: key.privateKey,
      kid: KID,
      issuer: ISSUER,
      audience: "some-other-service",
      subject: "account-123",
      ttlSeconds: 900,
      now: () => ISSUED_AT,
    });
    expect(await verify(wrongAudience, shift(ISSUED_AT, 60))).toEqual({
      ok: false,
      error: "invalid_token",
    });

    const wrongIssuer = await signAccessToken({
      privateKey: key.privateKey,
      kid: KID,
      issuer: "somebody-else",
      audience: AUDIENCE,
      subject: "account-123",
      ttlSeconds: 900,
      now: () => ISSUED_AT,
    });
    expect(await verify(wrongIssuer, shift(ISSUED_AT, 60))).toEqual({
      ok: false,
      error: "invalid_token",
    });
  });

  // `alg: "none"` is the classic JWT downgrade. Signature verification must be
  // pinned to RS256 rather than trusting the token's own header.
  it("rejects an unsigned token", async () => {
    const unsigned = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: KID })
      .setSubject("account-123")
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(Math.floor(ISSUED_AT.getTime() / 1000))
      .sign(await unrelatedKey());
    expect(await verify(unsigned, shift(ISSUED_AT, 60))).toEqual({
      ok: false,
      error: "invalid_token",
    });
  });

  it("rejects a token with no iat, which has no measurable age", async () => {
    const noIat = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: KID })
      .setSubject("account-123")
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .sign(key.privateKey);
    expect(await verify(noIat, shift(ISSUED_AT, 60))).toEqual({
      ok: false,
      error: "invalid_token",
    });
  });

  it("rejects malformed input rather than throwing", async () => {
    expect(await verify("not-a-jwt", ISSUED_AT)).toEqual({
      ok: false,
      error: "invalid_token",
    });
  });
});

async function unrelatedKey(): Promise<KeyLike> {
  const { privateKey } = await generateKeyPair("RS256", { extractable: true });
  return privateKey;
}
