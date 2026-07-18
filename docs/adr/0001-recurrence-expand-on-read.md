# 0001 — Recurrence stored as a rule, expanded on read

Date: 2026-07-18
Status: Accepted

## Context

Tasks can recur. We must decide how recurring Occurrences exist in storage and how they move
across the offline-first sync layer (PowerSync, self-hosted). Two strategies:

- **Expand-on-read** — store only the RRULE (+ Overrides + EXDATE); generate Occurrences on the
  device for the visible window at read time.
- **Materialize** — persist every Occurrence as a concrete row.

Constraints that weigh on the choice:

- Sync is offline-first over PowerSync; sync payload and per-edit write cost matter.
- Series can be open-ended (no COUNT/UNTIL) — materialization has no natural horizon.
- The app is a calendar view: it reads Occurrences for a bounded, visible date window.
- Mobile notifications must be scheduled ahead of time for near-future Occurrences.

## Decision

**Expand-on-read.** Store the RRULE string on the Series, plus separate Override records
(keyed by `RECURRENCE-ID`) and EXDATE exceptions. Occurrences are computed on-device (via an
RRULE library, e.g. `rrule.js`) for the window currently being viewed. Only the rule, Overrides
and EXDATEs sync — never generated Occurrence rows.

For notifications, schedule OS-level local notifications with a **hybrid, budget-managed**
strategy, because **iOS hard-limits an app to 64 pending local notifications** (soonest kept, the
rest silently discarded; Android has no such cap):

1. **Regular recurrence → native repeating triggers.** Series whose RRULE maps to a simple OS
   repeat (e.g. daily/weekly at a fixed time via `UNCalendarNotificationTrigger`) use **one**
   repeating notification each — a single slot covering the infinite future for that Series.
2. **Irregular recurrence + one-off Reminders → concrete scheduling within a budget.** Reserve a
   budget under the cap (target ~50 slots), fill it **soonest-fire-first** across all Tasks.
3. **Top-up on app foreground** (and best-effort background): recompute and reschedule the nearest
   notifications whenever the app opens, so the window rolls forward.
4. A single **slot-budget manager** owns all scheduling under the 64 cap.

This is a scheduling convenience, not persisted materialization. **Accepted edge case:** a user
with many *irregular* Reminders who never opens the app for a long time may miss some far-future
notifications; foreground top-up covers normal use. Server push is deliberately not used (it would
undermine the self-hosted simplicity).

## Consequences

**Positive**
- Small storage and sync payload; a rule edit is a single-row change, not a bulk regeneration.
- Open-ended series are natural — no horizon to pick.
- Editing one Occurrence (Override) and different-Occurrence edits on two Devices never collide.

**Negative / costs**
- Every calendar/list read must run RRULE expansion for the window — CPU on device, and all
  query paths must go through the expansion layer rather than a plain row scan.
- "Cross-cutting" queries (e.g. every Task due today including recurring) cannot be a naive SQL
  scan; they must expand first.
- Notification scheduling needs a slot-budget manager (the 64-cap hybrid above): mapping simple
  RRULEs to native repeating triggers, budgeting concrete ones soonest-first, and topping up on
  foreground/background.

## Alternatives considered

- **Materialize-to-rows** — simpler row-scan queries, but large sync payloads, a forced horizon
  for open-ended series, and full regeneration + reconciliation of future rows on every rule
  edit. Rejected as a poor fit for offline-first sync at this app's scale.
