-- Dead-letter table for writes /sync/write refuses (ADR-0008 §9).
--
-- A permanently-rejected CRUD transaction rolls back, then every op is recorded
-- here in a SEPARATE transaction and the request still returns 200 — so the
-- client's queue drains and downloads never stall, while the write is neither
-- applied nor silently gone.
--
-- Deliberately NOT in the `powersync` publication (declared FOR TABLE spaces,
-- space_members, tasks): raw rejected payloads must never replicate to devices.
CREATE TABLE rejected_writes (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id   uuid NOT NULL,
  -- The CRUD op verb (PUT/PATCH/DELETE) and target table, as received. Kept as
  -- text, not constrained: a malformed op is exactly the kind of thing that
  -- lands here, so the columns must tolerate whatever the client sent.
  op           text,
  table_name   text,
  row_id       text,
  reason       text NOT NULL,
  data         jsonb,
  -- Echo of the device transaction id the op belonged to, so every op of a
  -- rejected transaction can be grouped back together when #5 surfaces them.
  transaction_id  text,
  rejected_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rejected_writes_account_id_idx ON rejected_writes (account_id);
