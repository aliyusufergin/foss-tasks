# 0002 — Times are floating wall-clock, no timezone stored

Date: 2026-07-18
Status: Accepted

## Context

Tasks carry times (scheduled moments/ranges, deadlines, reminders) and recurrence. We must
decide how time is stored and interpreted across Devices that may be in different timezones or
travelling. Three options:

- **UTC** — store an absolute instant, render in the Device's local zone.
- **Floating / wall-clock** — store "09:00" with no zone; it means 09:00 in whatever zone the
  Device is currently in.
- **Named timezone (`TZID`, RFC 5545 style)** — store the time plus an explicit zone.

## Decision

**Floating wall-clock.** No timezone is persisted. A time of "09:00" is always 09:00 local to the
Device, and does not shift when the user travels or across DST. All-day (date-only) Schedules are
naturally timezone-free and consistent with this. RRULE expansion runs over floating times.

## Consequences

**Positive**
- "Every morning at 09:00" stays 09:00 everywhere — the intuitive behaviour for a personal task
  app (matches Todoist, Things).
- All-day and timed tasks share one consistent, zone-free model.
- No DST/zone-conversion bugs in recurrence expansion or reminder scheduling.

**Negative / costs**
- Genuinely zone-anchored events (a flight departing 15:00 in a fixed city) are modelled
  incorrectly — they will read as "15:00 wherever you are". Accepted: this is a task app, not a
  travel/calendar app.
- If a future requirement needs true zone anchoring, a per-Task `TZID` would have to be added on
  top — a real but bounded migration.

## Alternatives considered

- **UTC** — correct for absolute instants but makes "every morning 09:00" drift when travelling,
  which feels wrong in a task app. Rejected.
- **Named timezone (TZID)** — most precise, but heavy for a single-user task app and complicates
  every read. Rejected for v1; the escape hatch above remains.
