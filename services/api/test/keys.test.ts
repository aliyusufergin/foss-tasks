import {
  createLocalJWKSet,
  exportPKCS8,
  generateKeyPair,
  jwtVerify,
} from "jose";
import { describe, expect, it } from "vitest";
import { signAccessToken } from "../src/domain/jwt.js";
import { loadSigningKey } from "../src/keys.js";

describe("loadSigningKey", () => {
  it("derives a public JWK with no private material", async () => {
    const { privateKey } = await generateKeyPair("RS256", { extractable: true });
    const pem = await exportPKCS8(privateKey);

    const { jwk } = await loadSigningKey(pem, "auth-key-1");

    expect(jwk.kid).toBe("auth-key-1");
    expect(jwk.use).toBe("sig");
    expect(jwk.alg).toBe("RS256");
    // The published JWK must expose only the public RSA members.
    for (const secret of ["d", "p", "q", "dp", "dq", "qi"]) {
      expect(jwk[secret]).toBeUndefined();
    }
    expect(jwk.n).toBeTruthy();
    expect(jwk.e).toBeTruthy();
  });

  it("signs a token that validates against the derived JWKS", async () => {
    const { privateKey } = await generateKeyPair("RS256", { extractable: true });
    const pem = await exportPKCS8(privateKey);
    const key = await loadSigningKey(pem, "auth-key-1");

    const token = await signAccessToken({
      privateKey: key.privateKey,
      kid: key.kid,
      issuer: "foss-tasks-auth",
      audience: "powersync",
      subject: "account-1",
      ttlSeconds: 60,
    });

    const jwks = createLocalJWKSet({ keys: [key.jwk] });
    const { payload } = await jwtVerify(token, jwks, {
      issuer: "foss-tasks-auth",
      audience: "powersync",
    });
    expect(payload.sub).toBe("account-1");
  });
});
