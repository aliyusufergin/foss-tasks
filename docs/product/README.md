# Product documentation

End-user / community-facing documentation, written **as features land** so a future docs website
has ready content. This is *content*, not the website itself (building the site is separate work).

Accumulate Markdown here, e.g.:

- `self-hosting.md` — installing the server via docker-compose.
- `custom-themes.md` — authoring and importing a custom theme (JSON design tokens, `themeVersion`).
- `ai-task-capture.md` — natural-language task creation; configuring cloud vs self-hosted LLM.
- `recurring-tasks.md` — recurrence, editing one occurrence vs the series.
- `api-and-mcp.md` — (v2) REST API, MCP server, webhooks.

Keep these user-oriented; engineering decisions live in `docs/adr/` and vocabulary in `CONTEXT.md`.
