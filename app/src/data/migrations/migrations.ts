import type { SqlDatabase } from "./sql.js";

/**
 * One forward-only, on-device schema migration (ADR-0005 §5). Migrations run in
 * ascending `version` order at launch and are never edited once shipped — a
 * Device on an old version catches up by applying every version above its
 * marker. To change the local schema, append a new migration; never mutate an
 * existing one.
 *
 * These migrations own the **device-local** schema — tables that do not sync
 * (PowerSync manages the synced tables itself from the app Schema). The first
 * one is the device-local Preferences store (CONTEXT.md → Preferences: the
 * chosen Theme and other per-Device settings stay on the Device).
 */
export interface Migration {
  version: number;
  name: string;
  up: (db: SqlDatabase) => Promise<void>;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "device_local_preferences",
    up: async (db) => {
      await db.execute(
        `CREATE TABLE IF NOT EXISTS local_preferences (
           key text PRIMARY KEY NOT NULL,
           value text,
           updated_at text NOT NULL
         )`,
      );
    },
  },
];
