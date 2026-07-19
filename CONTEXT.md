# Context — glossary

The ubiquitous language for this project. Glossary only — no implementation detail.

## Terms

### Account
One human user, identified by email + password. An Account signs in on **multiple Devices**
(phone, tablet) that sync to the same self-hosted Server. Every Account owns exactly one
**Personal Space** and may belong to any number of **Group Spaces**.

### Space
The container every Task belongs to — the unit of ownership and sync scope. Two kinds:

- **Personal Space** — private to one Account. Every Account has exactly one.
- **Group Space** — shared by multiple Accounts (e.g. a family), with per-member **roles**:
  `owner` / `admin` / `member` / `viewer` (viewer is read-only).

Sync rules scope data by **Space membership**, not by Account. PowerSync imposes **no** conflict
strategy of its own; we **implement LWW as the server-side merge logic** (later `updatedAt`
wins). Even in Group Spaces this is adequate — concurrent same-field edits by two members are
rare (CRDT remains a future escape hatch if that proves inadequate).

**v1 scope:** the Space concept and schema exist from day one, but only Personal Spaces are
exposed in the UI. Group Space UI (creating groups, inviting members, roles) ships in **v2** —
the data model and sync rules are built to support it now so no migration is needed later.

### Server
One self-hosted deployment (docker-compose). A Server hosts **multiple independent Accounts**
and their Spaces, isolated by Space-membership sync rules. Auth is **minimal**: email + password
issuing a JWT; no OAuth, 2FA, or email-based password reset in v1.

### Device
One installation of the app signed into an Account. Devices hold a full offline copy and
sync with the server. All Devices of an Account see the same data.

### Theme
A named set of **design tokens** (colors, spacing, radius, …) stored as **data**, not code. UI
components read tokens only — **no hardcoded colors**. Tokens use the **W3C DTCG** format. The app
ships built-in **light** and **dark** themes; users can **import a custom theme** as a DTCG JSON
token set (v1, simple import), enabling community theming. The schema is **versioned**
(`themeVersion`) so future tokens can be added without breaking existing themes.

### Design handoff
Visual design is authored in **Claude Design** (Anthropic's web tool: it emits live HTML/CSS
prototypes; a token-JSON export is **not** a confirmed capability). The handoff **contract is the
DTCG token set**; the **transfer medium is Claude Design's exported HTML + a screenshot**. The
implementer derives/updates DTCG tokens from the exported HTML/CSS, then builds the React Native
UI from tokens + the HTML as a layout reference (HTML is a *reference mockup*, never portable
source — RN has no DOM/CSS cascade). Built-in themes are compiled with **Style Dictionary**
(DTCG → RN theme, with build-time Oklch/P3 → RN-safe color conversion); runtime custom-theme
import uses the same DTCG → theme mapping at runtime. See ADR 0006.

The **v1 design is done and committed** under `design/exports/` (theme **"Ink & Signal"**,
`themeVersion` 1, font **IBM Plex Sans**). Canonical token source:
`design/exports/pass-01-system/html/tokens.ink-signal.dtcg.json` (light in `$value`, dark in
`$extensions["app.foss-tasks.modes"].dark`, all sRGB hex — no Oklch/P3 in the actual export).
Per-pass HTML bundles + `layout-notes.md` + light/dark screenshots sit alongside; see
`design/exports/README_cdesign.md` for the folder map and which pass covers which screen.

### Task
The core unit of work. A Task's time is described by **two independent axes**, not a single
"type". Any combination is valid (including none).

- **Schedule** — when you plan to work on it. One of: *none* / *a day* (all-day, no clock
  time) / *a moment* (datetime) / *a range* (start + end datetime).
- **Deadline (`dueAt`)** — an optional "must be done by" point, independent of Schedule. A
  Task can have a Schedule and a Deadline at once ("start Tuesday 09:00, due Friday").

Derived language for common shapes (these are *not* stored types, just how users talk):
*open-ended* = no schedule, no deadline; *deadline task* = deadline only; *scheduled* = has a
schedule.

**Status:** a Task is `open` or `done` (v1 only these two). No *archive* state in v1 — done +
filtering suffices; archive is deferred to v2. Completing a Task records a `completedAt`
timestamp.

### Completion history
Completed Tasks and Occurrences are **retained, never hard-deleted** (deletion is soft-delete /
tombstone, already required by offline sync). This preserves the history that **v1 must keep** so
a **v2 Statistics** UI (counts, streaks, per-Space breakdowns) can be built without backfill.
Statistics UI is v2; the underlying data is retained from v1.

A Task carries a `title`, an optional plain-text `description`, and a `priority`
(none / low / medium / high) in v1. Tasks and sub-tasks support **manual ordering** via a
fractional-index field (see ADR 0005). **Attachments (files, images) are deferred** — they need
blob storage (S3/MinIO) and a separate attachment sync pipeline (built into the PowerSync SDKs;
the old `@powersync/attachments` helper is deprecated), added post-v1 as an isolated feature (no
migration of existing Tasks).

### Dependency (blocked-by) — v2
A Task may depend on other Tasks completing first. Deferred to **v2**, but one rule is fixed now:
dependencies are **only allowed within the same Space** (no cross-Space edges). Modelled as edges
between Tasks with **cycle prevention**; "blocked" is a **derived** state (not stored), true while
any prerequisite is still `open`. Mobile presentation is relationship lists ("Blocked by /
Blocks") + indented outline, not a free node-graph canvas (a full DAG view is an optional
tablet/wide-screen extra). Design handled in Claude design.

### All-day
A Schedule that names a **day but no clock time** ("do this Tuesday"). Distinct from *none*
(no date at all) and from a timed moment. First-class — calendar day-picking produces it.

### Time (floating / wall-clock)
All times are **floating wall-clock** — no timezone is stored. "09:00" means 09:00 wherever the
Device currently is; it does not shift when the user travels. All-day is naturally timezone-free
and consistent with this. See ADR 0002.

### Defer date (available-from)
An optional date before which a Task is hidden/inactive in normal lists. **In scope for v1.**
Distinct from a Schedule start: defer controls *visibility*, schedule controls *when planned*.

### Reminder
A notification tied to a Task, on its **own axis** — independent of Schedule and Deadline. A
Task may have zero or more Reminders (e.g. "2 hours before due"). Drives mobile notifications.

### Sub-task (Checklist item)
A **lightweight** item under a Task: `title` + `done` only. It has **no** Schedule, Deadline,
Reminder, or recurrence of its own — those belong to the Task. Sub-tasks may **nest to
multiple levels** (a checklist item can hold its own child items).

Because only a Task recurs (never a Sub-task), a recurring Task carries its whole Sub-task
tree as a template that is copied per occurrence — no nested/independent recurrence exists.

Open: whether ticking all children auto-completes the parent item — deferred, minor.

### Recurrence (Series / Occurrence / Override)
A Task may repeat. The repeat pattern is stored as an **RFC 5545 RRULE** string (full power —
FREQ/INTERVAL/BYDAY/COUNT/UNTIL — exposed in the v1 UI, not just simple presets).

- **Series** — the Task that owns the RRULE; the recurring definition.
- **Occurrence** — one dated instance generated by the Series' RRULE.
- **Override** — an Occurrence edited on its own, stored as a separate record keyed by RFC 5545
  **`RECURRENCE-ID`**. The Series' RRULE is never mutated for a single-Occurrence edit.
- **Exception (`EXDATE`)** — a deleted/skipped Occurrence, recorded as an EXDATE on the Series.

Completing one Occurrence marks **only that Occurrence** done — stored as an Override
(RECURRENCE-ID with done=true, plus a `completedAt` timestamp); the Series continues and the
next Occurrence still appears.
Ending a Series entirely is a separate action (set the Series RRULE `UNTIL` to now), not a
completion.

Editing a recurring Task offers **three choices** (Google-Calendar style):
- **This occurrence only** → create an Override (RECURRENCE-ID); delete → add EXDATE.
- **This and following** → close the old Series with `UNTIL`, start a new Series.
- **All** → edit the Series RRULE directly.

Because different Occurrences are separate Override records, two Devices editing different
Occurrences never collide.

### Preferences (feature toggles)
User settings. Split by scope:
- **Account-synced** — feature enablement toggles, synced across Devices so the experience is
  consistent. Optional/complexity-adding features (AI capture, voice, description, attachments
  when they exist, and other advanced fields) sit behind toggles; the **core** (title, schedule,
  done, sub-tasks) is always on. **v1 ships at least an AI-capture on/off toggle.**
- **Device-local** — per-Device settings that are not synced (e.g. chosen Theme — phone dark,
  tablet light).

Stored as a simple key-value preferences store; account-synced keys ride PowerSync, device-local
keys stay on the Device. Optional features are UI-gated behind their flag.

### AI task capture
Turning natural language ("dentist next Tuesday 3pm, remind me an hour before") into a Task via
an LLM that returns **structured output** matching the Task schema (title, schedule, `dueAt`,
RRULE, sub-tasks, reminders), which the app validates before insert. The LLM backend is
**configurable**: a cloud LLM is the default; a self-hosted endpoint (Ollama/llama.cpp) can be
configured instead. One schema, swappable backend. **Voice capture** (speech → text → the same
NL→task pipeline) is a **v2** layer on top. AI capture can be toggled off (see Preferences).

### Localization
UI strings go through **i18n** from v1, shipping **Turkish + English**. Adding languages later
is additive; strings are never hardcoded in components.
