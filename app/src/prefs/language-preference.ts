import { type DeviceKeyValueStore, EnumPreferenceStore } from "./store";

/**
 * The chosen UI language is device-local, like the theme. When set to `system`
 * the app follows the device locale (see `i18n/deviceLanguage`); `en`/`tr` pin it.
 */
export type LanguagePreference = "system" | "en" | "tr";

export const DEFAULT_LANGUAGE_PREFERENCE: LanguagePreference = "system";
export const LANGUAGE_PREFERENCES: readonly LanguagePreference[] = ["system", "en", "tr"];

export class LanguagePreferenceStore extends EnumPreferenceStore<LanguagePreference> {
  constructor(store: DeviceKeyValueStore) {
    super(store, "foss-tasks.language", LANGUAGE_PREFERENCES, DEFAULT_LANGUAGE_PREFERENCE);
  }
}
