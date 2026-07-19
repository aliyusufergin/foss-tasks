# FOSS Tasks — Claude Design exports (Ink & Signal, themeVersion 1)

One folder per pass area, matching the repo layout. Each contains light + dark @2x PNGs
and a layout-notes.md (token + flex intent per element). The HTML reference mockup
(open index .dc.html in a browser; needs the sibling support.js) is included once per pass:

- pass-01-system/html/   — hand-off sheet + core components + tokens.ink-signal.dtcg.json
- pass-02-today/html/    — Pass 2 HTML (covers today / calendar / all)
- pass-03-quick-add/html/ — Pass 3 HTML (covers quick-add / task-form / pickers)
- pass-04-auth/html/     — Pass 4 HTML (covers auth / settings)

Tokens: DTCG JSON — light in $value, dark in $extensions["app.foss-tasks.modes"].dark; all sRGB hex.
The archive is a reference; extract tokens and rebuild with Restyle (ADR 0006).
Type: IBM Plex Sans 400/500/600/700 (@expo-google-fonts/ibm-plex-sans).

Folders:
pass-01-system/ · pass-02-today/ · pass-02-calendar/ · pass-02-all/ ·
pass-03-quick-add/ · pass-03-task-form/ · pass-03-pickers/ ·
pass-04-auth/ · pass-04-settings/
