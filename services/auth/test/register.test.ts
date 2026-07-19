import { beforeEach, describe, expect, it } from "vitest";
import { registerAccount } from "../src/domain/register.js";
import type { RegisterDeps } from "../src/domain/register.js";
import { InMemoryAuthRepo } from "./support/in-memory-repo.js";

function makeDeps(repo: InMemoryAuthRepo): RegisterDeps {
  let counter = 0;
  return {
    repo,
    hashPassword: async (plain) => `hashed:${plain}`,
    generateId: () => `id-${++counter}`,
    now: () => new Date("2026-07-19T00:00:00.000Z"),
  };
}

describe("registerAccount", () => {
  let repo: InMemoryAuthRepo;
  let deps: RegisterDeps;

  beforeEach(() => {
    repo = new InMemoryAuthRepo();
    deps = makeDeps(repo);
  });

  it("creates an Account and its Personal Space with an owner membership", async () => {
    const result = await registerAccount(deps, {
      email: "alice@example.com",
      password: "supersecret",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const account = repo.accounts.get(result.accountId);
    expect(account?.email).toBe("alice@example.com");
    expect(account?.personalSpaceId).toBe(result.spaceId);

    const space = repo.spaces.get(result.spaceId);
    expect(space?.kind).toBe("personal");

    const membership = [...repo.memberships.values()].find(
      (m) => m.spaceId === result.spaceId,
    );
    expect(membership?.accountId).toBe(result.accountId);
    expect(membership?.role).toBe("owner");
  });

  it("stores the password hashed, never the plaintext", async () => {
    const result = await registerAccount(deps, {
      email: "alice@example.com",
      password: "supersecret",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const account = repo.accounts.get(result.accountId);
    expect(account?.passwordHash).toBe("hashed:supersecret");
    expect(account?.passwordHash).not.toContain("supersecret".slice(0, 5) + "!");
  });

  it("normalizes the email before storing", async () => {
    const result = await registerAccount(deps, {
      email: "  Alice@Example.COM ",
      password: "supersecret",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(repo.accounts.get(result.accountId)?.email).toBe("alice@example.com");
  });

  it("rejects an invalid email", async () => {
    const result = await registerAccount(deps, {
      email: "not-an-email",
      password: "supersecret",
    });
    expect(result).toEqual({ ok: false, error: "invalid_email" });
    expect(repo.accounts.size).toBe(0);
  });

  it("rejects a too-short password", async () => {
    const result = await registerAccount(deps, {
      email: "alice@example.com",
      password: "short",
    });
    expect(result).toEqual({ ok: false, error: "invalid_password" });
    expect(repo.accounts.size).toBe(0);
  });

  it("rejects a duplicate email (case-insensitive)", async () => {
    await registerAccount(deps, {
      email: "alice@example.com",
      password: "supersecret",
    });
    const result = await registerAccount(deps, {
      email: "ALICE@example.com",
      password: "anothersecret",
    });
    expect(result).toEqual({ ok: false, error: "email_taken" });
    expect(repo.accounts.size).toBe(1);
  });
});
