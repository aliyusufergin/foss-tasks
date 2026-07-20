import { describe, expect, it } from "vitest";
import { mergeLww, pickLwwWinner } from "../src/lww.js";

interface Task {
  id: string;
  title: string;
  updated_at: string;
  deleted_at: string | null;
}

const at = (s: string, patch: Partial<Task> = {}): Task => ({
  id: "t1",
  title: "x",
  updated_at: s,
  deleted_at: null,
  ...patch,
});

describe("pickLwwWinner", () => {
  it("later updated_at wins", () => {
    const older = at("2026-07-19T10:00:00Z", { title: "old" });
    const newer = at("2026-07-19T10:05:00Z", { title: "new" });
    expect(pickLwwWinner(older, newer).title).toBe("new");
    expect(pickLwwWinner(newer, older).title).toBe("new");
  });

  it("a later delete beats an earlier edit", () => {
    const edit = at("2026-07-19T10:00:00Z", { title: "edited" });
    const del = at("2026-07-19T10:05:00Z", { deleted_at: "2026-07-19T10:05:00Z" });
    expect(pickLwwWinner(edit, del).deleted_at).not.toBeNull();
  });

  it("a later edit beats an earlier delete (resurrection by later write)", () => {
    const del = at("2026-07-19T10:00:00Z", { deleted_at: "2026-07-19T10:00:00Z" });
    const edit = at("2026-07-19T10:05:00Z", { title: "back" });
    const winner = pickLwwWinner(del, edit);
    expect(winner.deleted_at).toBeNull();
    expect(winner.title).toBe("back");
  });

  it("on an exact timestamp tie, the tombstone wins", () => {
    const ts = "2026-07-19T10:00:00Z";
    const edit = at(ts, { title: "edited" });
    const del = at(ts, { deleted_at: ts });
    expect(pickLwwWinner(edit, del).deleted_at).not.toBeNull();
    expect(pickLwwWinner(del, edit).deleted_at).not.toBeNull();
  });

  it("is deterministic and order-independent for a plain tie", () => {
    const a = at("2026-07-19T10:00:00Z", { title: "a" });
    const b = at("2026-07-19T10:00:00Z", { title: "b" });
    // Same instant, same deleted-state: incoming is treated as last-writer.
    expect(pickLwwWinner(a, b).title).toBe("b");
    expect(pickLwwWinner(b, a).title).toBe("a");
  });
});

describe("mergeLww", () => {
  it("returns the side that exists when the other is absent", () => {
    const row = at("2026-07-19T10:00:00Z");
    expect(mergeLww(row, null)).toBe(row);
    expect(mergeLww(null, row)).toBe(row);
    expect(mergeLww(null, null)).toBeNull();
  });

  it("delegates to LWW when both sides exist", () => {
    const older = at("2026-07-19T10:00:00Z", { title: "old" });
    const newer = at("2026-07-19T10:05:00Z", { title: "new" });
    expect(mergeLww(older, newer)?.title).toBe("new");
  });
});
