/**
 * Pure DTCG helpers used by the Style Dictionary build (`scripts/build-theme.ts`).
 *
 * The "Ink & Signal" export encodes light/dark as a single token tree: `$value`
 * is the light value and the dark value lives under
 * `$extensions["app.foss-tasks.modes"].dark` (see the token file's `$description`).
 * Style Dictionary has no native notion of that mode extension, so we expand the
 * tree into one flat source per mode *before* handing it to Style Dictionary,
 * which then resolves aliases and runs the colour transform.
 *
 * Kept free of React Native and Style Dictionary imports so it runs and is
 * unit-tested in the Node seam.
 */

export const MODE_EXTENSION = "app.foss-tasks.modes" as const;
export type Mode = "light" | "dark";

/** A DTCG token leaf (has `$value`) or a group (nested tokens). */
export interface DtcgNode {
  $type?: string;
  $value?: unknown;
  $description?: string;
  $extensions?: Record<string, unknown>;
  [key: string]: unknown;
}

function isLeaf(node: DtcgNode): boolean {
  return Object.prototype.hasOwnProperty.call(node, "$value");
}

function darkValueOf(node: DtcgNode): unknown {
  const modes = node.$extensions?.[MODE_EXTENSION] as { dark?: unknown } | undefined;
  return modes?.dark;
}

/**
 * Produce a DTCG tree where every leaf's `$value` is the value for `mode`.
 *
 * For `dark`, a leaf carrying a dark override in its mode extension takes that
 * value; a leaf without one (including alias leaves like `{color.status.overdue}`)
 * keeps `$value` unchanged, so aliases resolve within the mode's own tree. The
 * `$extensions` block is dropped from the output — Style Dictionary never needs it.
 */
export function expandModes(node: DtcgNode, mode: Mode): DtcgNode {
  if (isLeaf(node)) {
    const dark = mode === "dark" ? darkValueOf(node) : undefined;
    const out: DtcgNode = {
      $value: dark !== undefined ? dark : node.$value,
    };
    if (node.$type !== undefined) out.$type = node.$type;
    return out;
  }

  const out: DtcgNode = {};
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$")) continue;
    out[key] = expandModes(child as DtcgNode, mode);
  }
  return out;
}

/** Parse a DTCG dimension (`"8px"`, `"999px"`) to a unitless RN number. */
export function parseDimension(value: string): number {
  const match = /^(-?\d+(?:\.\d+)?)px$/.exec(value.trim());
  if (match === null) {
    throw new Error(`Unsupported dimension: ${value}`);
  }
  return Number(match[1]);
}
