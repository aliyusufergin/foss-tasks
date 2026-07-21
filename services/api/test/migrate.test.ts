import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../src/db/migrate.js";
import { createTestDb } from "./support/pglite-pool.js";
import type { TestDb } from "./support/pglite-pool.js";

let db: TestDb;

beforeEach(async () => {
  // migrate:false → base schema only, as a pre-existing database would look.
  db = await createTestDb({ migrate: false });
});

afterEach(async () => {
  await db.close();
});

async function tableExists(name: string): Promise<boolean> {
  const { rows } = await db.pool.query(`SELECT to_regclass($1) AS reg`, [`public.${name}`]);
  return (rows[0] as { reg: string | null }).reg !== null;
}

describe("runMigrations", () => {
  it("applies rejected_writes to a pre-existing database", async () => {
    expect(await tableExists("rejected_writes")).toBe(false);
    await runMigrations(db.pool);
    expect(await tableExists("rejected_writes")).toBe(true);
  });

  it("records applied migrations and is a no-op on a second boot", async () => {
    await runMigrations(db.pool);
    const first = await db.pool.query(`SELECT id FROM schema_migrations ORDER BY id`);
    expect(first.rows).toHaveLength(1);

    // Second run must not error and must not re-apply (a re-run of CREATE TABLE
    // would throw "already exists" if the runner failed to skip it).
    await runMigrations(db.pool);
    const second = await db.pool.query(`SELECT id FROM schema_migrations ORDER BY id`);
    expect(second.rows).toEqual(first.rows);
  });

  it("leaves rejected_writes out of the powersync publication", async () => {
    // Mirror infra/postgres/init/02-powersync.sh: the publication is declared
    // for the syncable tables only.
    await db.pool.query(
      `CREATE PUBLICATION powersync FOR TABLE spaces, space_members, tasks`,
    );
    await runMigrations(db.pool);

    const { rows } = await db.pool.query(
      `SELECT tablename FROM pg_publication_tables WHERE pubname = 'powersync'`,
    );
    const tables = rows.map((r) => (r as { tablename: string }).tablename);
    expect(tables).not.toContain("rejected_writes");
    expect(tables.sort()).toEqual(["space_members", "spaces", "tasks"]);
  });
});
