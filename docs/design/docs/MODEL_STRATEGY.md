# Multi-model strategy for the new repo (2026-11-14)

Your direction: Claude now for design and handoff; Fable 5.2 for a few heavy bursts at the start; **Gemini as the deep-research tool and the primary long-term coder.** This document plans for exactly that, says plainly where I think it is risky, and builds the guardrails that make it work. The full playbook with ready-to-paste prompts comes in the Phase 2 handoff package.

This replaces the role table in `RESTART_PLAN_2026-11-13.md`, which had Gemini as researcher and reviewer and Claude models as coders.

## 1. Who does what

| Role | Model | Why this one |
|---|---|---|
| Design direction, prototypes, tokens, audits, handoff | Claude (this chat) | Done or in progress. After the handoff this chat drops to an occasional design and review partner. |
| **Founding bursts** (3 to 4 sessions) | **Claude Fable 5.2** | The parts where a lot of context must stay coherent at once and a mistake is expensive for months: repo skeleton and gates, the token-only component kit, the engine port behind a worker API, the first vertical slice. |
| **Owner of the repo: manager and maker** | **Gemini** (Antigravity and Gemini CLI) | Your decision. It has your largest usage budget, it is where you already work when Claude runs low, and one long-term owner beats a relay of five models. |
| **Research** | Gemini Deep Research | Baseline and reference sources, RU/HE terminology with citations, legal reading lists, pedagogy. |
| **Independent review at checkpoints** | Claude (Opus or Sonnet), occasionally ChatGPT for numbers | A different vendor from the one that wrote the code. Small, read-only, cheap. |

## 2. The honest risk, and what answers it

In the one large task Gemini has done on this project (the second-opinion review, `GEMINI_TRIAGE_2026-11-13.md`), it was sharp on consistency and arithmetic, and it found real errors I had made. It also:
- labelled claims **[Verified]** that it had not computed (it misread which bet size a tooltip belonged to and reported a wrong "correction");
- produced a slightly wrong equity figure (25.2% where exact enumeration gives 25.6%);
- recommended cutting several things you had explicitly decided (the dock, the table as a menu, the Lamp's moods).

None of that disqualifies it. All three are the same failure: **confidence without a check.** A coder with that habit will say "done, tests pass" about something that is not. So the plan does not rely on Gemini being careful. It relies on the repo making unverified claims impossible to merge:

| Risk | Guardrail (mechanical, not a promise) |
|---|---|
| "Verified" without verifying | Every number on screen comes from the engine and has a golden test. Golden values are computed by `tools/eqexact.py`, never typed by a model. A report may say "verified" only next to the command it ran and its output. |
| Visual regressions found by you | The layout audit and the theme audit run on every component and every screen state before a change is reported. Zero is the pass mark. |
| Drift from the design | Tokens only (a script fails the build on a raw colour or duration). Components come from the kit. A new visual pattern needs a line in the decision log first. |
| Overriding owner decisions | The decision log lists hard nos with reasons. Gemini is asked to **challenge** decisions in writing, and forbidden to act against one until you answer. |
| Scope creep and rewrites | One slice at a time, a fixed budget per slice, a written plan before any change that touches more than one module. |
| Self-review blind spots | A different vendor reviews at each checkpoint (section 4). |
| Lost context between sessions | The repo carries its own memory: `AGENTS.md` (read by both Antigravity and Gemini CLI), a decision log, a bug inbox, a current-state file updated at the end of every session. |

If, after the first two slices, Gemini's work needs more than about one correction round per slice on average, the fallback is already in place: the same repo, rules and gates work for Claude Code. Nothing in the setup is Gemini-specific except one settings line.

## 3. Fable 5.2: four bursts, then stop

Fable is the expensive, scarce resource. It is used where being wrong is costly and where the work is one coherent act. Each burst gets one packet (the handoff, the tokens, the prototypes, the tools) and ends with something you can open.

| # | Burst | Ends with | Why Fable and not Gemini |
|---|---|---|---|
| F1 | **Foundation**: repo, TypeScript strict, Vite, Preact and signals, CI running the two audits and the golden numbers, the token files wired in, the "no raw values" check, `AGENTS.md` and the repo docs | An empty app that already passes every gate, in seven themes | Every later session inherits these decisions. |
| F2 | **Component kit**: about fifteen shared components on a component sheet, each in every state, in English, Russian and Hebrew, each audited alone | The component sheet: the new source of visual truth | This is where "the build lost the feel" is prevented. It needs taste and consistency across all fifteen at once. |
| F3 | **Engine port**: the old engine copied in with its tests green, wrapped in a typed worker API with request IDs, cancellation and seeded randomness; golden numbers as tests | `engine.equity(...)` callable from the app, with the audited figures passing | Correctness, and the one place where the old code must be understood deeply. |
| F4 | **First slice**: Equity by rows on the real engine, end to end | A real, usable Equity room | It proves the whole chain (tokens, kit, worker, engine, audits) on the simplest pillar, and leaves Gemini a worked example to copy. |

After F4, Fable returns only for a hard correctness problem or an architecture question. It does not do tickets.

*My recommendation, for you to overrule:* do not skip F2 to save budget. If only two bursts are affordable, do F1 and F2 and let Gemini do F3 and F4 with a Claude review.

## 4. Gemini as owner: how the work is shaped

- **One slice at a time**, in this order unless you change it: Review plus Hand recorder; Game night with storage and export (then the first real Friday); Training drill; Strategy (spot map and plan builder); Home; Learn; Settings; Duel; Full hand last.
- **Each slice** = a short plan you approve (what, which components, which engine calls, what is out), the build, the gates, a five-line report, an entry in the current-state file. Then it stops.
- **Bugs** go to one inbox file and are fixed in batches, not as they appear.
- **Questions are welcome and expected.** The rules file tells Gemini to ask before guessing on product behaviour, and to push back on any decision it thinks is wrong, yours included, with a reason and an alternative.
- **Checkpoints** (after F4, after the first Friday, then every three slices): a read-only review by a Claude model with a fixed brief: token discipline, duplicated logic, anything claimed but not tested, engine numbers recomputed.

## 5. Gemini for research (can start today, needs no repo)

In value order. Each is one Deep Research run with a written brief (in the Phase 2 package).

1. **Reference sources for the baseline**: what published preflop references exist for 30 to 60 bb, what their licences allow, how a "Verified" tier could be measured honestly.
2. **Russian and Hebrew poker terminology** against real player usage, with sources, checked against `TERMINOLOGY_SHEET.md`.
3. **Right-to-left technical review** for dense data interfaces: tables, charts, card notation, mixed-direction text.
4. **Pedagogy**: feedback timing, spaced repetition (FSRS versus fixed intervals), deliberate practice, applied to poker study.
5. **Legal reading list** (not advice): study tools near real-money games, Israel and Russia, real-time-assistance rules of online rooms.
6. **Performance budget**: worker message costs, Monte Carlo on weak laptops, animation on integrated graphics.

Rule for all research: every claim carries a source and a date; anything about law or prices is a lead for a human to check, never a fact to build on.

## 6. Tooling facts I checked (2026-11-14)

- **Antigravity** reads `AGENTS.md` and `GEMINI.md` from the workspace and its parent folders, plus `.agents/rules/*.md`; rule files there need frontmatter with a `trigger` (`always_on`, `model_decision`, `glob`, `manual`) or they are silently ignored. Files over 24,000 bytes are truncated, and always-on rules share a budget of about 20,000 tokens. Source: [Antigravity rules documentation](https://antigravity.google/docs/rules.md).
- **Gemini CLI** reads `GEMINI.md` by default (global, workspace and parent folders, and just-in-time in folders it touches). Setting `context.fileName` in `settings.json` to a list such as `["AGENTS.md", "GEMINI.md"]` makes it read `AGENTS.md` too; `/memory show` displays what is loaded. Source: [Gemini CLI: provide context with GEMINI.md](https://geminicli.com/docs/cli/gemini-md/).

Consequence: **one `AGENTS.md` at the repo root is the single rules file**, kept under 24,000 bytes, with detail moved to `docs/` and to a few `.agents/rules/*.md` files that load only when relevant (for example a design rule that triggers on `*.css` and component files). Claude Code reads `AGENTS.md` through a one-line `CLAUDE.md` that imports it, so the fallback costs nothing.

## 7. What I would decide now, and what can wait

Decide now:
1. How many Fable bursts you can afford (four, or F1 and F2 only).
2. That Gemini owns the repo after the bursts, with Claude as reviewer. (Your stated direction; I am planning on it.)
3. The first slice after Equity: I recommend Review plus Hand recorder, because it is the loop only Riverline has.

Can wait: stack details beyond Preact, signals and Vite; desktop wrapper; open or closed source; FSRS; the evidence-gate rule.
