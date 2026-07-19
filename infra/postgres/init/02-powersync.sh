#!/bin/bash
# Configures the source Postgres for PowerSync logical replication:
#   * a `powersync` publication scoped to the SYNCABLE tables only
#     (accounts is deliberately excluded so password hashes never replicate),
#   * a replication role with REPLICATION + BYPASSRLS + SELECT.
#
# wal_level=logical is set on the server command line in docker-compose.yml
# (it cannot be changed from inside an init script — it needs a restart).
#
# Runs once, on first cluster init, as part of the postgres image entrypoint.
set -euo pipefail

: "${POWERSYNC_REPLICATION_PASSWORD:?POWERSYNC_REPLICATION_PASSWORD must be set}"

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=repl_password="$POWERSYNC_REPLICATION_PASSWORD" <<-'EOSQL'
  -- Publish only syncable tables (NOT accounts — no password_hash on the wire).
  CREATE PUBLICATION powersync FOR TABLE spaces, space_members, tasks;

  -- Replication role PowerSync connects as. BYPASSRLS so it reads every row
  -- regardless of any future row-level security; scoping is done in sync rules.
  CREATE ROLE powersync_replication WITH REPLICATION BYPASSRLS LOGIN
    PASSWORD :'repl_password';

  GRANT USAGE ON SCHEMA public TO powersync_replication;
  GRANT SELECT ON spaces, space_members, tasks TO powersync_replication;
EOSQL

echo "PowerSync publication + replication role configured."
