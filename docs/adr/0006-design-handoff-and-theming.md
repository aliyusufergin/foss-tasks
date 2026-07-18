# 0006 — Design handoff via DTCG tokens; theming with Restyle

Date: 2026-07-18
Status: Accepted

## Context

Visual design is authored in **Claude Design** (Anthropic's web tool), which produces live
HTML/CSS/JS prototypes and exports HTML + a "Hand off to Claude Code" bundle (design files, chat,
README). Research could **not** confirm from a primary Anthropic source that it emits a
machine-readable design-token file — that claim appears only in secondary blogs, so we do not
depend on it.

The target is **React Native + Expo**, which has no DOM, no CSS cascade, no Grid, and a Flexbox
subset — so Claude Design's HTML is a **reference mockup, never portable source**. We separately
decided (ADR-adjacent, CONTEXT) on a **design-token architecture** with built-in light/dark and
user-importable custom themes, which needs a canonical token contract.

## Decision

- **Handoff contract = DTCG token set.** Tokens use the **W3C Design Tokens Community Group**
  format (first stable 2025.10). The design's canonical values live as DTCG tokens, not pixels.
- **Transfer medium = exported HTML + screenshot.** The implementer derives/updates DTCG tokens
  from the exported HTML/CSS and builds the RN UI from **tokens + HTML-as-layout-reference**,
  verifying against the screenshot. HTML is never transpiled to RN.
- **Built-in themes compiled with Style Dictionary** (official RN support), including a build-time
  **Oklch/P3 → RN-safe color** conversion (RN doesn't fully support DTCG's wide-gamut colors).
- **Runtime custom-theme import** uses the same DTCG → theme mapping at runtime.
- **Theming library = Restyle (Shopify).** Token-first, typed theme via `ThemeProvider`; a
  runtime-imported DTCG theme is fed as the provider value. Chosen for simplicity and the largest
  body of examples (consistent with choosing an AI-authorable stack).

## Consequences

**Positive**
- Design values flow through one typed token contract; light/dark and custom themes come for free.
- No brittle web→RN transpile; HTML mismatch is contained to "reference only".
- Restyle's token-first model maps directly onto DTCG.

**Negative / costs**
- Token extraction from exported HTML is a **manual step** per design iteration (no auto token
  export). A Claude Design brief template (naming tokens up front) mitigates this.
- Restyle is less actively developed and nudges toward its Box/Text primitives; if runtime
  theme-swap performance becomes a problem, **Unistyles v3** is the noted escape hatch.
- Maintaining both a build-time (Style Dictionary) and a runtime DTCG→theme path.

## Alternatives considered

- **Pixel/screenshot replica or web→RN transpile** — breaks custom theming and is brittle across
  the DOM/CSS↔RN gap. Rejected.
- **Unistyles v3 / Tamagui / plain context** for theming — Unistyles has better runtime-swap perf
  but a newer, less-AI-familiar API; Tamagui is powerful but heavy; plain context hand-rolls
  theming. Restyle preferred for v1; Unistyles kept as escape hatch.
