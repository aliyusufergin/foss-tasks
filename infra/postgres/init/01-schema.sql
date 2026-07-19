-- Source-of-truth schema for foss-tasks.
--
-- Design notes (see CONTEXT.md + docs/adr):
--   * Every syncable row carries updated_at and a deleted_at soft-delete
--     tombstone (offline sync + retained completion history).
--   * All primary keys are UUIDs (client-generated on device; the auth service
--     generates them for Account/Space/membership).
--   * The `accounts` table is auth-only and is NOT published for replication —
--     password hashes never reach the PowerSync pipeline (see 02-powersync.sh).
--   * v1 exposes only Personal Spaces, but the Space model + membership ship now
--     so Group Spaces (v2) need no migration (ADR-0003).

BEGIN;

-- Spaces — the unit of ownership and sync scope.
CREATE TABLE spaces (
  id          uuid PRIMARY KEY,
  name        text NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('personal', 'group')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

-- Accounts — one human user (email + password). Auth-only, not synced.
CREATE TABLE accounts (
  id                 uuid PRIMARY KEY,
  email              text NOT NULL UNIQUE,
  password_hash      text NOT NULL,
  personal_space_id  uuid NOT NULL REFERENCES spaces (id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Space membership — the sync scope. Sync rules scope rows by membership here,
-- never by raw account id. Roles carry the v2 permission model (viewer = RO).
CREATE TABLE space_members (
  id          uuid PRIMARY KEY,
  space_id    uuid NOT NULL REFERENCES spaces (id),
  account_id  uuid NOT NULL REFERENCES accounts (id),
  role        text NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE (space_id, account_id)
);

CREATE INDEX space_members_account_id_idx ON space_members (account_id);

-- Tasks — minimal stub so per-Space sync scoping is demonstrable end-to-end.
-- The full Task shape (schedule/deadline/recurrence/etc.) lands with the
-- walking-skeleton ticket (#5); this is only the columns sync scoping needs.
CREATE TABLE tasks (
  id          uuid PRIMARY KEY,
  space_id    uuid NOT NULL REFERENCES spaces (id),
  title       text NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX tasks_space_id_idx ON tasks (space_id);

COMMIT;
