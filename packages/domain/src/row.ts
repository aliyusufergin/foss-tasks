/**
 * Base row shapes shared by every syncable table (ADR-0005). Concrete tables
 * (Task, Space, membership) extend these; the columns here are the offline-first
 * foundations every row carries.
 */

/** Every syncable row: client-generated id, Space scope, LWW clock, tombstone. */
export interface SyncableRow {
  /** Client-generated UUID primary key (ADR-0005 §1). */
  id: string;
  /** Owning Space — the unit of sync scope (ADR-0003). */
  space_id: string;
  /** ISO-8601 wall-clock instant of the last write (ADR-0005 §2, LWW). */
  updated_at: string;
  /** Soft-delete tombstone instant, or `null` while alive (ADR-0005 §3). */
  deleted_at: string | null;
}

/** A syncable row that can be manually reordered (ADR-0005 §4). */
export interface OrderableRow extends SyncableRow {
  /** Fractional-index ordering key; sort ascending by string comparison. */
  order_key: string;
}
