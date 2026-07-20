import { compactVerify } from "jose";
import type { KeyLike } from "jose";

export interface VerifyHeldTokenOptions {
  /** The access token the client currently holds, possibly expired. */
  token: string;
  publicKey: KeyLike;
  issuer: string;
  audience: string;
  /** How long after issuance a token may still be traded for a fresh one. */
  maxAgeSeconds: number;
  /** Injectable clock for deterministic tests. Defaults to the real clock. */
  now?: () => Date;
}

export type VerifyHeldTokenResult =
  | { ok: true; subject: string }
  | { ok: false; error: "invalid_token" | "session_expired" };

interface Claims {
  sub?: unknown;
  iss?: unknown;
  aud?: unknown;
  iat?: unknown;
}

function audienceMatches(aud: unknown, expected: string): boolean {
  if (typeof aud === "string") return aud === expected;
  if (Array.isArray(aud)) return aud.includes(expected);
  return false;
}

/**
 * Verifies a token the client is trading in at `POST /auth/token` for a fresh
 * one, and returns the Account id it was issued to.
 *
 * Deliberately **does not enforce `exp`**. The access-token TTL is short so that
 * a leaked token is useful only briefly, but the held token doubles as the
 * client's proof of an ongoing session — a user who closes the app overnight
 * must still come back signed in (user story 3). Session lifetime is bounded by
 * `iat` age against {@link VerifyHeldTokenOptions.maxAgeSeconds} instead, which
 * is what makes the session finite without making it an hour long.
 *
 * This is why verification is written against `compactVerify` and hand-checked
 * claims rather than `jwtVerify`: the set of claims enforced here differs from
 * the set PowerSync enforces, and being explicit about which ones is the point.
 * Everything except `exp` is still checked, and the algorithm is pinned to
 * RS256 rather than read from the token's own header.
 *
 * Note there is no revocation: within the max-age window a leaked token can be
 * rolled forward indefinitely. That is the same exposure the service already
 * has (nothing can invalidate an issued JWT), traded for not needing a
 * refresh-token table. Revocation wants a session record — see #16.
 */
export async function verifyHeldToken(
  opts: VerifyHeldTokenOptions,
): Promise<VerifyHeldTokenResult> {
  let claims: Claims;
  try {
    const { payload } = await compactVerify(opts.token, opts.publicKey, {
      algorithms: ["RS256"],
    });
    claims = JSON.parse(new TextDecoder().decode(payload)) as Claims;
  } catch {
    return { ok: false, error: "invalid_token" };
  }

  if (typeof claims.sub !== "string" || claims.sub === "") {
    return { ok: false, error: "invalid_token" };
  }
  if (claims.iss !== opts.issuer) return { ok: false, error: "invalid_token" };
  if (!audienceMatches(claims.aud, opts.audience)) {
    return { ok: false, error: "invalid_token" };
  }
  // Without `iat` the session has no measurable age, so the max-age bound
  // cannot be applied and the token would be usable forever.
  if (typeof claims.iat !== "number") return { ok: false, error: "invalid_token" };

  const nowSeconds = Math.floor((opts.now ?? (() => new Date()))().getTime() / 1000);
  if (nowSeconds - claims.iat > opts.maxAgeSeconds) {
    return { ok: false, error: "session_expired" };
  }

  return { ok: true, subject: claims.sub };
}
