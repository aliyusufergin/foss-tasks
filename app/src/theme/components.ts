import { createBox, createText, useTheme as useRestyleTheme } from "@shopify/restyle";
import type { Theme } from "./theme";

/** Token-first primitives. Every colour/spacing/radius prop is a theme key, so
 *  a component using these cannot hardcode a colour (CONTEXT.md § Theme). */
export const Box = createBox<Theme>();
export const Text = createText<Theme>();

export const useTheme = (): Theme => useRestyleTheme<Theme>();
