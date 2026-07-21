import { newId } from "@foss-tasks/domain";
import type { Pool } from "pg";

/** Inserts a Space and returns its id. */
export async function insertSpace(
  pool: Pool,
  opts: { id?: string; name?: string; kind?: "personal" | "group" } = {},
): Promise<string> {
  const id = opts.id ?? newId();
  await pool.query(
    `INSERT INTO spaces (id, name, kind) VALUES ($1, $2, $3)`,
    [id, opts.name ?? "Space", opts.kind ?? "personal"],
  );
  return id;
}

/** Inserts an Account (with a Personal Space reference) and returns its id. */
export async function insertAccount(
  pool: Pool,
  opts: { id?: string; personalSpaceId: string; email?: string },
): Promise<string> {
  const id = opts.id ?? newId();
  await pool.query(
    `INSERT INTO accounts (id, email, password_hash, personal_space_id)
     VALUES ($1, $2, 'x', $3)`,
    [id, opts.email ?? `${id}@example.test`, opts.personalSpaceId],
  );
  return id;
}

/** Grants an Account membership in a Space. */
export async function insertMembership(
  pool: Pool,
  opts: {
    spaceId: string;
    accountId: string;
    role?: "owner" | "admin" | "member" | "viewer";
    deletedAt?: Date | null;
  },
): Promise<string> {
  const id = newId();
  await pool.query(
    `INSERT INTO space_members (id, space_id, account_id, role, deleted_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, opts.spaceId, opts.accountId, opts.role ?? "owner", opts.deletedAt ?? null],
  );
  return id;
}

/**
 * The common setup: an Account that owns a Personal Space it is a member of.
 * Returns both ids.
 */
export async function seedMemberInSpace(
  pool: Pool,
): Promise<{ accountId: string; spaceId: string }> {
  const spaceId = await insertSpace(pool);
  const accountId = await insertAccount(pool, { personalSpaceId: spaceId });
  await insertMembership(pool, { spaceId, accountId });
  return { accountId, spaceId };
}

/** Inserts a `tasks` row directly (bypassing the write path), for stored-state setup. */
export async function insertTask(
  pool: Pool,
  opts: {
    id?: string;
    spaceId: string;
    title?: string;
    status?: "open" | "done";
    orderKey?: string | null;
    updatedAt: Date;
    deletedAt?: Date | null;
  },
): Promise<string> {
  const id = opts.id ?? newId();
  await pool.query(
    `INSERT INTO tasks (id, space_id, title, status, order_key, updated_at, deleted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      opts.spaceId,
      opts.title ?? "Task",
      opts.status ?? "open",
      opts.orderKey ?? null,
      opts.updatedAt,
      opts.deletedAt ?? null,
    ],
  );
  return id;
}

interface TaskRow {
  space_id: string;
  title: string;
  status: string;
  updated_at: Date;
  deleted_at: Date | null;
}

/** Reads a task back for assertions, or null if absent. */
export async function readTask(pool: Pool, id: string): Promise<TaskRow | null> {
  const { rows } = await pool.query(
    `SELECT space_id, title, status, updated_at, deleted_at FROM tasks WHERE id = $1`,
    [id],
  );
  return (rows[0] as TaskRow | undefined) ?? null;
}

interface RejectedRow {
  account_id: string;
  op: string | null;
  table_name: string | null;
  row_id: string | null;
  reason: string;
  transaction_id: string | null;
}

/** Reads the dead-letter table for assertions. */
export async function readRejected(pool: Pool): Promise<RejectedRow[]> {
  const { rows } = await pool.query(
    `SELECT account_id, op, table_name, row_id, reason, transaction_id
       FROM rejected_writes ORDER BY id`,
  );
  return rows as RejectedRow[];
}
