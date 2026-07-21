import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { Pool } from "pg";
import { runMigrations } from "../../src/db/migrate.js";

/**
 * A `pg.Pool`-shaped adapter over PGlite — a real Postgres engine compiled to
 * WASM, running in-process. The write path exercises genuine Postgres semantics
 * (transactions, `FOR UPDATE`, `ON CONFLICT`, `jsonb`, advisory locks) without a
 * container, so the same tests run locally and in CI where no Docker daemon or
 * Postgres service exists (ADR-0008 asks for a real Postgres; this is one).
 *
 * PGlite is single-session, which is fine: the store awaits every query
 * sequentially and never needs two live connections at once. `query()` with
 * bound params uses the extended protocol; a param-less call may be a
 * multi-statement string (a migration file, `BEGIN`/`COMMIT`), so it routes to
 * `exec()` and returns the last statement's rows.
 */
class PgliteClient {
  constructor(private readonly db: PGlite) {}

  async query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }> {
    if (params !== undefined) {
      return this.db.query(text, params);
    }
    const results = await this.db.exec(text);
    const last = results[results.length - 1];
    return { rows: last?.rows ?? [] };
  }

  release(): void {
    // Single shared session — nothing to return to a pool.
  }
}

class PglitePool {
  constructor(private readonly db: PGlite) {}

  async connect(): Promise<PgliteClient> {
    return new PgliteClient(this.db);
  }

  async query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }> {
    return new PgliteClient(this.db).query(text, params);
  }

  async end(): Promise<void> {
    await this.db.close();
  }
}

const BASE_SCHEMA = fileURLToPath(
  new URL("../../../../infra/postgres/init/01-schema.sql", import.meta.url),
);

export interface TestDb {
  /** Cast to `pg.Pool` for the store and route under test. */
  pool: Pool;
  /** Raw handle for seeding and assertions in tests. */
  raw: PGlite;
  close(): Promise<void>;
}

/**
 * Spins up a fresh in-memory database with the source-of-truth base schema
 * (`infra/postgres/init/01-schema.sql`) already applied. By default it then runs
 * the migration runner, so `rejected_writes` exists; pass `migrate: false` to
 * test the runner itself against a pre-existing database.
 */
export async function createTestDb(opts: { migrate?: boolean } = {}): Promise<TestDb> {
  const db = new PGlite();
  await db.exec(await readFile(BASE_SCHEMA, "utf8"));
  const pool = new PglitePool(db) as unknown as Pool;
  if (opts.migrate !== false) await runMigrations(pool);
  return {
    pool,
    raw: db,
    close: () => db.close(),
  };
}
