import { createRequire } from "node:module";
import { createIndexSql, createTableSql, SYNCED_TABLES } from "../../src/data/model";
import type { SqlDatabase } from "../../src/data/migrations/sql";

// Loaded via createRequire so the test bundler doesn't try to transform this
// newer built-in (Vite's module list predates `node:sqlite`).
const { DatabaseSync } = createRequire(import.meta.url)(
  "node:sqlite",
) as typeof import("node:sqlite");

/**
 * Test double for the on-device store: a real SQLite database (Node's built-in
 * `node:sqlite`) behind the same {@link SqlDatabase} port the app uses against
 * PowerSync. This is what makes the data-layer harness an *integration* test —
 * migrations, tombstone filtering and ordering run against genuine SQLite, not a
 * mock — while staying free of the native RN driver so it runs in CI.
 */
export class TestSqliteDatabase implements SqlDatabase {
  private readonly db = new DatabaseSync(":memory:");

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    this.db.prepare(sql).run(...(params as never[]));
  }

  async getAll<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...(params as never[])) as T[];
  }

  async getOptional<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const row = this.db.prepare(sql).get(...(params as never[]));
    return (row as T | undefined) ?? null;
  }

  close(): void {
    this.db.close();
  }
}

/** Create the synced tables (from the shared model) so queries can be exercised. */
export async function createSyncedTables(db: SqlDatabase): Promise<void> {
  for (const table of SYNCED_TABLES) {
    await db.execute(createTableSql(table));
    for (const indexSql of createIndexSql(table)) {
      await db.execute(indexSql);
    }
  }
}
