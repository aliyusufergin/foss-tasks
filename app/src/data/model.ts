/**
 * Single source of truth for the on-device table shapes. This module is
 * framework-agnostic data — no React Native / PowerSync imports — so it can be
 * consumed both by the production PowerSync schema (`schema.ts`) and by the
 * data-layer test harness, which materialises the same tables in plain SQLite.
 *
 * The columns mirror the source-of-truth Postgres schema
 * (`infra/postgres/init/01-schema.sql`) plus the offline-first foundations every
 * syncable row carries (ADR-0005): the id is the client-generated UUID pk, and
 * `updated_at` (LWW), `deleted_at` (tombstone), `space_id` (sync scope) and,
 * where rows are reorderable, `order_key` (fractional index) are always present.
 */

export type ColumnType = "text" | "integer" | "real";

export interface ColumnModel {
  name: string;
  type: ColumnType;
}

export interface TableModel {
  name: string;
  /** Columns excluding the `id` primary key, which every table has. */
  columns: ColumnModel[];
  /** Column names to index locally for query performance. */
  indexes?: string[];
}

const SPACE_ID: ColumnModel = { name: "space_id", type: "text" };
const UPDATED_AT: ColumnModel = { name: "updated_at", type: "text" };
const DELETED_AT: ColumnModel = { name: "deleted_at", type: "text" };
const ORDER_KEY: ColumnModel = { name: "order_key", type: "text" };

export const SPACES: TableModel = {
  name: "spaces",
  columns: [
    { name: "name", type: "text" },
    { name: "kind", type: "text" },
    { name: "created_at", type: "text" },
    UPDATED_AT,
    DELETED_AT,
  ],
};

export const SPACE_MEMBERS: TableModel = {
  name: "space_members",
  columns: [
    SPACE_ID,
    { name: "account_id", type: "text" },
    { name: "role", type: "text" },
    { name: "created_at", type: "text" },
    UPDATED_AT,
    DELETED_AT,
  ],
  indexes: ["space_id", "account_id"],
};

export const TASKS: TableModel = {
  name: "tasks",
  columns: [
    SPACE_ID,
    { name: "title", type: "text" },
    { name: "status", type: "text" },
    ORDER_KEY,
    { name: "created_at", type: "text" },
    UPDATED_AT,
    DELETED_AT,
  ],
  indexes: ["space_id"],
};

/** Every synced table, in the order the harness creates them. */
export const SYNCED_TABLES: TableModel[] = [SPACES, SPACE_MEMBERS, TASKS];

/**
 * `CREATE TABLE` for the test harness / any raw-SQLite consumer. PowerSync owns
 * the real synced tables at runtime (built from these models in `schema.ts`);
 * this DDL lets the data-layer integration harness exercise the same shapes.
 */
export function createTableSql(table: TableModel): string {
  const cols = [
    "id text PRIMARY KEY NOT NULL",
    ...table.columns.map((c) => `${c.name} ${c.type}`),
  ];
  return `CREATE TABLE IF NOT EXISTS ${table.name} (${cols.join(", ")})`;
}

/** Index DDL for a table's declared local indexes. */
export function createIndexSql(table: TableModel): string[] {
  return (table.indexes ?? []).map(
    (col) =>
      `CREATE INDEX IF NOT EXISTS ${table.name}_${col}_idx ON ${table.name} (${col})`,
  );
}
