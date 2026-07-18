# Claude Design → React Native + Expo handoff research

Date: 2026-07-18
Status: Research only — **feeds a human grilling session**. Nothing here is decided. No code written.
Author: research agent

> Scope: How to take a screen designed in **Claude Design** (Anthropic Labs) and reproduce it
> **faithfully** in a **React Native + Expo** app (offline-first task manager, self-hosted PowerSync),
> given there is **no automatic file bridge** — the design output must reach the implementation agent
> **manually**. Sibling doc: `docs/research/tech-stack-2026-07.md`.

All claims are cited inline to a primary source (Anthropic/Claude official, Expo/React Native official
docs, the W3C DTCG spec) wherever one exists. Claims that only have secondary sources (blogs, third-party
guides) are **flagged explicitly and marked low-confidence** — this matters a lot in Q1/Q5 because
Anthropic's own docs are thin on the internal bundle format.

---

## Executive summary — recommended handoff workflow

**Ground truth (Q1):** "Claude Design" is a real, distinct Anthropic Labs product (launched 2026, powered
by Claude Opus 4.7 per Anthropic), living on the web at `claude.com/product/design`. It produces
**interactive, live HTML/CSS/JS prototypes** (not a Figma-style vector file, not React Native). It can
**read a connected codebase/design system** during onboarding, and its native "finish line" is a
**one-click handoff bundle to Claude Code** — design files (HTML/CSS/JS) + per-state screenshots + a
README + the design chat history.
Sources: [Anthropic news](https://www.anthropic.com/news/claude-design-anthropic-labs),
[Claude Design tutorial](https://claude.com/resources/tutorials/using-claude-design-for-prototypes-and-ux).

**The core mismatch (Q2):** Claude Design speaks **web** (DOM, CSS cascade, `box-shadow`, `rem`, CSS grid).
React Native has **no DOM and no CSS** — it uses a Flexbox subset via `StyleSheet`, unitless density-independent
numbers, and platform-divergent shadows. So the HTML output is **never** portable as-is; it is a **reference
mockup + a source of values**, not source code you paste.

**Recommended workflow — "Spec + screenshot, tokens as the contract":**

1. In Claude Design, **connect the repo** so it designs against our real token vocabulary and component names
   ([tutorial](https://claude.com/resources/tutorials/using-claude-design-for-prototypes-and-ux)).
2. Ask Claude Design to emit, per screen, a **manual handoff pack** (because we cannot use the automatic
   Claude Code bridge):
   - a **reference screenshot** of each state (light + dark),
   - the **design tokens actually used** expressed as **DTCG-format JSON**
     ([DTCG format module](https://www.designtokens.org/tr/drafts/format/)) — colors/spacing/radius/typography/shadow,
   - a **per-component layout description** (hierarchy, flex direction, spacing, variants) in prose/JSON.
3. The human pastes that pack to the implementation agent (me).
4. I run the token JSON through **Style Dictionary** (or hand-map it) into an RN theme object, wire it into a
   **theme provider** (Restyle / Unistyles / Tamagui — see Q3), and build screens in `StyleSheet`/themed
   components, checking against the screenshot.
5. Parity pass (Q4): custom fonts via `expo-font`, cross-platform `boxShadow`, safe areas, density.

**Why tokens are the bridge and not the HTML:** tokens are the one artifact that is *format-neutral* — the
same `color.bg.surface = #111` is valid in CSS and in an RN `StyleSheet`. Everything else (selectors, cascade,
grid) has to be re-expressed. Standardizing on **DTCG JSON** (stable v2025.10) makes the token layer
tool-agnostic and future-proof ([DTCG stable announcement](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/)).

> ⚠️ **Load-bearing caveat for the grilling:** Anthropic's *own* docs confirm the handoff bundle = "design
> files, chat, and a README" + a bundle-URL prompt to Claude Code
> ([tutorial](https://claude.com/resources/tutorials/using-claude-design-for-prototypes-and-ux)). The claim
> that the bundle contains a **structured, machine-readable design-token file** (let alone DTCG JSON) comes
> only from **secondary blogs** and is **not confirmed by a primary Anthropic source** — see Q1. Treat
> "Claude Design emits clean token JSON for free" as **unverified**; we may have to *ask* for it explicitly
> or extract it ourselves.

---

## Q1 — What "Claude Design" actually is (2026)

**It is a distinct Anthropic Labs product, not just an Artifact.** Anthropic describes it as "a new Anthropic
Labs product that lets you collaborate with Claude to create polished visual work like designs, prototypes,
slides, one-pagers, and more," powered by **Claude Opus 4.7**, available to Pro/Max/Team/Enterprise, at
`claude.com/product/design` ([Anthropic news](https://www.anthropic.com/news/claude-design-anthropic-labs)).

Note this is **separate from Claude Artifacts**, the older in-chat panel that renders single-file React
components / HTML / SVG / Mermaid and lets you download the HTML or copy the React code
([Artifacts overview, secondary](https://www.buildfastwithai.com/ai-tools/claude-artifacts)). Claude Design is
the purpose-built design surface; Artifacts is the general in-conversation renderer. For our purposes the
target is **Claude Design**, but if the user is actually on Artifacts the output shape (web HTML / React-for-web)
and the mismatch with RN are the **same**.

**What it outputs:**
- **Live HTML/CSS/JS prototypes** — "clickable and testable," including "code-powered prototypes with voice,
  video, shaders, 3D and built-in AI" ([Anthropic news](https://www.anthropic.com/news/claude-design-anthropic-labs)).
  It is explicitly **not** a vector design file (no `.fig`), and **not** React Native.
- Prototypes, wireframes/mockups, and multiple design explorations (secondary summary of the six output types:
  [VentureBeat](https://venturebeat.com/technology/anthropic-just-launched-claude-design-an-ai-tool-that-turns-prompts-into-prototypes-and-challenges-figma)).

**How you export / retrieve output:** share as an **internal org URL**, **save as a folder**, or **export to
Canva, PDF, PPTX, or standalone HTML files** ([Anthropic news](https://www.anthropic.com/news/claude-design-anthropic-labs)).
For dev handoff specifically, you click **Export → Hand off to Claude Code**, which "bundles the project's
design files, chat, and a README" plus a prompt containing a **bundle URL**
([tutorial](https://claude.com/resources/tutorials/using-claude-design-for-prototypes-and-ux)).

**Can it see the repo? Yes.** "During onboarding, Claude builds a design system for your team by reading your
codebase and design files" and you can "point Claude at your codebase"
([Anthropic news](https://www.anthropic.com/news/claude-design-anthropic-labs)). The tutorial adds that it
"analyzes your styling patterns (CSS modules, Tailwind, styled-components, etc.), spacing scale, color system,
and layout conventions" and can link a codebase "via GitHub import or local directory attachment"
([tutorial](https://claude.com/resources/tutorials/using-claude-design-for-prototypes-and-ux)).

> ⚠️ **Two caveats that must survive the grilling:**
> 1. **Reads the repo ≠ reads RN idioms.** The primary examples of "styling patterns it analyzes" are all
>    **web** (CSS modules, Tailwind, styled-components). There is **no primary-source confirmation** that
>    Claude Design understands or emits **React Native `StyleSheet`/Flexbox-subset** conventions. Connecting
>    our RN repo may help it match our *token names/colors*, but assume it still *thinks in web layout*.
> 2. **The "tokens in the bundle" claim is secondary only.** Multiple third-party write-ups assert the bundle
>    contains "the design tokens actually used on the canvas" as a machine-readable spec
>    (e.g. [claudefa.st, secondary](https://claudefa.st/blog/guide/mechanics/claude-design-handoff),
>    [readysolutions, secondary](https://readysolutions.ai/blog/2026-04-24-claude-design-handoff-not-canvas/)).
>    Anthropic's own tutorial only lists "design files, chat, and a README." **Low confidence** that a clean
>    DTCG token file falls out automatically — plan to request/extract it.

---

## Q2 — The handoff problem: web output vs React Native

Claude Design emits web (HTML/CSS/JS). RN renders native views with a **CSS-inspired but deliberately reduced**
styling model. Concrete gaps to translate:

| Web (Claude Design output) | React Native target | Consequence for faithful translation |
|---|---|---|
| DOM elements (`div`, `span`, `p`, `button`) | `View`, `Text`, `Pressable`/`TouchableOpacity`, `Image` — **all text must be inside `<Text>`** | Structural rewrite; no free-floating text nodes. |
| Full CSS cascade, selectors, inheritance, `!important` | `StyleSheet.create` objects, **no cascade, almost no inheritance** (partial exception: `Text` style inherits into nested `Text`) | Every element styled explicitly; global CSS resets don't exist. ([StyleSheet](https://reactnative.dev/docs/stylesheet)) |
| CSS Flexbox + Grid; `flex-direction: row` default | **Flexbox subset only, no CSS Grid**; **`flexDirection` defaults to `column`**; uses Yoga engine | Re-lay-out; grid becomes nested flex; row/column defaults differ. |
| Units: `px`, `rem`, `em`, `%`, `vh/vw` | **Unitless density-independent numbers** (+ `%` in places); no `rem`/`vh` | `16px`/`1rem` → `16`; viewport units → `Dimensions`/`useWindowDimensions`. |
| `box-shadow` one-liner, works everywhere | 3 shadow APIs, historically platform-split (see Q4) | Shadows need care; use the new cross-platform `boxShadow`. ([Shadow Props](https://reactnative.dev/docs/shadow-props)) |
| Web fonts via `@font-face`/CSS `font-family` | Fonts must be **bundled and registered** via `expo-font` | Custom fonts are an explicit build step (Q4). ([Expo Fonts](https://docs.expo.dev/develop/user-interface/fonts/)) |
| Hover / focus / media queries | No hover on touch; responsiveness via JS (`useWindowDimensions`) or lib | Interaction + responsive model differs. |

**Recommended faithful-translation path:** do **not** attempt HTML→RN transpilation. Treat the HTML prototype
as a **pixel reference** and drive the build from **(a) extracted tokens** (portable) and **(b) an explicit
layout description**. Rebuild layout natively in Flexbox/`StyleSheet`, verifying against the screenshot. This is
synthesis/opinion, but it follows directly from the primary fact that RN has no DOM/CSS
([StyleSheet](https://reactnative.dev/docs/stylesheet)).

---

## Q3 — Design tokens as the bridge

### (a) Extract tokens from Claude Design output
Two realistic paths (see Q1 caveat — the automatic path is unverified):
- **Ask Claude Design (or Claude) to emit the tokens explicitly** as DTCG JSON. Because Claude Design can read
  our repo's existing color/spacing system, it can be prompted to output the palette/scale it used. *(Synthesis;
  relies on the model's generation, not a documented export button.)*
- **Extract from the exported HTML/CSS** — pull CSS custom properties / repeated values out of the standalone
  HTML export ([export options, primary](https://www.anthropic.com/news/claude-design-anthropic-labs)) and
  normalize into DTCG. Deterministic and primary-source-safe, but manual.

### (b) Represent tokens — W3C DTCG format (cite)
Use the **Design Tokens Community Group (DTCG) format**, which reached its **first stable version (2025.10)** on
2025-10-28 and is a "production-ready, vendor-neutral format"
([DTCG stable announcement](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/);
[format module](https://www.designtokens.org/tr/drafts/format/)). Key structural rules relevant to our
colors/spacing/radius + light/dark + importable themes:

- A **token** is any object with a **`$value`**; it also has a **`$type`** (types are **mandatory, not inferred**)
  and optional `$description`/`$extensions`/`$deprecated`
  ([format module](https://www.designtokens.org/tr/drafts/format/)).
- Relevant **types**: `color`, `dimension` (`{value, unit}` with unit `px`|`rem`), `fontFamily`, `fontWeight`,
  `number`; **composite types** include `shadow`, `border`, and `typography`
  ([format module](https://www.designtokens.org/tr/drafts/format/)).
- **Color** supports modern spaces — sRGB plus **Display P3, Oklch, and all CSS Color Module 4 spaces**
  ([DTCG stable announcement](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/)).
  ⚠️ RN color support is narrower than CSS Color 4, so **P3/Oklch tokens may need converting to hex/rgb at build
  time** — flag for grilling.
- **Aliases/references** via `{group.token}` (or JSON-Pointer `$ref`), incl. chained references — perfect for a
  two-tier **primitive → semantic** token model and for **light/dark** as alias sets pointing at the same
  primitives ([format module](https://www.designtokens.org/tr/drafts/format/)).
- **Grouping** is hierarchical (objects without `$value`), and **theming/multi-brand** is an explicit DTCG design
  goal — directly supports the project's "user-importable custom themes"
  ([DTCG stable announcement](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/)).
- Tooling reality: **Style Dictionary** and **Tokens Studio** already consume DTCG
  ([Style Dictionary DTCG](https://styledictionary.com/info/dtcg/); [Tokens Studio format, secondary](https://docs.tokens.studio/manage-settings/token-format)),
  and 10+ tools (Figma, Framer, Penpot, Sketch, Supernova, zeroheight…) support/implement it
  ([DTCG stable announcement](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/)).

### (c) Consume tokens in RN/Expo
- **Style Dictionary** transforms one DTCG source into platform outputs — it "exports these tokens to all the
  places you need (iOS, Android, CSS, JS…)" and ships an official **create-react-native-app** example and RN
  transforms ([Style Dictionary examples](https://styledictionary.com/getting-started/examples/);
  [built-in transforms](https://styledictionary.com/reference/hooks/transforms/predefined/)). Recommended to
  generate a typed JS/TS theme object from the DTCG JSON. *(Recommendation = synthesis.)*
- **Theme-provider libraries** (pick one — decision for the grilling, not made here):
  - **Shopify Restyle** — theme object of `colors`/`spacing`/`borderRadii`/`textVariants`, type-safe; positioned
    for **enterprise design systems** ([Restyle](https://shopify.github.io/restyle/); library comparison,
    secondary: [npmtrends](https://npmtrends.com/@shopify/restyle-vs-react-native-unistyles-vs-tamagui)). Maps
    almost 1:1 onto a token file → good fit for a token-driven app; runtime theming for light/dark.
  - **Unistyles (v3)** — `StyleSheet`-like API with themes/breakpoints, C++ runtime, strong perf
    (secondary: [comparison](https://medium.com/react-native-journal/nativewind-vs-tamagui-vs-unistyles-which-styling-library-should-you-use-in-2026-cf4f4d78b76f)).
  - **Tamagui** — token-first design-system framework, compiles/optimizes; largest of the three by downloads/stars
    (secondary: [npmtrends](https://npmtrends.com/@shopify/restyle-vs-react-native-unistyles-vs-tamagui)).
  - **Plain approach** — a hand-written theme object + React context + `useColorScheme`; zero deps, most control,
    more boilerplate.
- **Light/dark switching** is first-class in Expo/RN via `useColorScheme()` (subscribes to `Appearance`) plus the
  `userInterfaceStyle` app-config key ([Expo color themes](https://docs.expo.dev/develop/user-interface/color-themes/);
  [RN useColorScheme](https://reactnative.dev/docs/usecolorscheme)). Map the DTCG light/dark alias sets onto the
  two theme objects.

---

## Q4 — Faithful visual parity techniques (RN screen matches web mockup)

- **Custom fonts (Expo):** two supported methods — the **`expo-font` config plugin** (embeds fonts at build time,
  available immediately at startup, **recommended for iOS/Android**) or the **`useFonts` hook / `loadAsync`**
  (runtime, works on web too, requires gating render until loaded)
  ([Expo Fonts guide](https://docs.expo.dev/develop/user-interface/fonts/);
  [expo-font SDK](https://docs.expo.dev/versions/latest/sdk/font/)). Convention: font files in `assets/fonts`.
  For parity, match the mockup's family, weights, and letter-spacing explicitly (RN won't synthesize weights the
  way a browser might).
- **Shadows / elevation (the biggest web↔native gap):** RN now exposes **3 shadow APIs** —
  **`boxShadow`** (spec-compliant, **cross-platform iOS+Android**), **`dropShadow`** filter (**Android**), and the
  legacy **`shadow*` props** (`shadowColor` both platforms Android API 28+; **`shadowOffset`/`shadowOpacity`/`shadowRadius`
  iOS-only**) ([Shadow Props](https://reactnative.dev/docs/shadow-props)). **Recommendation:** use **`boxShadow`**
  to mirror the web mockup's `box-shadow` most faithfully across platforms; fall back to `elevation`/`shadow*` only
  for simple native depth. *(Historically `elevation` was required on Android and produced weaker shadows than iOS —
  `boxShadow` is what closes that gap.)*
- **Safe areas:** use **`react-native-safe-area-context`** (`SafeAreaProvider` + `SafeAreaView`/`useSafeAreaInsets`)
  so notches/home-indicator/status-bar don't clip the design — the mockup usually won't show these insets, so budget
  for them ([Expo/RN color-themes doc references SafeAreaProvider](https://docs.expo.dev/develop/user-interface/color-themes/)).
  ⚠️ *(The library itself is community-maintained; I did not fetch its standalone docs page — treat the exact API
  surface as needing a quick confirm, though it's the de-facto standard bundled in Expo.)*
- **Spacing scale:** carry the mockup's spacing scale in as `dimension` tokens; RN numbers are density-independent,
  so a `16` token renders consistently across densities (unlike raw pixels)
  ([StyleSheet](https://reactnative.dev/docs/stylesheet)).
- **Pixel density:** use `PixelRatio` / density-independent units and provide `@2x`/`@3x` raster assets; prefer
  vector (SVG) for icons to stay crisp — general RN guidance *(synthesis; confirm against RN images doc if it
  becomes load-bearing).*

---

## Q5 — Practical manual-handoff workflows (no auto-bridge)

Because we **cannot** use the built-in Claude Design → Claude Code bundle bridge (design and implementation are in
separate contexts, handed over by a human), we need a repeatable *manual* pack.

### Workflow A (recommended) — "Token JSON + layout spec + screenshot"
Per screen, the human collects from Claude Design:
1. **Reference screenshot(s)** — light + dark, each key state.
2. **DTCG token JSON** — the exact colors/spacing/radius/typography/shadow used (ask Claude Design to emit it; or
   extract from the HTML export — Q3a).
3. **Layout spec** — component hierarchy, flex direction, spacing, variants, in prose or JSON.

Then pastes all three to me. I map tokens → theme (Style Dictionary or by hand), build in `StyleSheet`/themed
components, and diff against the screenshot.
**Pros:** tokens are reusable across every screen (build the theme once); screenshot gives ground-truth pixels;
layout spec removes guesswork. **Cons:** depends on Claude Design producing usable token JSON (unverified — Q1);
most upfront structure.

### Workflow B (lighter) — "Screenshot + exported HTML as reference"
Human hands over the **screenshot** + the **standalone HTML export**
([export is primary-confirmed](https://www.anthropic.com/news/claude-design-anthropic-labs)). I read values
directly out of the HTML/CSS (colors, spacing, font sizes, shadows) and rebuild in RN.
**Pros:** relies only on a **primary-source-confirmed** export; no dependence on a maybe-nonexistent token export.
**Cons:** I re-extract tokens per screen (drift risk unless I centralize them); noisier than a clean token file.

### Workflow C (fallback) — "Screenshot only + prose"
Just a screenshot + a written description. Fastest for the human, least faithful; only for throwaway/exploratory
screens.

**Recommendation:** **A as the target, B as the fallback** until we've verified whether Claude Design reliably
emits clean DTCG tokens. Both keep a **single versioned DTCG token file in-repo** as the source of truth so every
screen shares one theme (aligns with the project's already-decided versioned-token architecture). *(Recommendation
= synthesis.)*

---

## Open questions for grilling

1. **Does Claude Design actually emit design tokens we can use?** Anthropic's docs only confirm "design files +
   chat + README." Is there a real token export, or must we prompt for it / extract from HTML? *(Primary sources
   say **unconfirmed**.)* — this decides Workflow A vs B.
2. **Does connecting our RN repo make Claude Design output RN-aware layouts,** or does it still design in web terms
   and only borrow our color/spacing names? No primary source says it understands `StyleSheet`/Flexbox-subset.
3. **Claude Design vs Claude Artifacts** — which surface is the user actually on? If Artifacts (React-for-web), the
   handoff bundle features don't exist and Workflow B is the only option.
4. **Token tier & theme model** — primitive→semantic two-tier DTCG? How do light/dark and *user-importable custom
   themes* map onto alias sets, and how are imported themes validated/sandboxed at runtime?
5. **Which RN theming lib** — Restyle (enterprise/token-shaped, our lean) vs Unistyles (perf) vs Tamagui (biggest
   ecosystem) vs plain context? Ties to the tech-stack doc's RN+Expo choice.
6. **Color space** — if Claude Design emits P3/Oklch tokens, what's our build-time conversion to RN-safe hex/rgb,
   and do we lose fidelity vs the mockup?
7. **Shadow strategy** — standardize on cross-platform `boxShadow` (matches web mockups) vs native `elevation`?
   Confirm min RN/Expo version that ships `boxShadow`.
8. **Screenshot fidelity** — mockups omit safe-area insets, real device fonts, and platform shadow rendering; what's
   our acceptance bar for "looks the same"?
9. **Versioning** — how do design-token versions correspond to app releases, and who bumps them when a Claude Design
   iteration changes a value?

---

## Sources

Primary:
- [Anthropic — Introducing Claude Design by Anthropic Labs](https://www.anthropic.com/news/claude-design-anthropic-labs)
- [Claude — Using Claude Design for prototypes and UX (tutorial)](https://claude.com/resources/tutorials/using-claude-design-for-prototypes-and-ux)
- [W3C DTCG — Design Tokens spec reaches first stable version (2025.10)](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/)
- [designtokens.org — Design Tokens Format Module (draft)](https://www.designtokens.org/tr/drafts/format/)
- [React Native — StyleSheet](https://reactnative.dev/docs/stylesheet)
- [React Native — Shadow Props](https://reactnative.dev/docs/shadow-props)
- [React Native — useColorScheme](https://reactnative.dev/docs/usecolorscheme)
- [Expo — Fonts](https://docs.expo.dev/develop/user-interface/fonts/) / [expo-font SDK](https://docs.expo.dev/versions/latest/sdk/font/)
- [Expo — Color themes](https://docs.expo.dev/develop/user-interface/color-themes/)
- [Style Dictionary — DTCG](https://styledictionary.com/info/dtcg/) / [examples](https://styledictionary.com/getting-started/examples/) / [transforms](https://styledictionary.com/reference/hooks/transforms/predefined/)
- [Shopify Restyle](https://shopify.github.io/restyle/)

Secondary (flagged in-text, lower confidence):
- [claudefa.st — Claude Design to Claude Code handoff](https://claudefa.st/blog/guide/mechanics/claude-design-handoff)
- [Ready Solutions — Claude Design: The Handoff Is the Feature](https://readysolutions.ai/blog/2026-04-24-claude-design-handoff-not-canvas/)
- [VentureBeat — Anthropic launches Claude Design](https://venturebeat.com/technology/anthropic-just-launched-claude-design-an-ai-tool-that-turns-prompts-into-prototypes-and-challenges-figma)
- [BuildFastWithAI — Claude Artifacts](https://www.buildfastwithai.com/ai-tools/claude-artifacts)
- [npmtrends — Restyle vs Unistyles vs Tamagui](https://npmtrends.com/@shopify/restyle-vs-react-native-unistyles-vs-tamagui)
- [React Native Journal — NativeWind vs Tamagui vs Unistyles (2026)](https://medium.com/react-native-journal/nativewind-vs-tamagui-vs-unistyles-which-styling-library-should-you-use-in-2026-cf4f4d78b76f)
- [Tokens Studio — token format](https://docs.tokens.studio/manage-settings/token-format)
