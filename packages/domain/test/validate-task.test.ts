import { describe, expect, it } from "vitest";
import { newId } from "../src/ids.js";
import { validateTask } from "../src/validate-task.js";

const validRow = () => ({
  id: newId(),
  space_id: newId(),
  title: "Buy milk",
  status: "open",
});

describe("validateTask", () => {
  it("accepts a well-formed task", () => {
    expect(validateTask(validRow())).toEqual({ valid: true, errors: [] });
  });

  it("accepts both permitted statuses", () => {
    expect(validateTask({ ...validRow(), status: "open" }).valid).toBe(true);
    expect(validateTask({ ...validRow(), status: "done" }).valid).toBe(true);
  });

  it("rejects a non-UUID id", () => {
    const result = validateTask({ ...validRow(), id: "not-a-uuid" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("id must be a valid UUID");
  });

  it("rejects a non-UUID space_id", () => {
    const result = validateTask({ ...validRow(), space_id: "42" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("space_id must be a valid UUID");
  });

  it("rejects an empty title", () => {
    expect(validateTask({ ...validRow(), title: "" }).valid).toBe(false);
  });

  it("rejects a whitespace-only title", () => {
    const result = validateTask({ ...validRow(), title: "   " });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("title must be a non-empty string");
  });

  it("rejects a non-string title", () => {
    expect(validateTask({ ...validRow(), title: 123 }).valid).toBe(false);
  });

  it("rejects a status outside the enum", () => {
    const result = validateTask({ ...validRow(), status: "archived" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("status must be one of: open, done");
  });

  it("reports every problem at once, not just the first", () => {
    const result = validateTask({ id: "x", space_id: "y", title: "", status: "nope" });
    expect(result.errors).toHaveLength(4);
  });
});
