/**
 * Last-write-wins merge (ADR-0005 §2, CONTEXT.md → Space). PowerSync imposes no
 * conflict strategy of its own; the app decides which version of a row survives
 * when two Devices edited it. The rule: the later `updated_at` wins. A delete is
 * just a row whose `deleted_at` tombstone is set, carrying its own `updated_at`,
 * so delete-vs-edit falls out of the same comparison — whichever happened later
 * wins.
 *
 * These functions are pure and side-effect-free so the same logic runs on the
 * Device today and in a future server-side merge path (ADR-0004).
 */

/** The minimum a row needs to take part in an LWW decision. */
export interface Versioned {
  /** ISO-8601 wall-clock instant of the write (floating, ADR-0002). */
  updated_at: string;
  /** Tombstone instant, or `null`/absent while the row is alive. */
  deleted_at?: string | null;
}

function isDeleted(row: Versioned): boolean {
  return row.deleted_at != null;
}

/**
 * Decide the winner between two versions of the same row.
 *
 * - Later `updated_at` wins.
 * - On an exact `updated_at` tie, a tombstone beats a live edit (a delete is
 *   not resurrected by a same-instant edit).
 * - On a further tie (same instant, same deleted-state) `incoming` wins:
 *   treating the incoming write as "last" makes the outcome deterministic and
 *   order-independent across Devices reconciling the same pair.
 */
export function pickLwwWinner<T extends Versioned>(current: T, incoming: T): T {
  if (current.updated_at > incoming.updated_at) return current;
  if (incoming.updated_at > current.updated_at) return incoming;
  if (isDeleted(current) && !isDeleted(incoming)) return current;
  if (isDeleted(incoming) && !isDeleted(current)) return incoming;
  return incoming;
}

/**
 * Merge a local row with an incoming one, either of which may be absent
 * (`null` = the row does not exist on that side). If exactly one side has the
 * row it survives; if both do, {@link pickLwwWinner} decides.
 */
export function mergeLww<T extends Versioned>(current: T | null, incoming: T | null): T | null {
  if (current === null) return incoming;
  if (incoming === null) return current;
  return pickLwwWinner(current, incoming);
}
