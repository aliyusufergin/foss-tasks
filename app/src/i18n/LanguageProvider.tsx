import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LANGUAGE_PREFERENCE,
  type LanguagePreference,
  LanguagePreferenceStore,
} from "../prefs/language-preference";
import { applyLanguage } from "./index";

interface LanguageControl {
  pref: LanguagePreference;
  setPref: (pref: LanguagePreference) => void;
}

const LanguageControlContext = createContext<LanguageControl | null>(null);

export function useLanguageControl(): LanguageControl {
  const ctx = useContext(LanguageControlContext);
  if (ctx === null) {
    throw new Error("useLanguageControl must be used within <LanguageProvider>");
  }
  return ctx;
}

interface Props {
  store: LanguagePreferenceStore;
  children: ReactNode;
}

/**
 * Owns the device-local language preference: loads it on launch, applies changes
 * to i18next at runtime, and persists them. i18next was already seeded with the
 * stored preference at boot, so this reconciles once React mounts and on change.
 */
export function LanguageProvider({ store, children }: Props): JSX.Element {
  const [pref, setPrefState] = useState<LanguagePreference>(DEFAULT_LANGUAGE_PREFERENCE);

  useEffect(() => {
    void store.load().then((stored) => {
      setPrefState(stored);
      void applyLanguage(stored);
    });
  }, [store]);

  const setPref = useCallback(
    (next: LanguagePreference) => {
      setPrefState(next);
      void applyLanguage(next);
      void store.save(next).catch(() => undefined);
    },
    [store],
  );

  const control = useMemo<LanguageControl>(() => ({ pref, setPref }), [pref, setPref]);

  return (
    <LanguageControlContext.Provider value={control}>{children}</LanguageControlContext.Provider>
  );
}
