import { describe, expect, it } from "vitest";
import { expandModes, parseDimension } from "../../src/theme/compile";

const sample = {
  color: {
    bg: {
      base: {
        $type: "color",
        $value: "#F3F5F6",
        $extensions: { "app.foss-tasks.modes": { dark: "#000000" } },
      },
    },
    accent: {
      on: {
        $type: "color",
        $value: "#FFFFFF",
        $extensions: { "app.foss-tasks.modes": { dark: "#000000" } },
      },
    },
    priority: {
      high: { $type: "color", $value: "{color.status.overdue}" },
    },
  },
};

describe("expandModes", () => {
  it("keeps light $value in light mode", () => {
    const light = expandModes(sample, "light");
    expect((light.color as any).bg.base.$value).toBe("#F3F5F6");
  });

  it("swaps in the dark override in dark mode", () => {
    const dark = expandModes(sample, "dark");
    expect((dark.color as any).bg.base.$value).toBe("#000000");
    expect((dark.color as any).accent.on.$value).toBe("#000000");
  });

  it("leaves alias leaves untouched in both modes so they resolve per-tree", () => {
    expect((expandModes(sample, "light").color as any).priority.high.$value).toBe(
      "{color.status.overdue}",
    );
    expect((expandModes(sample, "dark").color as any).priority.high.$value).toBe(
      "{color.status.overdue}",
    );
  });

  it("drops the $extensions block", () => {
    const dark = expandModes(sample, "dark");
    expect((dark.color as any).bg.base.$extensions).toBeUndefined();
  });
});

describe("parseDimension", () => {
  it("parses px dimensions to numbers", () => {
    expect(parseDimension("8px")).toBe(8);
    expect(parseDimension("999px")).toBe(999);
    expect(parseDimension("0px")).toBe(0);
  });

  it("throws on unsupported units", () => {
    expect(() => parseDimension("1rem")).toThrow();
    expect(() => parseDimension("12")).toThrow();
  });
});
