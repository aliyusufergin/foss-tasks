import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Migration } from "../../src/data/migrations/migrations.js";
import {
  currentSchemaVersion,
  runMigrations,
  SCHEMA_VERSION_TABLE,
} from "../../src/data/migrations/runner.js";
import type { SqlDatabase } from "../../src/data/migrations/sql.js";
import { TestSqliteDatabase } from "../support/sqlite-db.js";

async function tableExists(db: SqlDatabase, name: string): Promise<boolean> {
  const row = await db.getOptional<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
    [name],
  );
  return row !== null;
}

const createFoo: Migration = {
  version: 1,
  name: "create_foo",
  up: async (db) => {
    await db.execute(`CREATE TABLE foo (id text PRIMARY KEY NOT NULL)`);
  },
};
const createBar: Migration = {
  version: 2,
  name: "create_bar",
  up: async (db) => {
    await db.execute(`CREATE TABLE bar (id text PRIMARY KEY NOT NULL)`);
  },
};

describe("migration runner", () => {
  let db: TestSqliteDatabase;
  beforeEach(() => {
    db = new TestSqliteDatabase();
  });
  afterEach(() => db.close());

  it("applies all migrations on a fresh Device and records the version marker", async () => {
    const result = await runMigrations(db, [createFoo, createBar]);
    expect(result).toEqual({ from: 0, to: 2, applied: ["create_foo", "create_bar"] });
    expect(await currentSchemaVersion(db)).toBe(2);
    expect(await tableExists(db, "foo")).toBe(true);
    expect(await tableExists(db, "bar")).toBe(true);
  });

  it("is idempotent: a second run applies nothing", async () => {
    await runMigrations(db, [createFoo, createBar]);
    const second = await runMigrations(db, [createFoo, createBar]);
    expect(second).toEqual({ from: 2, to: 2, applied: [] });
  });

  it("applies only migrations above the current marker (forward catch-up)", async () => {
    await runMigrations(db, [createFoo]); // Device at v1
    const result = await runMigrations(db, [createFoo, createBar]); // v2 shipped
    expect(result).toEqual({ from: 1, to: 2, applied: ["create_bar"] });
    expect(await currentSchemaVersion(db)).toBe(2);
  });

  it("applies migrations in ascending version order regardless of array order", async () => {
    const result = await runMigrations(db, [createBar, createFoo]);
    expect(result.applied).toEqual(["create_foo", "create_bar"]);
  });

  it("records one marker row per applied migration", async () => {
    await runMigrations(db, [createFoo, createBar]);
    const rows = await db.getAll<{ version: number }>(
      `SELECT version FROM ${SCHEMA_VERSION_TABLE} ORDER BY version`,
    );
    expect(rows.map((r) => r.version)).toEqual([1, 2]);
  });

  it("stamps the marker from the injected clock", async () => {
    const fixed = new Date("2026-07-19T10:00:00.000Z");
    await runMigrations(db, [createFoo], () => fixed);
    const row = await db.getOptional<{ applied_at: string }>(
      `SELECT applied_at FROM ${SCHEMA_VERSION_TABLE} WHERE version = 1`,
    );
    expect(row?.applied_at).toBe("2026-07-19T10:00:00.000Z");
  });

  it("ships the bundled device-local preferences migration", async () => {
    // The default migration set (no arg) creates the device-local store.
    await runMigrations(db);
    expect(await tableExists(db, "local_preferences")).toBe(true);
    expect(await currentSchemaVersion(db)).toBeGreaterThanOrEqual(1);
  });
});
