# PowerSync client contracts — JWT expiry/refresh, and completing a CRUD batch without uploading

Date: 2026-07-20
Status: Research only — two questions raised by the walking-skeleton client (`app/src/data/connector.ts`).
No code changed by this note.
Author: research agent

> Scope: the **exact behaviour of the PowerSync versions this repo installs**, against a **self-hosted
> Open Edition** stack (Postgres + PowerSync Service + our own Fastify auth service with RS256/JWKS,
> `POST /auth/login`, `POST /auth/register`, JWT TTL 3600s, **no refresh-token endpoint**).
>
> **Q1** — when does the SDK call `fetchCredentials()`, and what breaks when the JWT expires?
> **Q2** — our `uploadData()` calls `batch.complete()` without uploading anything. What happens to a
> locally-added Task?

**Pinned versions** (the primary source for every "confirmed in installed source" claim below):

| Package | Version | Path |
|---|---|---|
| `@powersync/common` | **1.57.2** | `app/node_modules/@powersync/common/` (ships `src/*.ts`, not just `.d.ts`) |
| `@powersync/react-native` | **1.35.9** | `app/node_modules/@powersync/react-native/` (declared `^1.20` in `app/package.json`) |
| `@powersync/op-sqlite` | **0.5.6** | `app/node_modules/@powersync/op-sqlite/` |
| `@powersync/react` | installed | provides `useStatus()` / `useQuery()` used by `app/src/ui/TaskListScreen.tsx` |

Evidence is tagged **[source]** (read in the installed package or the PowerSync core repo),
**[docs]** (docs.powersync.com), or **[inferred]** (reasoned from the two, flagged as such).

---

## TL;DR — the two answers

1. **JWT expiry is handled for us, and our setup already fits.** The sync core asks for fresh
   credentials **30 seconds before the token expires**, and again on expiry, on any `401`, and on
   every reconnect. Because `fetchCredentials()` is called repeatedly for the life of the app,
   PowerSync does **not** need a refresh-token endpoint — it needs `fetchCredentials()` to be able to
   *produce a fresh token*. **Ours cannot**: `AppConnector.fetchCredentials` returns whatever
   `TokenStore` holds, so **60 minutes after login, sync dies** and the client enters a 5-second
   reconnect loop that never recovers until the user manually signs in again. That is a real bug
   today, not a theoretical one.

2. **Yes — the user's added Task silently disappears.** `batch.complete()` with no `writeCheckpoint`
   sets the `$local` bucket's `target_op` to a sentinel; the upload loop then fetches a *real* write
   checkpoint from the service (one which does not contain our write, because we uploaded nothing)
   and the next checkpoint rebuilds the local tables from the server oplog, dropping the row. It
   only survives while the device is offline. **[source + docs, both]**

---

# Q1 — JWT expiry / refresh contract

## 1.1 Where `fetchCredentials()` is actually called

The connector method is never called directly by app code. `AbstractRemote` wraps it:

`app/node_modules/@powersync/common/src/client/sync/stream/AbstractRemote.ts`

- `AbstractRemote.fetchCredentials()` (line 203) → calls `this.connector.fetchCredentials()` and
  validates there is no trailing slash on `endpoint`. **[source]**
- `AbstractRemote.getCredentials()` (line 175) — *cached* accessor:
  > ```
  > /**
  >  * Get credentials currently cached, or fetch new credentials if none are
  >  * available.
  >  *
  >  * These credentials may have expired already.
  >  */
  > async getCredentials(): Promise<PowerSyncCredentials | null> {
  >   if (this.credentials) { return this.credentials; }
  >   return this.prefetchCredentials();
  > }
  > ```
- `AbstractRemote.invalidateCredentials()` (line 219) clears the cache **and forwards to an optional
  connector hook**:
  > ```
  > invalidateCredentials() {
  >   this.credentials = null;
  >   this.connector.invalidateCredentials?.();
  > }
  > ```
  Note `invalidateCredentials?: () => void` is declared on `AbstractRemote`'s connector shape
  (`AbstractRemote.ts:22`) but **is not part of the public `PowerSyncBackendConnector` interface** in
  1.57.2 — `src/client/connection/PowerSyncBackendConnector.ts` declares only `fetchCredentials` and
  `uploadData`. It is therefore an undocumented optional extension point, callable but not typed on
  the interface we implement. **[source]**

Every credential fetch traces to one of these five triggers:

| # | Trigger | Call site **[source]** |
|---|---|---|
| 1 | **First use / connect** — cache empty, `buildRequest()` needs a token | `AbstractRemote.ts:228` `buildRequest()` → `getCredentials()` → `prefetchCredentials()` |
| 2 | **Proactive prefetch ~30s before expiry** | Core emits `FetchCredentials { did_expire: false }`; handled in `AbstractStreamingSyncImplementation.ts:801-816` |
| 3 | **Token already expired** | Core emits `FetchCredentials { did_expire: true }` → `remote.invalidateCredentials()` and the sync iteration closes (`AbstractStreamingSyncImplementation.ts:802-803`) |
| 4 | **HTTP `401` from the service** | `AbstractRemote.ts:261-263` (`post`), `:282-284` (`get`), `:592-594` (streaming POST) all call `this.invalidateCredentials()` |
| 5 | **WebSocket/RSocket auth error `PSYNC_S21`** | `AbstractRemote.ts:465-473` — on `PSYNC_S21`, or on any non-`PSYNC_` socket error other than a clean close, `invalidateCredentials()` |

The prefetch branch (trigger 2) is worth quoting in full, because it shows the SDK *does not block* —
it refreshes in the background and then tells the core to restart the iteration:

`AbstractStreamingSyncImplementation.ts:801`
```ts
} else if ('FetchCredentials' in instruction) {
  if (instruction.FetchCredentials.did_expire) {
    remote.invalidateCredentials();
  } else {
    remote.invalidateCredentials();

    // Restart iteration after the credentials have been refreshed.
    remote.fetchCredentials().then(
      (_) => { notifyTokenRefreshed?.(); },
      (err) => { syncImplementation.logger.warn('Could not prefetch credentials', err); }
    );
  }
}
```

`notifyTokenRefreshed` injects a `PowerSyncControlCommand.NOTIFY_TOKEN_REFRESHED` into the control
stream (`AbstractStreamingSyncImplementation.ts:866-870`; enum at
`src/client/sync/bucket/BucketStorageAdapter.ts:24`, wire value `'refreshed_token'`). **[source]**

**Reconnect:** every reconnect goes through `streamingSyncIteration` → `startCommand()` →
`receiveSyncLines` → `buildRequest()` → `getCredentials()`. If a `401`/expiry invalidated the cache,
that is a fresh `fetchCredentials()` call. If nothing invalidated it, **the cached credentials are
reused on reconnect** — `getCredentials()` returns the cached object and, per its own JSDoc, "These
credentials may have expired already." **[source]**

## 1.2 `PowerSyncCredentials.expiresAt` in 1.57.2 — declared but dead

`src/client/connection/PowerSyncCredentials.ts` (the whole file):
```ts
export interface PowerSyncCredentials {
  endpoint: string;
  token: string;
  expiresAt?: Date;
}
```

**`expiresAt` is never read anywhere in `@powersync/common` 1.57.2.** A grep for `expiresAt` across
`src/` returns exactly three hits: this declaration, an unrelated *sync-stream-subscription* TTL
(`src/client/sync/sync-streams.ts:51` — when a **stream subscription** expires, nothing to do with
auth), and `src/db/crud/SyncStatus.ts:327` which maps the **subscription's** `core.expires_at`.
**[source — confirmed by exhaustive grep]**

**So: the SDK does not decode the JWT `exp` itself, and setting `expiresAt` in our connector would
have no effect in 1.57.2.** Expiry is driven from the **wire**: the PowerSync Service sends a
`token_expires_in` keepalive line, which the Rust sync core parses into
`SyncLine::KeepAlive(TokenExpiresIn(seconds))`
([`crates/core/src/sync/line.rs`](https://github.com/powersync-ja/powersync-sqlite-core/blob/main/crates/core/src/sync/line.rs)). **[source, core repo]**

**The refresh margin is 30 seconds**, and it lives in the Rust core, not in JS:

`crates/core/src/sync/line.rs` —
```rust
pub fn should_prefetch(self) -> bool {
    !self.is_expired() && self.0 <= 30
}
```
`crates/core/src/sync/streaming_sync.rs` —
```rust
SyncLine::KeepAlive(token) => {
    self.adapter.increase_ttl(&self.options.active_streams)?;
    if token.is_expired() {
        event.instructions.push(Instruction::FetchCredentials { did_expire: true });
        SyncStateMachineTransition::CloseIteration(Default::default())
    } else if token.should_prefetch() {
        event.instructions.push(Instruction::FetchCredentials { did_expire: false });
        ...
```
**[source, core repo]** — matched by the docs, which state the SDK "pre-fetches new credentials in
the background" when the token has **30 seconds or less** remaining
([Client-Side Integration With Your Backend](https://docs.powersync.com/configuration/app-backend/client-side-integration)). **[docs]**

**Version note:** in older `@powersync/*` releases (the pre-Rust-core "JS sync client"), token expiry
was tracked JS-side and `expiresAt` was more meaningful. In 1.57.2 the Rust client is the *only*
implementation — `SyncStatusOptions.clientImplementation` is explicitly deprecated with
*"This field is no longer set, since `SyncClientImplementation.RUST` is the only option"*
(`src/db/crud/SyncStatus.ts:54-57`). Do not port advice from older blog posts. **[source]**

## 1.3 What happens when `fetchCredentials()` keeps returning a stale/expired token

**Not a silent stop, and not a tight loop — a 5-second backoff loop, forever.**

- The service rejects the expired JWT. Over HTTP streaming that is a `401` →
  `invalidateCredentials()` → `throw` with `error.status = 401`
  (`AbstractRemote.ts:592-598`). Over WebSocket it is `PSYNC_S21` → `invalidateCredentials()`
  (`AbstractRemote.ts:465-467`).
- `streamingSync()`'s `while (true)` loop catches it, sets
  `updateSyncStatus({ dataFlow: { downloadError: ex } })`, and `await this.delayRetry(...)`
  (`AbstractStreamingSyncImplementation.ts:546-605`). **[source]**
- The delay is **fixed, not exponential**: `delayRetry(signal, delay = this.options.retryDelayMs)` is
  a plain `setTimeout` (`AbstractStreamingSyncImplementation.ts:933-957`), and
  `DEFAULT_RETRY_DELAY_MS = 5000` (`:222`). So: **retry every 5 s indefinitely**. **[source]**
- Each retry re-enters `buildRequest()` → cache is empty → **`fetchCredentials()` is called again**.
  With our current connector it returns the same expired token, and the cycle repeats forever.
  **[inferred from the above call graph — high confidence]**
- If the token is *missing or empty*, `buildRequest()` synthesises its own 401:
  ```ts
  } else if (credentials?.token == null || credentials?.token == '') {
    const error: any = new Error(`Not signed in`);
    error.status = 401;
    throw error;
  }
  ```
  (`AbstractRemote.ts:232-236`) — same 5 s loop. **[source]**

Observable symptom in our app today: **`status.connected` flips to `false` about an hour after
sign-in and never comes back**, with a `downloadError` set and a warning logged every 5 seconds. The
`TaskListScreen` header would show `○ offline` with no explanation.

**`invalidateCredentials` as an API:** `AbstractRemote.invalidateCredentials()` is internal; the
optional `connector.invalidateCredentials?.()` hook (`AbstractRemote.ts:221`) is the app-facing lever
— implement it on `AppConnector` to *drop the stored session* so the next `fetchCredentials()` is
forced to re-authenticate. It is not on the public `PowerSyncBackendConnector` type, so it needs a
cast or a structural declaration. **[source; use with the caveat that it is untyped/undocumented]**

## 1.4 The recommended pattern when you run your own auth service

PowerSync's own guidance, from
[Custom authentication setup](https://docs.powersync.com/installation/authentication-setup/custom): **[docs]**

- `sub` **must** be the user id; `aud` **must** match the configured audience; the JWT **must** carry
  a `kid` matching a key in the JWKS.
- *"The JWT must expire in 24 hours or less, and 60 minutes or less is recommended."*
- *"JWTs older than 60 minutes are not accepted by PowerSync."*
- *"We recommend using short expiration periods (e.g. 5 minutes)."*
- Asymmetric (RS256 + JWKS) is *"the recommended approach for production environments."*

Our `services/auth/src/domain/jwt.ts` `signAccessToken()` already emits `sub`/`aud`/`iss`/`iat`/`exp`
with an RS256 `kid` header, and `services/auth/src/server.ts:61` serves the JWKS at
`/api/auth/keys`. **The token *shape* is correct.** **[source, this repo]**

**Does PowerSync expect a refresh-token endpoint?** **No.** The documented contract is a *token
endpoint* that `fetchCredentials()` can hit to **mint a fresh short-lived JWT on demand** — the docs
describe the connector as making "the API call, and the PowerSync Client SDK automatically invokes
`fetchCredentials()` as needed". The `PowerSyncBackendConnector` JSDoc says the same in one line
(`src/client/connection/PowerSyncBackendConnector.ts:8-18`): **[source]**
> ```
> /** ...
>  * This should always fetch a fresh set of credentials - don't use cached
>  * values.
>  *
>  * Return null if the user is not signed in. Throw an error if credentials
>  * cannot be fetched due to a network error or other temporary error.
>  *
>  * This token is kept for the duration of a sync connection.
>  */
> ```

Our connector violates the "don't use cached values" instruction verbatim: it reads a stored token
from `TokenStore`. Note the JSDoc's error contract too — **returning `null` means "signed out";
*throwing* means "temporary failure, retry"** — which is the right distinction for a flaky network.

Three viable shapes for a v1 with no refresh endpoint, in preference order:

1. **Add a session-scoped token endpoint** (e.g. `POST /auth/token`) that accepts the current
   still-valid JWT (or a long-lived opaque session record) and returns a fresh short-TTL JWT.
   `fetchCredentials()` calls it every time. This is the shape PowerSync's examples assume. Costs one
   endpoint in `services/auth/src/server.ts`.
2. **Re-login on demand** — hold the credentials (or an OS-keystore-held password/refresh secret) and
   have `fetchCredentials()` call `POST /auth/login`. Works with zero backend change but means
   storing a password on-device, which is worse than (1) on every security axis.
3. **Two-token split** — issue a long-lived refresh token alongside the short access token. More
   moving parts than (1) for a self-hosted single-service deployment; only worth it if tokens must be
   individually revocable.

Also: a 3600s TTL is at the documented *ceiling* of "60 minutes or less". Once (1) exists, dropping
the access-token TTL to ~5–15 minutes costs nothing (the SDK refreshes automatically) and shrinks
the blast radius of a leaked token.

## 1.5 What the UI can observe

`SyncStatus` (`app/node_modules/@powersync/common/src/db/crud/SyncStatus.ts`) exposes: **[source]**

| Member | Meaning (from its own JSDoc) |
|---|---|
| `connected` | connected to the PowerSync Service (`:83`) |
| `connecting` | connection attempt in flight (`:92`) |
| `lastSyncedAt?: Date` | *"Time that a last sync has fully completed, if any. This timestamp is reset to null after a restart of the PowerSync service."* (`:102`) |
| `hasSynced?: boolean` | *"whether there has been at least one full sync completed since initialization"*; `undefined` while loading (`:112`) |
| `dataFlowStatus.downloading` / `.uploading` | active transfer (`:124`) |
| `dataFlowStatus.downloadError?: Error` | *"Error during downloading (including connecting). Cleared on the next successful data download."* (`:11-17`) |
| `dataFlowStatus.uploadError?: Error` | *"Error during uploading. Cleared on the next successful upload."* (`:18-22`) |
| `downloadProgress`, `priorityStatusEntries` | progress + per-priority sync state |

**There is no separate error event or `onError` listener.** The only channel is the status observer:
`db.registerListener({ statusChanged })` (`AbstractPowerSyncDatabase.ts:534`), which is exactly what
`useStatus()` from `@powersync/react` wraps — already used in
`app/src/ui/TaskListScreen.tsx:23`. Auth failure is therefore surfaced as
`status.dataFlowStatus.downloadError` being set while `status.connected === false`. **[source]**

Note the deliberate asymmetry: an **expired-token failure is a `downloadError`**, not an
`uploadError` — it is thrown from the streaming connection, not from the CRUD loop. A UI that only
watches `uploadError` will miss it entirely.

Useful adjuncts: `db.getUploadQueueStats(includeSize?)` returns pending `ps_crud` count/size
(`AbstractPowerSyncDatabase.ts:691`), and `db.waitForFirstSync()` (`:435`) resolves on first
complete sync.

---

# Q2 — completing a CRUD batch without uploading

## 2.1 The definitive answer: **the locally-added Task disappears**

**Confirmed twice — once in the installed source, once in PowerSync's own docs.**

Docs, [Writing client changes](https://docs.powersync.com/installation/app-backend-setup/writing-client-changes): **[docs]**
> "The client advances to a new write checkpoint after uploads have been processed, so if the client
> believes that the server has written changes into your backend source database […] but the next
> checkpoint does not contain your uploaded changes, those changes will be removed from the client."

That describes our situation exactly. `batch.complete()` is precisely the signal "the server has
written these changes" — and we send it while having written nothing.

The mechanism, in `app/node_modules/@powersync/common/src/client/AbstractPowerSyncDatabase.ts:854`
(`handleCrudCheckpoint`, the function `CrudBatch.complete` is bound to at `:747`): **[source]**

```ts
private async handleCrudCheckpoint(lastClientId: number, writeCheckpoint?: string) {
  return this.writeTransaction(async (tx) => {
    await tx.execute(`DELETE FROM ${PSInternalTable.CRUD} WHERE id <= ?`, [lastClientId]);
    if (writeCheckpoint) {
      const check = await tx.execute(`SELECT 1 FROM ${PSInternalTable.CRUD} LIMIT 1`);
      if (!check.rows?.length) {
        await tx.execute(`UPDATE ${PSInternalTable.BUCKETS} SET target_op = CAST(? as INTEGER) WHERE name='$local'`, [writeCheckpoint]);
      }
    } else {
      await tx.execute(`UPDATE ${PSInternalTable.BUCKETS} SET target_op = CAST(? as INTEGER) WHERE name='$local'`, [
        this.bucketStorageAdapter.getMaxOpId()
      ]);
    }
  });
}
```
(`SqliteBucketStorage.getCrudBatch()` at `src/client/sync/bucket/SqliteBucketStorage.ts:133-171`
contains a byte-equivalent copy for the adapter path.)

Step by step, for "user types a title and taps **Add**" with the current
`app/src/data/connector.ts`: **[source-traced; the final step is [inferred] from the core's
`sync_local` contract + the docs quote above — high confidence]**

1. `insertTask()` writes through the PowerSync **view**. The `INSTEAD OF` trigger writes the row into
   `ps_data__tasks` *and* appends a `ps_crud` entry. The row is immediately visible to
   `useQuery(ACTIVE_TASKS_SQL)`. **[docs — [Client architecture](https://docs.powersync.com/architecture/client-architecture): client tables "are created as *SQLite views*" over `ps_data__<table>`; `ps_crud` is "a blocking FIFO queue"]**
2. The `crudUpdate` listener fires `triggerCrudUpload()`
   (`AbstractStreamingSyncImplementation.ts:512-514`), throttled to
   `crudUploadThrottleMs` (default **1000 ms**, `:218`).
3. `_uploadAllCrud` calls our `uploadData` (`:410`). We call `batch.complete()` with **no**
   `writeCheckpoint` → `ps_crud` is emptied and `$local.target_op` is set to
   `MAX_OP_ID = '9223372036854775807'` (`src/client/constants.ts:4`) — a sentinel meaning *"a real
   write checkpoint is still pending"*.
4. Next loop pass: `nextCrudItem()` returns nothing, so the loop calls
   `updateLocalTarget(() => this.getWriteCheckpoint())` (`:418`).
   `SqliteBucketStorage.updateLocalTarget` (`SqliteBucketStorage.ts:67-114`) sees
   `$local.target_op == MAX_OP_ID`, so it proceeds: it `GET`s
   `/write-checkpoint2.json?client_id=…` (`AbstractStreamingSyncImplementation.ts:358-365`) and
   writes that **real** op id into `$local.target_op`. That checkpoint reflects the server's actual
   state — which **does not include our row**, because we uploaded nothing.
5. `notifyCompletedUploads()` nudges the sync core. On the next checkpoint at or beyond
   `target_op`, the core runs its local-state reconciliation, rebuilding `ps_data__tasks` from
   `ps_oplog`. Our row is not in `ps_oplog`. **The row vanishes from the view, and the live
   `useQuery` re-renders the list without it.**

**The one saving grace — and it is a trap, not a mitigation:** step 4 only runs while **connected**.
Offline, `$local.target_op` stays at `MAX_OP_ID`, no checkpoint can ever reach it, and the row
persists. This matches
[Consistency](https://docs.powersync.com/architecture/consistency): *"While mutations are present in
the upload queue, the client does not advance to a new checkpoint."* **[docs]** So the failure is
**connection-dependent and therefore intermittent** — tasks added offline look fine and then
disappear the moment the device reconnects. That is the worst possible failure mode to debug.

## 2.2 The local mutation model, and what `writeCheckpoint` is for

- **`ps_data__<table>`** holds current local row state; the app-facing table name is a **view** over
  it. **`ps_oplog`** holds server-sourced history. Data moves from `ps_oplog` into `ps_data__<table>`
  "only after a full checkpoint downloads". **[docs, Client architecture]**
- **`ps_crud`** is the FIFO upload queue; local writes land in it via the view triggers. **[docs]**
- **`ps_buckets`** holds per-bucket sync state. The synthetic **`'$local'`** bucket's `target_op` is
  the gate: local writes are protected from being overwritten until the server has confirmed a
  checkpoint that includes them. **[source, `SqliteBucketStorage.ts:69,111`]**
- **`CrudBatch.complete(writeCheckpoint?: string)`** (`src/client/sync/bucket/CrudBatch.ts:21`,
  JSDoc: *"Call to remove the changes from the local queue, once successfully uploaded."*) does two
  things: delete the uploaded entries from `ps_crud`, and set `$local.target_op`.
  - **With `writeCheckpoint`** (the op id your write API returns after committing): `target_op` is
    set to that exact checkpoint — but only if the queue is now empty, so a later write doesn't get
    prematurely unblocked.
  - **Omitted** (the common case, and ours): `target_op = MAX_OP_ID`, deferring to the
    `updateLocalTarget` → `/write-checkpoint2.json` round-trip described above. **This is the
    correct, normal thing to do when you have genuinely uploaded** — it is only catastrophic because
    we haven't.

  So `writeCheckpoint` is a latency optimisation + precision tool for backends that can report the
  replication position of the write they just made; omitting it is fully supported and costs one
  extra HTTP GET. **[source]**

## 2.3 If `uploadData` throws, or never calls `complete()`

Both are handled, both are loud, and neither loses data:

- **Throws.** `PowerSyncBackendConnector.uploadData` JSDoc: *"Any thrown errors will result in a
  retry after the configured wait period (default: 5 seconds)."*
  (`src/client/connection/PowerSyncBackendConnector.ts:25`). In
  `_uploadAllCrud` the `catch` sets `dataFlow.uploadError`, logs
  *"Caught exception when uploading. Upload will retry after a delay."*, and `await this.delayRetry(signal)`
  — fixed 5 s, and it breaks out of the loop if `!this.isConnected`
  (`AbstractStreamingSyncImplementation.ts:427-449`). **[source]**
- **Returns without `complete()`.** The loop remembers the first queue item across iterations and
  detects the no-progress case explicitly (`:401-407`): **[source]**
  ```ts
  if (nextCrudItem.clientId == checkedCrudItem?.clientId) {
    this.logger.warn(`Potentially previously uploaded CRUD entries are still present in the upload queue.
  Make sure to handle uploads and complete CRUD transactions or batches by calling and awaiting their [.complete()] method.
  The next upload iteration will be delayed.`);
    throw new Error('Delaying due to previously encountered CRUD item.');
  }
  ```
  So: warning, synthetic throw, 5 s backoff. **No tight loop.**
- **Consequences of a permanently stuck queue:** `ps_crud` grows unbounded, and — per
  [Consistency](https://docs.powersync.com/architecture/consistency) — **downloads stall**: the
  client will not advance to a new checkpoint while mutations sit in the queue. The docs are blunt
  about the retry semantics: an erroring `uploadData` means the SDK *"will retry the same upload
  indefinitely, effectively blocking the upload queue"*, and your backend should return `2xx` for
  permanent validation failures so the entry is discarded rather than retried forever
  ([Client-side integration](https://docs.powersync.com/configuration/app-backend/client-side-integration)). **[docs]**

## 2.4 Is there an official download-only / read-only client mode?

**There is no "read-only" connect option, and `uploadData` is not optional.** In 1.57.2:

- `PowerSyncBackendConnector.uploadData` is a **required** member
  (`src/client/connection/PowerSyncBackendConnector.ts:27`). **[source]**
- The connection options — `BaseConnectionOptions` (`connectionMethod`, `fetchStrategy`, `params`,
  `includeDefaultStreams`, `serializedSchema`) and `AdditionalConnectionOptions` (`retryDelayMs`,
  `crudUploadThrottleMs`) — contain **nothing** resembling `readOnly` / `uploadEnabled` /
  `downloadOnly` (`AbstractStreamingSyncImplementation.ts:130-182`). **[source — confirmed by reading
  the full option interfaces]**
- `crudUploadThrottleMs` only spaces out upload attempts (`:372`); it cannot disable them.
- The `crudUploadLoop` is started unconditionally alongside `streamingSync` on every `connect()`
  (`:462-465`). **[source]**

**What *is* official is `localOnly` tables.** `TableOrRawTableOptions.localOnly?: boolean`
(`src/db/schema/Table.ts:20`), default `false` (`DEFAULT_TABLE_OPTIONS`, `:82-89`), with a
convenience constructor `Table.createLocalOnly(options)` (`:104-106`). Sibling options worth knowing:
`insertOnly` (`:21`, `Table.createInsertOnly` at `:108`), `trackPrevious`, `trackMetadata`,
`ignoreEmptyUpdates`, `viewName`. **[source]**

PowerSync documents `localOnly` for exactly the "no backend yet" case
([Local-only usage](https://docs.powersync.com/usage/use-case-examples/offline-only-usage)): **[docs]**
> "Use local-only tables until the user has registered or signed in. This would not store any data in
> the upload queue, avoiding any overhead or growth in database size."
> […] "Once the user registers, move the data over to synced tables, at which point the data would be
> placed in the upload queue."

The same page mentions periodically clearing the queue with `DELETE FROM ps_crud` as an alternative,
while warning against touching `ps_oplog`. **That alternative has the identical data-loss profile as
our `complete()`-without-upload and should not be used here.**

**Note the asymmetry that makes `localOnly` awkward for us:** a `localOnly` table is *never synced*,
in either direction. It is not "download but don't upload" — it is "don't sync at all". There is no
supported per-table download-only mode. **[source — no such option exists in `TableOrRawTableOptions`]**

## 2.5 Concrete recommendation for a client with no write backend

Ranked, honestly:

1. **Remove the local write path from the UI until a write endpoint exists.** *(Recommended for v1.)*
   The walking skeleton's stated purpose is to prove **downstream** streaming — rows appearing as the
   Server syncs them. Writes are out of scope for that proof. A user-facing **Add** button that
   creates a task which vanishes on reconnect is worse than no button. **The Add and Delete buttons
   in `TaskListScreen` must go (or be disabled with an explanatory label) until `uploadData` really
   uploads.**
2. **If local writes must be demonstrable now**, move `tasks` to a `localOnly: true` table. Data is
   durable, the queue stays empty, nothing is silently reverted — but **you lose downstream sync for
   that table entirely**, which defeats the skeleton's purpose. Only viable as a separate scratch
   table, not for `tasks`.
3. **Leave the queue pending** — i.e. make `uploadData` a no-op that *returns without calling
   `complete()`*. Data is preserved locally and will upload for real once the endpoint lands. But per
   §2.3 this **blocks all downloads** and logs a warning every 5 seconds, so it also defeats the
   skeleton. Mentioned only for completeness.
4. **Status quo (`complete()` without uploading).** Actively loses user data, intermittently, in a
   way that looks like a sync bug. **Do not keep this.**

---

## Unverified / open

- Whether the *self-hosted Open Edition* service emits `token_expires_in` keepalives on the same
  cadence as Cloud (assumed yes — same service binary and protocol; not directly observed).
- The precise checkpoint at which `sync_local` drops the local row is inferred from the core's
  `target_op` contract plus the docs' explicit "those changes will be removed from the client"; it
  was not reproduced against a live service. **Reproducing it once on-device before acting would be
  cheap and worth doing.**
- `connector.invalidateCredentials?.()` is called by `AbstractRemote` but is absent from the public
  `PowerSyncBackendConnector` type in 1.57.2 — treat it as an unstable extension point.

---

## Recommendations for this repo

### Q1 — auth/JWT (fixes a live bug: sync dies ~60 min after sign-in)

1. **`services/auth/src/server.ts`** — add **`POST /auth/token`**: accept the current (still-valid)
   bearer JWT, re-verify it, and re-issue via the existing `signAccessToken()` in
   `services/auth/src/domain/jwt.ts`. No schema change, no refresh-token table. This is the single
   change that makes everything below possible.
2. **`app/src/auth/client.ts`** — add `refresh(accessToken): Promise<AuthResult>` alongside `login`/
   `register`, reusing `parseSession`.
3. **`app/src/data/connector.ts`** — make `fetchCredentials()` honour its contract
   (*"should always fetch a fresh set of credentials"*): call `AuthClient.refresh`, persist the new
   `Session` via `TokenStore.save`, and return the fresh token. Distinguish the two failure modes the
   JSDoc defines — **return `null`** when refresh yields `401` (session is dead, sign the user out);
   **throw** on network failure (transient, let the 5 s retry loop handle it). Optionally implement
   `invalidateCredentials()` to clear `TokenStore`.
   *Trade-off:* one extra HTTP round-trip per token refresh (~once an hour, or once per reconnect).
   Negligible.
4. **Consider shortening the JWT TTL** from 3600 s to ~900 s once (1)–(3) are in. The docs recommend
   "60 minutes or less", and explicitly suggest ~5 minutes. Refresh becomes automatic and invisible,
   so a short TTL costs nothing and shrinks leak exposure. *Trade-off:* more auth-service traffic —
   trivial at this scale.
5. **`app/src/ui/TaskListScreen.tsx`** — the header currently reduces everything to
   `connected ? "● live" : "○ offline"`. Distinguish the auth-dead state: if
   `status.dataFlowStatus.downloadError` is set while `!status.connected`, show something actionable
   ("sync stopped — sign in again") rather than a bare "offline", since the user cannot tell a tunnel
   from a permanent auth failure. Note that expired-token failures land on **`downloadError`**, not
   `uploadError`.

**Also worth flagging (adjacent, not asked):** `System.disconnect()` in `app/src/data/system.ts:45`
calls `powersync.disconnectAndClear()`, which **wipes the local database**, not just the connection.
If it is wired to sign-out that is arguably intentional; if anything calls it as a plain
"disconnect", it is a data-loss bug. Worth a second look.

### Q2 — the upload queue

1. **`app/src/ui/TaskListScreen.tsx`** — **remove or disable the `Add` and `Delete` controls** until a
   real write endpoint exists. This is the honest answer. As written, a task added while connected is
   deleted by the next checkpoint, and a task added offline is deleted on reconnect — intermittent,
   invisible, and indistinguishable from a sync bug. The skeleton's goal (downstream streaming, live
   `useQuery`) is fully demonstrated by rows arriving *from* the Server; it does not need a write
   path.
   *Trade-off:* the demo becomes read-only, and manual testing needs rows seeded directly into
   Postgres. That is a fair price for not shipping silent data loss — and arguably a better test of
   what the skeleton claims to prove.
2. **`app/src/data/connector.ts`** — with the UI writes gone, `ps_crud` stays empty and `uploadData`
   is never meaningfully invoked. Keep it as a **throwing** stub, not a `complete()`-ing one:
   ```
   throw new Error("No write backend in v1");
   ```
   Fail loud (5 s retry, `uploadError` set) rather than fail silent. Update the JSDoc, which
   currently claims "Downstream streaming is unaffected" — **that is wrong**: a completed-but-unsent
   batch advances `$local.target_op` and causes the local row to be reverted. Correcting that comment
   matters even if nothing else changes, because it is actively misleading the next reader.
   *Trade-off:* if a stray write ever does reach `ps_crud`, downloads stall until the write endpoint
   exists. Given (1) that should never happen, and a stalled sync is far easier to notice and diagnose
   than a disappearing task.
3. **When the write endpoint lands**, the real `uploadData` should: send the batch, and call
   `batch.complete()` **only on a confirmed commit** — passing `writeCheckpoint` if the API returns
   one, omitting it otherwise (both are supported; omitting costs one extra
   `/write-checkpoint2.json` GET). Return `2xx` from the backend for *permanent* validation failures
   so the entry is dropped, and reserve non-`2xx` for transient errors that genuinely warrant the
   indefinite retry.
4. **Do not** reach for `localOnly: true` on `tasks`. It stops downstream sync for that table
   entirely, which is precisely the thing the walking skeleton exists to prove.
