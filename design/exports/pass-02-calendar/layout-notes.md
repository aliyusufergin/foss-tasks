# Calendar — layout notes
Month card: bg.surface, radius.lg, padding 10/8/6.
Nav row: 32 chevron hit areas (text.muted) + type.title month label.
Weekday + week rows: flexDirection row, each cell flex 1, column, alignItems center (Monday start).
Day cell: 30×30 circle — selected: bg accent.default + text accent.on; today: 1.5 border accent.default; adjacent-month: faint text.
Dots (4px, under number): accent = has tasks/occurrences; red = overdue.
Selected-day list: label row (13/700 date + caption count) + Task rows + dashed add-row (1.5 dashed faint border, radius.md, text.muted) → creates an all-day task on the selected day.
Recurring occurrences render as normal rows with the recurrence glyph.