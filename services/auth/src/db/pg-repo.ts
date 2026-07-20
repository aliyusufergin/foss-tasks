import type { Pool } from "pg";
import type { AccountRecord, AuthRepo } from "../domain/types.js";

const UNIQUE_VIOLATION = "23505";

interface AccountRow {
  id: string;
  email: string;
  password_hash: string;
  personal_space_id: string;
}

/** Postgres-backed {@link AuthRepo} against the source-of-truth database. */
export class PgAuthRepo implements AuthRepo {
  constructor(private readonly pool: Pool) {}

  async findAccountByEmail(email: string): Promise<AccountRecord | null> {
    return this.findAccountBy("a.email", email);
  }

  async findAccountById(id: string): Promise<AccountRecord | null> {
    return this.findAccountBy("a.id", id);
  }

  /** Shared lookup body; `column` is a literal from this class, never input. */
  private async findAccountBy(
    column: "a.id" | "a.email",
    value: string,
  ): Promise<AccountRecord | null> {
    const { rows } = await this.pool.query<AccountRow>(
      `SELECT a.id, a.email, a.password_hash, a.personal_space_id
         FROM accounts a
        WHERE ${column} = $1`,
      [value],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      personalSpaceId: row.personal_space_id,
    };
  }

  async createAccountWithPersonalSpace(input: {
    accountId: string;
    email: string;
    passwordHash: string;
    spaceId: string;
    membershipId: string;
    now: Date;
  }): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO spaces (id, name, kind, created_at, updated_at)
         VALUES ($1, 'Personal', 'personal', $2, $2)`,
        [input.spaceId, input.now],
      );
      await client.query(
        `INSERT INTO accounts (id, email, password_hash, personal_space_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)`,
        [input.accountId, input.email, input.passwordHash, input.spaceId, input.now],
      );
      await client.query(
        `INSERT INTO space_members (id, space_id, account_id, role, created_at, updated_at)
         VALUES ($1, $2, $3, 'owner', $4, $4)`,
        [input.membershipId, input.spaceId, input.accountId, input.now],
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code?: string }).code === UNIQUE_VIOLATION
      ) {
        throw new Error("email_taken");
      }
      throw err;
    } finally {
      client.release();
    }
  }
}
