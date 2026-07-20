import { MIGRATIONS, type Migration } from "./migrations.js";
import type { SqlDatabase } from "./sql.js";

/** Table holding the schema version marker (ADR-0005 §5). */
export const SCHEMA_VERSION_TABLE = "_app_schema_version";

export interface MigrationResult {
  /** Version before the run (0 on a fresh Device). */
  from: number;
  /** Version after the run. */
  to: number;
  /** Names of migrations applied this run, in order. */
  applied: string[];
}

async function ensureVersionTable(db: SqlDatabase): Promise<void> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS ${SCHEMA_VERSION_TABLE} (
       version integer PRIMARY KEY NOT NULL,
       applied_at text NOT NULL
     )`,
  );
}

/** The highest applied migration version, or 0 if none have run. */
export async function currentSchemaVersion(db: SqlDatabase): Promise<number> {
  await ensureVersionTable(db);
  const row = await db.getOptional<{ version: number | null }>(
    `SELECT MAX(version) AS version FROM ${SCHEMA_VERSION_TABLE}`,
  );
  return row?.version ?? 0;
}

/**
 * Apply every migration whose version is above the Device's current marker, in
 * ascending order, recording each in the marker table. Forward-only and
 * idempotent: re-running with no new migrations is a no-op. Runs at launch so a
 * Device that skipped several app versions catches up in one pass.
 */
export async function runMigrations(
  db: SqlDatabase,
  migrations: Migration[] = MIGRATIONS,
  now: () => Date = () => new Date(),
): Promise<MigrationResult> {
  const from = await currentSchemaVersion(db);
  const pending = [...migrations]
    .filter((m) => m.version > from)
    .sort((a, b) => a.version - b.version);

  const applied: string[] = [];
  let to = from;
  for (const migration of pending) {
    await migration.up(db);
    await db.execute(
      `INSERT INTO ${SCHEMA_VERSION_TABLE} (version, applied_at) VALUES (?, ?)`,
      [migration.version, now().toISOString()],
    );
    applied.push(migration.name);
    to = migration.version;
  }

  return { from, to, applied };
}
