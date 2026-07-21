import { ThemeProvider as RestyleProvider } from "@shopify/restyle";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import { DEFAULT_THEME_MODE, type ThemeMode, ThemePreferenceStore } from "../prefs/theme-preference";
import { themes } from "./theme";

interface ThemeControl {
  /** The user's stored choice: `system` | `light` | `dark`. */
  mode: ThemeMode;
  /** The scheme actually rendering (`system` resolved against the OS). */
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
}

const ThemeControlContext = createContext<ThemeControl | null>(null);

/** Read + change the device-local theme preference. */
export function useThemeControl(): ThemeControl {
  const ctx = useContext(ThemeControlContext);
  if (ctx === null) {
    throw new Error("useThemeControl must be used within <AppThemeProvider>");
  }
  return ctx;
}

interface Props {
  store: ThemePreferenceStore;
  children: ReactNode;
}

/**
 * Owns the theme preference: loads it on launch, persists changes, and resolves
 * `system` against the live OS colour scheme so the app re-themes at runtime both
 * when the user picks a mode and when the OS flips light/dark.
 */
export function AppThemeProvider({ store, children }: Props): JSX.Element {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const osScheme = useColorScheme();

  useEffect(() => {
    void store.load().then(setModeState);
  }, [store]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      // Fire-and-forget persist; the in-memory state is the source of truth for
      // this session, so a failed write only costs the choice on next launch.
      void store.save(next).catch(() => undefined);
    },
    [store],
  );

  const resolved: "light" | "dark" = mode === "system" ? (osScheme ?? "light") : mode;

  const control = useMemo<ThemeControl>(
    () => ({ mode, resolved, setMode }),
    [mode, resolved, setMode],
  );

  return (
    <ThemeControlContext.Provider value={control}>
      <RestyleProvider theme={themes[resolved]}>{children}</RestyleProvider>
    </ThemeControlContext.Provider>
  );
}
