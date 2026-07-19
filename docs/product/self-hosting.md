# Self-hosting the foss-tasks server

The whole backend runs from one `docker-compose up`. It brings up four services:

| Service            | What it is                                                          |
| ------------------ | ------------------------------------------------------------------- |
| `postgres`         | Source of truth. Runs with `wal_level=logical` and a `powersync` publication. |
| `powersync-bucket` | A **separate** Postgres for PowerSync's bucket storage (ADR-0007).  |
| `powersync`        | The PowerSync Service — streams per-Space-scoped data to Devices.   |
| `auth`             | Minimal email + password auth; issues JWTs PowerSync accepts.       |

You run one Server; it hosts many independent Accounts, each isolated by
Space-membership sync rules.

## Prerequisites

- Docker with Compose v2 (`docker compose version`).
- Node.js 20+ **only** to generate a signing key (one command, below).

## Setup

### 1. Configure the environment

```bash
cp .env.example .env
```

Edit `.env` and replace every `change-me-*` value with your own secrets.

### 2. Generate the JWT signing key

The auth service signs tokens with an RS256 key and publishes the matching
public key at a JWKS endpoint that PowerSync reads. Generate a key pair:

```bash
cd services/auth
npm install
npm run gen-keys
```

Copy the printed PEM into `.env` as `AUTH_JWT_PRIVATE_KEY`, on a single line with
literal `\n` between the PEM lines:

```
AUTH_JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n
```

`AUTH_JWT_AUDIENCE` in `.env` must match `client_auth.audience` in
`infra/powersync/service.yaml` (both default to `powersync`).

### 3. Start the stack

```bash
docker compose up -d --build
```

First boot: Postgres runs the init scripts in `infra/postgres/init/` (schema,
the `powersync` publication scoped to the syncable tables, and the
`powersync_replication` role with `REPLICATION` + `BYPASSRLS`). PowerSync then
snapshots those tables into bucket storage and starts streaming.

Check everything is healthy:

```bash
docker compose ps
```

## Verify

**Register an Account** (creates the Account and its Personal Space):

```bash
curl -X POST localhost:6060/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"supersecret"}'
```

The response includes `access_token`, `account_id`, and `personal_space_id`.
The token's `sub` is the `account_id` — this is what sync rules read as
`request.user_id()`.

**Sign in** later for a fresh token:

```bash
curl -X POST localhost:6060/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"supersecret"}'
```

**Inspect the JWKS** PowerSync validates tokens against:

```bash
curl localhost:6060/api/auth/keys
```

**PowerSync liveness:**

```bash
curl localhost:8080/probes/liveness
```

## How per-Space sync scoping works

Sync rules live in `infra/powersync/sync-rules.yaml`. A token streams data
**only** for Spaces the Account belongs to — never by raw account id:

```yaml
bucket_definitions:
  user_spaces:
    parameters: SELECT space_id FROM space_members WHERE account_id = request.user_id() AND deleted_at IS NULL
    data:
      - SELECT * FROM spaces WHERE id = bucket.space_id AND deleted_at IS NULL
      - SELECT * FROM space_members WHERE space_id = bucket.space_id AND deleted_at IS NULL
      - SELECT * FROM tasks WHERE space_id = bucket.space_id AND deleted_at IS NULL
```

Each of the Account's `space_members` rows becomes one bucket; every data query
filters by that bucket's `space_id`. An Account never receives a row from a Space
it is not a member of. Registration gives each Account exactly one Personal Space
with an `owner` membership, so out of the box a token streams only its own data.

> The `accounts` table (with password hashes) is deliberately **excluded** from
> the `powersync` publication, so it never enters the replication stream.

## Operations

- **Logs:** `docker compose logs -f powersync` (or `auth`, `postgres`).
- **Stop:** `docker compose down` (keeps data volumes).
- **Reset all data:** `docker compose down -v` (drops the Postgres volumes; on
  next up the init scripts re-run). PowerSync bucket state is rebuildable from
  the source Postgres, so wiping only `powersync_bucket_data` is safe too.
- **Rotate the signing key:** replace `AUTH_JWT_PRIVATE_KEY`, bump
  `AUTH_JWT_KID`, and restart `auth`. Existing tokens stay valid until they
  expire (`AUTH_JWT_TTL_SECONDS`).

## Security notes

- This is **minimal auth** (v1): email + password only — no OAuth, 2FA, or
  password reset.
- Change **every** secret in `.env`; never commit `.env` (it is gitignored).
- Put a TLS-terminating reverse proxy in front of `auth` and `powersync` for any
  deployment reachable off localhost.
