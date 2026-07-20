## Agent skills

### Issue tracker

Issues and PRDs live as GitHub issues (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Verification

**CI never builds the RN bundle or launches the app — green tests do not mean the app runs.** Any ticket touching `app/` must be built and run on a real device *early*, and its acceptance criteria verified there. See `docs/agents/verification.md`.
