# Claude Design exports

Unzip each Claude Design **project archive** here, one folder per pass. Claude Code reads these
**locally** — pushing to GitHub is **not** required (only Claude Design needs the GitHub repo, for
the CONTEXT/brief; the implementer reads the local filesystem).

## Layout

```
design/exports/
├── pass-01-system/     ← design system + core components + token sheet (hand off FIRST, gates T03/#4)
├── pass-02-today/
├── pass-02-calendar/
├── pass-02-all/
├── pass-03-quick-add/
├── pass-03-task-form/
├── pass-03-pickers/    ← schedule / deadline+defer / recurrence / reminder / checklist
├── pass-04-auth/
└── pass-04-settings/
```

Per folder, drop:
- the **unzipped HTML/CSS/JS** archive (the reference mockup — the source of token values + layout),
- the **light + dark screenshots** (PNG) if not already in the archive (optional but helpful),
- any **layout note** Claude Design produced (which token each element uses, flex/spacing intent).

## Notes

- The archive is the *reference* — it is never transpiled to React Native (no DOM/CSS in RN). The
  implementer extracts DTCG tokens from it and rebuilds each screen with Restyle (ADR 0006).
- Committing these is **optional** (backup only). They can be large; skip if you don't want them in
  git history.
- Folder names are a suggestion — match them to how you actually batch the passes.
