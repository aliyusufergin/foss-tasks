import { describe, expect, it } from "vitest";
import {
  firstOrderKey,
  orderKeyAfter,
  orderKeyBefore,
  orderKeyBetween,
  orderKeys,
} from "../src/order-key.js";

/** Simulate a list as (id, order_key) pairs sorted the way the data layer sorts. */
function sortedIds(rows: Array<{ id: string; order_key: string }>): string[] {
  return [...rows]
    .sort((a, b) => (a.order_key < b.order_key ? -1 : a.order_key > b.order_key ? 1 : 0))
    .map((r) => r.id);
}

describe("order-key", () => {
  it("appends keep ascending order", () => {
    let last: string | null = null;
    const keys: string[] = [];
    for (let i = 0; i < 50; i++) {
      last = orderKeyAfter(last);
      keys.push(last);
    }
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
  });

  it("orderKeyBetween lands strictly between its neighbours", () => {
    const a = firstOrderKey();
    const b = orderKeyAfter(a);
    const mid = orderKeyBetween(a, b);
    expect(a < mid).toBe(true);
    expect(mid < b).toBe(true);
  });

  it("moving one row is a single-key change that yields a stable order", () => {
    // Seed a 4-row list: A B C D.
    const [ka, kb, kc, kd] = orderKeys(4) as [string, string, string, string];
    const rows = [
      { id: "A", order_key: ka },
      { id: "B", order_key: kb },
      { id: "C", order_key: kc },
      { id: "D", order_key: kd },
    ];
    expect(sortedIds(rows)).toEqual(["A", "B", "C", "D"]);

    // Move D between A and B — only D's key changes.
    const moved = rows.map((r) =>
      r.id === "D" ? { ...r, order_key: orderKeyBetween(ka, kb) } : r,
    );
    expect(sortedIds(moved)).toEqual(["A", "D", "B", "C"]);
  });

  it("prepend sorts before the first row", () => {
    const first = firstOrderKey();
    const before = orderKeyBefore(first);
    expect(before < first).toBe(true);
  });

  it("repeated inserts at the same gap stay strictly ordered", () => {
    let lo = firstOrderKey();
    const hi = orderKeyAfter(lo);
    const between: string[] = [];
    for (let i = 0; i < 20; i++) {
      const k = orderKeyBetween(lo, hi);
      between.push(k);
      lo = k; // next insert goes just after the one we made
    }
    const all = [...between, hi];
    expect(all).toEqual([...all].sort());
    expect(new Set(all).size).toBe(all.length);
  });
});
