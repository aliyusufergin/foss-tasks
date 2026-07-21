import type { AccountRecord, AuthRepo } from "./types.js";
import { normalizeEmail } from "./validation.js";

export interface AuthenticateDeps {
  repo: AuthRepo;
  verifyPassword: (plain: string, hash: string) => Promise<boolean>;
}

export type AuthenticateResult =
  | { ok: true; account: AccountRecord }
  | { ok: false; error: "invalid_credentials" };

/**
 * Verifies email + password. Unknown email and wrong password return the same
 * `invalid_credentials` error to avoid account enumeration.
 */
export async function authenticate(
  deps: AuthenticateDeps,
  input: { email: string; password: string },
): Promise<AuthenticateResult> {
  const email = normalizeEmail(input.email);
  const account = await deps.repo.findAccountByEmail(email);

  if (!account || !(await deps.verifyPassword(input.password, account.passwordHash))) {
    return { ok: false, error: "invalid_credentials" };
  }

  return { ok: true, account };
}
