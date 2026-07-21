import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_MODE,
  ThemePreferenceStore,
  type ThemeMode,
} from "../../src/prefs/theme-preference";
import { MemoryKeyValueStore } from "../support/memory-kv";

describe("ThemePreferenceStore", () => {
  let store: MemoryKeyValueStore;
  let prefs: ThemePreferenceStore;

  beforeEach(() => {
    store = new MemoryKeyValueStore();
    prefs = new ThemePreferenceStore(store);
  });

  it("defaults to system on a fresh device", async () => {
    expect(await prefs.load()).toBe(DEFAULT_THEME_MODE);
    expect(DEFAULT_THEME_MODE).toBe("system");
  });

  it("round-trips a chosen mode", async () => {
    await prefs.save("dark");
    expect(await prefs.load()).toBe("dark");
  });

  it("falls back to the default for a corrupt stored value", async () => {
    await store.setItem("foss-tasks.themeMode", "chartreuse");
    expect(await prefs.load()).toBe("system");
  });

  it("accepts every valid mode", async () => {
    for (const mode of ["system", "light", "dark"] as ThemeMode[]) {
      await prefs.save(mode);
      expect(await prefs.load()).toBe(mode);
    }
  });
});
