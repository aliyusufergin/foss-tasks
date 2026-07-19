import type { AuthRepo } from "./types.js";
import { isValidEmail, isValidPassword, normalizeEmail } from "./validation.js";

export interface RegisterDeps {
  repo: AuthRepo;
  hashPassword: (plain: string) => Promise<string>;
  generateId: () => string;
  now: () => Date;
}

export type RegisterResult =
  | { ok: true; accountId: string; spaceId: string }
  | { ok: false; error: "invalid_email" | "invalid_password" | "email_taken" };

/**
 * Registers an Account and, in the same atomic step, its Personal Space with an
 * `owner` membership (CONTEXT: every Account owns exactly one Personal Space).
 * Pure orchestration over the injected {@link RegisterDeps} — no I/O of its own.
 */
export async function registerAccount(
  deps: RegisterDeps,
  input: { email: string; password: string },
): Promise<RegisterResult> {
  const email = normalizeEmail(input.email);

  if (!isValidEmail(email)) return { ok: false, error: "invalid_email" };
  if (!isValidPassword(input.password)) {
    return { ok: false, error: "invalid_password" };
  }

  if (await deps.repo.findAccountByEmail(email)) {
    return { ok: false, error: "email_taken" };
  }

  const accountId = deps.generateId();
  const spaceId = deps.generateId();
  const membershipId = deps.generateId();
  const passwordHash = await deps.hashPassword(input.password);

  try {
    await deps.repo.createAccountWithPersonalSpace({
      accountId,
      email,
      passwordHash,
      spaceId,
      membershipId,
      now: deps.now(),
    });
  } catch {
    // Lost a race to a concurrent registration of the same email (the unique
    // constraint fired). Surface it as the same client-facing outcome.
    return { ok: false, error: "email_taken" };
  }

  return { ok: true, accountId, spaceId };
}
