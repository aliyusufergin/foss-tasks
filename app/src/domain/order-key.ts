import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";

/**
 * Manual ordering via a fractional index (ADR-0005 §4). Order keys are opaque,
 * lexicographically-sortable strings: a row's position is `ORDER BY order_key`.
 * Inserting or moving a single row mints one new key strictly between its
 * neighbours, so a reorder is a **single-row write** — no bulk re-indexing that
 * would thrash sync.
 *
 * `before`/`after` are the order keys of the neighbours the new row lands
 * between; `null` means "no neighbour on that side" (start or end of the list).
 * The library guarantees `before < result < after` under string comparison.
 */

/** The order key for the first row in an empty list. */
export function firstOrderKey(): string {
  return generateKeyBetween(null, null);
}

/** A key strictly between two neighbours; pass `null` for an open end. */
export function orderKeyBetween(before: string | null, after: string | null): string {
  return generateKeyBetween(before, after);
}

/** A key that sorts after `last` (append to the end). */
export function orderKeyAfter(last: string | null): string {
  return generateKeyBetween(last, null);
}

/** A key that sorts before `first` (prepend to the start). */
export function orderKeyBefore(first: string | null): string {
  return generateKeyBetween(null, first);
}

/** `count` evenly-spaced keys for seeding a list in one shot. */
export function orderKeys(count: number): string[] {
  return generateNKeysBetween(null, null, count);
}
