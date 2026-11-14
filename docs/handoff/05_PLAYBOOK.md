# Execution playbook: Fable 5.2 founding sessions, then Gemini

How the restart is run, by whom, in what order, with which prompt. Every prompt named here is a ready-to-paste file in `prompts/`. Nothing in this playbook is approved until the owner says so; sections 1 and 8 list what the owner must decide.

---

## 1. The plan on one screen

| Step | Who | What | Prompt | Ends with |
|---|---|---|---|---|
| 0 | Owner | Decide: number of Fable sessions; first slice after Equity; the open questions that block F1 | `07_ADDITIONS_AND_RISKS.md` section 3 | Answers written into the decision log |
| R | Gemini Deep Research | Six research runs; can start today, in parallel with everything | `prompts/RESEARCH_BRIEFS.md` | Reports in `docs/research/` |
| M | Any agent, read-only | Map the old repository (including `.claude/worktrees/`) | `prompts/ENGINE_MAP_001.md` | `ENGINE_MAP.md` |
| F1a | Claude Fable 5.2 (or Opus 5.5 / Hydrogen High) | Foundation Part 1: repo, TS/Vite/Preact+Signals, CSS Modules, tokens, fonts, 3-lang i18n, shell, test hook, `typecheck`/`test`/`check:raw` | `prompts/FABLE_F1A_SKELETON.md` (or combined `FABLE_F1_FOUNDATION.md`) | App skeleton passing unit & raw-value gates |
| F1b | Claude Fable 5.2 (or Opus 5.5 / Hydrogen High) | Foundation Part 2: Playwright `audit:layout` & `audit:theme` (against `vite preview`, 7 themes × 3 langs × 2 sizes), `golden` harness (`eqexact.py`), CI | `prompts/FABLE_F1B_GATES.md` | Empty app passing all five gates + CI |
| F2a | Claude Fable 5.2 | Component kit Part 1 (`/kit` + 8 core UI primitives) | `prompts/FABLE_F2A_CORE_KIT.md` (or combined `FABLE_F2_COMPONENT_KIT.md`) | Core UI primitives on `/kit`, all gates zero |
| F2b | Claude Fable 5.2 | Component kit Part 2 (6 poker & table components + motion) | `prompts/FABLE_F2B_TABLE_KIT.md` | Table, cards, tickets, mix bar, equity row, history rail on `/kit` |
| F2c | Claude Fable 5.2 | Component kit Part 3 (Lamp 8 moods, Heat grid, Family strip) | `prompts/FABLE_F2C_STUDY_KIT.md` | All 18 components complete on `/kit` |
| F3 | Fable 5.2 (or Gemini 4 Hydrogen High/XHigh) | Clean-room TS engine rewrite, worker API, ported behaviour & golden tests | `prompts/FABLE_F3_ENGINE_PORT.md` | Engine callable; verified figures passing |
| F4 | Fable 5.2 (or Gemini 4 Hydrogen High) | First slice: Equity by rows, storage for one object, export | `prompts/FABLE_F4_FIRST_SLICE_EQUITY.md` | A usable Equity room and a worked pattern |
| C1 | Claude (Opus 5.5 or Sonnet 5.5), read-only | Checkpoint review | `prompts/REVIEW_CHECKPOINT.md` | Findings; fixes go to the bug inbox or a slice |
| G0 | **Gemini** | Takes ownership | `prompts/GEMINI_KICKOFF.md` | Understanding, disagreements, questions, first plan |
| G1… | **Gemini** | Slices, one at a time (**one fresh session per slice**) | `prompts/GEMINI_SLICE.md` | Usable outcome each |
| | Gemini | End every session | `prompts/GEMINI_SESSION_END.md` | `docs/STATE.md` true |
| | Gemini | Bugs, on a schedule | `prompts/GEMINI_BUG_BATCH.md` | Inbox worked through |
| C2… | Claude, read-only | After the first real game night, then every three slices | `prompts/REVIEW_CHECKPOINT.md` | Findings |

**Why F1 and F2 have split prompts (`F1a`/`F1b` and `F2a`/`F2b`/`F2c`):** wiring a 7-theme × 3-language × 2-viewport Playwright + Pillow audit pipeline and building 18 animated, RTL-safe components are too dense for a single context window without rushing the end. Running the split prompts guarantees every component and gate gets full attention. The combined `FABLE_F1_FOUNDATION.md` and `FABLE_F2_COMPONENT_KIT.md` remain in `prompts/` if needed.

---

## 2. Why Fable for the founding sessions (and how to pair models in Antigravity)

Fable 5.2 is the scarce, expensive resource. It is spent where a mistake costs months and where the work must be one coherent act:

| Session | Why it needs the strongest model |
|---|---|
| F1 (`F1a` + `F1b`) Foundation | Every later session inherits these choices: folder boundaries, CSS Modules, the deterministic test hook, the gates, the i18n shape, how themes switch. A weak foundation is paid for in every slice. |
| F2 (`F2a` + `F2b` + `F2c`) Component kit | This is where "the build lost the feel" is prevented. Eighteen components must be consistent with each other in look, states, motion and three languages at once. It needs taste and stamina together. **Do not skip this one.** |
| F3 Engine port | Correctness, and the one place where old code must be understood deeply before it is trusted. |
| F4 First slice | Proves the whole chain and leaves a worked example (`docs/HOW_A_ROOM_IS_BUILT.md`) that every later room copies. |

### Antigravity model pairing (by role and quota pool)

Inside Antigravity, models run on separate quota pools (Hydrogen and 3.8 Flash share a short rolling window; Argon and Orchestrator share a weekly pool; Claude Opus/Sonnet 5.5 share their own pool). Pair them by job:

| Job | Recommended Model in Antigravity | Why |
|---|---|---|
| **Slice planning, architecture checks, `/plan` or `/grill-me`** | **Orchestrator (Argon)** or **Gemini 4 Argon (High)** | Strong strategic decomposition; uses the weekly Argon quota pool so planning never drains your coding quota. |
| **Standard slice implementation & bug batches** | **Gemini 4 Hydrogen (Medium)** | Fast, balanced daily-driver coding workhorse for room slices and kit reuse. |
| **Hard slices, F3 Engine port, deep debugging** | **Gemini 4 Hydrogen (High)** or **(XHigh)** | Maximum reasoning depth for worker concurrency, poker state-machine edge cases, and complex multi-file slices. |
| **`ENGINE_MAP_001`, i18n checks, mechanical test scaffolding** | **Gemini 3.8 Flash (High)** or **Gemini 4 Hydrogen (Low)** | Fast, low-cost execution for read-only repo mapping and mechanical tasks. |
| **Checkpoint reviews (`REVIEW_CHECKPOINT.md`)** | **Claude Opus 5.5 (High)** or **Claude Sonnet 5.5 (High)** | Cross-vendor audit on a separate quota pool; reads `CLAUDE.md` -> `AGENTS.md` automatically. |

**How to run a founding or slice session well**
- **One session, one outcome.** Never stack multiple slices into one endless chat; context rot is what causes bug loops. Start each slice in a fresh session that reads `AGENTS.md`, `docs/STATE.md`, and `docs/DECISIONS.md`.
- Attach the handoff package to F1a; later sessions open directly in the repository, which by then contains it under `docs/`.
- Each prompt makes the agent reply first with disagreements, questions and a plan. Answer those before it builds. This is where the owner's ten minutes are worth most.
- Let it finish the gates. Do not accept a report without gate output.
- If a session runs out before the outcome is reached, have it update `docs/STATE.md` and stop; continue in a fresh session with "Read AGENTS.md and docs/STATE.md, then continue F-n".

---

## 3. Gemini as owner of the repository

### 3.1 What changes when Gemini takes over

Until now, models worked on this project as visitors: a ticket in, a report out, context lost. From G0 on there is **one long-term owner**. That owner holds the plan, questions it, builds it, checks it and keeps the records (`docs/STATE.md` and `docs/DECISIONS.md`) across clean, slice-scoped sessions. The handoff documents (`01_HANDOFF_MASTER.md` section 4 and `AGENTS.md`) define how: total ownership, merge before add, strict design discipline with creative proposals, skeptical collaboration, confirmation before major changes.

### 3.2 The honest risk and the guardrails

In its one earlier task on this project (an independent review), Gemini was sharp on consistency and arithmetic and found real errors. It also labelled claims "Verified" that it had not computed, one of which was wrong; produced one slightly wrong equity figure; and recommended cutting three things the owner had explicitly chosen. These are one failure: **confidence without a check.** The setup therefore does not rely on care. It makes unchecked claims hard to merge:

| Risk | Mechanical guardrail |
|---|---|
| "Verified" without verifying | Reports may use the word only beside a command and its output. Golden numbers come from `python tools/eqexact.py`. |
| Visual regressions | Layout audit and theme audit (running against `vite preview` and exiting non-zero on failure) on every kit entry and every app state, all themes, three languages, two sizes. Pass mark zero. |
| Design drift | `check:raw` fails the build on raw values (including inline SVGs). CSS Modules (`*.module.css`) scope component classes. Rooms may not restyle kit components. New patterns need a yes. |
| Acting against owner decisions | The decision log lists hard nos with reasons. Challenge in writing; do not act until answered. |
| Scope creep, rewrites | One slice, one fresh session, one page of plan, a budget. |
| Self-review blind spots | A Claude model reviews at checkpoints. A different vendor is the point. |
| Lost context or token bloat | `AGENTS.md` loads every session; `docs/STATE.md` is updated at the end of every session; `.geminiignore` keeps binary screenshots and historical `reference/` files out of automatic search indexing. |

**Fallback.** If, after the first two slices, Gemini's work needs more than about one correction round per slice on average, or a checkpoint finds a false claim, the owner can move the same repository to Claude Code without changing anything: `CLAUDE.md` imports `AGENTS.md`, and the gates are plain npm scripts.

### 3.3 The slice order (a proposal)

1. **Review plus Hand recorder** (or **Hand recorder** then **Review** as two tight slices so neither exceeds a 1–2 session budget). The loop only Riverline has. Needs the hand object, the shorthand grammar (already begun in Equity), the legal state machine from the engine, decisions versus luck, "what were you thinking".
2. **Game night** (phone layout first) with full storage and export, then **the first real Friday.** After it: checkpoint review, and a conversation with the owner about what was annoying.
3. **Training: quick drill** and the session report.
4. **Strategy:** spot map and plan builder, then the leak map.
5. **Home** (coach layout), built from what the earlier rooms now know.
6. **Learn** and the quick trainer.
7. **Settings**, the rest (Appearance exists from F1).
8. **Heads-up duel.**
9. **Full hand**, last, and only with better bots.

Onboarding, the Russian and Hebrew review with the owner, and 1366×768 checks are part of every slice, not slices of their own.

### 3.4 What a good Gemini session looks like

1. Starts in a **fresh session** for the slice; reads `AGENTS.md`, `docs/STATE.md`, and `docs/DECISIONS.md`; reads only the section of `06_PRODUCT_MAP.md` / `04_DESIGN_SPEC.md` that the slice touches.
2. Writes a one-page plan that names what it will reuse, what it will merge or delete, and what it disagrees with.
3. Waits for the owner's yes.
4. Builds from the kit (`*.module.css`), on tokens, through the engine API, in three languages.
5. Runs all gates to zero (`typecheck`, `test`, `golden`, `check:raw`, `audit:layout`, `audit:theme`).
6. Reports in five lines with gate output and an honest "not done" line.
7. Updates state, decisions, ideas, bug inbox. Stops.

### 3.5 What the owner should watch for

- A report without command output next to its claims.
- A new file where an existing one could have been extended.
- A style rule inside a room folder or a raw colour inside an inline SVG.
- A number computed in a component.
- "Temporary", "for now", "TODO: replace".
- A plan that grows after it was approved, or a session where multiple slices are stacked without resetting context.
- Agreement with everything. A good owner of the repo disagrees sometimes.

---

## 4. Setup (owner, once, about fifteen minutes)

1. **Create the empty repository** (for example `C:\Users\sjzns\Projects\riverline`), next to the old one (`poker-gto-app`). Keep the old one untouched.
2. **Unzip the handoff package** somewhere outside both repositories. F1a copies what it needs into the new repo (including `.gitignore` and `.geminiignore`).
3. **Antigravity:** open the new repository as the workspace. It reads `AGENTS.md` at the root and `.agents/rules/*.md` automatically. Rule files there need frontmatter with a `trigger` (the two seed files have it); verify in Session 1 that both `.agents/rules/design-tokens.md` and `.agents/rules/engine-truth.md` load when touching `src/ui/**` and `engine/**`. Files over 24,000 bytes are truncated, and always-on rules share a budget of about 20,000 tokens, which is why `AGENTS.md` is kept short and `.geminiignore` excludes `docs/reference/` and binary screenshots from automatic indexing.
4. **Gemini CLI:** it reads `GEMINI.md` by default. The seed file `.gemini/settings.json` sets `context.fileName` to `["AGENTS.md", "GEMINI.md"]` so that it reads `AGENTS.md` too. Run `/memory show` once to confirm the file is loaded.
5. **Claude Code** (for Fable sessions and checkpoint reviews): `CLAUDE.md` contains one line, `@AGENTS.md`, so the same rules load.
6. **Permissions:** let the agent run the npm scripts, Playwright and git on its working branch without asking each time; keep a prompt for installs, pushes to the main branch and anything outside the repository. Give it **read-only** access to the old repository.
7. **Python and Playwright:** the audits need Node 22+, Playwright with Chromium, and Python 3 with Pillow (`pip install Pillow`).

---

## 5. Research with Gemini Deep Research

`prompts/RESEARCH_BRIEFS.md` holds a shared context block and six briefs: (1) reference sources for a 30 to 60 big blind baseline, (2) Russian and Hebrew terminology as really used, (3) right-to-left engineering for dense data, (4) skill-acquisition research applied to study tools, (5) a legal and platform reading list, (6) a performance budget. Run them in that order; none needs the repository.

How to use the results:
- Save each report in `docs/research/` with its date.
- Gemini (as repo owner) reads a report and proposes, in one paragraph each, what to adopt, with the source. The owner decides. Adopted items go to the decision log.
- Nothing about law, prices or licences is acted on without a human reading the primary source.
- Brief 2 results are reviewed by the owner personally, who is fluent in both languages.

Older research from October is in `reference/LONG_TERM_NOTES.md` (summaries) and was never independently verified.

---

## 6. Checkpoint reviews

A read-only session with a Claude model (e.g. Claude Opus 5.5 or Sonnet 5.5), using `prompts/REVIEW_CHECKPOINT.md`. It reruns the gates, recomputes ten numbers, hunts for duplicated logic, token violations, honesty-rule violations, throwaway code and source-shape tests, and opens three screens in Russian and Hebrew.

When: after F4 (or after F2c if only the foundation and kit sessions are run before Gemini takes over), after the first real game night, then every three slices, and any time the owner feels something is off.

The reviewer fixes nothing. Gemini receives the report, answers each finding (agree and fix, disagree with a reason, needs the owner), and the owner settles disagreements.

---

## 7. Budgets and rhythm

- A slice is sized in the plan. As a starting rule: a room's first usable version fits in one to three sessions (one fresh session per sub-slice). If the plan needs more, the slice is too big; cut it.
- Polish target: signature screens (Review, Equity, the drill, the table) to the standard of the prototype; everything else to "broadly right", with small fixes logged.
- Bug batch: weekly, or before each real game night.
- The owner's acceptance is by use: open it in Firefox, do the thing, say what was annoying. Not a checklist.
- A monthly question, kept from the old process because it is the right one: **"Would I use it by choice?"**

---

## 8. What the owner must decide before F1

1. How many Fable sessions: all four (`F1a`–`F1b`, `F2a`–`F2c`, `F3`, `F4`), or two milestones (`F1a`–`F1b` and `F2a`–`F2c` with Fable/Opus, then `F3` and `F4` with Gemini 4 Hydrogen High).
2. Confirm Gemini as owner after the founding sessions, with Claude checkpoint reviews.
3. Confirm the stack proposal (TypeScript strict, Vite, Preact with `@preact/signals`, Vitest, CSS Modules `*.module.css` with plain CSS on tokens), or ask F1a to challenge it.
4. Confirm the method change: a component kit and audits, instead of ported mockup markup and a pixel-diff gate.
5. The first slice after Equity (recommended: Hand recorder + Review).
6. Where the new repository lives and what it is called.

Everything else can wait for the session that needs it.
