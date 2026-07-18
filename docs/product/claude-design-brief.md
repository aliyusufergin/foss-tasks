# Claude Design brief — template

Paste the **Design direction**, **Screens to produce**, and **Prompt** sections below at the start
of a Claude Design session. It aligns Claude Design's output with our handoff contract (ADR 0006)
so the exported HTML + screenshot translate faithfully into the React Native app. You don't need to
compose a screen list yourself — the full v1 set is enumerated below.

> Keep this template stable; only edit the token names / screen list as the design system grows.
> Do **not** paste the top note or the "After the session" section — those are meta / implementer
> steps, not instructions for Claude Design.

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

## Screens to produce (v1) — design all of these, in this order

Every screen in **both light and dark**. Start with Pass 1 (it produces the tokens + shared
components the implementer needs first); then the screens reuse those components.

**Pass 1 — Design system & core components** (hand off first, before anything else)
1. Token sheet: color (light + dark), spacing (8-pt), typography, radius — in the DTCG token names
   listed in the Prompt below.
2. Core components (states included: default, done, overdue, pressed): **Task row**, done
   **checkbox**, **priority** left-accent, **date/deadline chip**, **recurrence glyph**, **sub-task
   count**, nestable **checklist item**, **bottom tab bar**, **"+" FAB**, **AI-capture input**.

**Pass 2 — Primary screens**
3. **Today (home)** — the three sections Overdue / Timed today / All-day-anytime; plus the friendly
   empty state.
4. **Calendar** — month + selected-day view showing that day's tasks and recurring occurrences;
   the create-a-task-on-this-day entry point.
5. **All** — the filtered task pool: filter controls (priority, dated vs undated, done history) and
   its empty state.

**Pass 3 — Create & edit**
6. **Quick-add sheet** — natural-language input (AI on) → editable **preview to confirm**; and the
   AI-off variant (plain title + "+ details").
7. **Task detail / create form** — title + quick chip row (date, priority) + progressive "+ Add …"
   rows (recurrence, reminder, defer, sub-tasks, description). The AI preview is this same form,
   pre-filled.
8. **Schedule picker** — none / all-day / timed moment / start-end range.
9. **Deadline + Defer picker.**
10. **Recurrence editor** — full RRULE builder + the "This occurrence / This and following / All"
    edit-scope choice.
11. **Reminder editor** — add / remove multiple reminders.
12. **Sub-task / checklist** — nested items with a drag-reorder affordance.

**Pass 4 — Settings & auth**
13. **Sign in / Register** — minimal email + password.
14. **Settings index** + sub-screens: **Theme** (light / dark / **import custom theme**),
    **Feature toggles** (incl. AI on/off), **Account** (sign out), **AI config** (cloud vs
    self-hosted endpoint), **Language** (Turkish / English).

Global treatments to keep consistent across screens: empty states, an offline/sync indicator,
overdue emphasis, and the done/completed look.

## Prompt to paste into Claude Design

You are designing screens for a **mobile-first, cross-platform task app** built in **React Native
+ Expo** (NOT web — the output is a reference mockup that will be re-implemented in RN). Design
for a phone viewport first (~390×844). Follow the **Design direction** section for information
architecture and interactions, and produce **all the screens in the "Screens to produce" section,
in the pass order given** (Pass 1 first, and stop there for the first hand-off). Respect these
constraints so the design ports cleanly:

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
