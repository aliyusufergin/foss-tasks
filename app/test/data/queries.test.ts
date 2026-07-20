import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newId, orderKeyBetween, orderKeys } from "@foss-tasks/domain";
import {
  insertTask,
  listActiveTasks,
  moveTask,
  softDeleteTask,
  type NewTask,
} from "../../src/data/queries";
import { createSyncedTables, TestSqliteDatabase } from "../support/sqlite-db";

const SPACE = "11111111-1111-4111-8111-111111111111";
const OTHER_SPACE = "22222222-2222-4222-8222-222222222222";

function task(over: Partial<NewTask> & { order_key: string; title: string }): NewTask {
  return {
    id: newId(),
    space_id: SPACE,
    status: "open",
    created_at: "2026-07-19T10:00:00Z",
    updated_at: "2026-07-19T10:00:00Z",
    ...over,
  };
}

describe("local data layer (integration over SQLite)", () => {
  let db: TestSqliteDatabase;
  beforeEach(async () => {
    db = new TestSqliteDatabase();
    await createSyncedTables(db);
  });
  afterEach(() => db.close());

  it("reads back inserted Tasks in fractional-index order", async () => {
    const [ka, kb, kc] = orderKeys(3) as [string, string, string];
    await insertTask(db, task({ order_key: kc, title: "C" }));
    await insertTask(db, task({ order_key: ka, title: "A" }));
    await insertTask(db, task({ order_key: kb, title: "B" }));

    const titles = (await listActiveTasks(db, SPACE)).map((t) => t.title);
    expect(titles).toEqual(["A", "B", "C"]);
  });

  it("hides soft-deleted Tasks (tombstone) from reads", async () => {
    const [ka, kb] = orderKeys(2) as [string, string];
    const keep = task({ order_key: ka, title: "keep" });
    const drop = task({ order_key: kb, title: "drop" });
    await insertTask(db, keep);
    await insertTask(db, drop);

    await softDeleteTask(db, drop.id, "2026-07-19T11:00:00Z");

    const rows = await listActiveTasks(db, SPACE);
    expect(rows.map((t) => t.title)).toEqual(["keep"]);

    // The row is retained (completion history), not physically removed.
    const raw = await db.getOptional<{ deleted_at: string | null; updated_at: string }>(
      `SELECT deleted_at, updated_at FROM tasks WHERE id = ?`,
      [drop.id],
    );
    expect(raw?.deleted_at).toBe("2026-07-19T11:00:00Z");
    expect(raw?.updated_at).toBe("2026-07-19T11:00:00Z"); // delete carries an LWW clock
  });

  it("scopes reads to a single Space", async () => {
    await insertTask(db, task({ order_key: orderKeys(1)[0]!, title: "mine" }));
    await insertTask(
      db,
      task({ space_id: OTHER_SPACE, order_key: orderKeys(1)[0]!, title: "theirs" }),
    );
    const rows = await listActiveTasks(db, SPACE);
    expect(rows.map((t) => t.title)).toEqual(["mine"]);
  });

  it("reorders with a single-row write that yields a stable order", async () => {
    const [ka, kb, kc] = orderKeys(3) as [string, string, string];
    const a = task({ order_key: ka, title: "A" });
    const b = task({ order_key: kb, title: "B" });
    const c = task({ order_key: kc, title: "C" });
    await insertTask(db, a);
    await insertTask(db, b);
    await insertTask(db, c);

    // Move C to the front — only C's row changes.
    await moveTask(db, c.id, orderKeyBetween(null, ka), "2026-07-19T12:00:00Z");

    const rows = await listActiveTasks(db, SPACE);
    expect(rows.map((t) => t.title)).toEqual(["C", "A", "B"]);
    const movedC = rows.find((t) => t.id === c.id);
    expect(movedC?.updated_at).toBe("2026-07-19T12:00:00Z");
    expect(rows.find((t) => t.id === a.id)?.updated_at).toBe("2026-07-19T10:00:00Z");
  });
});
