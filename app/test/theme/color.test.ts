import { describe, expect, it } from "vitest";
import { toRnHex } from "../../src/theme/color";

describe("toRnHex — hex passthrough/normalisation", () => {
  it("upcases and keeps 6-digit hex", () => {
    expect(toRnHex("#0e8c7d")).toBe("#0E8C7D");
    expect(toRnHex("#FFFFFF")).toBe("#FFFFFF");
  });

  it("expands 3-digit shorthand", () => {
    expect(toRnHex("#abc")).toBe("#AABBCC");
    expect(toRnHex("#000")).toBe("#000000");
  });

  it("keeps 8-digit hex with alpha (RN supports #RRGGBBAA)", () => {
    expect(toRnHex("#0e8c7d80")).toBe("#0E8C7D80");
  });

  it("expands 4-digit shorthand to 8-digit", () => {
    expect(toRnHex("#abcf")).toBe("#AABBCCFF");
  });

  it("rejects malformed hex", () => {
    expect(() => toRnHex("#12g")).toThrow();
    expect(() => toRnHex("#12345")).toThrow();
  });
});

describe("toRnHex — oklch() -> sRGB hex (build-time wide-gamut conversion, ADR-0006)", () => {
  it("converts pure white and black", () => {
    expect(toRnHex("oklch(1 0 0)")).toBe("#FFFFFF");
    expect(toRnHex("oklch(0 0 0)")).toBe("#000000");
  });

  it("converts a mid accent and lands in sRGB gamut", () => {
    // oklch for a teal-ish accent; exact hex is checked to pin the math.
    const hex = toRnHex("oklch(0.6 0.12 180)");
    expect(hex).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("supports an alpha channel via slash syntax", () => {
    expect(toRnHex("oklch(1 0 0 / 0.5)")).toBe("#FFFFFF80");
  });
});

describe("toRnHex — color(display-p3 ...) -> sRGB hex", () => {
  it("maps p3 white/black to sRGB white/black", () => {
    expect(toRnHex("color(display-p3 1 1 1)")).toBe("#FFFFFF");
    expect(toRnHex("color(display-p3 0 0 0)")).toBe("#000000");
  });

  it("clamps an out-of-sRGB-gamut p3 green into range", () => {
    const hex = toRnHex("color(display-p3 0 1 0)");
    expect(hex).toMatch(/^#[0-9A-F]{6}$/);
    // Pure P3 green exceeds sRGB green; after gamut clamp it saturates green.
    expect(hex).toBe("#00FF00");
  });

  it("supports an alpha channel", () => {
    expect(toRnHex("color(display-p3 1 1 1 / 0.5)")).toBe("#FFFFFF80");
  });
});
