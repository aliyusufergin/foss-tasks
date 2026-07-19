# Sync-protocol alternatives — why not Google Tasks / CalDAV / EteSync / DAVx5

Date: 2026-07-19
Status: Research only — background for the "why PowerSync, not X?" question. Sync engine is already
decided (PowerSync + Postgres, see ADR 0007); this doc records *why the four commonly-suggested
alternatives were not chosen* as the primary sync mechanism.
Author: research agent

> Scope: evaluate **Google Tasks API**, **CalDAV** (+ iCalendar VTODO), **EteSync/Etebase**, and
> **DAVx5** against THIS app's actual requirements (see `CONTEXT.md`, ADRs 0001/0003/0005/0007):
> offline-first client SQLite, two-axis scheduling (Schedule + Deadline), multi-level sub-tasks,
> full RFC 5545 recurrence with per-occurrence overrides/completion, priority, reminders, defer
> dates, per-row `updatedAt` LWW, soft-delete tombstones, fractional-index manual ordering, and
> **Space multi-tenancy with roles + membership-scoped partial sync**.

All factual claims are cited inline to a primary source (official API reference, RFC, first-party
SDK repo, or license text). Where a claim could not be confirmed from a primary source it is listed
in the **Unverified** section rather than asserted.

---

## Verdict — one line each

| Candidate | What it actually is | Why NOT the primary sync engine |
|---|---|---|
| **Google Tasks API** | Google-cloud-hosted REST task service | **Not self-hostable** (cloud-only, `tasks.googleapis.com`) and the data model is far too thin: `due` is **date-only** (time discarded), **no recurrence, no timed schedule, no priority, no reminders, no second date axis, no custom fields**. Disqualified on both self-hosting and data-model. |
| **CalDAV** (+ VTODO) | An **interop sync *protocol*** over WebDAV/HTTP for iCalendar objects | Best data-model fit of the four (shares our RFC 5545 vocabulary), self-hostable (Radicale/Baïkal), but it is **not an offline-first engine**: no client SQLite, **whole-object ETag conflict** (412 Precondition Failed) not per-field LWW, no partial/streaming sync, **no standard manual-ordering property**, and a weak multi-user/roles/membership-scoped-sync story. Wrong *layer*. |
| **EteSync / Etebase** | An **end-to-end-encrypted** backend-as-a-service (opaque items) | E2EE means **the server cannot read, index, or query item contents** — which structurally forbids server-evaluated per-Space sync rules, server-side recurrence expansion, shared filtered views, and the server-readable data our v2 API/MCP + LWW-merge design depends on. Fundamentally incompatible with our architecture. |
| **DAVx5** | An **Android-only CalDAV/CardDAV *sync-adapter app*** (GPLv3) | Category error: it is a user-facing **app**, not a library/SDK/protocol, and **Android-only**. Nothing to embed in a cross-platform RN/Expo app; only relevant to an end user who separately wants to pull a CalDAV server into Android's system providers. |

**Framing:** these are **interoperability protocols/products for the calendar-and-contacts
ecosystem** (Google Tasks, CalDAV) or **an encrypted generic sync BaaS** (Etebase) — not
**offline-first application sync engines**. PowerSync gives us the things they don't: a real
on-device SQLite store, **partial/streaming sync scoped per-Space by server-evaluated sync rules**,
app-controlled server-side LWW merge, and real-time replication (ADR 0007). Self-hosting alone does
**not** disqualify CalDAV or Etebase — the disqualifier is the **data-model + sync-model mismatch**.

---

## 1 — Google Tasks API

**What it is:** a Google-cloud-hosted REST service at `https://tasks.googleapis.com`
([Tasks REST reference](https://developers.google.com/tasks/reference/rest)). There is **no
self-hosted deployment** — it is a Google product, accessed against Google's endpoint for a
Google-account user. That alone fails our **self-hosted docker-compose** requirement (`CONTEXT.md` →
Server; ADR 0007).

**Data model (the full `Task` resource):** `kind`, `id`, `etag`, `title` (≤1024 chars), `updated`,
`selfLink`, `parent`, `position`, `notes` (≤8192 chars), `status`, `due`, `completed`, `deleted`,
`hidden`, `links[]`, `webViewLink`, `assignmentInfo`
([Tasks resource reference](https://developers.google.com/tasks/reference/rest/v1/tasks)).

Field-by-field against our requirements:

- **`due` is date-only.** The reference states the due date *"only records date information; the
  time portion of the timestamp is discarded when setting the due date."*
  ([Tasks resource ref](https://developers.google.com/tasks/reference/rest/v1/tasks)). So it cannot
  represent a **timed moment**, a **range**, or a **timed deadline** — our Schedule axis (`a moment`
  / `a range`) and timed `dueAt` are unrepresentable.
- **One date field only.** There is no second date axis, so our **Schedule + Deadline** two-axis
  model (`CONTEXT.md` → Task) cannot be expressed at all.
- **No recurrence.** No RRULE / recurrence field exists on the resource — our entire RFC 5545
  Series/Occurrence/Override model (ADR 0001) has nowhere to live.
- **No priority, no reminders, no defer date, no custom fields/metadata.** None of these appear on
  the resource — our `priority`, Reminder axis, and defer date have no home.
- **Sub-tasks:** `parent` gives hierarchy, but Google Tasks limits nesting (single level of
  subtasks in practice) — far short of our **multi-level nesting** (`CONTEXT.md` → Sub-task).
  `position` gives sibling ordering (output-only string).
- **`status`** is only `needsAction` | `completed` — matches our two-state `open`/`done`, the one
  clean fit.
- **Multi-user shared lists:** endpoints operate on *"the authenticated user's specified task
  list"* ([REST overview](https://developers.google.com/tasks/reference/rest)); task lists are
  per-user, not shared with roles. No Space/role/membership concept.

**Offline / rate limits:** it is an online REST API, not an offline-first engine — there is no
client-side store or conflict engine; you'd build all of that yourself against a remote API subject
to Google's per-project usage quotas ([REST overview → "Usage limits"](https://developers.google.com/tasks/reference/rest)).

**Verdict:** disqualified twice over — **cloud-only (not self-hostable)** *and* a **data model too
thin** (date-only due, no recurrence/timed/priority/second-axis) to carry even v1.

---

## 2 — CalDAV (RFC 4791) + iCalendar VTODO (RFC 5545)

**What it is:** CalDAV extends WebDAV/HTTP to access iCalendar data —
*"extensions to the Web Distributed Authoring and Versioning (WebDAV) protocol … a standard way of
accessing, managing, and sharing calendaring and scheduling information based on the iCalendar
format"* ([RFC 4791](https://datatracker.ietf.org/doc/html/rfc4791)). It is a **sync protocol**, and
it is **self-hostable** (Radicale, Baïkal, Nextcloud) — so self-hosting is not the problem here.

**Data-model fit is genuinely the best of the four**, because VTODO uses the *same RFC 5545
vocabulary we already adopted* (ADR 0001). Per the VTODO `todoprop` definition
([RFC 5545 §3.6.2](https://icalendar.org/iCalendar-RFC-5545/3-6-2-to-do-component.html)):

- **`SUMMARY` / `DESCRIPTION`** → our `title` / `description`.
- **`PRIORITY`** → our `priority` (VTODO has a native priority property).
- **`STATUS` + `PERCENT-COMPLETE` + `COMPLETED`** → our `open`/`done` + `completedAt`.
- **`DTSTART` + `DUE`** — *two* date properties. This is the one place another model plausibly maps
  our **Schedule (DTSTART) + Deadline (DUE)** two-axis idea. Constraint: *"'due' and 'duration'
  MUST NOT occur in the same 'todoprop'. If 'duration' appears … then 'dtstart' MUST also appear"*
  ([§3.6.2](https://icalendar.org/iCalendar-RFC-5545/3-6-2-to-do-component.html)) — DTSTART+DUE
  together is legal, so the mapping is representable.
- **`RRULE` + `EXDATE` + `RECURRENCE-ID`** → exactly our Series / Exception / Override recurrence
  model (ADR 0001) — same spec, so recurrence and per-occurrence overrides map cleanly.
- **`RELATED-TO;RELTYPE=PARENT|CHILD`** for hierarchy: RELATED-TO references another component by
  its UID; RELTYPE values are **PARENT** (default — "subordinate of the referenced component"),
  **CHILD**, and **SIBLING**
  ([RFC 5545 §3.8.4.5](https://icalendar.org/iCalendar-RFC-5545/3-8-4-5-related-to.html)). So
  multi-level sub-tasks *and* our v2 dependency edges are expressible in principle — but the spec
  warns *"it is up to the target calendar system to maintain any property implications of this
  relationship"* (i.e. interop of nesting is not guaranteed across servers/clients).

**Where CalDAV fails us — it's the wrong *layer* (a protocol, not an offline engine):**

- **No offline-first client store.** CalDAV is an HTTP access protocol; there is no client SQLite,
  no local query surface, no built-in offline mutation queue. Our whole ADR 0005/0007 foundation
  (on-device SQLite, offline reads/writes, tombstones) would have to be built on top.
- **Whole-object conflict, not per-field LWW.** Each task is a **calendar object resource** carrying
  a strong ETag: *"The DAV:getetag property MUST be defined and set to a strong entity tag on all
  calendar object resources"* ([RFC 4791](https://datatracker.ietf.org/doc/html/rfc4791)). Updates
  are `PUT` with an `If-Match` ETag precondition; a stale ETag yields **HTTP 412 Precondition
  Failed**. Conflict resolution is therefore **whole-resource (the entire iCalendar object)**, not
  the **per-row/per-field `updatedAt` LWW** our merge design relies on (`CONTEXT.md` → Space; ADR
  0003). Two devices editing *different fields* of the same task collide at the object level.
- **No partial/streaming sync scoped to a Space.** CalDAV sync is per-**collection** (a calendar),
  pulled via `calendar-query`/`sync-collection` REPORTs. There is no server-evaluated,
  membership-scoped partial sync like PowerSync sync rules (ADR 0007) — modelling Group-Space roles
  (`owner`/`admin`/`member`/`viewer`, `CONTEXT.md` → Space) and per-member sync scope would be a
  bespoke layer CalDAV does not provide.
- **No standard manual ordering.** RFC 5545 defines no ordering property for VTODO. In practice
  manual sort is a **non-standard extension** — Apple/Nextcloud/Tasks.org use `X-APPLE-SORT-ORDER`
  ([Tasks.org — "implements *My order* using x-apple-sort-order, a non-standard extension to the
  iCalendar protocol"](https://tasks.org/docs/manual_sort_mode/)). Our **fractional-index** manual
  ordering (ADR 0005) has no interoperable home and would not survive round-tripping across
  clients.
- **No real-time.** CalDAV is poll-based (some servers add push extensions, non-universal); no
  streaming replication like PowerSync.
- **RN/Expo client maturity:** there is no widely-adopted, maintained first-party CalDAV *client
  library for React Native/Expo* (see Unverified) — we'd be integrating/​maintaining a protocol
  stack ourselves.

**Verdict:** closest data-model match (it *is* our RFC 5545), and self-hostable — but it is a
**calendar interop protocol, not an offline-first sync engine**. Whole-object ETag conflicts, no
partial per-Space sync, no standard manual ordering, and no client store make it the wrong layer for
the primary engine. (It resurfaces below as a plausible *future interop bridge*.)

---

## 3 — EteSync / Etebase

**What it is:** Etebase (the current EteSync SDK) is *"an end-to-end encrypted backend as a service.
Think Firebase, but encrypted in a way that only your users can access their data"*
([docs.etebase.com](https://docs.etebase.com/)). It is self-hostable (open-source server + clients)
— so, again, self-hosting is not the disqualifier.

**Data model:** opaque encrypted **Items** grouped in **Collections**; content is encrypted
client-side before upload so the server stores only ciphertext. The JS/TS SDK repo confirms platform
reach — the `etebase` package supports *"the web, node and react-native"*
([etesync/etebase-js](https://github.com/etesync/etebase-js)) — so an RN client *does* exist. The
defining property is server-blindness: *"encrypted in a way that only your users can access their
data"* / *"only your users can access their data"* ([docs.etebase.com](https://docs.etebase.com/)).

**Why E2EE structurally conflicts with our architecture:** because **the server cannot read, index,
or query item contents**, every capability our design places *on the server* becomes impossible:

- **No server-evaluated per-Space sync rules.** Membership-scoped **partial sync** (ADR 0003/0007)
  requires the server to read each row's Space and each user's membership/role to decide what to
  send. An E2EE server cannot read the Space field, so it cannot scope sync by it. (Etebase scopes
  by Collection ACLs, not by server-side queries over row contents.)
- **No server-side recurrence expansion / queries / shared filtered views.** Anything that needs the
  server to understand task fields (expand RRULE, filter by due date, build a shared Group-Space
  view) is off the table when the server sees only ciphertext.
- **Breaks our LWW merge model.** ADR 0003 / `CONTEXT.md` implement **server-side LWW** by comparing
  `updatedAt` across writers — the server must read the field to merge. E2EE hides it.
- **Blocks the v2 server-readable surface.** AI task capture today runs client-side, but our roadmap
  (server-side API, MCP, v2 Statistics that aggregates completion history — `CONTEXT.md` →
  Completion history) all assume **server-readable data**. E2EE forecloses that direction.

**Verdict:** a good design for a zero-knowledge notes/calendar app, but its core guarantee
(server-blindness) is **mutually exclusive** with our PowerSync-style server-evaluated,
Postgres-queryable, membership-scoped model. Not a candidate.

---

## 4 — DAVx5

**What it is:** DAVx5 (`davx5-ose`) is *an Android application* — a **CalDAV/CardDAV
synchronization suite / sync adapter** for Android's native contacts, calendar, and tasks providers,
**Android-only**, licensed **GPLv3**
([bitfireAT/davx5-ose](https://github.com/bitfireAT/davx5-ose)). It is a user-facing app, **not a
library or SDK** you embed, **not iOS**, and **not a protocol**.

**Why "use DAVx5" is a category error for this app:** we are building a **cross-platform RN/Expo**
app. DAVx5 is:
- **An app, not an SDK** — there is nothing to import; it runs as a separate Android process syncing
  a CalDAV server into Android's system content providers.
- **Android-only** — no iOS, so it can't be part of a cross-platform sync story even in principle.
- **GPLv3** — a copyleft app license; irrelevant to us as a dependency because it isn't one.

The only sense in which DAVx5 is relevant: **if** we ever expose a CalDAV endpoint (see §5), an
end user could *separately* install DAVx5 to pull that endpoint into their Android calendar/tasks —
that is an end-user interop convenience, not an architectural choice we make. It is not, and cannot
be, our sync engine.

**Verdict:** not a sync engine or library for us at all; only meaningful downstream of a hypothetical
CalDAV interop endpoint, and only for Android users.

---

## 5 — Could any be a future interop option? (honest, not a commitment)

- **CalDAV read-only / one-way publish (plausible v2 interop, NOT a commitment).** Because our
  recurrence model *already is* RFC 5545 (ADR 0001) and VTODO natively carries
  SUMMARY/DESCRIPTION/DTSTART/DUE/PRIORITY/STATUS/RRULE/EXDATE/RECURRENCE-ID/RELATED-TO
  ([§3.6.2](https://icalendar.org/iCalendar-RFC-5545/3-6-2-to-do-component.html)), we could later
  **export or one-way-publish** a Space's tasks as a read-only CalDAV/VTODO collection (an `.ics`
  feed or a small read CalDAV surface). That lets users subscribe from Apple Reminders / Thunderbird
  / DAVx5-on-Android **without** adopting CalDAV as our engine. Caveats to flag honestly:
  manual **fractional ordering won't round-trip** (only the non-standard `X-APPLE-SORT-ORDER`
  approximates it — [Tasks.org](https://tasks.org/docs/manual_sort_mode/)); sub-task nesting interop
  via RELATED-TO is *"up to the target calendar system"*
  ([§3.8.4.5](https://icalendar.org/iCalendar-RFC-5545/3-8-4-5-related-to.html)); and two-way sync
  would reintroduce the whole-object 412 conflict problem. So: **read-only / one-way is a plausible
  future feature; full two-way CalDAV sync is not.** Treat this as a *possible* v2, not a plan.
- **Google Tasks:** not viable even as export — its model can't even represent our fields (no
  recurrence, date-only due). At most a lossy one-way *push* of title+date; not worth it.
- **Etebase:** irrelevant as interop — it's a private encrypted store, not an interchange format.
- **DAVx5:** only ever relevant *downstream of* a CalDAV endpoint (above), as an Android end-user
  client — never something we integrate.

---

## Unverified / couldn't confirm from a primary source

- **RN/Expo CalDAV client library maturity.** I did not locate a widely-adopted, actively-maintained
  first-party CalDAV *client* library for React Native/Expo. Claim in §2 ("no mature RN CalDAV
  client") is an **absence-of-evidence** observation, not a positively-cited fact — verify with a
  targeted npm/registry survey before relying on it.
- **Google Tasks exact rate-limit numbers.** The REST overview references a "Usage limits" section
  but the concrete per-project quota numbers were not fetched
  ([REST overview](https://developers.google.com/tasks/reference/rest)). Confirm on the Usage-limits
  page if specific numbers are needed.
- **Google Tasks sub-task depth limit.** The `parent` field gives hierarchy; the practical
  single-level-subtask limit is well-known behaviour but was **not** confirmed from the resource
  reference here — treat the "single level" claim as needing confirmation.
- **Etebase Collection/Item schema specifics** (exact `meta`/`content` shape, ACL/sharing model
  granularity). Confirmed platform support (web/node/react-native) and the E2EE/server-blind
  property from primary sources; the detailed data-model schema was on a docs page that 404'd during
  research — verify against `docs.etebase.com` guides if depth is needed.
- **DAVx5 exact feature-list wording / current license file.** License (GPLv3) and Android-only
  sync-adapter nature confirmed from the repo README summary
  ([davx5-ose](https://github.com/bitfireAT/davx5-ose)); exact LICENSE-file SPDX text not
  independently opened.
- **CalDAV `sync-collection` (RFC 6578) specifics.** §2 describes CalDAV change detection via
  ETags + `calendar-query` REPORT from RFC 4791; the incremental `sync-collection` REPORT is defined
  in **RFC 6578** (WebDAV Sync), which was not separately fetched. The whole-object-ETag conflict
  conclusion stands regardless of which REPORT is used.

---

*Primary sources are linked inline. This document explains a decision already made in ADR 0007
(PowerSync + Postgres); it does not reopen it.*
