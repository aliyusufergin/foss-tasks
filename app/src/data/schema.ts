import { column, Schema, Table, type BaseColumnType } from "@powersync/react-native";
import { SYNCED_TABLES, type ColumnType, type TableModel } from "./model.js";

/**
 * The PowerSync client schema — the on-device SQLite tables PowerSync
 * materialises and keeps in sync. It is built from the shared {@link model}, so
 * the synced tables here and the tables the data-layer harness exercises are the
 * same shape by construction (no drift between prod storage and its tests).
 *
 * PowerSync owns the `id` primary key implicitly; every other column comes from
 * the model. This schema does NOT run the forward-migration runner — PowerSync
 * reconciles synced-table schema changes itself. The runner (see
 * `migrations/`) owns device-local tables only (ADR-0005 §5).
 */

const COLUMN: Record<ColumnType, BaseColumnType<string | number | null>> = {
  text: column.text,
  integer: column.integer,
  real: column.real,
};

function toTable(model: TableModel): Table {
  const columns: Record<string, BaseColumnType<string | number | null>> = {};
  for (const c of model.columns) columns[c.name] = COLUMN[c.type];

  const indexes: Record<string, string[]> = {};
  for (const col of model.indexes ?? []) indexes[col] = [col];

  return new Table(columns, Object.keys(indexes).length ? { indexes } : undefined);
}

export const AppSchema = new Schema(
  Object.fromEntries(SYNCED_TABLES.map((t) => [t.name, toTable(t)])),
);

export type Database = (typeof AppSchema)["types"];
