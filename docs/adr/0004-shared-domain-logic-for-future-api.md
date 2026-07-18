# 0004 — Domain logic as shared pure functions; Postgres is the source of truth

Date: 2026-07-18
Status: Accepted

## Context

An external surface — a public REST API, an MCP server so other AI tools can drive the app, and
outbound webhooks — is wanted, but deferred to v2. The app is offline-first: business logic
(RRULE expansion, recurrence Override creation, validation, derived "blocked" state) naturally
lives on the client, because the Device must apply edits offline.

If that logic is written client-only, a future server-side API that writes Tasks would either
duplicate it or bypass it — producing data the clients consider invalid. That is the expensive
mistake to avoid now, even though no API ships in v1.

## Decision

Two principles are fixed from v1, before any API exists:

1. **Postgres is the source of truth.** This is already forced by PowerSync (it streams Postgres
   to Devices). A future external API writes to Postgres and the change syncs to every Device for
   free — no separate write path into the client stores.
2. **Domain logic lives in shared, pure, side-effect-free functions** (plain TypeScript:
   RRULE/recurrence, Task validation, dependency/cycle checks). The client uses them offline; a
   future server-side API import the same functions to validate its writes. Logic is never buried
   in UI components or client-only modules.

The REST API, MCP server, and webhooks themselves are **v2**.

## Consequences

**Positive**
- Adding the v2 API/MCP is largely additive — reuse the shared logic, write to Postgres, sync is
  automatic.
- Read endpoints are trivial (Postgres is authoritative); write endpoints reuse validated logic.

**Negative / costs**
- A discipline cost now: recurrence/validation must be authored as framework-agnostic functions,
  not inline in React Native components — slightly more structure than a UI-coupled approach.
- Server-side execution of the shared logic (v2) needs a JS runtime path; accepted.

## Alternatives considered

- **Write logic client-only, extract later** — faster v1, but a risky untangling when the API
  arrives and a window where API writes and client writes disagree. Rejected.
