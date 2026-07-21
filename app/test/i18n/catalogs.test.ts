import { describe, expect, it } from "vitest";
import { en } from "../../src/i18n/en";
import { tr } from "../../src/i18n/tr";

/** Flatten a nested string catalog to dotted leaf keys. */
function keys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix === "" ? k : `${prefix}.${k}`;
    return typeof v === "object" && v !== null
      ? keys(v as Record<string, unknown>, path)
      : [path];
  });
}

describe("i18n catalogs", () => {
  it("Turkish covers exactly the English key set", () => {
    expect(keys(tr).sort()).toEqual(keys(en).sort());
  });

  it("has no empty strings", () => {
    const flat = (obj: Record<string, unknown>): string[] =>
      Object.values(obj).flatMap((v) =>
        typeof v === "object" && v !== null ? flat(v as Record<string, unknown>) : [String(v)],
      );
    for (const value of [...flat(en), ...flat(tr)]) {
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
