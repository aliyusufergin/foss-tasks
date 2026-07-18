# Where to sharpen design DIRECTION: Claude Code grill vs. Claude Design

Date: 2026-07-18
Status: Research only — informs a workflow decision. Nothing decided here; no code written.
Author: research agent

> **The question:** the builder has already grilled + documented architecture/domain (CONTEXT.md +
> ADRs, committed). They will author the *visual* screens in **Claude Design**. Open question: where to
> sharpen the **design DIRECTION** (information architecture, navigation model, screen density, visual
> hierarchy, per-screen priorities) —
> **(A)** grill the direction first in **Claude Code** (which holds glossary/ADRs/constraints), capture a
> sharpened brief, then hand it to Claude Design to execute the visuals; or
> **(B)** do the design thinking directly inside **Claude Design** (belief: it's "more capable on the
> design side").
>
> Sibling docs: `docs/research/claude-design-handoff-2026-07.md` (output/handoff mechanics),
> `docs/product/claude-design-brief.md` (the brief template that already exists), ADR 0006.

Every factual claim is cited inline to a primary source (Anthropic/Claude official). Anything not tied to
a primary source is flagged **UNVERIFIED** or marked as **synthesis/opinion**.

---

## Executive summary — recommendation: **hybrid, leaning A**

**Grill the design DIRECTION in Claude Code first, then hand a sharpened brief to Claude Design for visual
EXECUTION.** This is a *hybrid* because Claude Design still owns real design work (the visual iteration
loop), and because a small amount of direction-refinement will inevitably happen inside Claude Design too.
But the *upstream* decision-sharpening belongs in Claude Code, for reasons the sources support:

1. **The two tools are optimized for different halves of the problem.** Anthropic positions **Claude
   Design** as a tool to *"collaborate with Claude to create polished visual work like designs,
   prototypes, slides"* — a **visual generation + iteration** surface, powered by a *"most capable vision
   model"*
   ([Anthropic news](https://www.anthropic.com/news/claude-design-anthropic-labs)). The Claude Design
   tutorial frames input as *"a feature idea"* you make *tangible*, with the workflow being generate →
   iterate on prototypes; it *"doesn't prescribe feeding design briefs, principles, or IA specs"* and is
   **not** a design-thinking / critique / interview surface
   ([tutorial](https://claude.com/resources/tutorials/using-claude-design-for-prototypes-and-ux)).
   **Claude Code** is positioned for *"Build, debug, and ship from your terminal"* — execution over
   strategy ([Claude Code product](https://claude.com/product/claude-code);
   [overview](https://code.claude.com/docs/en/overview)).

2. **The "grilling" behavior — relentless, one-question-at-a-time interrogation of a plan — lives in
   Claude Code, not Claude Design.** The grilling skill is a **Claude Code plugin/skill**
   (`mattpocock/skills`), invoked with a slash command, that runs *"a relentless interview to sharpen a
   plan or design"* ([mattpocock/skills grill-me SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/productivity/grill-me/SKILL.md);
   [grill-me docs](https://github.com/mattpocock/skills/blob/main/docs/productivity/grill-me.md)). It is
   literally installed as a Claude Code skill in this repo's environment (`mattpocock-skills:grilling`).
   **It does not exist inside Claude Design** — see the "grilling skill" note below.

3. **Claude Code holds the context the direction decisions depend on.** IA / navigation / hierarchy
   decisions are downstream of the glossary, ADRs, and constraints — which are committed to *this repo*
   that Claude Code is already operating in. Claude Design *can* read a connected codebase, but it reads
   it to extract a **visual** design system (*"color system, spacing scale, typography, and CSS
   approach"*), not to interrogate product IA
   ([tutorial](https://claude.com/resources/tutorials/using-claude-design-for-prototypes-and-ux)).

4. **The repo convention already encodes this split.** `docs/product/claude-design-brief.md` is a
   *"Paste this at the start of a Claude Design session"* brief — i.e. the project already assumes a brief
   is prepared *before* the Claude Design session. Grilling in Claude Code is how you fill that brief with
   *sharpened* IA/hierarchy content instead of a thin template.

**When B (design inside Claude Design) is the better move:** once direction is roughly set, *visual*
questions — "does this density read as calm or cramped?", "which of these three hierarchies feels right?" —
are best answered by *seeing* them, which is exactly Claude Design's iteration loop
([Anthropic news](https://www.anthropic.com/news/claude-design-anthropic-labs)). So the honest recommendation
is: **direction decisions → Claude Code (grill) → brief; visual execution + visual-level direction → Claude
Design.** The user's premise that Claude Design is "more capable on the design side" is *partially*
supported (it runs a vision-tuned model and is purpose-built for visuals) but says nothing about it being
better at *interrogating IA/UX trade-offs* — that is a reasoning/interview behavior, not a vision behavior.

**This doc recommends; it does not make the call.** The builder chooses.

---

## Q1 — What Claude Design is actually optimized for

**It is a visual-work generation + iteration product**, described by Anthropic as *"a new Anthropic Labs
product that lets you collaborate with Claude to create polished visual work like designs, prototypes,
slides, one-pagers, and more"*
([Anthropic news](https://www.anthropic.com/news/claude-design-anthropic-labs)).

- **Inputs it consumes:** text prompts, uploaded files (DOCX/PPTX/XLSX), **codebase references**, and web
  captures. During setup it *"reads your codebase and design files"* to build a design system
  ([Anthropic news](https://www.anthropic.com/news/claude-design-anthropic-labs)). The tutorial says the
  natural starting input is a **feature concept / prompt** — *"you have a feature idea and need to make it
  tangible"* ([tutorial](https://claude.com/resources/tutorials/using-claude-design-for-prototypes-and-ux)).
- **What it reads from a connected repo:** *"your UI building blocks and how they compose together,"* and
  *"your color system, spacing scale, typography, and CSS approach"* — i.e. the **visual** design system,
  so output uses *"actual components, styling, and architecture"* rather than generic patterns
  ([tutorial](https://claude.com/resources/tutorials/using-claude-design-for-prototypes-and-ux)).
- **Mode of operation:** **iterative refinement**, not a distinct "thinking" mode. You *"refine through
  conversation, inline comments, direct edits, or custom sliders (made by Claude)"*
  ([Anthropic news](https://www.anthropic.com/news/claude-design-anthropic-labs)). The tutorial explicitly
  characterizes it as **visual prototype generation and iteration, not design-thinking or critique modes**
  ([tutorial](https://claude.com/resources/tutorials/using-claude-design-for-prototypes-and-ux)).
- **What it outputs:** live/clickable **HTML/CSS/JS prototypes**; exports to *"Canva, PDF, PPTX, or
  standalone HTML files"*; internal org URL sharing; and a **handoff bundle to Claude Code**
  ([Anthropic news](https://www.anthropic.com/news/claude-design-anthropic-labs)).

**So:** Claude Design *does* support collaborative, conversational exploration (so it is not a pure
one-shot renderer), but its documented job is **visual execution and iteration** — turning an idea into
tangible, refinable pixels. There is **no primary source** positioning it as a relentless-interview /
design-critique / IA-interrogation tool.

## Q2 — Does Claude Design ingest a written brief / design principles / IA spec, and is that endorsed?

**You can feed it a brief (it accepts arbitrary text/prompts and uploaded docs), but "feed it a sharpened
brief" is not a documented/endorsed pattern.** The tutorial says it accepts *feature concepts and prompts
rather than formal specifications*, and *"doesn't prescribe feeding design briefs, principles, or IA
specs, though these could inform the prompts used"*
([tutorial](https://claude.com/resources/tutorials/using-claude-design-for-prototypes-and-ux)). It does
accept uploaded DOCX/PPTX and codebase references as context
([Anthropic news](https://www.anthropic.com/news/claude-design-anthropic-labs)), so a brief *works
mechanically* as input.

- **Verdict:** Feeding a brief is **supported as input** but **not an Anthropic-endorsed flow** — treat
  "Anthropic recommends handing Claude Design a written IA brief" as **UNVERIFIED**. It is, however,
  consistent with how the tool consumes prompts/docs, and it matches this repo's existing
  `claude-design-brief.md` convention (synthesis).

## Q3 — Claude Code's design capability: direction/critique vs. implementation

**Anthropic positions Claude Code for building/shipping, and its design skill for aesthetics-in-code, not
for interviewing you about IA.**

- **Claude Code overall:** an *agentic coding tool* — *"Build, debug, and ship from your terminal, IDE,
  Slack, web"*; *"turn issues into PRs,"* *"make powerful edits"* — execution-focused
  ([Claude Code product](https://claude.com/product/claude-code);
  [overview](https://code.claude.com/docs/en/overview)).
- **The frontend-design skill** (`anthropics/claude-code` plugin) gives *"specialized context on demand"*
  to steer generation away from generic defaults ("distributional convergence") toward *"distinctive,
  intentional visual design"* — typography, color/theme, motion, backgrounds, all framed as
  **CSS/code-implementable** decisions
  ([Anthropic: Improving frontend design through Skills](https://claude.com/blog/improving-frontend-design-through-skills);
  [frontend-design SKILL.md](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md)).
  It is **aesthetic direction embedded in implementation** — *not* positioned as design critique or user
  interviews ([blog](https://claude.com/blog/improving-frontend-design-through-skills)).
- **But** — the capability that makes A viable in Claude Code is **not** the frontend-design skill; it is
  **(a)** Claude Code's grip on the repo context (CONTEXT.md, ADRs, glossary) and **(b)** the **grilling
  skill**, a Claude Code plugin that runs *"a relentless interview to sharpen a plan or design"* — asking
  one question at a time, each with a recommended answer, reading the codebase where it can instead of
  asking ([grill-me SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/productivity/grill-me/SKILL.md);
  [grill-me docs](https://github.com/mattpocock/skills/blob/main/docs/productivity/grill-me.md)).

**So:** Claude Code is not marketed as a "design direction" tool, but it is the surface where (i) the
project context lives and (ii) the relentless-interview behavior exists. That combination is what makes it
the better home for **direction interrogation**, even though the *visual* work belongs elsewhere.

## Q4 — Model capability signal (state only what's stated; do not infer)

- **Claude Design is powered by Claude Opus 4.7**, which Anthropic calls *"our most capable vision model"*
  ([Anthropic news](https://www.anthropic.com/news/claude-design-anthropic-labs)).
- **Claude Code is powered by Opus** (the product page references *Opus 4.8* in its fast-mode
  configuration) ([Claude Code product](https://claude.com/product/claude-code)).
- **What Anthropic actually states about design/visual capability:** only that the Claude Design model is
  its *"most capable vision model."* That is a **vision** signal (rendering/critiquing pixels), which
  supports Claude Design's strength at **visual execution**. **There is no Anthropic statement that Claude
  Design reasons better about information architecture / UX direction than Claude Code.** Inferring
  IA-reasoning superiority from "most capable vision model" would be exactly the model-name inference the
  brief warns against — so treat the user's "more capable on the design side" as **applying to visuals
  only; UNVERIFIED for IA/UX-direction reasoning.**

## Q5 — Recommended handoff direction per Anthropic

**Anthropic documents exactly one direction: Design → Code (finished visuals → build).** *"When a design
is ready to build, Claude packages everything into a handoff bundle that you can pass to Claude Code with a
single instruction,"* preserving *"the design intent, component choices, and architectural decisions so
engineers can build on your work instead of reinterpreting it"*
([Anthropic news](https://www.anthropic.com/news/claude-design-anthropic-labs);
[tutorial](https://claude.com/resources/tutorials/using-claude-design-for-prototypes-and-ux)).

- **What Anthropic does NOT document:** a *"grill the direction in Claude Code first → hand a brief to
  Claude Design"* flow. That upstream, direction-setting step is **not covered** by any primary source —
  Anthropic's documented flow begins *once you already have a feature idea to make tangible* and ends at
  the Design→Code handoff. So workflow **A is neither endorsed nor discouraged by Anthropic** — it sits
  *before* the flow they document. (Synthesis: it therefore doesn't conflict with the documented
  Design→Code handoff; it feeds it.)
- **Where Anthropic says design *decisions* are made:** the *visual* design decisions are made **in Claude
  Design** during the iteration loop, and captured as *"design intent"* in the handoff. There is **no
  primary statement** that *IA/UX direction* decisions should be made in Claude Design specifically — that
  is the gap workflow A fills.

---

## The grilling skill caveat (must not be missed)

The mattpocock **"grilling" skill is a Claude Code plugin/skill** — packaged in a `.claude` skills
directory, invoked by a slash command, with skill frontmatter like `disable-model-invocation`
([grill-me SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/productivity/grill-me/SKILL.md);
[mattpocock/skills repo](https://github.com/mattpocock/skills)). **It does not exist inside Claude
Design.** Claude Design has no skills/plugin system exposed for this; it runs its own conversational
iteration loop ([Anthropic news](https://www.anthropic.com/news/claude-design-anthropic-labs)). So *"run
the grilling skill inside Claude Design"* is **not literally possible** — the only way to get grill-like
behavior in Claude Design is to **paste the skill's instruction text** into the chat as a prompt, which is
a manual approximation, not the installed skill (and it would run against Claude Design's vision model
without the repo context the real skill reads).

---

## What each tool is for

| Concern | Claude Code | Claude Design |
|---|---|---|
| **Anthropic's stated purpose** | *"Build, debug, and ship from your terminal"* — agentic coding ([product](https://claude.com/product/claude-code)) | *"Collaborate with Claude to create polished visual work…prototypes"* ([news](https://www.anthropic.com/news/claude-design-anthropic-labs)) |
| **Optimized for** | Implementation / execution of code | **Visual** generation + iteration (pixels, layout, tokens) |
| **Model / signal** | Opus (page cites Opus 4.8) ([product](https://claude.com/product/claude-code)) | Opus 4.7, *"most capable vision model"* ([news](https://www.anthropic.com/news/claude-design-anthropic-labs)) |
| **Holds repo/ADR/glossary context** | Yes — operating in the repo | Only the **visual** system if repo is connected (color/spacing/typography/components) ([tutorial](https://claude.com/resources/tutorials/using-claude-design-for-prototypes-and-ux)) |
| **Relentless-interview / grill behavior** | Yes — grilling skill is a Claude Code plugin ([SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/productivity/grill-me/SKILL.md)) | **No** — not a documented mode; skill can't be installed there, only pasted as text |
| **Design-thinking / critique mode** | Not marketed; frontend-design skill = aesthetics-in-code ([blog](https://claude.com/blog/improving-frontend-design-through-skills)) | Not a critique mode; it's iterate-on-prototype ([tutorial](https://claude.com/resources/tutorials/using-claude-design-for-prototypes-and-ux)) |
| **Best-fit part of THIS problem** | **DIRECTION** — IA, nav model, hierarchy, per-screen priorities (the "grillable" part) | **EXECUTION** — density-as-seen, visual hierarchy in pixels, layout, tokens |
| **Documented handoff role** | Receives the Design→Code bundle to build ([news](https://www.anthropic.com/news/claude-design-anthropic-labs)) | Produces the bundle; owns the visual iteration |

**DIRECTION vs EXECUTION (the key distinction):**
- **DIRECTION (grillable, → Claude Code):** what the app's screens *are* and *prioritize* — information
  architecture, navigation model, which screens exist and how they relate, what each screen leads with,
  target density, the hierarchy of what matters. These are product/UX trade-offs downstream of the ADRs
  and glossary; they are *argued*, not *seen*.
- **EXECUTION (→ Claude Design):** how the chosen direction *looks* — spacing, type scale, color, exact
  layout, component styling, tokens; and the visual-level judgment calls ("does this actually read as calm
  vs. cramped?") that only become answerable once rendered.

---

## Recommended workflow for this builder (synthesis — builder decides)

1. **Grill design DIRECTION in Claude Code** using the installed grilling skill, with CONTEXT.md + ADRs
   in context. Force the soft spots: primary navigation model, screen inventory, per-screen "leads with
   X", density target, and the hierarchy of task/schedule/priority/status per the domain glossary.
2. **Capture the sharpened direction into the existing brief** (`docs/product/claude-design-brief.md`) —
   which already exists as a paste-into-Claude-Design template, so this is repo-native. The brief carries
   *direction* (IA/priorities/hierarchy) on top of the token contract it already carries.
3. **Hand the brief to Claude Design** and do the **visual execution + visual-level direction** there,
   using its iteration loop (conversation, inline comments, sliders). Connect the repo so it matches the
   token vocabulary.
4. **Design→Code handoff** back into Claude Code to build in RN/Expo — per ADR 0006 and the sibling
   handoff research (tokens + screenshot as the contract).

This keeps each tool on the half it's documented to be good at, uses the grilling skill where it actually
exists, and doesn't fight Anthropic's Design→Code handoff — it *front-loads* the direction it assumes you
already have.

---

## Open questions / unverified

1. **UNVERIFIED:** whether feeding a written IA/brief into Claude Design is an Anthropic-*endorsed* pattern
   (it is *mechanically supported* as prompt/doc input; not prescribed —
   [tutorial](https://claude.com/resources/tutorials/using-claude-design-for-prototypes-and-ux)).
2. **UNVERIFIED / out of scope of primary sources:** whether Claude Design's vision-tuned model reasons
   *better about IA/UX direction* than Claude Code. Sources support only a **visual** capability edge
   (Opus 4.7 = *"most capable vision model"*). Do not treat the user's "more capable on the design side" as
   covering IA reasoning.
3. **Not documented by Anthropic:** the upstream "grill direction first, then feed Claude Design" flow
   (workflow A) — neither endorsed nor discouraged; it precedes the documented Design→Code flow.
4. **Behavioral, worth a quick live check:** how much *direction* Claude Design will independently
   re-open/challenge once given a brief (its loop is iterate-on-prototype, not interrogate-the-plan), and
   whether a connected repo makes it read CONTEXT.md/ADRs for IA or only for the visual system (primary
   source says the latter).

---

## Sources

Primary (Anthropic / Claude official):
- [Anthropic — Introducing Claude Design by Anthropic Labs](https://www.anthropic.com/news/claude-design-anthropic-labs)
- [Claude — Using Claude Design for prototypes and UX (tutorial)](https://claude.com/resources/tutorials/using-claude-design-for-prototypes-and-ux)
- [Claude Code — product page](https://claude.com/product/claude-code)
- [Claude Code — Docs overview](https://code.claude.com/docs/en/overview)
- [Anthropic — Improving frontend design through Skills](https://claude.com/blog/improving-frontend-design-through-skills)
- [anthropics/claude-code — frontend-design SKILL.md](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md)

Primary-ish (skill author's own repo — establishes the grilling skill is a Claude Code plugin):
- [mattpocock/skills — repo](https://github.com/mattpocock/skills)
- [mattpocock/skills — grill-me SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/productivity/grill-me/SKILL.md)
- [mattpocock/skills — grill-me docs](https://github.com/mattpocock/skills/blob/main/docs/productivity/grill-me.md)

Repo-internal (context, not external claims):
- `docs/research/claude-design-handoff-2026-07.md`, `docs/product/claude-design-brief.md`, `docs/adr/0006-design-handoff-and-theming.md`, `CONTEXT.md`
