import { DarkTheme, DefaultTheme, type Theme as NavTheme } from "@react-navigation/native";
import type { Theme } from "../theme/theme";

/**
 * Map the Restyle theme onto a React Navigation theme so the navigation chrome
 * (headers, tab bar, card backgrounds) is themed from the same tokens as the
 * screens — no separate colour source.
 */
export function toNavTheme(theme: Theme, isDark: boolean): NavTheme {
  const base = isDark ? DarkTheme : DefaultTheme;
  const c = theme.colors;
  return {
    ...base,
    dark: isDark,
    colors: {
      ...base.colors,
      primary: c["accent.default"],
      background: c["bg.base"],
      card: c["bg.surface"],
      text: c["text.primary"],
      border: c["border.default"],
      notification: c["status.overdue"],
    },
  };
}
