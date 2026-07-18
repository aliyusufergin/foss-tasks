# 0005 — Offline-first data foundations (IDs, LWW, tombstones, ordering, migrations)

Date: 2026-07-18
Status: Accepted

## Context

The app is offline-first over PowerSync with LWW conflict resolution across multiple Devices
(and, in v2, multiple Accounts in a Group Space). Several low-level data decisions are cheap to
make now and painful to retrofit once data exists on many Devices. They are grouped here.

## Decision

1. **Client-generated UUIDs.** Every record's primary key is a UUID generated **on the Device**,
   not a server autoincrement — a Device must create records while offline with a stable, final
   id that never changes on sync.

2. **Per-row `updatedAt` for LWW.** Every syncable row carries an `updatedAt`; the later write
   wins on conflict. (Field-level timestamps may be added later for specific hot rows if needed.)

3. **Soft-delete via tombstones.** Deletes are marked, not physically removed, so every Device
   learns of the deletion through sync. This also preserves completion history for future
   Statistics (ADR-adjacent to 0001/completion retention).

4. **Manual ordering via fractional index.** Tasks and sub-tasks that can be manually reordered
   carry a fractional-index / LexoRank-style ordering key, so a single reorder is a single-row
   write — no bulk re-indexing that would thrash sync.

5. **On-device SQLite schema-migration strategy.** Devices will run older schema versions; the
   app ships forward migrations and a version marker from day one, applied on launch/sync.

## Consequences

**Positive**
- Offline record creation, deletion, reordering, and multi-version clients all work without a
  later data migration.
- LWW has the timestamps it needs; deletions and history propagate correctly.

**Negative / costs**
- Every table carries extra columns (UUID pk, `updatedAt`, `deletedAt`/tombstone, ordering key)
  and the app owns a migration runner from v1 — upfront structure before it visibly pays off.
- Tombstones accumulate; a future compaction/GC policy may be needed (noted, not built now).

## Alternatives considered

- **Server autoincrement ids / hard deletes / integer position ordering** — simpler in a purely
  online app, but each breaks or churns under offline multi-Device sync. Rejected.
