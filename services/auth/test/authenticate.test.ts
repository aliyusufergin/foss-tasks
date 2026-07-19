import { beforeEach, describe, expect, it } from "vitest";
import { authenticate } from "../src/domain/authenticate.js";
import type { AuthenticateDeps } from "../src/domain/authenticate.js";
import { registerAccount } from "../src/domain/register.js";
import { InMemoryAuthRepo } from "./support/in-memory-repo.js";

describe("authenticate", () => {
  let repo: InMemoryAuthRepo;
  let deps: AuthenticateDeps;

  beforeEach(async () => {
    repo = new InMemoryAuthRepo();
    let counter = 0;
    await registerAccount(
      {
        repo,
        hashPassword: async (plain) => `hashed:${plain}`,
        generateId: () => `id-${++counter}`,
        now: () => new Date("2026-07-19T00:00:00.000Z"),
      },
      { email: "alice@example.com", password: "supersecret" },
    );
    deps = {
      repo,
      verifyPassword: async (plain, hash) => hash === `hashed:${plain}`,
    };
  });

  it("returns the account for correct credentials", async () => {
    const result = await authenticate(deps, {
      email: "alice@example.com",
      password: "supersecret",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.account.email).toBe("alice@example.com");
    expect(result.account.personalSpaceId).toBeTruthy();
  });

  it("accepts a differently-cased email", async () => {
    const result = await authenticate(deps, {
      email: "ALICE@Example.com",
      password: "supersecret",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a wrong password with a generic error", async () => {
    const result = await authenticate(deps, {
      email: "alice@example.com",
      password: "wrongpassword",
    });
    expect(result).toEqual({ ok: false, error: "invalid_credentials" });
  });

  it("rejects an unknown email with the same generic error", async () => {
    const result = await authenticate(deps, {
      email: "nobody@example.com",
      password: "supersecret",
    });
    expect(result).toEqual({ ok: false, error: "invalid_credentials" });
  });
});
