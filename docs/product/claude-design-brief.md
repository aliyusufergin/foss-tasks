# Claude Design brief — template

Paste this at the start of a Claude Design session, then describe the screen(s) you want. It
aligns Claude Design's output with our handoff contract (ADR 0006) so the exported HTML +
screenshot translate faithfully into the React Native app.

> Keep this template stable; only edit the token names as the design system grows.

---

## Prompt to paste into Claude Design

You are designing screens for a **mobile-first, cross-platform task app** built in **React Native
+ Expo** (NOT web — the output is a reference mockup that will be re-implemented in RN). Design
for a phone viewport first (~390×844). Respect these constraints so the design ports cleanly:

**Layout**
- Flexbox only. No CSS Grid, no `position: sticky`, no floats, no `vh`/`vw` — RN can't use them.
- Use simple, unitless spacing on an 8-pt scale (4, 8, 12, 16, 24, 32).
- Assume a safe-area inset top and bottom (notch / home indicator).
- Text must live in explicit text elements; no bare text nodes on containers.

**Design tokens (this is the contract — name everything with these tokens, don't hardcode)**
Emit/annotate every color, spacing, radius, and type style as a **named token** in **W3C DTCG**
shape. Use these token groups and names:
- `color.bg.*` (`base`, `surface`, `elevated`), `color.text.*` (`primary`, `secondary`, `muted`),
  `color.accent.*` (`default`, `pressed`), `color.status.*` (`done`, `overdue`, `blocked`),
  `color.border.*`.
- `space.*` (`xs`…`xl` mapping to the 8-pt scale), `radius.*` (`sm`, `md`, `lg`, `pill`).
- `type.*` (`display`, `title`, `body`, `label`, `caption`) each with font family, size, weight,
  line-height.
- Provide **both `light` and `dark`** values for every color token.
- Avoid P3/Oklch if possible; if used, also give an sRGB hex fallback (RN color support is limited).

**Components to keep consistent** (reuse, don't reinvent per screen): Task row (title, schedule/
deadline chip, priority marker, done checkbox), sub-task/checklist item (nestable), calendar day
cell, bottom tab bar, floating "add task" action, AI-capture input.

**What to hand off**
1. The **exported HTML/CSS** (the confirmed export).
2. A **screenshot** of each screen in both light and dark.
3. A short **layout note** per screen: which tokens each element uses, and the flex direction /
   spacing intent (so RN implementation is deterministic).

Do not worry about RN code — just the HTML prototype, tokens, screenshots, and layout notes.

---

## After the session (implementer (Claude Code) side)

1. Extract/update DTCG tokens from the exported HTML/CSS into the theme source.
2. Run Style Dictionary → RN theme (build-time), converting any Oklch/P3 to RN-safe colors.
3. Build the RN screen with **Restyle**, reading tokens only; verify against the screenshots
   (light + dark).
