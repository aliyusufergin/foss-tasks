import { describe, expect, it } from "vitest";
import {
  darkColors,
  lightColors,
  radii,
  spacing,
  typography,
} from "../../src/theme/tokens.generated";

/**
 * Pins a few known outputs of the Style Dictionary pipeline so a broken build
 * (bad colour conversion, dropped mode, unresolved alias) fails CI rather than
 * shipping. If the design tokens legitimately change, re-run `npm run build:theme`
 * and update these.
 */
describe("generated tokens", () => {
  it("light and dark carry the same colour keys", () => {
    expect(Object.keys(lightColors).sort()).toEqual(Object.keys(darkColors).sort());
  });

  it("has the Ink & Signal screen backgrounds per mode", () => {
    expect(lightColors["bg.base"]).toBe("#F3F5F6");
    expect(darkColors["bg.base"]).toBe("#000000");
  });

  it("resolves the priority.high alias to status.overdue in both modes", () => {
    expect(lightColors["priority.high"]).toBe(lightColors["status.overdue"]);
    expect(darkColors["priority.high"]).toBe(darkColors["status.overdue"]);
  });

  it("emits RN-safe uppercase hex for every colour", () => {
    for (const value of [...Object.values(lightColors), ...Object.values(darkColors)]) {
      expect(value).toMatch(/^#[0-9A-F]{6}([0-9A-F]{2})?$/);
    }
  });

  it("carries unitless numeric spacing and radii", () => {
    expect(spacing.lg).toBe(16);
    expect(radii.pill).toBe(999);
  });

  it("parses typography sizes to numbers", () => {
    expect(typography.display.fontSize).toBe(28);
    expect(typography.body.lineHeight).toBe(20);
  });
});
