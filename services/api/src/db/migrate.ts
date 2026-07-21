import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";

/**
 * Advisory-lock key for the migration runner. A single arbitrary constant: any
 * two API instances booting at once serialise on it, so migrations apply exactly
 * once even across a rolling restart.
 */
const MIGRATION_LOCK_KEY = 4_705_170_801; // "api" boot lock, arbitrary but fixed

/** Where the numbered .sql files live, relative to this compiled module
 * (`dist/db/migrate.js` → `../../migrations`), which resolves the same in the
 * repo and in the Docker image (both keep `migrations/` beside `dist/`). */
const MIGRATIONS_DIR = fileURLToPath(new URL("../../migrations", import.meta.url));

/**
 * Applies pending SQL migrations on boot (ADR-0008 §12). `infra/postgres/init`
 * runs only on a fresh volume, so it cannot deliver schema to an existing
 * database — this runner can.
 *
 * Each migration runs inside its own transaction and is recorded in
 * `schema_migrations`; the whole pass is serialised under a session-level
 * advisory lock so concurrent boots do not race. Re-running is a no-op: already
 * applied files are skipped.
 */
export async function runMigrations(
  pool: Pool,
  log: (message: string) => void = () => {},
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`SELECT pg_advisory_lock($1)`, [MIGRATION_LOCK_KEY]);
    try {
      await client.query(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
           id          text PRIMARY KEY,
           applied_at  timestamptz NOT NULL DEFAULT now()
         )`,
      );

      const { rows } = await client.query<{ id: string }>(`SELECT id FROM schema_migrations`);
      const applied = new Set(rows.map((r) => r.id));

      for (const file of await migrationFiles()) {
        if (applied.has(file)) continue;
        const sql = await readFile(`${MIGRATIONS_DIR}/${file}`, "utf8");
        await client.query("BEGIN");
        try {
          await client.query(sql);
          await client.query(`INSERT INTO schema_migrations (id) VALUES ($1)`, [file]);
          await client.query("COMMIT");
          log(`applied migration ${file}`);
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        }
      }
    } finally {
      await client.query(`SELECT pg_advisory_unlock($1)`, [MIGRATION_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

/** The `.sql` files in lexical order — zero-padded numeric prefixes make lexical
 * order the apply order. */
async function migrationFiles(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries.filter((name) => name.endsWith(".sql")).sort();
}
