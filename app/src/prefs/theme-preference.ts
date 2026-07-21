import { type DeviceKeyValueStore, EnumPreferenceStore } from "./store";

/**
 * The chosen Theme is a **device-local** preference — never synced (CONTEXT.md
 * § Preferences: "phone dark, tablet light").
 *
 * `system` follows the OS light/dark setting; `light`/`dark` pin it.
 */
export type ThemeMode = "system" | "light" | "dark";

export const DEFAULT_THEME_MODE: ThemeMode = "system";
export const THEME_MODES: readonly ThemeMode[] = ["system", "light", "dark"];

export class ThemePreferenceStore extends EnumPreferenceStore<ThemeMode> {
  constructor(store: DeviceKeyValueStore) {
    super(store, "foss-tasks.themeMode", THEME_MODES, DEFAULT_THEME_MODE);
  }
}
