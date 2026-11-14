# Additions the owner did not ask for, the risk register, and the questions waiting

The owner asked the outgoing manager to go beyond the brief and to flag what was added. This file is that flag, updated with the pre-flight handoff optimizations (script fixes, split founding prompts, CSS Modules, and `.geminiignore` token protection). Gemini: treat every item in section 1 as a proposal with no special authority. Challenge any of it.

---

## 1. What was added unasked

### 1.1 In the design phase

| Addition | Why | Status |
|---|---|---|
| **Paper**, a second light theme | To prove the token system: it took nine values and passed the audit first time. | Built; owner has not commented. |
| **Phone Game night in Daylight** | The phone layout was the one real screen outside the audited app board. | Built; checked by eye in four states. |
| **Contrast fixes in the dark themes** | The audit found 23 low-contrast texts in Midnight, six in Felt and one in Slate. Tertiary text was too dim on raised surfaces. | Fixed. |
| **A real equity engine inside the Equity prototype** | So that typed players and multiway numbers are true, and checkable. It is a stand-in; the app must use the engine. | Built; matches the independent evaluator. |
| **The theme audit** (pixel-measured contrast and friends over 43 states) | Daylight could not be fixed reliably by eye. | Built; proposed as a permanent gate. |
| **Type and space scales that are tidier than the prototype** | The prototype uses sixteen font sizes. | In `tokens.css` as the target; flagged as not matching every prototype screen. |
| **The "two clocks" motion rule** and four duration tokens | The owner asked for slower table actions; slowing everything would feel broken. | Proposal until felt in a build. |
| **Proposals:** street ribbon, the Friday loop as a guided path, "Can I call?" strip, commitment preview, motion ideas, follow-the-system theme, print stylesheet | Bigger-picture ideas the owner asked for. | In the idea bank (68 to 79) and the decision log section E. |

### 1.2 In this handoff (including pre-flight optimizations)

| Addition | Why |
|---|---|
| **`AGENTS.md` as the single rules file**, with `CLAUDE.md` importing it and Gemini CLI configured to read it | One source of rules for Antigravity, Gemini CLI and Claude Code. It also makes the fallback to Claude Code free. |
| **Two scoped rule files** (`.agents/rules/`) that load only when interface or engine files are touched | Keeps the always-loaded rules short; detail arrives when relevant. |
| **`repo-seed/.gitignore` and `repo-seed/.geminiignore`** | Prevents committing build/audit outputs or secrets, and excludes binary screenshots (`docs/design/screenshots/`), `.dc.html` canvas files, and historical `docs/reference/` files from automatic agent search indexing to save token budget. |
| **Split founding prompts (`F1a`/`F1b` and `F2a`/`F2b`/`F2c`)** | F1 and F2 are too large for single context windows without rushing the audit harness or the 18 animated components. Splitting them into bounded sessions prevents context exhaustion. |
| **CSS Modules (`*.module.css`) + Vitest + `vite preview` audit target** | Prevents global CSS class collisions across 18 components and 8 rooms while keeping 100% plain CSS on tokens; ensures Playwright audits test production CSS order. |
| **Hardened `check-no-raw-values.mjs` and cross-platform `design/tools/*` scripts** | Fixed `check-no-raw-values.mjs` to catch raw hex/rgb/durations in inline SVG attributes (`fill`, `stroke`, `stopColor`, `dur`) while allowing `0s`/`0ms` resets; fixed hardcoded Linux `/home/claude/...` and `/mnt/user-data/...` paths, Windows `file://` URL conversion (`pathToFileURL`), UTF-8 file encoding for Russian/Hebrew/suit symbols on Windows, RTL left-edge clipping detection in `snap.js`, non-zero failure exit codes in `audit.js` and `analyze.py`, and added a full CLI + multiway/turn/vs-any support to `eqexact.py`. |
| **The reporting rule: "verified" only beside a command and its output** | Direct answer to the one weakness Gemini showed on this project. |
| **A "confirm before" list** | The owner asked for confirmation of major decisions; a list makes "major" concrete and frees everything else. |
| **A slice template, a state file, a bug inbox, an engine provenance file** | The smallest set of records that lets any session start cold. |
| **The read-only engine map task** (`ENGINE_MAP_001.md`) including `.claude/worktrees/` inspection | The legacy description in this package is second-hand and the old repo has at least nine worktrees; both must be verified before code is copied. |
| **A checkpoint review by a different vendor** | Self-review misses what cross-review catches. Cheap, read-only. |
| **A fallback** (move the same repo to Claude Code) | The owner is betting on one model; the bet should be reversible. |
| **Six research briefs with a shared context block** | The owner wants Gemini for deep research; the briefs are ready today. |
| **The supersession table** in the decision log | Older documents in `reference/` contradict newer decisions; without the table an agent could revive a dead idea in good faith. |
| **A wording defect flagged in the Review prototype** (which quantity "−48.8 bb" is) | Found while writing the verified-numbers table. |
| **`reference/README.md`** with a trust level per file | The history is useful and dangerous in equal measure. |
| **An explicit list of what is not designed** | So that nobody mistakes the absence of a screen for a decision. |
| **The owner profile** in the master document | A new owner of the repo works better knowing how this owner decides, what annoys them and what they have asked to be told. |

---

## 2. Risk register

| # | Risk | Likelihood | Cost | What reduces it |
|---|---|---|---|---|
| R1 | **Russian and Hebrew break the layouts.** No restart screen was drawn in either. | High | High: every component | Three languages from the first kit component; the audit runs in all three (including RTL left-edge clip detection); the owner reviews wording. |
| R2 | **The component kit is rushed** to get to features. | Medium | Very high: it is the old failure again | F2 is split into `F2a`, `F2b`, and `F2c` with the strongest model; the `/kit` component sheet is the reference; rooms cannot restyle. |
| R3 | **Unverified claims in reports.** | Medium | High: trust | The reporting rule; golden numbers (`python tools/eqexact.py --section8`); checkpoint reviews. |
| R4 | **The legacy description is wrong in places, or worktrees hold newer fixes.** | Medium | Medium | `ENGINE_MAP_001` (checking both `codex/stabilization` and `.claude/worktrees/`) before any copy; provenance file. |
| R5 | **Engine code turns out to be entangled with the page.** | Medium | Medium to high | The "mixed" classification; extract with a pinning test first; do not copy what touches the DOM. |
| R6 | **The owner's real study data** sits in the old app's browser storage on one machine. | Low now | Very high if lost | Never touch the old repo or its storage; `ENGINE_MAP_001` documents the exact storage keys; write an export tool for it early; export in the new app from the first slice that stores anything. |
| R7 | **The baseline is only Estimated** and the product leans on it. | Certain | Medium | Design so that the product is useful while saying so; lead with plan versus play and exact facts; research brief 1. |
| R8 | **Bots are not believable,** making the duel and Full hand hollow. | High | Medium | Build those modes last; treat bot quality as part of the feature. |
| R9 | **The loop is never used.** Nobody has recorded a real hand on a real night in any version. | Unknown | Decisive | The second slice ends with a real Friday; ask "would I use it by choice?" monthly. |
| R10 | **Scope.** The idea bank has 79 entries; the owner generates more and asked to be kept in check. | High | High | One slice at a time; ideas go to the bank; the manager role says no. |
| R11 | **Motion tokens feel wrong in a real build.** They were set on a page, not in use. | Medium | Low | They are tokens: change four numbers. Ask the owner once on the kit sheet. |
| R12 | **Performance** of exact equity and animation on a modest laptop, in Firefox. | Medium | Medium | Worker, cancellation, compute when visible; transform and opacity only; measure in F3; research brief 6. |
| R13 | **Legal and naming** questions unanswered (money in Game night, the name, notices). | Low while private | High at public release | Chips by default before any release; research brief 5; a human lawyer before going public. |
| R14 | **Licences** of fonts, sounds, reference data. | Low | High | Record a licence before use; `docs/THIRD_PARTY.md` from F1a. |
| R15 | **One human, limited time and limited AI budgets.** | Certain | Shapes everything | Fresh session per slice; `.geminiignore` excluding archives/screenshots; cheap gates; no ceremony; accept "broadly right". |
| R16 | **Tooling drift.** Antigravity and Gemini CLI change how rules load. | Medium | Low | One plain `AGENTS.md`; verify `.agents/rules/*.md` on Session 1; `/memory show`; nothing depends on a vendor-specific feature. |
| R17 | **This handoff is wrong somewhere.** It was written by one model from memory, notes and artifacts. | Certain, in small ways | Low to medium | The handoff asks to be challenged; the decision log is append-only and correctable; the owner is the authority. |
| R18 | **Old documents in `reference/` are followed by mistake.** | Medium | Medium | The precedence rule; the supersession table; the reference README; `.geminiignore`. |
| R19 | **The 1440×900 prototype is copied literally** and fails at 1920 and 1366. | Medium | Medium | The kit settles sizes; audits run at both `1920×1080` and `1366×768`. |
| R20 | **A second "mockup" starts to live outside the repo again.** | Medium | High: drift returns | After F2c the `/kit` component sheet is the only visual truth. New design exploration may happen in a chat canvas, but it lands as a kit change or it is discarded. |

---

## 3. Questions waiting for the owner

Blocking the first founding session:
1. Founding sessions: run the split `F1a`–`F1b` and `F2a`–`F2c` with Fable/Opus and then hand `F3`–`F4` to Gemini 4 Hydrogen High, or run all four milestones (`F1`–`F4`) with Fable?
2. Stack proposal confirmed (TypeScript strict, Vite, Preact with `@preact/signals`, Vitest, CSS Modules `*.module.css` with plain CSS on tokens), or should F1a challenge it?
3. Component kit and audits instead of ported markup and a pixel-diff gate: confirmed?
4. Name and location of the new repository.

Blocking a later slice (answer when that slice is planned): the first slice after Equity; evidence gate rule; Game night default units; keep the leak scan, the plan builder, or both as first session; fixed intervals or FSRS; desktop wrapper; Paper as a shipped theme; Georgia as a heading option; whose-turn design accepted; decision controls per mode; whether the weekly letter gets a room; when sound arrives; whether old study data is migrated or only exported; open or closed source.

The full list with the manager's view on each is in `02_DECISION_LOG.md` section F.

---

## 4. Things the outgoing manager got wrong or left unfinished (so you do not inherit them silently)

1. Mockup numbers were wrong more than once and were caught by the owner or by review. That is why golden numbers (`eqexact.py`) are a gate.
2. Mockups were produced faster than the build could absorb them, which widened the gap the reset is meant to close.
3. Long handoffs and prescribed patches sometimes stood in for asking whether a concept was wrong.
4. The restart canvas was drawn at 1440×900 against a standing rule of 1920×1080.
5. No restart screen exists in Russian or Hebrew.
6. The disabled-button style on the app board is still the washed-out one in Daylight.
7. The two Lamp boards and the two motion boards sit on a Midnight page only.
8. The prototype's CSS still contains literal durations and in-between font sizes; only its colours are fully tokenised.
9. Hover, focus and pressed states were not walked by the audit.
10. The legacy repository was described from reports, not from reading it.
