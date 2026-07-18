# Decision verification — fact-check of architecture claims

Date: 2026-07-18
Status: Verification report — fact-checks the factual claims underlying CONTEXT.md, ADR 0001–0006,
and the two research docs against **primary sources**. Design opinions are not re-argued; only the
facts the decisions rest on are checked.
Author: verification agent

Verdict key: **CONFIRMED** (primary source agrees) / **REFUTED** (primary source contradicts, with
what's actually true) / **UNVERIFIED** (no primary source found).

---

## Executive summary — re-grill candidates

No claim came back **fully REFUTED**. Three came back qualified or UNVERIFIED, and one CONFIRMED
fact directly threatens an accepted decision. In priority order:

1. **[HIGH — threatens ADR-0001] iOS 64-notification cap is REAL and CONFIRMED.** Apple hard-limits
   an app to **64 pending local notifications** (soonest-firing kept, the rest discarded). ADR-0001's
   plan to "expand a **30–60 day** window of recurring Occurrences and schedule OS notifications"
   will **blow past 64** for any user with a handful of daily/near-daily recurring Tasks, each with
   one or more Reminders. The fact is confirmed; the **design consequence needs re-grilling** — the
   notification-scheduling strategy (rolling/prioritized window, cap-aware budgeting) must be
   redesigned, not just "expand 30–60 days." Android has **no equivalent 64 cap**, so this is
   iOS-specific.

2. **[MEDIUM — qualifies ADR/tech-stack Q3] PowerSync Postgres bucket storage is BETA, not GA.**
   Postgres-as-bucket-store is supported and "on par with MongoDB," but PowerSync labels it **Beta**
   ("production-ready *provided you've adequately tested your use case*"). The **MongoDB** connector
   is the GA/battle-tested path. The "avoid running Mongo" decision is viable but rides a
   Beta-tier feature — worth an explicit acceptance.

3. **[MEDIUM — implementation obligation, mildly overstated in CONTEXT/ADR-0003] PowerSync does NOT
   give LWW for free.** CONTEXT ("conflict resolution stays LWW") and ADR-0003 read as if LWW is a
   property PowerSync provides. It is not: PowerSync imposes **no** conflict strategy — the
   **server-side merge logic is the developer's responsibility**. LWW is a thing *we must implement*
   on the Postgres write side. Not a refutation, but the docs should not treat LWW as automatic.

4. **[LOW — outdated package name, claim 12] `@powersync/attachments` is DEPRECATED.** The official
   attachment capability still exists and works with any S3-compatible store (MinIO) — but it is now
   **built into the platform SDKs** (`@powersync/react-native`), and the standalone
   `@powersync/attachments` package is deprecated. Attachments are deferred post-v1, so low impact;
   just don't reference the old package name.

5. **[LOW — unchanged, claim 17] Claude Design machine-readable token export remains UNVERIFIED by a
   primary Anthropic source.** ADR-0006's cautious stance is still correct: Anthropic's own page only
   says the handoff "packages everything into a handoff bundle" — no primary confirmation of a
   DTCG/JSON token file. Secondary blogs/VentureBeat claim June-2026 token/code-integration updates,
   but no first-party doc confirms a token export. Keep depending on manual extraction.

6. **[LOW — staleness note, claim 4] Restyle is maintained but aging.** Not deprecated, not archived,
   no warning — but last release `v2.4.5` is **March 2025** (~16 months old), last substantive commit
   Aug 2025. ADR-0006's "less actively developed" is accurate; keep the Unistyles v3 escape hatch warm.

Everything else (claims 3, 5, 6, 7[mechanism], 8, 9, 10, 11, 13, 14, 15, 16) is **CONFIRMED** against
primary sources.

---

## HIGH RISK

### 1. iOS local-notification cap (~64 pending) — **CONFIRMED**

- Apple engineer, Apple Developer Forums: *"there is a limit of 64 for how many simultaneous
  notification requests can be active/pending at one time per app. This is a system limit and there
  is no way around it."* — https://developer.apple.com/forums/thread/811171
- Apple docs, "Scheduling a notification locally from your app": *the system keeps the
  **soonest-firing 64 notifications** (automatically-rescheduled ones counting as one) and discards
  the rest* — https://developer.apple.com/documentation/usernotifications/scheduling-a-notification-locally-from-your-app
- The limit is an **OS limit surfaced through `expo-notifications` / `UNUserNotificationCenter`**; the
  Expo Notifications doc itself does **not** document the number (it's Apple's cap, not Expo's) —
  https://docs.expo.dev/versions/latest/sdk/notifications/
- **Android:** no equivalent 64-pending hard cap; Android schedules via AlarmManager/notification
  channels and does not impose the iOS 64 ceiling (its constraints are exact-alarm permissions and
  Doze batching, a different problem shape).

**Impact:** ADR-0001's "expand a 30–60 day window of recurring occurrences and schedule local
notifications" is not safe on iOS as written. A 30–60 day window across several recurring Tasks (plus
multiple Reminders per Task, each a separate `UNNotificationRequest`) will exceed 64 and silently drop
the furthest-out ones. **Re-grill the scheduling strategy** (shrink the window / prioritize soonest N
/ re-arm on app-open + background-task) — see claim 14 for the background-refresh limits that
constrain re-arming.

### 2. PowerSync bucket store = Postgres — **CONFIRMED (Beta, not GA)**

- PowerSync Service supports a **pluggable bucket-storage layer; MongoDB and Postgres are both
  supported** — https://docs.powersync.com/architecture/powersync-service
- Postgres bucket storage was introduced in Service image v1.3.8 and is **Beta**, defined as
  "production-ready, provided you've adequately tested your use case," with **functionality on par with
  MongoDB** — https://releases.powersync.com/announcements/introducing-postgres-for-sync-bucket-storage
- The MongoDB connector/storage path is the GA, most battle-tested option.

**Impact:** the "Postgres bucket store to avoid running Mongo" choice (tech-stack Q3) is real and
supported, but is a **Beta** feature vs GA MongoDB. Accept explicitly; test the self-host path.

### 3. Sync rules scope by group/space membership — **CONFIRMED**

- PowerSync **parameter queries** can `SELECT` from a many-to-many membership/join table, e.g.
  `SELECT list_id FROM user_lists WHERE user_lists.user_id = request.user_id()`, and a parameter query
  may **return multiple rows → multiple bucket-parameter sets per user** — exactly the "sync rows where
  the connected user is a member of the row's Space" pattern, not just `user_id = token.sub` —
  https://docs.powersync.com/usage/sync-rules/parameter-queries

**Impact:** ADR-0003's "sync rules key on Space membership" is expressible in PowerSync today. Sound.

### 4. Restyle maintenance/status — **CONFIRMED (maintained but stale; not deprecated)**

- Repo not archived; README carries **no deprecation notice**. Latest release **v2.4.5, 2025-03-19**;
  most recent substantive commit **2025-08-28**; 37 open issues (GitHub API, `Shopify/restyle`).
- Repo/docs: https://github.com/Shopify/restyle • https://shopify.github.io/restyle/

**Impact:** ADR-0006's "less actively developed" is accurate — the last release is ~16 months old as
of this report. Not a re-decision forcer. Primary token-first alternative is **Unistyles v3**
(already named as the escape hatch): https://www.unistyl.es/

### 5. rrule.js and RECURRENCE-ID overrides — **CONFIRMED (library expands + EXDATE/RDATE only; no
per-occurrence overrides)**

- rrule.js `RRuleSet` supports **RRULE expansion, `rdate()` (extra dates), `exdate()` (exclusions),
  and `exrule()`** — but has **no RECURRENCE-ID / per-occurrence property override** mechanism. It
  includes/excludes whole dates; it does not model an edited single occurrence —
  https://github.com/jkbrzt/rrule
- RFC 5545 `RECURRENCE-ID` is the override primitive —
  https://datatracker.ietf.org/doc/html/rfc5545

**Impact:** matches CONTEXT/ADR-0001's design exactly — the app stores Overrides as **separate
records keyed by RECURRENCE-ID** and only uses the library to expand RRULE + apply EXDATE. The
override/merge layer is **app-owned by design**, and the docs already assume this. Correctly scoped.

---

## MEDIUM

### 6. PowerSync + Expo RN SDK — **CONFIRMED**

- `@powersync/react-native` works under Expo but the native SQLite adapters (**OP-SQLite**,
  **React Native Quick SQLite**) are **not compatible with Expo Go** → requires a **custom Expo dev
  client**. OP-SQLite is the recommended driver (SQLCipher encryption, New Architecture). Expo Go
  falls back to a JS/wasm adapter —
  https://docs.powersync.com/client-sdk-references/react-native-and-expo

### 7. PowerSync conflict model — **CONFIRMED (no imposed LWW; ordered upload queue)**

- *"With PowerSync offering full flexibility in how mutations are applied on the server, it is also
  the developer's responsibility to implement this correctly."* Client uses a **blocking FIFO upload
  queue**; *"while mutations are present in the upload queue, the client does not advance to a new
  checkpoint."* — https://docs.powersync.com/architecture/consistency

**Impact:** confirms the mechanism, and confirms LWW is **our** responsibility to implement
server-side — see re-grill item 3.

### 8. PowerSync licenses — **CONFIRMED**

- Client SDKs + client-side packages: **Apache 2.0 (& MIT)**. Server-side Service + CLI: **Functional
  Source License (FSL)** — https://www.powersync.com/open-source
- FSL **converts to Apache 2.0 or MIT after two years, per released version**, with a "cannot undermine
  the producer" (non-compete) restriction — https://fsl.software/

### 9. Postgres logical-replication requirements — **CONFIRMED**

- Requires `wal_level = logical`; a publication **named `powersync`** (`CREATE PUBLICATION powersync
  FOR ALL TABLES;`); and a role `CREATE ROLE powersync_role WITH **REPLICATION BYPASSRLS** LOGIN …`
  plus `GRANT SELECT` — https://docs.powersync.com/installation/database-setup

### 10. DTCG + Style Dictionary — **CONFIRMED**

- DTCG format reached its **first stable version, 2025.10, on 2025-10-28** —
  https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/
- Style Dictionary **v4 has first-class DTCG support** — https://styledictionary.com/info/dtcg/
- Official **`create-react-native-app` example** ships in the Style Dictionary repo —
  https://styledictionary.com/getting-started/examples/ •
  https://github.com/style-dictionary/style-dictionary/tree/main/examples/advanced/create-react-native-app

### 11. AI structured output self-hosted (Ollama → GBNF → llama.cpp) — **CONFIRMED**

- Ollama accepts a **JSON schema on the `format` parameter** for structured outputs
  (`/api/generate`, `/api/chat`) — https://github.com/ollama/ollama/blob/main/docs/api.md
- Since Ollama v0.5, supplying a JSON schema **generates a grammar for that specific schema**,
  implemented on top of **llama.cpp GBNF grammars**, which mask invalid tokens during sampling
  (grammar-constrained decoding) — https://github.com/ggml-org/llama.cpp/blob/master/grammars/README.md

### 12. PowerSync attachments — **CONFIRMED capability, but named package DEPRECATED**

- Attachment sync exists and supports any storage adapter incl. **S3-compatible stores (S3, R2,
  Supabase, … MinIO)**. **But** `@powersync/attachments` (JS/TS) and `powersync_attachments_helper`
  (Dart) are **deprecated — functionality is now built into the platform SDKs**
  (`@powersync/react-native`, `@powersync/web`, `@powersync/node`) —
  https://docs.powersync.com/usage/use-case-examples/attachments-files

**Impact:** the capability the CONTEXT relies on for future attachments exists; only the package name is
outdated. Attachments are post-v1, so low urgency.

---

## LOWER

### 13. Floating/wall-clock time on RN/Hermes — **CONFIRMED (adequate, with known Intl caveats)**

- Hermes implements a **subset of ECMA-402 Intl** (incl. `Intl.DateTimeFormat`). Known caveats: some
  historical iOS quirks (`monthShort`/`weekdayShort` returning null), and **JS engines don't expose the
  device's default timezone** (polyfills default to UTC) —
  https://github.com/facebook/hermes/issues/1172
- Because the app stores **floating wall-clock** times and deliberately avoids timezones (ADR-0002),
  plain `Date`/wall-clock arithmetic is adequate; locale-aware *display* formatting may want a polyfill
  (`@formatjs/intl-datetimeformat`) — https://formatjs.github.io/docs/polyfills/intl-datetimeformat/

**Impact:** consistent with ADR-0002. The timezone-detection gap is a non-issue precisely because the
design does not anchor to zones.

### 14. expo-background-task ~15-min minimum — **CONFIRMED**

- Android (WorkManager): **minimum 15-minute interval**. iOS (BGTaskScheduler): a minimum can be
  requested but the **OS decides timing** ("may run at a later time"; short intervals often deferred to
  system windows). Not guaranteed timing —
  https://docs.expo.dev/versions/latest/sdk/background-task/

**Impact:** relevant to re-arming iOS notifications (claim 1) — background re-arm is best-effort, so the
notification budget must survive long gaps between background runs.

### 15. i18n (expo-localization + i18n lib) — **CONFIRMED**

- `expo-localization` exposes device locale via `getLocales()`/`useLocales()`, and the docs recommend
  pairing it with an i18n library (`i18n-js`, `react-i18next`, `react-intl`, `lingui`, `intlayer`) —
  https://docs.expo.dev/versions/latest/sdk/localization/

### 16. Fractional indexing for manual ordering — **CONFIRMED**

- `rocicorp/fractional-indexing` implements fractional indexing for "Realtime Editing of Ordered
  Sequences," based on David Greenspan's *Implementing Fractional Indexing*, with an optional **jitter**
  extension to reduce collisions when generating keys **concurrently** — a sync-safe single-row-write
  reorder pattern — https://github.com/rocicorp/fractional-indexing
- Note: this is the fractional-index approach; **LexoRank** is Atlassian's separate variant. ADR-0005's
  "fractional-index / LexoRank-style" phrasing is fine — both give single-write reorders.

### 17. Claude Design machine-readable token export — **UNVERIFIED (unchanged)**

- Anthropic's own page describes the handoff only as *"Claude packages everything into a handoff bundle
  that you can pass to Claude Code"* — **no primary confirmation** of a machine-readable DTCG/JSON token
  file — https://www.anthropic.com/news/claude-design-anthropic-labs
- Secondary sources (VentureBeat, third-party blogs) report June-2026 "token improvements" and
  Claude Code round-trip integration, but **no first-party Anthropic doc confirms a token export**.

**Impact:** ADR-0006's decision to **not depend** on an automatic token export, and to extract DTCG
tokens manually from the exported HTML, remains the correct posture. Re-confirm if Anthropic publishes
first-party handoff-bundle format docs.

---

## Prioritized "re-grill these"

1. **[HIGH] ADR-0001 notification scheduling vs the iOS 64-pending cap** (fact CONFIRMED). "Expand a
   30–60 day window and schedule local notifications" is unsafe on iOS. Redesign to a cap-aware,
   soonest-first, re-armed-on-launch/background strategy; account for the best-effort background limit
   (claim 14).
2. **[MEDIUM] PowerSync Postgres bucket storage is Beta, not GA** — accept the Beta-tier dependency
   explicitly, or fall back to GA MongoDB for the bucket store.
3. **[MEDIUM] "LWW" wording in CONTEXT/ADR-0003** — PowerSync imposes no conflict strategy; LWW is
   app-implemented server-side merge logic, not a free property. Tighten the docs and own the
   implementation task.
4. **[LOW] Restyle staleness** — maintained but ~16-month-old last release; keep Unistyles v3 ready.
5. **[LOW] `@powersync/attachments` package name is deprecated** — capability is built into the SDKs
   now; update any reference (post-v1, low urgency).
6. **[LOW] Claude Design token export still primary-unconfirmed** — keep the manual-extraction plan;
   re-check when Anthropic ships first-party handoff-format docs.

---

*All verdicts cite primary sources (official docs, source repos, specs, first-party licenses) inline.
Where the task asked for GA-vs-beta or maintenance status, repo/release metadata was pulled directly
from the GitHub API and PowerSync's own release announcements.*
