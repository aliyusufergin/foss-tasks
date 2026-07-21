import { isValidId, pickLwwWinner, validateTask } from "@foss-tasks/domain";
import type { Pool, PoolClient } from "pg";
import {
  CLOCK_SKEW_CLAMP_MS,
  WRITABLE_TABLES,
  isKnownOpType,
} from "../domain/crud.js";
import type { CrudOp, Rejection, RejectionReason, WriteResult } from "../domain/crud.js";

/**
 * A `tasks` row, with timestamps normalised to ISO strings. Serves both as the
 * row loaded from Postgres (`loadTask`) and the merged row an accepted op
 * resolves to (`mergePut`/`mergePatch`) — one shape so the two cannot drift.
 */
interface TaskRow {
  id: string;
  space_id: string;
  title: string;
  status: string;
  order_key: string | null;
  created_at: Date;
  updated_at: string;
  deleted_at: string | null;
}

/** The outcome of evaluating one op against the (locked) current row. A `noop`
 * is a stale write that LWW discards — it still counts as `applied` (§8). */
type Plan =
  | { kind: "reject"; reason: RejectionReason }
  | { kind: "noop" }
  | { kind: "write"; row: TaskRow };

/**
 * Applies PowerSync CRUD transactions to the source-of-truth Postgres
 * (ADR-0008). One device transaction per call, one Postgres transaction per
 * call: either every op lands or none does. A permanent rejection anywhere rolls
 * the whole transaction back and dead-letters every op to `rejected_writes` in a
 * *separate* transaction — the response is still 200, so the client's queue
 * drains and downloads never stall (§9).
 */
export class PgWriteStore {
  constructor(private readonly pool: Pool) {}

  async applyTransaction(
    ops: CrudOp[],
    accountId: string,
    now: Date,
    transactionId: string | number | null = null,
  ): Promise<WriteResult> {
    if (ops.length === 0) return { applied: 0, rejected: [] };

    const plans = await this.runTransaction(ops, accountId, now);
    const rejectedIndex = plans.findIndex((p) => p.kind === "reject");

    if (rejectedIndex === -1) {
      return { applied: ops.length, rejected: [] };
    }

    // At least one op is a permanent rejection: nothing partial landed (the
    // transaction already rolled back), and every op — offending or not — is
    // dead-lettered so the write is durable, attributable, and reportable.
    const rejections: Rejection[] = ops.map((op, i) => {
      const plan = plans[i];
      const reason: RejectionReason =
        plan?.kind === "reject" ? plan.reason : "transaction_rolled_back";
      return { op_index: i, id: idOf(op), type: typeOf(op), reason };
    });
    await this.deadLetter(ops, accountId, rejections, now, transactionId);
    return { applied: 0, rejected: rejections };
  }

  /**
   * Evaluates and (if all pass) applies every op inside one Postgres
   * transaction, then commits — or rolls back if any op is a permanent
   * rejection. The `SELECT ... FOR UPDATE` in evaluation holds the row locks
   * through the apply pass, so an interleaved writer cannot slip between the LWW
   * read and the write. Returns the per-op plans.
   */
  private async runTransaction(ops: CrudOp[], accountId: string, now: Date): Promise<Plan[]> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const plans: Plan[] = [];
      for (const op of ops) {
        plans.push(await this.evaluate(client, op, accountId, now));
      }
      if (plans.some((p) => p.kind === "reject")) {
        await client.query("ROLLBACK");
        return plans;
      }
      for (const plan of plans) {
        if (plan.kind === "write") await upsertTask(client, plan.row);
      }
      await client.query("COMMIT");
      return plans;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err; // transient (e.g. Postgres unreachable) → surfaces as 5xx, client retries
    } finally {
      client.release();
    }
  }

  private async evaluate(
    client: PoolClient,
    op: CrudOp,
    accountId: string,
    now: Date,
  ): Promise<Plan> {
    if (typeof op !== "object" || op === null || !isKnownOpType(op.op)) {
      return { kind: "reject", reason: "malformed_op" };
    }
    if (typeof op.id !== "string" || !isValidId(op.id)) {
      return { kind: "reject", reason: "malformed_op" };
    }
    if (!WRITABLE_TABLES.has(op.type)) {
      return { kind: "reject", reason: "not_writable" };
    }

    const data = (op.data ?? {}) as Record<string, unknown>;

    // Client clocks are trusted for ordering, clamped for damage (§7). A missing
    // or unparseable updated_at is a permanent rejection.
    const parsed = parseInstant(data.updated_at);
    if (parsed === null) return { kind: "reject", reason: "invalid_updated_at" };
    const updatedAt = clampInstant(parsed, now);

    const stored = await loadTask(client, op.id);

    // Membership on the STORED space_id whenever the row exists, so a forged
    // space_id cannot land an op on a row in a Space the caller cannot read (§5).
    if (stored !== null && !(await isMember(client, stored.space_id, accountId))) {
      return { kind: "reject", reason: "not_a_member" };
    }

    if (op.op === "DELETE") {
      if (stored === null) return { kind: "reject", reason: "row_not_found" };
      // A DELETE may carry a space_id; if so it must also be one the caller belongs to.
      const incomingSpace = data.space_id;
      if (typeof incomingSpace === "string" && !(await isMember(client, incomingSpace, accountId))) {
        return { kind: "reject", reason: "not_a_member" };
      }
      const row: TaskRow = {
        id: op.id,
        space_id: stored.space_id,
        title: stored.title,
        status: stored.status,
        order_key: stored.order_key,
        created_at: stored.created_at,
        updated_at: updatedAt,
        deleted_at: updatedAt,
      };
      return lwwPlan(stored, row);
    }

    if (op.op === "PATCH") {
      if (stored === null) return { kind: "reject", reason: "row_not_found" };
      const row = mergePatch(op.id, stored, data, updatedAt);
      const membership = await membershipOk(client, accountId, row.space_id, stored.space_id);
      if (!membership) return { kind: "reject", reason: "not_a_member" };
      const validation = validateTask(row);
      if (!validation.valid) return { kind: "reject", reason: "invalid_task" };
      return lwwPlan(stored, row);
    }

    // PUT — an upsert of the full row the client sends.
    const row = mergePut(op.id, stored, data, updatedAt, now);
    const membership = await membershipOk(client, accountId, row.space_id, stored?.space_id ?? null);
    if (!membership) return { kind: "reject", reason: "not_a_member" };
    const validation = validateTask(row);
    if (!validation.valid) return { kind: "reject", reason: "invalid_task" };
    return lwwPlan(stored, row);
  }

  /**
   * Records rejected ops in a transaction of their own. It cannot share the
   * apply transaction: that one rolled back, and a shared transaction would roll
   * the evidence back with it (§9).
   */
  private async deadLetter(
    ops: CrudOp[],
    accountId: string,
    rejections: Rejection[],
    now: Date,
    transactionId: string | number | null,
  ): Promise<void> {
    const txId = transactionId === null ? null : String(transactionId);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (let i = 0; i < ops.length; i++) {
        const op = ops[i];
        const rejection = rejections[i];
        if (!op || !rejection) continue;
        await client.query(
          `INSERT INTO rejected_writes
             (account_id, op, table_name, row_id, reason, data, transaction_id, rejected_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            accountId,
            typeof op.op === "string" ? op.op : null,
            typeOf(op),
            idOf(op),
            rejection.reason,
            op.data == null ? null : JSON.stringify(op.data),
            txId,
            now,
          ],
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
}

/** Compares the incoming row against the current one by LWW; the loser is a
 * stale no-op that still counts as `applied` (§8). A brand-new row always wins. */
function lwwPlan(stored: TaskRow | null, row: TaskRow): Plan {
  if (stored === null) return { kind: "write", row };
  const current = { updated_at: stored.updated_at, deleted_at: stored.deleted_at };
  const incoming = { updated_at: row.updated_at, deleted_at: row.deleted_at };
  return pickLwwWinner(current, incoming) === incoming ? { kind: "write", row } : { kind: "noop" };
}

function mergePut(
  id: string,
  stored: TaskRow | null,
  data: Record<string, unknown>,
  updatedAt: string,
  now: Date,
): TaskRow {
  return {
    id,
    space_id: asString(data.space_id) ?? "",
    title: asString(data.title) ?? "",
    status: asString(data.status) ?? "open",
    order_key: asStringOrNull(data.order_key),
    created_at: stored?.created_at ?? now,
    updated_at: updatedAt,
    deleted_at: "deleted_at" in data ? parseInstant(data.deleted_at) : null,
  };
}

function mergePatch(
  id: string,
  stored: TaskRow,
  data: Record<string, unknown>,
  updatedAt: string,
): TaskRow {
  return {
    id,
    space_id: "space_id" in data ? asString(data.space_id) ?? "" : stored.space_id,
    title: "title" in data ? asString(data.title) ?? "" : stored.title,
    status: "status" in data ? asString(data.status) ?? "" : stored.status,
    order_key: "order_key" in data ? asStringOrNull(data.order_key) : stored.order_key,
    created_at: stored.created_at,
    updated_at: updatedAt,
    deleted_at: "deleted_at" in data ? parseInstant(data.deleted_at) : stored.deleted_at,
  };
}

async function upsertTask(client: PoolClient, row: TaskRow): Promise<void> {
  await client.query(
    `INSERT INTO tasks
       (id, space_id, title, status, order_key, created_at, updated_at, deleted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       space_id   = EXCLUDED.space_id,
       title      = EXCLUDED.title,
       status     = EXCLUDED.status,
       order_key  = EXCLUDED.order_key,
       updated_at = EXCLUDED.updated_at,
       deleted_at = EXCLUDED.deleted_at`,
    [
      row.id,
      row.space_id,
      row.title,
      row.status,
      row.order_key,
      row.created_at,
      row.updated_at,
      row.deleted_at,
    ],
  );
}

async function loadTask(client: PoolClient, id: string): Promise<TaskRow | null> {
  const { rows } = await client.query(
    `SELECT space_id, title, status, order_key, created_at, updated_at, deleted_at
       FROM tasks WHERE id = $1 FOR UPDATE`,
    [id],
  );
  const row = rows[0] as
    | {
        space_id: string;
        title: string;
        status: string;
        order_key: string | null;
        created_at: Date;
        updated_at: Date;
        deleted_at: Date | null;
      }
    | undefined;
  if (!row) return null;
  return {
    id,
    space_id: row.space_id,
    title: row.title,
    status: row.status,
    order_key: row.order_key,
    created_at: row.created_at,
    updated_at: row.updated_at.toISOString(),
    deleted_at: row.deleted_at ? row.deleted_at.toISOString() : null,
  };
}

async function isMember(
  client: PoolClient,
  spaceId: string,
  accountId: string,
): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT 1 FROM space_members
      WHERE space_id = $1 AND account_id = $2 AND deleted_at IS NULL`,
    [spaceId, accountId],
  );
  return rows.length > 0;
}

/** Membership on the incoming space_id, and — when the row already exists — on
 * the stored one too (§5). */
async function membershipOk(
  client: PoolClient,
  accountId: string,
  incomingSpaceId: string,
  storedSpaceId: string | null,
): Promise<boolean> {
  if (!(await isMember(client, incomingSpaceId, accountId))) return false;
  if (storedSpaceId !== null && storedSpaceId !== incomingSpaceId) {
    return isMember(client, storedSpaceId, accountId);
  }
  return true;
}

/** Parses a client instant to a normalised ISO string, or null if absent/unparseable. */
function parseInstant(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** Clamps an instant more than 5 minutes ahead of server time down to now (§7). */
function clampInstant(iso: string, now: Date): string {
  return Date.parse(iso) > now.getTime() + CLOCK_SKEW_CLAMP_MS ? now.toISOString() : iso;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function idOf(op: CrudOp): string | null {
  return op && typeof op.id === "string" ? op.id : null;
}

function typeOf(op: CrudOp): string | null {
  return op && typeof op.type === "string" ? op.type : null;
}
