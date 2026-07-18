# Claude Design brief — template

Paste this at the start of a Claude Design session, then describe the screen(s) you want. It
aligns Claude Design's output with our handoff contract (ADR 0006) so the exported HTML +
screenshot translate faithfully into the React Native app.

> Keep this template stable; only edit the token names as the design system grows.

---

## Design direction (decided — grilled 2026-07-18)

Design to this information architecture and interaction direction (the *what/where*; you own the
*visual* execution):

- **Home = "Today" agenda.** The app opens to today's work in three sections, in this order:
  **Overdue** (past due, still open — shown only if any, collapsible, gentle red emphasis) →
  **Timed today** (chronological) → **All-day / anytime today**. Friendly empty state when clear.
- **Navigation = 3 bottom tabs** — **Today**, **Calendar**, **All** — plus a prominent **"+" FAB**
  for adding, and **Settings reached from a header icon** (not a tab). "All" is a single filtered
  pool of tasks (priority / dated-vs-undated / done history); undated (open-ended) tasks live here.
  No projects/lists/tags in v1.
- **Calendar tab** = pick a day → that day's tasks and recurring occurrences; create a task on the
  selected day (defaults to all-day).
- **Task row = comfortable density, scannable.** Leading done checkbox; a thin colored **priority**
  left-accent (none = none); **title on one line** (truncate); a **secondary meta line only when
  there's a signal** — the most relevant date chip (overdue in red), a small recurrence glyph, a
  sub-task count like "2/5". Description, reminders, defer, full range live in detail, not the row.
- **Add flow = one quick-add sheet, natural-language first.** With AI on: a single text input
  parses natural language ("dentist Tuesday 3pm, remind me an hour before") into a task, then shows
  an **editable preview to confirm** before saving. With AI off: the same input is a plain title
  with a "+ details" expansion. One entry point either way.
- **Task detail/create form = progressive + quick chips.** Title always visible; a **quick chip
  row** under it for the common fields (date, priority); everything else (recurrence, reminder,
  defer, sub-tasks, description) behind **"+ Add …" rows** revealed on demand. **Feature-toggled-off
  fields do not appear at all** — this is how minimalists get a simple form and power users still
  reach everything. The AI preview screen is this same form, pre-filled.
- **Theme:** light + dark, both designed. (Density toggle, projects/tags, group-sharing UI are v2 —
  don't design them now.)

## Prompt to paste into Claude Design

You are designing screens for a **mobile-first, cross-platform task app** built in **React Native
+ Expo** (NOT web — the output is a reference mockup that will be re-implemented in RN). Design
for a phone viewport first (~390×844). Follow the **Design direction** section above for
information architecture and interactions. Respect these constraints so the design ports cleanly:

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
