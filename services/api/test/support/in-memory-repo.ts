import type { AccountRecord, AuthRepo } from "../../src/domain/types.js";

interface SpaceRow {
  id: string;
  name: string;
  kind: "personal" | "group";
  createdAt: Date;
}

interface MembershipRow {
  id: string;
  spaceId: string;
  accountId: string;
  role: "owner" | "admin" | "member" | "viewer";
}

/**
 * Test double for {@link AuthRepo}. Mirrors the atomic
 * account+space+membership creation the Postgres repo performs, so the domain
 * orchestration can be exercised without a real database.
 */
export class InMemoryAuthRepo implements AuthRepo {
  readonly accounts = new Map<string, AccountRecord>();
  readonly spaces = new Map<string, SpaceRow>();
  readonly memberships = new Map<string, MembershipRow>();

  async findAccountByEmail(email: string): Promise<AccountRecord | null> {
    for (const account of this.accounts.values()) {
      if (account.email === email) return account;
    }
    return null;
  }

  async findAccountById(id: string): Promise<AccountRecord | null> {
    return this.accounts.get(id) ?? null;
  }

  async createAccountWithPersonalSpace(input: {
    accountId: string;
    email: string;
    passwordHash: string;
    spaceId: string;
    membershipId: string;
    now: Date;
  }): Promise<void> {
    if (await this.findAccountByEmail(input.email)) {
      throw new Error("duplicate email — unique constraint");
    }
    this.spaces.set(input.spaceId, {
      id: input.spaceId,
      name: "Personal",
      kind: "personal",
      createdAt: input.now,
    });
    this.memberships.set(input.membershipId, {
      id: input.membershipId,
      spaceId: input.spaceId,
      accountId: input.accountId,
      role: "owner",
    });
    this.accounts.set(input.accountId, {
      id: input.accountId,
      email: input.email,
      passwordHash: input.passwordHash,
      personalSpaceId: input.spaceId,
    });
  }
}
