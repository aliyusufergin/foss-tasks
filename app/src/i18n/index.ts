import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import type { LanguagePreference } from "../prefs/language-preference";
import { en } from "./en";
import { tr } from "./tr";

export const SUPPORTED_LANGUAGES = ["en", "tr"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const FALLBACK: Language = "en";

/** Pick the app language from the device locales, falling back to English. */
export function deviceLanguage(): Language {
  for (const locale of getLocales()) {
    const code = locale.languageCode?.toLowerCase();
    if (code !== undefined && (SUPPORTED_LANGUAGES as readonly string[]).includes(code)) {
      return code as Language;
    }
  }
  return FALLBACK;
}

/** Resolve a stored preference to a concrete language (`system` -> device locale). */
export function resolveLanguage(pref: LanguagePreference): Language {
  return pref === "system" ? deviceLanguage() : pref;
}

/**
 * Initialise i18next once, seeded from the stored preference (or the device
 * locale). React components read strings via `useTranslation()`; nothing is
 * hardcoded (CONTEXT.md § Localization). Call before rendering the tree.
 */
export function initI18n(pref: LanguagePreference = "system"): typeof i18n {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources: {
        en: { translation: en },
        tr: { translation: tr },
      },
      lng: resolveLanguage(pref),
      fallbackLng: FALLBACK,
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  }
  return i18n;
}

/** Switch the live UI language at runtime for a stored preference. */
export async function applyLanguage(pref: LanguagePreference): Promise<void> {
  await i18n.changeLanguage(resolveLanguage(pref));
}

export { default as i18n } from "i18next";
