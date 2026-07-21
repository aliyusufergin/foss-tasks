import { jwtVerify } from "jose";
import type { KeyLike } from "jose";

export interface VerifyAccessTokenOptions {
  /** The bearer token presented on the request. */
  token: string;
  publicKey: KeyLike;
  issuer: string;
  audience: string;
  /** Injectable clock for deterministic tests. Defaults to the real clock. */
  now?: () => Date;
}

export type VerifyAccessTokenResult =
  | { ok: true; accountId: string }
  | { ok: false; error: "invalid_token" };

/**
 * Verifies the JWT a client presents to `POST /sync/write`. This is the **same**
 * token PowerSync's Service verifies out of band — RS256 via the local key,
 * `iss: foss-tasks-auth`, `aud: powersync` (ADR-0008 §2). Reusing PowerSync's
 * audience is deliberate: `auth` mints the token, both services are ours, and it
 * already grants full read of the Account's Spaces; a write-scoped audience
 * would add a second token lifecycle to a client whose refresh path is already a
 * known gap (#16).
 *
 * Unlike {@link verifyHeldToken}, this **enforces `exp`**: `/sync/write` is a
 * normal resource endpoint, not the session-renewal path, so an expired token is
 * simply unauthenticated. `jwtVerify` checks `exp` (and `iss`/`aud`) itself; the
 * algorithm is pinned to RS256 rather than read from the token header.
 */
export async function verifyAccessToken(
  opts: VerifyAccessTokenOptions,
): Promise<VerifyAccessTokenResult> {
  try {
    const { payload } = await jwtVerify(opts.token, opts.publicKey, {
      algorithms: ["RS256"],
      issuer: opts.issuer,
      audience: opts.audience,
      currentDate: opts.now?.(),
    });
    if (typeof payload.sub !== "string" || payload.sub === "") {
      return { ok: false, error: "invalid_token" };
    }
    return { ok: true, accountId: payload.sub };
  } catch {
    return { ok: false, error: "invalid_token" };
  }
}
