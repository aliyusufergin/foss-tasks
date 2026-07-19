# Model & Effort Choice for Claude Code: Opus 4.8 vs Fable 5

**Date:** 2026-07-18
**Question:** For a solo builder running **Claude Code** on a React Native + Expo offline-first task app, which model (Claude Opus 4.8 vs Claude Fable 5) and which reasoning-effort level should run Claude Code for (a) the design-handoff phase and (b) implementing hard coding tickets?
**Scope note:** This is about which model runs *Claude Code*. The *Claude Design* web tool runs a fixed Anthropic model that you do not choose — it is out of scope.

All claims below are tied to Anthropic primary sources (docs.claude.com / platform.claude.com, code.claude.com, claude.com blog). Anything not grounded in a primary source is flagged UNVERIFIED.

---

## Executive summary

Anthropic's own guidance is unusually direct here, and it cuts against the intuition the *name* "Fable" invites. Do **not** read "Fable" as a writing/creative model — the primary sources position `claude-fable-5` squarely as a **long-horizon agentic/coding** model ("next-generation intelligence for long-running agents"), the tier *above* Opus, not a different specialty. ([overview](https://platform.claude.com/docs/en/about-claude/models/overview))

The default recommendation for agentic coding is **Opus 4.8**, with **Fable 5 reserved for the hardest, longest-horizon work** that Opus can't finish:

> "If you're unsure which model to use, start with **Claude Opus 4.8** for complex agentic coding and enterprise work. For workloads that need the highest available capability, use Claude Fable 5." — [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview)

For a solo builder weighing cost, Opus 4.8 is also 2× cheaper than Fable 5 ($5/$25 vs $10/$50 per MTok), faster, and carries no safety-classifier fallback friction ([overview](https://platform.claude.com/docs/en/about-claude/models/overview); [introducing Fable 5](https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5)).

### Two-phase recommendation

| Phase | Recommended model | Effort level | Why (grounded in Anthropic guidance) |
|---|---|---|---|
| **(a) Design handoff** — extract DTCG tokens from exported HTML, map to Restyle theme, build RN screens from a visual reference | **Opus 4.8** | **`high`** for the token-extraction/mapping work; **`xhigh`** when building screens / doing multi-step agentic edits | This is well-scoped, vision-assisted frontend coding. Opus 4.8 is Anthropic's default coding model; its example use cases explicitly include "vision-heavy workflows." xhigh is Anthropic's recommended setting "for most coding and agentic use cases." ([choosing-a-model](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model); [effort](https://platform.claude.com/docs/en/build-with-claude/effort)) |
| **(b) Hard coding tickets** — PowerSync offline sync, RFC-5545 recurrence, notification scheduling, TS domain logic, tests | **Opus 4.8 at `xhigh`** as the primary; **escalate to Fable 5** (start `high`, raise to `xhigh`) only for tickets Opus can't finish | "Start with `xhigh` for coding and agentic use cases" on Opus 4.8. Switch up to Fable 5 when Opus "has all the pertinent context and clearly tried and still got it wrong" — Fable is where "long, multi-step work" that Opus "can't reach at any effort level" gets done. ([effort](https://platform.claude.com/docs/en/build-with-claude/effort); [Claude Code model/effort blog](https://claude.com/blog/claude-model-and-effort-level-in-claude-code)) |

**Confidence:** High on model positioning, effort levels, and defaults (all directly documented). Lower on the phase-specific mapping — Anthropic publishes no guidance specific to "design-token extraction" or "React Native / Restyle" builds; that mapping is my reasoning from the general coding/agentic guidance (see Open questions).

---

## 1. What is Claude Fable 5 (`claude-fable-5`)?

**Positioning (verbatim):** "Claude Fable 5 is Anthropic's most capable widely released model, built for the most demanding reasoning and long-horizon agentic work." ([Introducing Claude Fable 5](https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5)) The models-overview one-liner is "**Next-generation intelligence for long-running agents.**" ([overview](https://platform.claude.com/docs/en/about-claude/models/overview))

**Is it a coding/agentic model or something else?** It is explicitly an agentic/coding-and-reasoning model, not a writing/creative specialist. In Claude Code it is described as "the most capable model in Claude Code, suited to tasks larger than a single sitting. It sustains long autonomous sessions, investigates before acting, and verifies its work more often than smaller models." ([Claude Code model config → Work with Fable 5](https://code.claude.com/docs/en/model-config)) The blog frames it as "a specialist who's seen problems almost no one else has," best for "long, multi-step work" where it "finished jobs Opus and Sonnet can't reach at any effort level." ([blog](https://claude.com/blog/claude-model-and-effort-level-in-claude-code)) → **Do not infer a "storytelling" specialty from the name; the sources are consistent that this is the top agentic-reasoning tier.**

**Specs / pricing** ([Introducing Fable 5](https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5); [overview](https://platform.claude.com/docs/en/about-claude/models/overview)):
- Context: 1M tokens by default; up to 128k output tokens.
- Pricing: **$10 / MTok input, $50 / MTok output** (2× Opus 4.8's $5/$25).
- Latency: documented as "Slower" (vs Opus "Moderate", Sonnet "Fast").
- Knowledge/training cutoff: Jan 2026.
- GA on the Claude API June 9, 2026.

**Stated constraints / weaknesses relevant to your build:**
- **Safety classifiers can decline requests** (returns `stop_reason: "refusal"`), most often in **cybersecurity and biology** domains. In Claude Code these trigger automatic fallback to Opus 4.8. Fallback "can trigger on the first request of a session… because the first request carries workspace context such as your CLAUDE.md content and git status." ([Claude Code → Automatic model fallback](https://code.claude.com/docs/en/model-config)) — **Low risk for an offline task app**, but worth knowing.
- **Adaptive thinking is always on and cannot be disabled**; the raw chain of thought is never returned. ([Introducing Fable 5](https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5))
- **Requires 30-day data retention; not available under zero data retention (ZDR).** Under ZDR the `/model` picker omits or disables it. ([Introducing Fable 5](https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5); [Claude Code model config](https://code.claude.com/docs/en/model-config))
- **Not the default model** on any account type; you opt in with `/model fable`. ([Claude Code model config](https://code.claude.com/docs/en/model-config))

**How to get the most from Fable 5** (verbatim, Claude Code docs) — relevant to *how you'd prompt it* for phase (b):
- "Describe the outcome, not the steps: hand it the result you want and let it plan the path." (Pair with `/goal`.)
- "Hand it ambiguous problems: root-cause investigations, outage debugging, and architecture decisions."
- "Skip the verification reminders: it verifies its own work with less prompting."
- "Size up larger tasks: give it work you would normally break into pieces." ([Claude Code → Work with Fable 5](https://code.claude.com/docs/en/model-config))

---

## 2. What is Claude Opus 4.8 optimized for?

**Positioning (verbatim):** models-overview description is "**For complex agentic coding and enterprise work.**" ([overview](https://platform.claude.com/docs/en/about-claude/models/overview)) The choosing-a-model matrix lists its example use cases as "Multihour autonomous coding agents, large-scale refactoring, complex systems engineering, advanced research, knowledge work, vision-heavy workflows, computer use." ([choosing-a-model](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model))

The blog frames Opus as "the expert," to pick "for complex problems like subtle bugs, unfamiliar domains, or architecture decisions" and "situations where smaller models are confidently wrong no matter how much context you give it." ([blog](https://claude.com/blog/claude-model-and-effort-level-in-claude-code))

**Specs / pricing** ([overview](https://platform.claude.com/docs/en/about-claude/models/overview)): 1M context, 128k output, **$5 / MTok input, $25 / MTok output**, "Moderate" latency, Jan 2026 cutoff. It is the **default model** on Anthropic API / Max / Team Premium / Enterprise pay-as-you-go accounts in Claude Code. ([Claude Code model config → default model setting](https://code.claude.com/docs/en/model-config))

**Benchmark/positioning caveat:** The overview and choosing-a-model pages I fetched give *qualitative* positioning (agentic coding, enterprise), not a numeric SWE-bench figure. A specific SWE-bench number is **UNVERIFIED** from the pages fetched (see Open questions); the "What's new in Claude Opus 4.8" page may carry benchmarks but was not fetched.

---

## 3. Direct comparison for coding / agentic work

Anthropic positions **one clearly above the other, but with a cost/capability gate**:

- **Default for agentic coding = Opus 4.8.** "start with **Claude Opus 4.8** for complex agentic coding and enterprise work." ([overview](https://platform.claude.com/docs/en/about-claude/models/overview))
- **Highest capability = Fable 5**, for "workloads that need the highest available capability" / "the most demanding reasoning and long-horizon agentic work." ([overview](https://platform.claude.com/docs/en/about-claude/models/overview); [Introducing Fable 5](https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5))

The blog gives the concrete **decision rule** for moving between them:
> **Switch to a larger model** if Claude "has all the pertinent context and clearly tried and still got it wrong."
> **Increase effort** (not model) if Claude "got it wrong by skipping a file, not running the tests, or bailing on a refactor partway through."
> "effort controls thoroughness and token generation; model selection determines underlying capability." ([blog](https://claude.com/blog/claude-model-and-effort-level-in-claude-code))

And Anthropic explicitly notes that **tuning effort is often a better first lever than switching models**: "Tuning effort is often a better lever than switching models." ([choosing-a-model](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model))

Net: For your build, Opus 4.8 is the documented default for *both* phases; Fable 5 is an escalation target for phase (b)'s hardest tickets, justified only when Opus 4.8 has full context, has genuinely tried (at high effort), and still fails.

---

## 4. Reasoning effort levels

Effort is a single-model control that "trades intelligence for latency and cost." It affects **all** tokens — text, tool calls, and thinking — not just thinking. ([effort](https://platform.claude.com/docs/en/build-with-claude/effort))

**Levels and what each does** ([effort](https://platform.claude.com/docs/en/build-with-claude/effort)):

| Level | Description | Typical use case |
|---|---|---|
| `max` | Absolute maximum capability, no token-spend constraint | Deepest reasoning; "prone to overthinking" — test before adopting |
| `xhigh` | Extended capability for long-horizon work | "Long-running agentic and coding tasks (over 30 minutes)" |
| `high` | High capability; **equivalent to omitting the parameter** | "Complex reasoning, difficult coding problems, agentic tasks" |
| `medium` | Balanced, moderate token savings | Agentic tasks balancing speed/cost/performance |
| `low` | Most efficient, some capability reduction | "Simpler tasks… such as subagents" |

Effort is "a behavioral signal, not a strict token budget." ([effort](https://platform.claude.com/docs/en/build-with-claude/effort))

**Availability by model** ([Claude Code model config → Adjust effort level](https://code.claude.com/docs/en/model-config)): Fable 5, Sonnet 5, Opus 4.8, Opus 4.7 → `low/medium/high/xhigh/max`. Opus 4.6 / Sonnet 4.6 → no `xhigh`.

**Defaults** ([Claude Code model config](https://code.claude.com/docs/en/model-config); [overview note](https://platform.claude.com/docs/en/about-claude/models/overview)): default effort is **`high` on Fable 5, Sonnet 5, and Opus 4.8** (and `xhigh` on Opus 4.7). On Opus 4.8 the effort default is `high` on all surfaces including Claude Code.

**Does guidance differ by model? Yes:**
- **Opus 4.8 / 4.7:** "**Start with `xhigh` for coding and agentic use cases**, and use `high` as the minimum for most intelligence-sensitive workloads." Step down to `medium` only when evals show the lower level holds quality. At `xhigh`/`max`, set a large `max_tokens` (start ~64k). ([effort → Recommended for Opus 4.8/4.7](https://platform.claude.com/docs/en/build-with-claude/effort))
- **Fable 5:** "**Start with `high`, the default, for most tasks**, use `xhigh` for the most capability-sensitive workloads, and step down to `medium` or `low` for routine work. Lower effort settings on Claude Fable 5 still perform well and often exceed `xhigh` performance on prior models." ([effort → Recommended for Fable 5](https://platform.claude.com/docs/en/build-with-claude/effort))
- **The effort scale is calibrated per model** — "the same level name does not represent the same underlying value across models." ([Claude Code model config](https://code.claude.com/docs/en/model-config))

**Claude Code specifics you'll see in the picker:**
- `ultracode` appears in Claude Code's `/effort` menu but is **not a new API effort level.** It "sends `xhigh` to the model and additionally has Claude orchestrate dynamic workflows [multi-agent] for substantive tasks," session-only. ([effort note](https://platform.claude.com/docs/en/build-with-claude/effort); [Claude Code model config](https://code.claude.com/docs/en/model-config))
- `ultrathink` in a prompt requests deeper reasoning for that one turn without changing the session effort setting (adds an in-context instruction; the API effort level is unchanged). ([Claude Code model config](https://code.claude.com/docs/en/model-config))
- Set effort with `/effort <level>`, `--effort`, `CLAUDE_CODE_EFFORT_LEVEL`, or `effortLevel` in settings (`max`/`ultracode` are session-only, not persisted in settings). ([Claude Code model config](https://code.claude.com/docs/en/model-config))

---

## 5. Phase-specific guidance (design handoff vs hard tickets)

**There is no Anthropic guidance specific to design-token extraction, DTCG, Restyle, or React Native.** The mapping below is my reasoning from the general coding/agentic guidance; treat it as a recommendation, not a documented rule.

**Phase (a) design handoff.** Extracting DTCG tokens from HTML, mapping to a Restyle theme, and building RN screens from a visual reference is (i) frontend coding and (ii) vision-assisted. Both current models support image input/vision ([overview](https://platform.claude.com/docs/en/about-claude/models/overview)), and Opus 4.8's documented use cases include "vision-heavy workflows" ([choosing-a-model](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model)). This is well-scoped, bounded work — the profile Anthropic describes for **Sonnet/Opus at high effort**, not the "ambiguous, larger-than-a-sitting" profile Fable is reserved for. → **Opus 4.8, `high` for token mapping, `xhigh` when it starts making many multi-step edits to build screens.** Fable 5 would be overspend here.

**Phase (b) hard tickets.** Offline-first sync (PowerSync conflict handling), RFC-5545 recurrence expansion, notification scheduling, and their tests are "hard, multi-step, agentic coding" — exactly what `xhigh` is for ("difficult coding problems, agentic tasks" / "long-running agentic and coding tasks"). → **Opus 4.8 at `xhigh`** as the workhorse. **Escalate to Fable 5** (start `high`, raise to `xhigh`) for a specific ticket only when the blog's model-switch rule fires: Opus had full context, tried at xhigh, and still got it wrong — the "long, multi-step work Opus can't reach at any effort level" case. When you do use Fable, prompt it outcome-first and drop verification reminders (§1).

**Practical operating pattern:** `/model opus` at `xhigh` for everything; keep `/model fable` in reserve for the one or two tickets that stall. This matches Anthropic's own escalation ladder (tune effort first, switch model only when a fully-contexted, genuine attempt still fails) and keeps your token spend on the $5/$25 tier.

---

## Open questions / UNVERIFIED

- **No numeric coding benchmark (e.g. SWE-bench) confirmed** for either Opus 4.8 or Fable 5 from the pages fetched. The "What's new in Claude Opus 4.8" and Fable launch/announcement pages (not fetched) may carry figures. Positioning here is qualitative-but-primary; treat any specific SWE-bench percentage as UNVERIFIED until read from those pages.
- **No design-token / React Native / Restyle-specific guidance exists** in Anthropic docs. The phase-(a) vs phase-(b) model+effort mapping is inference from general agentic-coding guidance, not a documented recommendation. (Confidence: medium.)
- **Fable 5 classifier friction on your repo is unquantified.** Docs say cyber/bio context (including CLAUDE.md and git status on the first request) can trigger fallback. An offline task app is unlikely to trip it, but this was not tested against your repo. If it ever does, `claude --safe-mode` isolates whether a customization is the cause. ([Claude Code model config](https://code.claude.com/docs/en/model-config))
- **ZDR gate:** If your Anthropic org runs under zero data retention, Fable 5 is unavailable — the `/model` picker will omit/disable it. Verify your org's retention setting before planning to escalate to Fable. ([Introducing Fable 5](https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5))
- **Fable 5 access note:** the docs mention a June 2026 access interruption that was "restored" (link to Anthropic's statement). Not relevant to the recommendation, but if the picker doesn't list Fable, availability/entitlement — not a bug — is the likely cause. ([Introducing Fable 5 tip](https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5))

---

## Primary sources cited

- Models overview — https://platform.claude.com/docs/en/about-claude/models/overview
- Choosing the right model — https://platform.claude.com/docs/en/about-claude/models/choosing-a-model
- Introducing Claude Fable 5 and Claude Mythos 5 — https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5
- Effort — https://platform.claude.com/docs/en/build-with-claude/effort
- Claude Code: Model configuration — https://code.claude.com/docs/en/model-config
- Choosing a Claude model and effort level in Claude Code (blog) — https://claude.com/blog/claude-model-and-effort-level-in-claude-code
