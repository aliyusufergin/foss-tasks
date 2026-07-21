import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_LANGUAGE_PREFERENCE,
  LanguagePreferenceStore,
  type LanguagePreference,
} from "../../src/prefs/language-preference";
import { MemoryKeyValueStore } from "../support/memory-kv";

describe("LanguagePreferenceStore", () => {
  let store: MemoryKeyValueStore;
  let prefs: LanguagePreferenceStore;

  beforeEach(() => {
    store = new MemoryKeyValueStore();
    prefs = new LanguagePreferenceStore(store);
  });

  it("defaults to system", async () => {
    expect(await prefs.load()).toBe(DEFAULT_LANGUAGE_PREFERENCE);
    expect(DEFAULT_LANGUAGE_PREFERENCE).toBe("system");
  });

  it("round-trips every valid preference", async () => {
    for (const pref of ["system", "en", "tr"] as LanguagePreference[]) {
      await prefs.save(pref);
      expect(await prefs.load()).toBe(pref);
    }
  });

  it("falls back to system for a corrupt value", async () => {
    await store.setItem("foss-tasks.language", "kryptonian");
    expect(await prefs.load()).toBe("system");
  });
});
