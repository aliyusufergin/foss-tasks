import { exportJWK, importJWK, importPKCS8 } from "jose";
import type { JWK, KeyLike } from "jose";

export interface SigningKey {
  privateKey: KeyLike;
  /**
   * The matching public key. PowerSync validates tokens out of band via the
   * JWKS, but `POST /auth/token` has to verify a token this service issued
   * without a round-trip to its own JWKS endpoint.
   */
  publicKey: KeyLike;
  kid: string;
  jwk: JWK;
}

/** RSA private-JWK members that must never be published in the JWKS. */
const PRIVATE_RSA_MEMBERS = ["d", "p", "q", "dp", "dq", "qi"] as const;

/** Derives the public JWK from an RSA private key by dropping private members. */
export function toPublicJwk(privateJwk: JWK, kid: string): JWK {
  const pub: JWK = { ...privateJwk };
  for (const member of PRIVATE_RSA_MEMBERS) delete pub[member];
  delete pub.key_ops;
  delete pub.ext;
  return { ...pub, kid, use: "sig", alg: "RS256" };
}

/**
 * Loads the RS256 signing key from a PKCS8 PEM and derives its PUBLIC JWK
 * (served at the JWKS endpoint for PowerSync to validate tokens). Private key
 * material is stripped before it ever leaves this function as a JWK.
 */
export async function loadSigningKey(
  privateKeyPem: string,
  kid: string,
): Promise<SigningKey> {
  const privateKey = await importPKCS8(privateKeyPem, "RS256", {
    extractable: true,
  });
  const jwk = toPublicJwk(await exportJWK(privateKey), kid);
  const publicKey = (await importJWK(jwk, "RS256")) as KeyLike;
  return { privateKey, publicKey, kid, jwk };
}
