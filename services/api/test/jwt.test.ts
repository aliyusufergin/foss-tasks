import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  jwtVerify,
} from "jose";
import type { JWK, KeyLike } from "jose";
import { describe, expect, it } from "vitest";
import { signAccessToken } from "../src/domain/jwt.js";

const ISSUER = "foss-tasks-auth";
const AUDIENCE = "powersync";
const KID = "test-key-1";

/** Test-local: derive a signing JWK straight from a public key. */
async function signingJwk(publicKey: KeyLike, kid: string): Promise<JWK> {
  return { ...(await exportJWK(publicKey)), kid, use: "sig", alg: "RS256" };
}

describe("signAccessToken", () => {
  it("issues a token PowerSync can validate against the JWKS", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256", {
      extractable: true,
    });

    const fixedNow = new Date("2026-07-19T12:00:00.000Z");
    const token = await signAccessToken({
      privateKey,
      kid: KID,
      issuer: ISSUER,
      audience: AUDIENCE,
      subject: "account-123",
      ttlSeconds: 3600,
      now: () => fixedNow,
    });

    const jwks = createLocalJWKSet({ keys: [await signingJwk(publicKey, KID)] });
    const { payload, protectedHeader } = await jwtVerify(token, jwks, {
      issuer: ISSUER,
      audience: AUDIENCE,
      // Validate exp/iat against the same injected clock so the test is
      // deterministic regardless of the real wall-clock time.
      currentDate: fixedNow,
    });

    expect(protectedHeader.alg).toBe("RS256");
    expect(protectedHeader.kid).toBe(KID);
    expect(payload.sub).toBe("account-123");
    expect(payload.iat).toBe(Math.floor(fixedNow.getTime() / 1000));
    expect(payload.exp).toBe(Math.floor(fixedNow.getTime() / 1000) + 3600);
  });

  it("carries extra claims (e.g. personal space id)", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256", {
      extractable: true,
    });
    const token = await signAccessToken({
      privateKey,
      kid: KID,
      issuer: ISSUER,
      audience: AUDIENCE,
      subject: "account-123",
      ttlSeconds: 60,
      extraClaims: { personal_space_id: "space-9" },
    });

    const jwks = createLocalJWKSet({ keys: [await signingJwk(publicKey, KID)] });
    const { payload } = await jwtVerify(token, jwks);
    expect(payload.personal_space_id).toBe("space-9");
  });
});
