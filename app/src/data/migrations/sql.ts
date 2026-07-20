/**
 * The narrow port the migration runner and query layer speak to. It is the
 * subset of PowerSync's database API they need, so the same code runs against
 * the on-device PowerSync SQLite at runtime and against a plain SQLite database
 * in the data-layer test harness. Keeping the surface this small is what makes
 * the local data layer a testable seam (ADR-0004 discipline applied to storage).
 */
export interface SqlDatabase {
  /** Run a statement (DDL or write). Any result is ignored by callers. */
  execute(sql: string, params?: unknown[]): Promise<unknown>;
  /** Read all matching rows. */
  getAll<T>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Read one row, or `null` if there is none. */
  getOptional<T>(sql: string, params?: unknown[]): Promise<T | null>;
}
