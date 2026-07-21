/**
 * English UI strings. Keys are grouped by screen/feature. Turkish (`tr.ts`) must
 * carry the exact same key set — a test enforces parity so a missing translation
 * is caught in CI, not on a device. No UI string is hardcoded in a component
 * (CONTEXT.md § Localization).
 */
export const en = {
  common: {
    appName: "foss-tasks",
    signOut: "Sign out",
    bootError: "Couldn't start",
  },
  auth: {
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    passwordLabel: "Password",
    passwordPlaceholder: "••••••••",
    signIn: "Sign in",
    register: "Create account",
    switchToRegister: "New here? Create an account",
    switchToSignIn: "Have an account? Sign in",
  },
  tasks: {
    title: "Today",
    empty: "All clear",
    emptyHint: "Tasks stream in from your Server.",
    readOnlyNote: "Read-only until the write path ships.",
    statusLive: "Live",
    statusOffline: "Offline",
    statusStopped: "Sync stopped",
    syncError: "Sync error: {{message}}",
  },
  settings: {
    title: "Settings",
    theme: "Theme",
    themeSystem: "System",
    themeLight: "Light",
    themeDark: "Dark",
    language: "Language",
    languageSystem: "System",
    languageEnglish: "English",
    languageTurkish: "Türkçe",
  },
  tabs: {
    today: "Today",
    settings: "Settings",
  },
} as const;

/** The English catalog is the source of truth for keys; translations must match
 *  the *shape* but carry their own strings, so leaf types widen to `string`. */
type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Translations = Widen<typeof en>;
