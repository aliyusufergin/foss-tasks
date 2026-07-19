# Quick-add — layout notes
Bottom sheet: bg.elevated, radius.lg top corners, scrim rgba(0,0,0,0.4), grabber 36×4 faint, padding space.lg + 32 bottom.
Header: type.title + AI pill (accent.surface bg, accent.pressed text, caption 700).
AI input = pass-01 component (1.5 accent border, sparkle, 32 send button radius 8).
AI preview (= task form, pre-filled): title in bg.subtle field radius.md; parsed values as accent.surface chips; parsed reminder row bg.subtle with × remove; unused fields stay "+ Add …" rows (44 high, hairline separated, text.muted).
Footer: two flex-1 buttons gap space.md — Cancel bordered, Save accent (radius.lg, padding 12, 15/600 accent.on).
AI-off: same sheet, bg.subtle plain input, accent "Details" text-button.