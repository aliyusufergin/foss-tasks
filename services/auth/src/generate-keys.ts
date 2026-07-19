import { exportPKCS8, generateKeyPair } from "jose";

/**
 * Prints a fresh RS256 private key as PKCS8 PEM for AUTH_JWT_PRIVATE_KEY.
 * Run with: `npm run gen-keys`.
 */
const { privateKey } = await generateKeyPair("RS256", { extractable: true });
process.stdout.write(await exportPKCS8(privateKey));
