import type { SqlDatabase } from "./migrations/sql.js";

/**
 * The local data-layer read/write seam (ADR-0004 discipline applied to storage).
 * Every function speaks the {@link SqlDatabase} port, so the same code runs
 * against PowerSync's SQLite on-device and against plain SQLite in the harness.
 *
 * The invariant enforced here is the offline-first one from ADR-0005: reads
 * never surface tombstoned rows (`deleted_at IS NULL`), a delete is a soft
 * update, and ordering is by the fractional-index `order_key`.
 */

export interface TaskRow {
  id: string;
  space_id: string;
  title: string;
  status: string;
  order_key: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** A locally-created Task: every column except the tombstone, which starts unset. */
export type NewTask = Omit<TaskRow, "deleted_at">;

/**
 * The live-Tasks-in-a-Space query: tombstones hidden, manual order. Shared so
 * the data layer and any live `useQuery` on-screen enforce the same invariant
 * (ADR-0005) rather than drifting apart.
 */
export const ACTIVE_TASKS_SQL =
  `SELECT * FROM tasks WHERE space_id = ? AND deleted_at IS NULL ORDER BY order_key ASC`;

/** Insert a locally-created Task (client-generated id, ADR-0005 §1). */
export async function insertTask(db: SqlDatabase, task: NewTask): Promise<void> {
  await db.execute(
    `INSERT INTO tasks (id, space_id, title, status, order_key, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      task.id,
      task.space_id,
      task.title,
      task.status,
      task.order_key,
      task.created_at,
      task.updated_at,
    ],
  );
}

/**
 * Soft-delete a Task (ADR-0005 §3): set the tombstone and bump `updated_at` so
 * the delete carries an LWW clock. The row is retained (completion history) and
 * the deletion propagates through sync.
 */
export async function softDeleteTask(
  db: SqlDatabase,
  id: string,
  deletedAt: string,
): Promise<void> {
  await db.execute(`UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?`, [
    deletedAt,
    deletedAt,
    id,
  ]);
}

/** Reorder a Task by rewriting only its fractional-index key (ADR-0005 §4). */
export async function moveTask(
  db: SqlDatabase,
  id: string,
  orderKey: string,
  updatedAt: string,
): Promise<void> {
  await db.execute(`UPDATE tasks SET order_key = ?, updated_at = ? WHERE id = ?`, [
    orderKey,
    updatedAt,
    id,
  ]);
}

/** Live Tasks in a Space, tombstones hidden, in manual order. */
export async function listActiveTasks(db: SqlDatabase, spaceId: string): Promise<TaskRow[]> {
  return db.getAll<TaskRow>(ACTIVE_TASKS_SQL, [spaceId]);
}
