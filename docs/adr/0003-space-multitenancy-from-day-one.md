# 0003 — Every Task belongs to a Space; multi-tenancy modelled from day one

Date: 2026-07-18
Status: Accepted

## Context

v1 is single-user (personal tasks only). But shared **Group Spaces** (e.g. a family with roles)
are a wanted v2 feature. Retrofitting a sharing/ownership scope onto a data model that assumed
"every row belongs to one user" is a large, risky migration — it touches every table's ownership
column and the sync rules that isolate data.

The sync engine (PowerSync) scopes what a Device downloads via **sync rules**. Whether those
rules key on Account or on a sharing scope is a foundational decision, hard to change once data
exists on many Devices.

## Decision

Introduce a **Space** as the ownership + sync-scope container. Every Task (and its sub-tasks,
recurrence data, attachments) belongs to exactly one Space. Two kinds: **Personal Space** (one
per Account) and **Group Space** (shared, role-based). PowerSync sync rules key on **Space
membership**, not on Account id.

The schema and sync rules ship in **v1**; only Personal Spaces are surfaced in the v1 UI. Group
Space UI (create/invite/roles) is a **v2** feature that needs no schema migration.

Conflict resolution is **LWW, implemented by us as server-side merge logic** — PowerSync imposes
no strategy of its own (it provides an ordered client upload queue; the merge is the developer's
responsibility). Family-scale concurrent editing of the same field is rare; the later `updatedAt`
wins.

## Consequences

**Positive**
- Adding Group Spaces in v2 is a UI + permissions feature, not a data migration.
- Sync isolation is uniform: one membership-based rule covers personal and shared data.

**Negative / costs**
- Every Task carries a `space_id` and every query/sync rule is Space-scoped from day one, even
  while only Personal Spaces exist — some upfront complexity for a v1 that doesn't yet share.
- LWW can silently drop one of two concurrent same-field edits in a Group Space. Accepted at
  family scale; CRDT is the escape hatch if it proves inadequate.

## Alternatives considered

- **Per-Account isolation now, add sharing later** — simpler v1, but a painful migration of every
  table's ownership model and the sync rules when Group Spaces arrive. Rejected.
- **CRDT from the start** — robust concurrent editing, but heavy for a mostly single-user app and
  a document model that fights the SQL/row shape. Rejected for v1; kept as escape hatch.
