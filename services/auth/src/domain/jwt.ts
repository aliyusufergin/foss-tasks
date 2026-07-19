import { SignJWT } from "jose";
import type { KeyLike } from "jose";

export interface SignTokenOptions {
  privateKey: KeyLike;
  kid: string;
  issuer: string;
  audience: string;
  subject: string;
  ttlSeconds: number;
  /** Injectable clock for deterministic tests. Defaults to the real clock. */
  now?: () => Date;
  extraClaims?: Record<string, unknown>;
}

/**
 * Signs an RS256 access token PowerSync accepts: `sub` (Account id), `aud`
 * (matching the service's configured audience), `iss`, `iat`, `exp`, and a
 * `kid` header so PowerSync can select the right key from the JWKS.
 */
export async function signAccessToken(opts: SignTokenOptions): Promise<string> {
  const nowMs = (opts.now ?? (() => new Date()))().getTime();
  const iat = Math.floor(nowMs / 1000);

  return new SignJWT({ ...opts.extraClaims })
    .setProtectedHeader({ alg: "RS256", kid: opts.kid })
    .setSubject(opts.subject)
    .setIssuer(opts.issuer)
    .setAudience(opts.audience)
    .setIssuedAt(iat)
    .setExpirationTime(iat + opts.ttlSeconds)
    .sign(opts.privateKey);
}
