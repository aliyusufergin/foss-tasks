import type { Translations } from "./en";

// Type-safe `t()` keys and interpolation, checked against the English catalog.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: Translations };
  }
}
