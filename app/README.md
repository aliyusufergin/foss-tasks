# foss-tasks app (T02 — app skeleton)

The Expo **dev-client** app: signs in against the self-hosted Server, holds a
JWT, and maintains an offline PowerSync SQLite replica that syncs against the
membership-scoped rules from the v1 spec. This ticket establishes the
**offline-first data foundations** (ADR-0005) and the **two test seams**
(ADR-0004); the full Task shape, theming, and screens land in later tickets.

## Layout

```
src/
  domain/          Pure, framework-agnostic domain logic (PRIMARY test seam, ADR-0004)
    ids.ts           Client-generated UUID pks (ADR-0005 §1)
    order-key.ts     Fractional-index ordering (ADR-0005 §4)
    lww.ts           Last-write-wins merge (ADR-0005 §2)
    row.ts           Base syncable / orderable row shapes
  data/            Local data layer (SECONDARY test seam)
    model.ts         Table shapes — single source of truth (no RN imports)
    migrations/      Forward-migration runner + schema version marker (ADR-0005 §5)
    queries.ts       Reads/writes over the SqlDatabase port (tombstones hidden, ordered)
    schema.ts        PowerSync client Schema, built from model.ts        (RN)
    connector.ts     Auth ↔ PowerSync bridge (fetchCredentials/uploadData) (RN)
    system.ts        Opens the on-device PowerSync DB (op-sqlite)          (RN)
  auth/
    client.ts        email+password → Session (JWT + identity claims)
    token-store.ts   Persisted session (stay signed in) over a secure-store port
  ui/              Minimal unstyled scaffold screens                       (RN)
App.tsx / index.ts App root + entry                                        (RN)
```

The **domain** and **data-layer logic** are written as pure functions over
narrow ports (`SqlDatabase`, `fetch`, a secure key-value store), so they run and
are tested in Node with no React Native toolchain — the discipline ADR-0004
mandates so a future server-side path can reuse the same logic.

## The two test seams (runnable in CI)

- **Domain-logic unit harness** — `test/domain/**`: ordering, LWW merge, id
  generation. Pure, deterministic (time is injected, never read from the clock).
- **Local data-layer integration harness** — `test/data/**`: the migration
  runner and query layer exercised against **real SQLite** (Node's built-in
  `node:sqlite`) behind the same `SqlDatabase` port the app uses against
  PowerSync. Asserts tombstones hide deleted rows, Space scoping, and
  fractional-index ordering.

```sh
npm install --legacy-peer-deps
npm test              # both seams
npm run typecheck     # Node-safe seams (tsconfig.seams.json)
npm run typecheck:app # full React Native / Expo typecheck (tsconfig.json)
```

`--legacy-peer-deps` and the `@powersync/common` override in `package.json`
pin a single copy of that package (react-native and react otherwise pull
different versions, which breaks structural typing across the SDK).

## Running the app against a Server

The app is a **dev client** (not Expo Go) because PowerSync needs a native
SQLite driver (op-sqlite). Bring up the backend first (repo root
`docker compose up`, see `docs/product/self-hosting.md`), then:

```sh
npm run android   # or: npm run ios  — builds and installs the dev client
npm start         # dev server for an already-installed dev client
```

Endpoints default to a Server on the dev machine (Android emulator `10.0.2.2`,
iOS simulator `localhost`; auth `:6060`, PowerSync `:8080` per `.env.example`).
Override with `EXPO_PUBLIC_AUTH_URL` / `EXPO_PUBLIC_POWERSYNC_URL`.

**Manual acceptance** (needs a device/emulator + running Server, so it is not in
CI): register or sign in, add a Task, and confirm it streams live — a change on
the Server (or a second Device) appears within seconds while the app is
foregrounded.

## Known boundaries (later tickets)

- **No write-back API in v1.** Postgres is the source of truth (ADR-0004) and no
  write endpoint ships yet, so `connector.uploadData` acknowledges the local
  write queue without uploading — Device-side edits stay on the Device.
  Downstream streaming is unaffected. Replace that method body when the write
  endpoint lands.
- The **tasks** table mirrors the current server stub plus the ADR-0005
  ordering key (`order_key` was added to the source-of-truth schema in this
  ticket so manual order survives a resync); the full Task shape
  (schedule/deadline/recurrence) lands with the walking-skeleton ticket.
- Screens are unstyled scaffolding; the **Ink & Signal** themed UI is a later
  ticket.
