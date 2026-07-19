# Today (home) — layout notes
Screen: column — safe top 44 → header → list (flex 1) → tab bar.
Header: row, space-between, padding 8/16/10; type.display title + caption date (text.muted); right: sync glyph + settings icon, 36×36 hit areas, color.text.muted.
List: column, gap space.sm, paddingH space.lg, on color.bg.base.
Section headers: type.caption 700, letterSpacing 0.08em — OVERDUE: color.status.overdue + collapse chevron; TIMED / ALL-DAY · ANYTIME: color.text.muted.
Order: Overdue (only if any, collapsible) → Timed (chronological) → All-day/Anytime; done rows sink to section bottom.
Task row: see pass-01 component spec. FAB 52, radius.xl, accent, absolute space.lg from right, above tab bar.
Empty state: centered column — 44 icon (faint), type.title "All clear", type.body text.secondary, caption CTA.
Tab bar: bg.surface, top hairline border.default, safe-area bottom; active tab accent, inactive text.muted.