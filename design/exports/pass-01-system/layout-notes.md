# Pass 1 — design system & core components — layout notes

Token values: html/tokens.ink-signal.dtcg.json (DTCG; light in $value, dark in
$extensions["app.foss-tasks.modes"].dark; all sRGB hex). Type: IBM Plex Sans 400/500/600/700.
Spacing 8-pt: xs 4 / sm 8 / md 12 / lg 16 / xl 24 / xxl 32.
Radius: sm 4 (chips) / md 6 (rows, cards, checkbox) / lg 10 (inputs, sheets, tab bar) / xl 14 (FAB) / pill 999.

## Task row
Row: flexDirection row, alignItems center, bg color.bg.surface, border 1 color.border.default,
radius.md, overflow hidden; min height 48. Priority accent: width 3, alignSelf stretch,
color.priority.low/medium/high — omit entirely for "none". Content: row, gap space.md,
padding 10 14 10 11. Text column: flex 1, minWidth 0, gap 4.
Title: type.body @500 color.text.primary, numberOfLines 1; done → text.muted + strikethrough.
Meta line (only when there's a signal): row, gap space.sm — one date chip, 13px recurrence glyph
(text.muted), sub-task count (type.caption text.muted). Pressed → bg color.bg.pressed.

## Checkbox
22×22, border 2 color.text.muted, radius 6. Done: fill color.status.done, check icon
color.accent.on, no border. Checklist variant: 18×18, radius 5.

## Date / deadline chip
type.caption, padding 2–3 / 7–9, radius.sm. Schedule (neutral): text.secondary on bg.subtle.
Deadline: accent.pressed on accent.surface (dark: accent.default on accent.surface).
Overdue: status.overdue on status.overdueSurface. A row shows only the single most relevant chip.

## Recurrence glyph · sub-task count
13px repeat icon, color.text.muted, inline in meta line. Count: type.caption text.muted, "2/5".

## Checklist item (nestable)
Container: bg.surface, hairline border, radius.md, padding 10 12, column gap space.sm.
Item: row, alignItems center, gap 10 — 12px drag handle (border tone) + 18 checkbox + type.body
title. Nesting: paddingLeft 26 per level. Done: as task row.

## Bottom tab bar
Row, bg.surface, borderTop 1 border.default, padding 8 top + safe-area bottom.
Tab: flex 1, column, center, gap 3 — 22 icon stroke 2 + 10/600 label.
Active color.accent.default; inactive color.text.muted.

## "+" FAB
52×52, radius.xl, bg accent.default, 24 plus icon accent.on, shadow; floats space.lg from right
edge above the tab bar. Pressed → accent.pressed.

## AI-capture input
Row, alignItems center, gap 10, bg.surface, border 1.5 accent.default, radius.lg,
padding 9 / 14 left / 9 right. Sparkle glyph accent.default; placeholder type.body text.muted.
Send: 32×32, radius 8, bg accent.default, arrow accent.on.
AI-off variant: border border.default, no sparkle, placeholder "New task…".

## States (all components)
default / pressed (bg.pressed) / done (muted + strikethrough + green check) /
overdue (text-on-tint, never a filled red row).
