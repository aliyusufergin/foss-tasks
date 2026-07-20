import { describe, expect, it } from "vitest";
import { isValidId, newId } from "../../src/domain/ids.js";

describe("newId", () => {
  it("mints a valid UUID", () => {
    expect(isValidId(newId())).toBe(true);
  });

  it("is collision-free across many calls (client-generated pks)", () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => newId()));
    expect(ids.size).toBe(10_000);
  });
});

describe("isValidId", () => {
  it("rejects non-UUID strings", () => {
    expect(isValidId("")).toBe(false);
    expect(isValidId("not-a-uuid")).toBe(false);
    expect(isValidId("12345678-1234-1234-1234-123456789012")).toBe(false); // bad version nibble
  });
});
