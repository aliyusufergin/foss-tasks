import { createTheme } from "@shopify/restyle";
import {
  type ColorToken,
  darkColors,
  lightColors,
  radii,
  spacing,
  typography,
} from "./tokens.generated";

// The generated maps are `as const` (literal hex per mode); widen the *values*
// to string so light and dark share one colours shape, keeping the token keys.
type Colors = Record<ColorToken, string> & { transparent: string };
const lightPalette: Colors = { ...lightColors, transparent: "transparent" };
const darkPalette: Colors = { ...darkColors, transparent: "transparent" };

/**
 * The Restyle theme (ADR-0006). Colours, spacing, radii and text variants come
 * entirely from the compiled DTCG tokens — nothing here is a literal, so any
 * component built on `Box`/`Text` reads tokens by construction.
 *
 * Light and dark are the same shape with a different colour palette, so a runtime
 * swap is a single provider value change (see `ThemeProvider`). A runtime-imported
 * custom DTCG theme would be fed through the same colour map (future ticket).
 */

// The design specifies IBM Plex Sans, but the font is not bundled yet; naming an
// unavailable family renders a blank/❒ glyph box on Android. Until the font ships
// we fall through to the system font and keep the rest of the type scale. The
// family lives in the tokens (`typography[*].fontFamily`) ready for that ticket.
const textVariant = (t: (typeof typography)[keyof typeof typography]) => ({
  fontSize: t.fontSize,
  lineHeight: t.lineHeight,
  fontWeight: t.fontWeight,
  color: "text.primary" as const,
});

export const lightTheme = createTheme({
  colors: lightPalette,
  spacing,
  borderRadii: radii,
  textVariants: {
    defaults: textVariant(typography.body),
    display: textVariant(typography.display),
    title: textVariant(typography.title),
    body: textVariant(typography.body),
    label: textVariant(typography.label),
    caption: textVariant(typography.caption),
  },
});

export type Theme = typeof lightTheme;

export const darkTheme: Theme = {
  ...lightTheme,
  colors: darkPalette,
};

export const themes = { light: lightTheme, dark: darkTheme } as const;
