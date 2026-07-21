import { exportPKCS8, generateKeyPair } from "jose";
import { newId } from "@foss-tasks/domain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { signAccessToken } from "../src/domain/jwt.js";
import { loadSigningKey } from "../src/keys.js";
import type { SigningKey } from "../src/keys.js";
import { PgWriteStore } from "../src/db/write-store.js";
import { buildServer } from "../src/server.js";
import { InMemoryAuthRepo } from "./support/in-memory-repo.js";
import { createTestDb } from "./support/pglite-pool.js";
import type { TestDb } from "./support/pglite-pool.js";
import {
  insertMembership,
  insertSpace,
  insertTask,
  readRejected,
  readTask,
  seedMemberInSpace,
} from "./support/seed.js";

const ISSUER = "foss-tasks-auth";
const AUDIENCE = "powersync";
const NOW = new Date("2026-07-21T12:00:00.000Z");
const iso = (offsetMs: number) => new Date(NOW.getTime() + offsetMs).toISOString();

let db: TestDb;
let app: FastifyInstance;
let signingKey: SigningKey;

// PGlite's WASM init costs ~2s, so the database and server are built once for the
// file and each test starts from a truncated schema rather than a fresh engine.
beforeAll(async () => {
  db = await createTestDb();
  const { privateKey } = await generateKeyPair("RS256", { extractable: true });
  signingKey = await loadSigningKey(await exportPKCS8(privateKey), "kid-1");
  app = buildServer({
    repo: new InMemoryAuthRepo(),
    signingKey,
    writeStore: new PgWriteStore(db.pool),
    issuer: ISSUER,
    audience: AUDIENCE,
    tokenTtlSeconds: 900,
    sessionMaxAgeSeconds: 30 * 24 * 60 * 60,
    now: () => NOW,
  });
});

beforeEach(async () => {
  await db.pool.query(
    `TRUNCATE tasks, rejected_writes, space_members, accounts, spaces RESTART IDENTITY CASCADE`,
  );
});

afterAll(async () => {
  await app.close();
  await db.close();
});

async function token(accountId: string, at: Date = NOW): Promise<string> {
  return signAccessToken({
    privateKey: signingKey.privateKey,
    kid: signingKey.kid,
    issuer: ISSUER,
    audience: AUDIENCE,
    subject: accountId,
    ttlSeconds: 900,
    now: () => at,
  });
}

async function write(accountId: string, ops: unknown[], at?: Date) {
  return app.inject({
    method: "POST",
    url: "/sync/write",
    headers: { authorization: `Bearer ${await token(accountId, at)}` },
    payload: { transaction_id: 1, ops },
  });
}

const putTask = (id: string, spaceId: string, extra: Record<string, unknown> = {}) => ({
  op: "PUT",
  type: "tasks",
  id,
  data: { space_id: spaceId, title: "Buy milk", status: "open", updated_at: iso(0), ...extra },
});

describe("POST /sync/write — happy path", () => {
  it("applies a valid transaction and returns 200 { applied, rejected: [] }", async () => {
    const { accountId, spaceId } = await seedMemberInSpace(db.pool);
    const taskId = newId();

    const res = await write(accountId, [putTask(taskId, spaceId)]);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ applied: 1, rejected: [] });
    const stored = await readTask(db.pool, taskId);
    expect(stored?.title).toBe("Buy milk");
    expect(stored?.space_id).toBe(spaceId);
  });

  it("applies multiple ops in one device transaction atomically", async () => {
    const { accountId, spaceId } = await seedMemberInSpace(db.pool);
    const a = newId();
    const b = newId();

    const res = await write(accountId, [
      putTask(a, spaceId, { title: "A" }),
      putTask(b, spaceId, { title: "B" }),
    ]);

    expect(res.json()).toEqual({ applied: 2, rejected: [] });
    expect((await readTask(db.pool, a))?.title).toBe("A");
    expect((await readTask(db.pool, b))?.title).toBe("B");
  });
});

describe("POST /sync/write — authorization", () => {
  it("rejects a missing token with 401", async () => {
    const res = await app.inject({ method: "POST", url: "/sync/write", payload: { ops: [] } });
    expect(res.statusCode).toBe(401);
  });

  it("rejects a malformed token with 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/sync/write",
      headers: { authorization: "Bearer not.a.jwt" },
      payload: { ops: [] },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects an expired token with 401", async () => {
    const { accountId, spaceId } = await seedMemberInSpace(db.pool);
    // Issued 1h before NOW with a 900s TTL: expired by the server's fixed clock.
    const res = await write(accountId, [putTask(newId(), spaceId)], new Date(NOW.getTime() - 3600_000));
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /sync/write — membership", () => {
  it("rejects an op on a Space the Account is not a member of; nothing is written", async () => {
    const { accountId } = await seedMemberInSpace(db.pool);
    const strangerSpace = await insertSpace(db.pool);
    const taskId = newId();

    const res = await write(accountId, [putTask(taskId, strangerSpace)]);

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.applied).toBe(0);
    expect(body.rejected).toEqual([
      { op_index: 0, id: taskId, type: "tasks", reason: "not_a_member" },
    ]);
    expect(await readTask(db.pool, taskId)).toBeNull();
    const rejected = await readRejected(db.pool);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({ reason: "not_a_member", row_id: taskId });
    // The device transaction id is recorded so #5 can group a rejected tx's ops.
    expect(rejected[0]?.transaction_id).toBe("1");
  });

  it("rejects when the STORED space_id is a Space the Account cannot read, even if the op's own space_id is theirs", async () => {
    const { accountId, spaceId } = await seedMemberInSpace(db.pool);
    const victimSpace = await insertSpace(db.pool);
    // A task the attacker cannot see, living in a Space they are not in.
    const taskId = await insertTask(db.pool, { spaceId: victimSpace, updatedAt: new Date(NOW.getTime() - 1000) });

    // The forged op claims a space_id the attacker *is* in.
    const res = await write(accountId, [
      { op: "PATCH", type: "tasks", id: taskId, data: { space_id: spaceId, title: "hijacked", updated_at: iso(0) } },
    ]);

    expect(res.statusCode).toBe(200);
    expect(res.json().rejected[0]).toMatchObject({ reason: "not_a_member" });
    expect((await readTask(db.pool, taskId))?.title).toBe("Task");
  });

  it("does not leak writes across a rolled-back mixed transaction", async () => {
    const { accountId, spaceId } = await seedMemberInSpace(db.pool);
    const strangerSpace = await insertSpace(db.pool);
    const good = newId();
    const bad = newId();

    const res = await write(accountId, [putTask(good, spaceId), putTask(bad, strangerSpace)]);

    expect(res.json().applied).toBe(0);
    expect(await readTask(db.pool, good)).toBeNull();
    const rejected = await readRejected(db.pool);
    expect(rejected).toHaveLength(2);
    const reasons = rejected.map((r) => r.reason).sort();
    expect(reasons).toEqual(["not_a_member", "transaction_rolled_back"]);
  });
});

describe("POST /sync/write — writable set", () => {
  it("rejects an op on space_members as not writable", async () => {
    const { accountId, spaceId } = await seedMemberInSpace(db.pool);
    const res = await write(accountId, [
      { op: "PUT", type: "space_members", id: newId(), data: { space_id: spaceId, updated_at: iso(0) } },
    ]);
    expect(res.json().rejected[0]).toMatchObject({ reason: "not_writable", type: "space_members" });
  });

  it("rejects an op on spaces as not writable", async () => {
    const { accountId } = await seedMemberInSpace(db.pool);
    const res = await write(accountId, [
      { op: "PUT", type: "spaces", id: newId(), data: { updated_at: iso(0) } },
    ]);
    expect(res.json().rejected[0]).toMatchObject({ reason: "not_writable", type: "spaces" });
  });
});

describe("POST /sync/write — LWW and clock clamp", () => {
  it("does not overwrite a newer stored row, and reports the stale op as applied", async () => {
    const { accountId, spaceId } = await seedMemberInSpace(db.pool);
    const taskId = await insertTask(db.pool, { spaceId, title: "newer", updatedAt: NOW });

    // Incoming op is older than the stored row.
    const res = await write(accountId, [
      { op: "PATCH", type: "tasks", id: taskId, data: { title: "older", updated_at: iso(-60_000) } },
    ]);

    expect(res.json()).toEqual({ applied: 1, rejected: [] });
    expect((await readTask(db.pool, taskId))?.title).toBe("newer");
  });

  it("clamps a far-future updated_at to server time, and a later normal write still wins", async () => {
    const { accountId, spaceId } = await seedMemberInSpace(db.pool);
    const taskId = newId();

    // A phone set a year ahead.
    await write(accountId, [putTask(taskId, spaceId, { title: "from the future", updated_at: iso(365 * 24 * 3600_000) })]);
    const clamped = await readTask(db.pool, taskId);
    expect(clamped?.updated_at.toISOString()).toBe(NOW.toISOString());

    // A normal write one minute later overwrites it — it would not, had the future value stuck.
    const res = await write(accountId, [
      { op: "PATCH", type: "tasks", id: taskId, data: { title: "corrected", updated_at: iso(60_000) } },
    ]);
    expect(res.json().applied).toBe(1);
    expect((await readTask(db.pool, taskId))?.title).toBe("corrected");
  });

  it("rejects an op with a missing updated_at", async () => {
    const { accountId, spaceId } = await seedMemberInSpace(db.pool);
    const res = await write(accountId, [
      { op: "PUT", type: "tasks", id: newId(), data: { space_id: spaceId, title: "x", status: "open" } },
    ]);
    expect(res.json().rejected[0]).toMatchObject({ reason: "invalid_updated_at" });
  });
});

describe("POST /sync/write — op semantics", () => {
  it("DELETE sets deleted_at rather than removing the row", async () => {
    const { accountId, spaceId } = await seedMemberInSpace(db.pool);
    const taskId = await insertTask(db.pool, { spaceId, updatedAt: new Date(NOW.getTime() - 1000) });

    const res = await write(accountId, [
      { op: "DELETE", type: "tasks", id: taskId, data: { updated_at: iso(0) } },
    ]);

    expect(res.json().applied).toBe(1);
    const stored = await readTask(db.pool, taskId);
    expect(stored).not.toBeNull();
    expect(stored?.deleted_at).not.toBeNull();
  });

  it("rejects a PATCH for a row that does not exist and dead-letters it", async () => {
    const { accountId } = await seedMemberInSpace(db.pool);
    const missing = newId();
    const res = await write(accountId, [
      { op: "PATCH", type: "tasks", id: missing, data: { title: "x", updated_at: iso(0) } },
    ]);
    expect(res.json().rejected[0]).toMatchObject({ reason: "row_not_found" });
    expect((await readRejected(db.pool))[0]).toMatchObject({ reason: "row_not_found", row_id: missing });
  });

  it("rejects a DELETE for a row that does not exist", async () => {
    const { accountId } = await seedMemberInSpace(db.pool);
    const res = await write(accountId, [
      { op: "DELETE", type: "tasks", id: newId(), data: { updated_at: iso(0) } },
    ]);
    expect(res.json().rejected[0]).toMatchObject({ reason: "row_not_found" });
  });

  it("rejects a PUT that fails validateTask", async () => {
    const { accountId, spaceId } = await seedMemberInSpace(db.pool);
    const res = await write(accountId, [
      putTask(newId(), spaceId, { title: "   " }), // whitespace-only title
    ]);
    expect(res.json().rejected[0]).toMatchObject({ reason: "invalid_task" });
  });
});

describe("POST /sync/write — limits and idempotency", () => {
  it("returns 413 for more than 1000 ops", async () => {
    const { accountId, spaceId } = await seedMemberInSpace(db.pool);
    const ops = Array.from({ length: 1001 }, () => putTask(newId(), spaceId));
    const res = await write(accountId, ops);
    expect(res.statusCode).toBe(413);
  });

  it("returns 400 for a non-CRUD body", async () => {
    const { accountId } = await seedMemberInSpace(db.pool);
    const res = await app.inject({
      method: "POST",
      url: "/sync/write",
      headers: { authorization: `Bearer ${await token(accountId)}` },
      payload: { not: "ops" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("is idempotent: replaying an identical transaction leaves the same final state", async () => {
    const { accountId, spaceId } = await seedMemberInSpace(db.pool);
    const taskId = newId();
    const ops = [putTask(taskId, spaceId, { title: "once" })];

    const first = await write(accountId, ops);
    const second = await write(accountId, ops);

    expect(first.json().applied).toBe(1);
    expect(second.json().applied).toBe(1);
    const { rows } = await db.pool.query(`SELECT count(*)::int AS n FROM tasks WHERE id = $1`, [taskId]);
    expect((rows[0] as { n: number }).n).toBe(1);
    expect((await readTask(db.pool, taskId))?.title).toBe("once");
  });

  it("allows a member of both Spaces to move a task between them", async () => {
    const { accountId, spaceId } = await seedMemberInSpace(db.pool);
    const otherSpace = await insertSpace(db.pool);
    await insertMembership(db.pool, { spaceId: otherSpace, accountId });
    const taskId = await insertTask(db.pool, { spaceId, updatedAt: new Date(NOW.getTime() - 1000) });

    const res = await write(accountId, [
      { op: "PATCH", type: "tasks", id: taskId, data: { space_id: otherSpace, updated_at: iso(0) } },
    ]);

    expect(res.json().applied).toBe(1);
    expect((await readTask(db.pool, taskId))?.space_id).toBe(otherSpace);
  });
});
