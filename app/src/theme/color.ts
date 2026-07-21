/**
 * Build-time colour normalisation for the token pipeline (ADR-0006).
 *
 * React Native's colour parser only understands a subset of CSS: named colours,
 * `rgb[a]()`, `hsl[a]()`, and hex — it does **not** understand the wide-gamut
 * forms DTCG allows (`oklch()`, `color(display-p3 …)`). Style Dictionary calls
 * {@link toRnHex} as a build-time transform so whatever a theme author writes is
 * compiled down to an RN-safe hex string before it ever reaches the device.
 *
 * The committed "Ink & Signal" tokens are all sRGB hex, so in practice this is a
 * normaliser; the oklch/P3 paths exist so a custom imported theme (or a future
 * design pass) using wide-gamut colour still lands on a colour RN can render,
 * gamut-clamped into sRGB rather than silently dropped.
 *
 * Pure and dependency-free: it runs in the Node build seam and is unit-tested
 * there, never importing React Native.
 */

/** Encode a 0..1 channel as a two-digit uppercase hex byte. */
function byte(channel: number): string {
  const clamped = Math.max(0, Math.min(1, channel));
  return Math.round(clamped * 255)
    .toString(16)
    .toUpperCase()
    .padStart(2, "0");
}

/** sRGB gamma encode: linear-light 0..1 -> display-encoded 0..1. */
function srgbEncode(c: number): number {
  const x = Math.max(0, Math.min(1, c));
  return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
}

/** sRGB EOTF: display-encoded 0..1 -> linear-light 0..1. */
function srgbDecode(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function hex(r: number, g: number, b: number, alpha: number | null): string {
  const base = `#${byte(r)}${byte(g)}${byte(b)}`;
  return alpha === null || alpha >= 1 ? base : `${base}${byte(alpha)}`;
}

/** Björn Ottosson's OKLab -> linear-sRGB, given OKLCH (L 0..1, C, H degrees). */
function oklchToLinearSrgb(L: number, C: number, hDeg: number): [number, number, number] {
  const hRad = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Display-P3 linear RGB -> linear sRGB (via D65 XYZ). */
function p3LinearToSrgbLinear(r: number, g: number, b: number): [number, number, number] {
  // P3 (D65) linear RGB -> XYZ
  const x = 0.4865709486 * r + 0.2656676932 * g + 0.1982172852 * b;
  const y = 0.2289745641 * r + 0.6917385218 * g + 0.0792869141 * b;
  const z = 0.0 * r + 0.0451133819 * g + 1.0439443689 * b;
  // XYZ -> sRGB linear
  return [
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  ];
}

function parseHex(value: string): string {
  const body = value.slice(1);
  if (!/^[0-9a-fA-F]+$/.test(body)) {
    throw new Error(`Invalid hex colour: ${value}`);
  }
  const expand = (s: string): string =>
    s
      .split("")
      .map((ch) => ch + ch)
      .join("");
  let full: string;
  switch (body.length) {
    case 3:
    case 4:
      full = expand(body);
      break;
    case 6:
    case 8:
      full = body;
      break;
    default:
      throw new Error(`Invalid hex colour length: ${value}`);
  }
  return `#${full.toUpperCase()}`;
}

/** Split the numeric args of `fn(a b c [/ alpha])`, tolerating commas. */
function fnArgs(inner: string): { parts: number[]; alpha: number | null } {
  const slash = inner.split("/");
  const main = slash[0] ?? "";
  const alphaRaw = slash[1];
  const parts = main
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  const alpha = alphaRaw === undefined ? null : Number(alphaRaw.trim());
  if (parts.some(Number.isNaN) || (alpha !== null && Number.isNaN(alpha))) {
    throw new Error(`Invalid colour arguments: ${inner}`);
  }
  return { parts, alpha };
}

/**
 * Convert any DTCG colour value to an RN-safe hex string (`#RRGGBB` or, with
 * alpha, `#RRGGBBAA`). Accepts hex (3/4/6/8 digit), `oklch()`, and
 * `color(display-p3 …)`. Out-of-sRGB-gamut inputs are clamped per channel.
 */
export function toRnHex(value: string): string {
  const v = value.trim();

  if (v.startsWith("#")) {
    return parseHex(v);
  }

  const oklch = /^oklch\(([^)]*)\)$/i.exec(v);
  if (oklch !== null) {
    const { parts, alpha } = fnArgs(oklch[1] ?? "");
    const [L = 0, C = 0, H = 0] = parts;
    const [lr, lg, lb] = oklchToLinearSrgb(L, C, H);
    return hex(srgbEncode(lr), srgbEncode(lg), srgbEncode(lb), alpha);
  }

  const p3 = /^color\(\s*display-p3\s+([^)]*)\)$/i.exec(v);
  if (p3 !== null) {
    const { parts, alpha } = fnArgs(p3[1] ?? "");
    const [r = 0, g = 0, b = 0] = parts;
    const [lr, lg, lb] = p3LinearToSrgbLinear(srgbDecode(r), srgbDecode(g), srgbDecode(b));
    return hex(srgbEncode(lr), srgbEncode(lg), srgbEncode(lb), alpha);
  }

  throw new Error(`Unsupported colour format: ${value}`);
}
