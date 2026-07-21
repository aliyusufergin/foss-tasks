/**
 * The wire contract for `POST /sync/write` and the vocabulary the write path
 * speaks in. The client (its drain loop lands in #5) POSTs one **device
 * transaction** — the ops PowerSync yields from a single `getNextCrudTransaction()`
 * — and the server applies it as one Postgres transaction (ADR-0008 §3).
 */

/** The only table a client may write. `spaces`/`space_members` are read-only to
 * the CRUD path — a `PUT` on `space_members` is self-service privilege
 * escalation (ADR-0008 §4). */
export const WRITABLE_TABLES: ReadonlySet<string> = new Set(["tasks"]);

/** Largest device transaction accepted; beyond this the endpoint returns 413
 * (retryable, so an oversized batch wedges rather than silently discards). */
export const MAX_OPS_PER_REQUEST = 1000;

/** How far ahead of server `now()` a client `updated_at` may sit before it is
 * clamped, bounding a skewed device clock's blast radius (ADR-0008 §7). */
export const CLOCK_SKEW_CLAMP_MS = 5 * 60 * 1000;

export type CrudOpType = "PUT" | "PATCH" | "DELETE";

/** One CRUD op as it arrives on the wire. `data` carries the changed columns
 * (PowerSync's `opData`); it is absent for a bare `DELETE`. */
export interface CrudOp {
  op: CrudOpType;
  type: string;
  id: string;
  data?: Record<string, unknown> | null;
}

export interface WriteRequest {
  /** Echo of the device transaction id (PowerSync's `CrudTransaction.transactionId`);
   * recorded on dead-lettered ops for traceability. */
  transaction_id?: string | number | null;
  ops: CrudOp[];
}

/**
 * Why an op could never be applied — every one of these is *permanent* (retrying
 * cannot succeed), which is what makes dead-lettering the right move over a 4xx
 * that would wedge the queue forever (ADR-0008 §9). `transaction_rolled_back` is
 * not an op's own fault: it is a valid op that shared a transaction with a
 * rejected sibling and went down with it (§3's atomic unit).
 */
export type RejectionReason =
  | "not_writable"
  | "not_a_member"
  | "row_not_found"
  | "invalid_task"
  | "invalid_updated_at"
  | "malformed_op"
  | "transaction_rolled_back";

export interface Rejection {
  op_index: number;
  id: string | null;
  type: string | null;
  reason: RejectionReason;
}

export interface WriteResult {
  /** Ops accepted, including stale LWW no-ops (§8) — 0 when the whole
   * transaction was rejected. */
  applied: number;
  rejected: Rejection[];
}

const OP_TYPES: ReadonlySet<string> = new Set(["PUT", "PATCH", "DELETE"]);

export type ParseResult =
  | { ok: true; request: WriteRequest }
  | { ok: false; error: "malformed_request" | "too_many_ops" };

/**
 * Shape-checks the request envelope only — that `ops` is an array within the
 * size limit. Per-op validity (writable table, membership, LWW, `validateTask`)
 * is decided later against the database, because a malformed *op* is dead-lettered
 * and returned 200, whereas a malformed *request* is a client bug returned 400.
 */
export function parseWriteRequest(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null) return { ok: false, error: "malformed_request" };
  const { ops, transaction_id } = body as { ops?: unknown; transaction_id?: unknown };
  if (!Array.isArray(ops)) return { ok: false, error: "malformed_request" };
  if (ops.length > MAX_OPS_PER_REQUEST) return { ok: false, error: "too_many_ops" };
  return {
    ok: true,
    request: {
      transaction_id: normaliseTransactionId(transaction_id),
      ops: ops as CrudOp[],
    },
  };
}

function normaliseTransactionId(value: unknown): string | number | null {
  if (typeof value === "string" || typeof value === "number") return value;
  return null;
}

export function isKnownOpType(value: unknown): value is CrudOpType {
  return typeof value === "string" && OP_TYPES.has(value);
}
