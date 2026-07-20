# 0008 — Clients do not write to Postgres directly; writes go through a backend endpoint

Date: 2026-07-20
Status: Accepted

Supersedes nothing. Extends ADR-0004 (Postgres is the source of truth; domain logic is shared)
and ADR-0005 (client-generated ids, LWW, tombstones).

## Context

PowerSync clients never write to the source-of-truth Postgres. Local writes land in an on-device
CRUD queue (`ps_crud`), and the connector's `uploadData()` must POST them to a backend that applies
them. Our stack had no such endpoint — `services/auth` only issued JWTs.

Two source-traced constraints (`docs/research/powersync-client-contracts-2026-07.md`) make this
non-deferrable:

1. **There is no supported download-only mode.** `uploadData` is a required interface member and no
   `connect()` option disables upload. `localOnly: true` kills sync in both directions.
2. **Acknowledging a batch without uploading destroys the write.** `CrudBatch.complete()` with no
   `writeCheckpoint` sets `$local.target_op = MAX_OP_ID`; the upload loop then fetches a real
   write-checkpoint that lacks the row, and the next checkpoint rebuilds the table from `ps_oplog`
   without it. This only happens *while connected*, so an offline edit looks fine and vanishes on
   reconnect — the worst possible failure mode to debug.

Because of (2), T02 (#3) shipped the task list read-only and `uploadData()` deliberately throws.

This ADR records the decisions taken before implementation, so the implementer reads them rather
than inventing them mid-ticket. One of them (what to do with an invalid op) has a default that looks
tidy in code and is silent data loss; it is settled here explicitly.

## Decision

### 1. A single `services/api`, not a second service

`services/auth` is renamed to `services/api`. It already owns the JWT signing key, the JWKS
endpoint, a `pg` pool, Fastify, and a config loader — all of which a separate write service would
duplicate, and it would need the public key anyway. One process, one pool.

Environment variables move from `AUTH_*` to `API_*`. The **values** are unchanged — in particular
`API_JWT_ISSUER` stays `foss-tasks-auth` and the signing key and `kid` are preserved, since changing
either invalidates every issued token and the `kid` PowerSync resolves from JWKS.

Rejected: extending `services/auth` under its old name (the name would lie about what it owns), and
a separate `services/sync-write` (duplicate infrastructure and a second credential path for no v1
benefit).

### 2. The endpoint accepts the token the client already holds

`POST /sync/write` verifies the same JWT the PowerSync Service verifies: RS256 via the local JWKS,
`iss: foss-tasks-auth`, `aud: powersync`. Reusing PowerSync's audience is deliberate, not an
oversight: `auth` mints the token, both services are ours, and the token already grants full read of
the Account's Spaces — a write-scoped audience would add a second token lifecycle to a client whose
token *refresh* path is already a known gap (#16).

Rejected: minting `aud: ["powersync", "foss-tasks-api"]` (semantically tidier, but PowerSync's
acceptance of a superset audience array is unverified), and a separate write token (two expiries for
a client that cannot yet refresh one).

### 3. One device transaction per request, one Postgres transaction per request

The client drains with `getNextCrudTransaction()` in a loop, not `getCrudBatch()`. The server's
atomic unit therefore equals the user's atomic unit: "add a task and reorder it" either both land or
neither does. `getCrudBatch()` would put ops from several unrelated device transactions in one
request, where partial-failure semantics map to nothing the user did.

Cost: more HTTP requests when draining a deep queue after a long offline period. Accepted.

### 4. Writes are restricted to `tasks`, by allowlist

Sync rules stream `spaces`, `space_members`, and `tasks` to the device, so the CRUD queue can
contain ops for any of them. A `PUT` on `space_members` is self-service privilege escalation —
inserting a row that grants yourself membership in someone else's Space. Membership checks alone do
not stop it, because the op *creates* the membership any after-the-fact check would read.

`WRITABLE = {"tasks"}`. Ops on other tables are permanently rejected. Group Space invitations (v2)
get a dedicated endpoint with its own authorization, never a raw CRUD op.

### 5. Membership is checked on both the incoming and the stored `space_id`

For each op: the Account must be a current member (`deleted_at IS NULL`) of the incoming `space_id`,
and — when the row already exists — of the **stored** row's `space_id`.

Checking only the incoming value would let `PATCH tasks id=<victim-uuid> space_id=<my-space>` land
on a row in a Space the attacker cannot read. UUIDs make that hard to exploit blind, but
unguessability is not an authorization control, and ids leak (shared Spaces in v2, logs, bug
reports).

The check reads `SELECT space_id, updated_at FROM tasks WHERE id = $1 FOR UPDATE`, which the LWW
comparison needs regardless, so it costs nothing extra.

### 6. LWW is imported from `packages/domain`, not reimplemented

`app/src/domain/lww.ts` already implements the merge rule, and its own docstring anticipates this
ticket: *"the same logic runs on the Device today and in a future server-side merge path
(ADR-0004)."* This endpoint **is** that path.

`pickLwwWinner` carries three rules: the later `updated_at` wins; on an exact tie a tombstone beats
a live edit; on a further tie `incoming` wins. A server that reimplemented these would eventually
disagree with a device about the same pair — divergence that sync cannot repair, because both sides
believe they converged.

The module therefore moves to `packages/domain`, consumed by both `app` and `services/api`
(see §11).

### 7. Client clocks are trusted for ordering, clamped for damage

LWW compares the client's `updated_at` — it must, or offline edits cannot be ordered at all. But
ADR-0002 fixes floating wall-clock time, so a skewed device clock is ordinary rather than exotic: a
phone set to 2030 writes a row that no later edit from any device can overwrite, and the poison
syncs to every member of the Space.

Rule: compare on the client's `updated_at`, but if it exceeds server `now()` by more than **5
minutes**, clamp it to `now()` before storing. Bounds the blast radius of a bad clock to minutes
instead of years. A missing or unparseable `updated_at` is a permanent rejection.

Rejected: trusting the client verbatim (one wrong clock freezes rows Space-wide, repairable only by
manual SQL), and server-stamped `updated_at` (immune to clocks, but destroys offline LWW — an edit
made three days offline would outrank an edit made online yesterday, contradicting ADR-0005 §2).

### 8. Op semantics, including rows that are not there

| Op | SQL | Row missing |
| --- | --- | --- |
| `PUT` | `INSERT ... ON CONFLICT (id) DO UPDATE`, LWW-guarded | n/a — it inserts |
| `PATCH` | `UPDATE ... WHERE id`, LWW-guarded | permanent rejection, `row_not_found` |
| `DELETE` | `UPDATE ... SET deleted_at`, LWW-guarded | permanent rejection, `row_not_found` |

A `PATCH` for an unknown row cannot be reconstructed (`title` and `space_id` are `NOT NULL`), and a
`DELETE` for one signals a real inconsistency. Both are surfaced rather than swallowed.

Sync rules already filter `deleted_at IS NULL`, so a tombstone propagates to other devices as a
REMOVE without further work.

**A stale op is not a failure.** An op whose (clamped) `updated_at` does not beat the stored row
applies nothing and counts as `applied` — that is LWW working, not an error.

### 9. An invalid op rejects its whole transaction, is dead-lettered, and returns 200

This is the decision the ticket was gated on. The failure taxonomy:

- **Transient** (Postgres unreachable) → `5xx`, the client retries. Uncontroversial.
- **Stale LWW** → applies nothing, reported as `applied` (§8).
- **Permanent** (not a member; table not writable; malformed payload; fails `validateTask`;
  `row_not_found`) → retrying can never succeed.

PowerSync's own docs recommend returning `2xx` for permanent validation failures *"so the entry is
discarded rather than retried forever"* — i.e. the documented advice **is** the silent-data-loss
default. A `4xx` instead is loud but wedges the device permanently: `uploadData` retries every 5s
forever, and because the client will not advance to a new checkpoint while mutations sit in the
queue, **downloads stall too**. The app goes read-stale with no in-app recovery path.

Neither is acceptable, so we take the payload out of the queue and put it somewhere durable:

1. Attempt the transaction. On any permanent rejection, **nothing partial lands** — `ROLLBACK`.
2. In a **separate transaction**, insert every op of that transaction into `rejected_writes` with
   its reason. (It cannot share the first transaction: the rollback would erase the evidence.)
3. Return **200** with `{ applied, rejected[] }`. The queue drains, downloads never stall, and the
   write is neither applied nor gone — it is durable, attributable, and reportable.

Rejected: `2xx` with the bad op silently dropped and the rest applied. This is the tidy-looking
default the endpoint exists to prevent; T02 removed the Add button precisely to avoid a write path
that eats data quietly, and this would let it back in through the back door.

**The residual gap, stated plainly:** a rejected transaction still returns 200, so the client
completes it and the local row is rebuilt out of existence — the user's task visibly disappears.
That is correct (the server refused it) but it is only *non-silent* once the client surfaces
`rejected[]`. **#5 must not ship without that surface.**

`rejected_writes` is not added to the `powersync` publication, which is declared `FOR TABLE spaces,
space_members, tasks` explicitly — so raw rejected payloads never replicate to devices.

### 10. No write-checkpoint is returned

The ticket originally required the endpoint to return a write-checkpoint. It does not.

Omitting it is fully supported: `complete()` with no argument sets `target_op = MAX_OP_ID`, and the
upload loop then GETs a real `/write-checkpoint2.json`. That was only catastrophic in T02 because
nothing had been uploaded; once we genuinely upload, it is the normal path and costs one extra HTTP
GET per drained transaction.

Returning a real checkpoint would mean `services/api` holding `PS_ADMIN_API_TOKEN` and calling the
PowerSync Service after every commit — a new api → PowerSync-Service coupling and a second
credential, against an admin API shape we have not verified, to save one round-trip.

### 11. Domain logic lives in `packages/domain`; both consumers import it

`app/src/domain/*` moves to `packages/domain`, wired with npm workspaces at the repo root.

**Packaging.** The package is compiled with `tsc` to `dist/` (ESM + `.d.ts`) and exposed via the
`main` field. This is forced by a real collision:

- `services/api` uses `"module": "NodeNext"`, so relative imports **require** a `.js` extension.
- Metro **rejects** the `.js`→`.ts` mapping — the exact failure that made T02's bundle never build
  once (`docs/agents/verification.md`).

Raw shared TypeScript source cannot satisfy both. Compiled plain JS satisfies both. The `exports`
field is deliberately **not** used: Metro's package-exports support is behind a flag in RN 0.76,
while `main` resolves everywhere.

Metro also does not watch outside the app directory, so `app/metro.config.js` is added with
`watchFolders` pointing at the monorepo root and both `nodeModulesPaths`.

**Validation.** `validateTask(row)` is added to `packages/domain` now — non-empty `title`, `status`
in the enum, valid UUIDs — and `/sync/write` calls it; a failure is a permanent rejection
(`invalid_task`). The stub `tasks` shape barely needs it today, but it establishes the call site so
later tickets extend a seam instead of inventing one.

**Standing rule:** every Task field added by #6–#10 is validated in `packages/domain`, and both the
client and `/sync/write` are wired to it **in the same ticket**. Otherwise the endpoint becomes the
one path by which invalid Tasks enter the source of truth.

### 12. A Postgres migration runner ships with this work

`infra/postgres/init/*.sql` runs only on first cluster init, so it cannot deliver
`rejected_writes` to an existing database. ADR-0005 §5 covers on-device SQLite migrations only.

A runner is added at `services/api/migrations/`: numbered SQL files, a `schema_migrations` table,
applied on boot inside a transaction under an advisory lock. A self-hosted product cannot ship
"delete your volume" as its upgrade path, and this is the cheapest the runner will ever be — one
migration to carry.

### 13. Other settled defaults

- **Retries are naturally idempotent.** A `5xx` that in fact committed, then retried, re-applies the
  same op with an equal `updated_at` → stale → no-op. No idempotency key is needed.
- **1000 ops per request**, `413` beyond. Anything larger is a client bug rather than user data, and
  `413` is retryable — it wedges rather than discards, which is the safer side of §9's trade.

## Delivery

Split into three, because the monorepo change and the write-path semantics are independent risks
that should not fail inside the same diff:

- **T04a-0** — root workspace, `packages/domain` extraction, `metro.config.js`, CI. Behaviour-neutral.
  Verified on a device: the app builds, launches, syncs, and renders the list; `uploadData` still
  throws. This run exists to answer one question — does Metro resolve a symlinked workspace package.
- **T04a** (#17) — `services/api` rename, `POST /sync/write`, migration runner, `rejected_writes`.
  Backend only, no `app/` changes, verified by HTTP tests against a real Postgres.
- **#5** — the `uploadData` drain loop, `complete()`, the `rejected[]` user-facing surface, and the
  Add button.

## Consequences

**Positive**
- A write either lands or is durably recorded as rejected. There is no path where it disappears
  silently.
- Membership is enforced server-side on untrusted input; sync rules scope reads, and now something
  scopes writes.
- Device and server agree on LWW by construction, not by parallel maintenance.
- The monorepo seam ADR-0004 assumed actually exists, with a validation call site ready for #6–#10.

**Negative / costs**
- `services/api` is now the single process for auth and writes; splitting later means undoing the
  rename.
- A rejected transaction is invisible to the user until #5 lands its surface, and the local row
  disappears in the meantime.
- `rejected_writes` grows unbounded; no retention policy is defined (noted, not built).
- The 5-minute clock clamp is a heuristic. A device skewed by under 5 minutes still wins ties it
  arguably should not.
- Draining with `getNextCrudTransaction()` costs more round-trips than batching.

## Alternatives considered

Recorded inline per decision above. The two worth restating, because both are the *tidy* option:

- **Drop the invalid op, apply the rest, return 2xx** (§9) — PowerSync's documented advice, three
  lines of code, and silent data loss. Rejected.
- **Reimplement LWW in `services/api`** (§6) — keeps this ticket small and `app/` untouched, at the
  cost of two copies of a tie-breaking rule whose divergence produces unrepairable disagreement
  between device and server. Rejected.
