# Tech-stack research — self-hosted offline-first mobile task app

Date: 2026-07-18
Status: Research only — **feeds a human grilling session**. Nothing here is decided.
Author: research agent

> Scope: mobile-first iOS + Android task app. Requirements: light/dark theme, sub-tasks,
> open-ended / time-range / deadline tasks, recurring tasks, calendar day-picking, AI-assisted
> task creation. Sync is **self-hosted via docker-compose**. Design handled separately.

All claims are cited inline to a primary source (official docs, source repo, spec, or license
text). Where a fact is a secondary/opinion synthesis it is flagged as such.

---

## Executive summary — the three recommendations

1. **Cross-platform framework → React Native + Expo** (lead), with **Flutter** as the strong
   runner-up. Reason: the most mature *local-first sync* ecosystem targets JS/RN first
   (PowerSync `powersync-js`, ElectricSQL TS client), Expo ships first-party background-task and
   SQLite modules, and theming/calendar libraries are well-trodden. Flutter is technically equal
   on storage/background/theming but the self-hostable sync engines treat Dart as a second (still
   supported) target. Kotlin Multiplatform is production-viable but the local-first tooling is
   thinnest and you carry more of the sync layer yourself.

2. **Sync strategy → last-write-wins with per-field timestamps at the row level, uploaded through
   a sync engine that keeps an ordered upload queue** — *not* a document CRDT, unless
   collaborative concurrent editing of the same task becomes a real requirement. For a
   single-user-per-account task app, conflicts are rare and LWW is adequate; a CRDT
   ([Automerge](https://automerge.org/docs/reference/documents/conflicts/)) is the escape hatch if
   real-time multi-device concurrent edits on the *same* field become common. Recommended engine:
   **PowerSync** (Postgres-backed, real offline SQLite on device, self-hostable "Open Edition",
   RN + Flutter + Kotlin SDKs). ElectricSQL is a strong alternative but is **read-path only** — you
   build the write path yourself.

3. **Self-hosted backend → Postgres + PowerSync Service via docker-compose.** Postgres 11+ with
   `wal_level = logical` and a `powersync` publication; PowerSync Service needs a separate bucket
   store (MongoDB **or** Postgres). Watch the **FSL license** on the PowerSync Service (non-compete,
   converts to Apache-2.0 after 2 years) — fine for self-hosting your own app, a constraint only if
   you resell a competing sync product.

**Recurring tasks:** model on **RFC 5545 RRULE** (+ `RECURRENCE-ID` overrides, `EXDATE`
exceptions) rather than a bespoke model — it already encodes the hard cases.
**AI task creation:** natural-language → structured task via **LLM tool-use / JSON-schema
constrained output**; self-hosting-friendly via Ollama/llama.cpp grammar-constrained decoding.

---

## Q1 — Cross-platform framework

Comparing **React Native + Expo**, **Flutter**, **Kotlin Multiplatform (KMP)** on the axes that
matter for a local-first task app.

### React Native + Expo

- **Offline storage:** `expo-sqlite` is the first-party on-device SQLite module, positioned for
  offline-first apps ([Expo SQLite docs / guide](https://docs.expo.dev/versions/latest/sdk/sqlite/)).
  It is also the storage layer PowerSync's RN SDK builds on.
- **Background tasks:** `expo-background-task` (SDK 53+) wraps **WorkManager (Android)** and
  **BGTaskScheduler (iOS)**. Hard constraint: **minimum 15-minute interval and timing is not
  guaranteed** — the OS decides when to run based on battery/network/usage; short intervals on iOS
  are often deferred to system windows
  ([Expo BackgroundTask docs](https://docs.expo.dev/versions/latest/sdk/background-task/)). This is
  a platform limit, not an Expo one — it applies equally to any framework (see Flutter/KMP below).
- **Calendar / date:** `expo-calendar` for device-calendar access
  ([docs](https://docs.expo.dev/versions/latest/sdk/calendar/)); day-picking UI is typically a
  community lib (react-native-calendars etc.) rather than first-party — a minor gap.
- **Theming:** RN exposes `useColorScheme()` and `Appearance` for light/dark; theming is
  library-level (React Navigation themes, etc.), not an enforced design system.
- **Local-first maturity:** strongest of the three. PowerSync's primary SDK is
  [`powersync-js`](https://www.powersync.com/open-source) (React Native, web, Node, Capacitor,
  Tauri) and ElectricSQL's reference client is TypeScript. Most local-first tooling ships JS first.

### Flutter

- **Offline storage:** first-party guidance exists — the official
  [offline-first architecture guide](https://docs.flutter.dev/app-architecture/design-patterns/offline-first)
  — with `drift` (type-safe SQLite) or `sqflite` as the common stores.
- **Background tasks:** `workmanager` plugin schedules persistent background work that survives
  restarts (community plugin over the same WorkManager/BGTaskScheduler OS APIs, so the same
  15-min / best-effort limits apply).
- **Calendar / date:** Material `showDatePicker` / `CalendarDatePicker` are built into the SDK;
  `table_calendar` is the common month-view lib.
- **Theming:** best-in-class here — `MaterialApp` takes explicit `theme` + `darkTheme` and Material 3
  `ColorScheme.fromSeed` gives consistent light/dark from one seed color
  ([Flutter theming / Material 3 docs](https://docs.flutter.dev/cookbook/design/themes)).
- **Local-first maturity:** PowerSync ships a first-class Dart/Flutter SDK
  ([`powersync.dart`, Apache-2.0](https://www.powersync.com/open-source)). Good, but the sync-engine
  ecosystem is JS-first; Dart is a supported second target.

### Kotlin Multiplatform (KMP)

- **Offline storage:** **SQLDelight** is the multiplatform-native typed SQLite wrapper (Android,
  native/iOS, JVM, JS drivers) — the de-facto KMP local store
  ([Kotlin KMP + SQLDelight tutorial](https://kotlinlang.org/docs/multiplatform/multiplatform-ktor-sqldelight.html)).
- **Background tasks:** no unified KMP API — you drop to WorkManager on Android and BGTaskScheduler
  on iOS in platform code (more native code to maintain).
- **Theming / calendar:** with **Compose Multiplatform** (stable for iOS since **May 2025**,
  v1.8.0 per JetBrains) you get shared Compose UI incl. Material theming; date-pickers are Material3
  Compose components. iOS tooling still lags Android but the gap is closing (secondary synthesis).
- **Local-first maturity:** thinnest. PowerSync has a
  [`powersync-kotlin` (Apache-2.0)](https://www.powersync.com/open-source) SDK, but ElectricSQL and
  most other engines have no first-party Kotlin client — you'd build more of the sync glue yourself.

### Recommendation (Q1)

**React Native + Expo** for the richest local-first ecosystem + first-party background/SQLite
modules; **Flutter** a very close second and the better pick if the team prefers Dart or wants the
strongest built-in theming. **KMP** only if native-per-platform UI and a mostly-native team are
priorities and you're willing to own more of the sync layer. *This is a judgment call across the
cited primary facts — the grilling session should pressure-test team skills and the calendar-UI gap.*

---

## Q2 — Offline-first sync strategy

### Conflict semantics for THIS data shape (hierarchical tasks + recurrence)

The data is a **tree** (task → sub-tasks) plus **recurrence metadata** on a task. Two edit
patterns dominate:

- **Structural edits** — add/remove/reorder sub-tasks, re-parent a task. These map to
  *insert/delete on a collection*, which is where naive LWW is weakest (concurrent adds to the same
  parent, or delete-vs-edit races).
- **Field edits** — title, notes, done-flag, deadline, RRULE string. These are *single-scalar*
  updates where LWW-per-field is well-behaved.

Three strategies:

1. **Last-write-wins + timestamps.** Simplest. Each row (or field) carries an updated-at; the later
   timestamp wins. Correct for scalar field edits. Weakness: concurrent structural edits and the
   classic **delete-vs-update** race (one device edits a sub-task while another deletes its parent).
   Acceptable for a **single-user, few-devices** task app where true concurrency is rare.

2. **CRDT (Automerge / Yjs).** Automatic convergence. For nested maps/lists, Automerge merges
   different keys cleanly and, for the *same* key/index, deterministically picks a winner via Lamport
   timestamps + actor IDs while **retaining the losing values in a `conflicts` object** you can
   surface to the user ([Automerge conflicts doc](https://automerge.org/docs/reference/documents/conflicts/);
   [lists doc](https://automerge.org/docs/reference/documents/lists/)). Sub-task lists map naturally
   to a list CRDT; fine-grained ops (push one item) merge far better than replacing a whole array
   (same doc). Cost: larger payloads, a document model that doesn't line up 1:1 with SQL rows, and
   more moving parts than the app arguably needs.

3. **Event log / operation log.** Persist intent ("mark task X done", "add sub-task Y under X") and
   replay in order. Composes with recurrence nicely (an "edit this instance" is just another event)
   and is effectively what an ordered upload queue gives you. More design work than LWW.

**Recurrence-specific conflict note:** editing *one instance* vs *the whole series* is itself a
conflict-shaped decision (see Recurring-tasks section). Whichever sync strategy, "edit this
occurrence" should be modeled as an **override record** (RFC 5545 `RECURRENCE-ID`) rather than a
mutation of the series' RRULE, so two devices editing different occurrences never collide.

**Assessment:** LWW-per-field at the row level, carried over an engine with an **ordered upload
queue**, covers the realistic conflict set for a single-user task app. Reserve CRDT for if/when
concurrent editing of the *same* task by multiple users becomes a product requirement.

### Self-hostable sync engines

| Engine | Backing store | Self-host / docker | License | Client SDKs (RN / Flutter / Kotlin) | Conflict handling |
|---|---|---|---|---|---|
| **PowerSync** | Source-of-truth **Postgres** (also MySQL/Mongo); Service needs a **bucket store: MongoDB or Postgres** | Yes — "Open Edition" self-host, `journeyapps/powersync-service` Docker image + docker-compose demo | **Client SDKs Apache-2.0; Service = FSL** | RN (`powersync-js`), Flutter (`powersync.dart`), Kotlin (`powersync-kotlin`) — all Apache-2.0 | Ordered **upload queue**; client never advances checkpoint while writes pending, so **no client-side conflict resolution**; server-side merge logic is **your responsibility** (not LWW by default) |
| **ElectricSQL** | **Postgres** (reads logical replication into "Shapes" over HTTP) | Yes — Elixir service, `electricsql/electric` Docker image | **Apache-2.0** | TypeScript client (RN via JS); no first-party Flutter/Kotlin | **Read-path only** — no built-in write sync. You pick from 4 write patterns (online writes, optimistic state, shared persistent optimistic, through-the-DB). Docs argue conflicts are rare; "blunt strategies" usually suffice |
| **Convex (self-host)** | **SQLite** by default; can point at **Postgres or MySQL**; S3 for files/exports | Yes — download `docker-compose.yml`, `docker compose up` (backend + dashboard) | **FSL (Apache-2.0 flavor)** — non-compete | Reactive JS/TS client + React Native; no first-party Flutter/Kotlin | Reactive server-function model with optimistic updates; **not** a local-first offline-SQLite engine in the PowerSync sense — offline story is weaker for this use case |
| **Custom sync API** | Whatever you choose (Postgres) | You build it (docker-compose is trivial) | Yours | Yours | Yours — full control, full cost. Typically LWW + timestamps + an ordered change log |

Citations:
- PowerSync store + Service: bucket storage is MongoDB or Postgres
  ([architecture](https://docs.powersync.com/architecture/powersync-service));
  consistency / upload-queue / "developer's responsibility" conflict model
  ([consistency doc](https://docs.powersync.com/architecture/consistency));
  Open Edition self-host + Docker image
  ([Open Edition release](https://www.powersync.com/blog/powersync-open-edition-release),
  [Docker Hub](https://hub.docker.com/r/journeyapps/powersync-service));
  SDKs + licenses ([open source page](https://www.powersync.com/open-source)).
- ElectricSQL: Apache-2.0, Elixir sync service, Shapes over HTTP from logical replication
  ([intro](https://electric-sql.com/docs/intro), [repo](https://github.com/electric-sql/electric),
  [Docker image](https://hub.docker.com/r/electricsql/electric)); read-path only + 4 write patterns
  ([writes guide](https://electric.ax/docs/guides/writes)).
- Convex: self-host via docker-compose, SQLite default / Postgres/MySQL option, S3
  ([self-hosted README](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md));
  FSL Apache-2.0 non-compete ([Convex self-hosting news](https://news.convex.dev/self-hosting/)).
- FSL terms: non-compete, converts to Apache-2.0 / MIT after 2 years per version
  ([fsl.software](https://fsl.software/), [SPDX FSL-1.1-ALv2](https://spdx.org/licenses/FSL-1.1-ALv2.html)).

### Recommendation (Q2)

**PowerSync + LWW/row-level semantics with server-side merge rules.** It gives real on-device
SQLite offline, is Postgres-native, self-hosts under docker-compose, and has SDKs for RN *and*
Flutter *and* Kotlin — the only engine here that covers all three candidate frameworks. The
tradeoff to grill: PowerSync makes you **write the server-side conflict/merge logic yourself**
(it deliberately does not impose LWW), and the **Service is FSL** (fine for self-hosting your own
app). **ElectricSQL** is the pick if you want Apache-2.0 top to bottom and are happy to own the
write path. **Custom API** only if the engines' constraints prove disqualifying — highest control,
highest ongoing cost.

---

## Q3 — Self-hosted backend via docker-compose

What each engine needs to run:

- **PowerSync Service**
  - **Postgres 11+** as source of truth.
  - `wal_level = logical` (via config or `ALTER SYSTEM SET wal_level = logical;` + restart).
  - A publication: `CREATE PUBLICATION powersync FOR ALL TABLES;` (scope to specific tables in prod).
  - DB role with **`REPLICATION`** and **`BYPASSRLS`** plus `SELECT` on replicated tables.
  - A **separate bucket-storage database** for the Service: **MongoDB or Postgres**.
  - Runs as `journeyapps/powersync-service` container; official self-host demo is docker-compose based.
  - Sources: [database setup](https://docs.powersync.com/installation/database-setup),
    [architecture](https://docs.powersync.com/architecture/powersync-service),
    [self-host demo](https://github.com/powersync-ja/self-host-demo).
  - **Gotcha:** Service is **FSL** (non-compete, Apache-2.0 after 2 years). Extra moving part = the
    bucket store alongside Postgres.

- **ElectricSQL**
  - **Postgres with logical replication** (consumes the replication stream via `DATABASE_URL`).
  - Single Elixir container (`electricsql/electric`) exposing HTTP; needs a filesystem + exposed port.
  - **Apache-2.0**, no bucket store, no extra services — the lightest stack.
  - Sources: [deployment guide](https://electric-sql.com/docs/guides/deployment),
    [config](https://electric-sql.com/docs/api/config).
  - **Gotcha:** read-path only, so your docker-compose also needs *your* write API service.

- **Convex self-host**
  - `docker-compose.yml` brings up backend + dashboard; **SQLite by default**, optional
    **Postgres/MySQL**; **S3-compatible** storage for files/exports/snapshots.
  - **FSL (Apache-2.0 flavor)**.
  - Source: [self-hosted README](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md).
  - **Gotcha:** not a local-first offline-SQLite sync engine — weaker fit for the offline requirement.

- **Custom API** — you choose (a plain Postgres + your app container). No license gotchas; all cost
  is engineering time.

**Licensing/cost summary:** ElectricSQL is fully Apache-2.0 and the simplest stack but shifts the
write path to you. PowerSync and Convex are FSL — free to self-host for your own product; the
non-compete only bites if you resell a competing hosted sync service. PowerSync adds an extra
bucket-store service to operate.

---

## Recurring tasks modeling — RRULE (RFC 5545) vs custom

**Recommendation: adopt RFC 5545 recurrence primitives.** The spec already solves the hard cases;
a custom model would re-derive them badly.

- **RRULE** — the recurrence rule grammar (FREQ/INTERVAL/BYDAY/COUNT/UNTIL...), RFC 5545
  §3.3.10 and §3.8.5.3 ([RFC 5545](https://datatracker.ietf.org/doc/html/rfc5545),
  [iCalendar.org 3.3.10](https://icalendar.org/iCalendar-RFC-5545/3-3-10-recurrence-rule.html)).
- **EXDATE** — excludes specific instances from the set; exclusions apply *after* RRULE generation,
  and EXDATE takes precedence over RDATE/RRULE inclusions (RFC 5545 §3.8.5.1).
- **RDATE** — explicit extra dates (§3.8.5.2).
- **RECURRENCE-ID** — identifies one occurrence so it can be **overridden** independently of the
  series (the mechanism for "edit just this instance").

Hard cases and how the model handles them:

- **Edit one instance vs whole series:** whole-series edit = change the master's RRULE; single-instance
  edit = create an **override** keyed by `RECURRENCE-ID` (do not touch the series RRULE). This keeps
  concurrent edits to different occurrences conflict-free.
- **Exceptions / deletions:** deleting one occurrence = add an **EXDATE** (some ecosystems instead
  mark the override CANCELLED — a known Google divergence, secondary note from Nylas guide).
- **Materialization:** decide **expand-on-read** (store only the rule, generate occurrences within a
  visible window) vs **materialize** (persist concrete rows). Expand-on-read keeps storage small and
  edits cheap; materialization simplifies queries but forces you to reconcile overrides/EXDATE. This
  is a key open question below.

Tooling exists on both candidate stacks (e.g. `rrule.js` for JS/RN, `dateutil.rrule` semantics as a
reference — [dateutil rrule](https://dateutil.readthedocs.io/en/stable/rrule.html)).

---

## AI-assisted task creation — natural-language → structured task

**Recommendation:** treat NL→task as **structured output / tool-use**: the LLM returns a JSON object
matching your task schema (title, start/end, deadline, RRULE, sub-tasks), which you validate before
insert. Provider-neutral; keep the schema in one place and validate + retry on parse failure.

- **Cloud LLMs:** all major providers expose JSON-schema / tool-calling structured output; keep the
  prompt→schema contract provider-agnostic so you can swap.
- **Self-hosting-friendly path:** **Ollama** accepts a JSON schema on its `format` parameter and
  converts it to a **GBNF grammar** internally, passed to **llama.cpp**, which masks invalid tokens
  during sampling to *guarantee* schema-valid output
  ([llama.cpp grammar/structured-output](https://deepwiki.com/ggml-org/llama.cpp/8.1-grammar-and-structured-output)).
  Tool/function-calling is "structured output wearing a trench coat" — same mechanism, supported on
  Llama 3.1+, Qwen 2.5+, Mistral, etc.
- **Reliability pattern:** define the schema (e.g. Pydantic/zod), constrain generation, then
  validate + retry — this resolves the large majority of malformed-output issues (secondary synthesis
  from multiple guides above).
- **Recurrence angle:** have the model emit an **RRULE string** directly (it aligns NL like "every
  Tuesday" to the spec) and validate it against an RRULE parser before saving.

Self-hosting note: a local Ollama/llama.cpp container slots into the same docker-compose, keeping the
whole stack self-hosted; a cloud LLM is the low-effort default but breaks the "fully self-hosted"
property.

---

## Open questions to feed the grilling session

1. **Framework:** RN+Expo vs Flutter is close — what decides it? Team skills? The calendar-UI
   first-party gap in RN? Does "AI-assisted" push toward the JS ecosystem's LLM tooling?
2. **Single-user vs collaborative:** is this ever multi-user/shared-list? That single fact flips the
   Q2 answer between LWW and CRDT. If single-user, is CRDT over-engineering?
3. **PowerSync's "you write the merge logic" burden:** are we comfortable owning server-side conflict
   resolution, or does ElectricSQL's read-path-only + our own write API end up simpler/more honest?
4. **FSL acceptable?** Confirm we never intend to resell a competing sync service — otherwise
   PowerSync Service / Convex FSL is a real constraint (Apache-2.0 only after 2 years per version).
5. **Extra operational surface:** PowerSync needs a bucket store (Mongo/Postgres) *plus* Postgres.
   Is that acceptable ops load for a self-hosted, likely small-scale deployment?
6. **Recurrence materialization:** expand-on-read vs materialize-to-rows — which, and how does it
   interact with the chosen sync engine (syncing a rule vs syncing generated rows)?
7. **Instance-override storage:** does the task schema get a clean `RECURRENCE-ID`-style override
   record, and does the sync engine handle those rows without collisions?
8. **Background sync realism:** OS caps background refresh at ~15 min best-effort — is that good
   enough, or do we need foreground/push-triggered sync (and does self-hosting rule out push)?
9. **AI hosting:** local Ollama in the compose stack (fully self-hosted, heavier) vs a cloud LLM
   (breaks the self-hosted property but far less infra) — which wins, and is it user-configurable?
10. **Convex** — is it even a contender given its offline story is weaker than PowerSync/Electric for
    a local-first app, or does its DX justify a second look?

---

*Primary sources are linked inline above. Items flagged "secondary synthesis" draw on multiple
non-primary guides and should be treated as lower-confidence during grilling.*
