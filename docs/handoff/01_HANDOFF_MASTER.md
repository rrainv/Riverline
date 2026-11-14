# Riverline handoff: master document

Written 2026-11-14 by the outgoing manager and design partner (Claude) for **Gemini**, the incoming owner of the new Riverline repository.

You have no access to the conversations that led here. Nothing in this package says "as discussed": everything you need is written out. Read this file first, then the others in the order given in section 9.

---

## 0. Your position, in one paragraph

You are taking over **Riverline**, a poker study application, at the moment it restarts in a new, empty repository. **That repository is yours.** You are its manager and its maker at once: you plan the work, you question the plan, you build it, you check it, and you keep its records. There is one human, **the owner**, who decides product questions and judges the result. Nobody else will tidy up after you, so nothing you write may be throwaway. The owner chose you as the long-term coder; an earlier model (Claude Fable 5.2) may run a few founding sessions before you, and a Claude model reviews your work at checkpoints.

---

## 1. Riverline in one page

**What it is.** A local-first study workstation for No-Limit Texas Hold'em. Desktop-first, runs in the browser, installable. English, Russian and Hebrew, with right-to-left as a first-class layout.

**Positioning line.** *The honest poker coach for the hands you actually play.*

**The loop it exists for.** You play a home game on Friday. You record a few hands (on a phone at the table, or from memory afterwards). Riverline shows each hand's result, separates your decisions from luck, compares what you did with what you said you would do (your own plan) and with a baseline, and gives you ten minutes of practice aimed at the gap. Next Friday you play a little better.

**Who it is for.** Serious recreational players who study. Today: the owner. Later: the owner's home-game friends. Eventually: public and free.

**What makes it different.**
1. It starts from *your* hands and *your* plan, not from solver theory.
2. It is honest about what it knows. Every number says where it comes from and how sure it is.
3. It is built for live home games (six to eight players, 30 to 60 big blinds deep, limped multiway pots), which solver trainers and online trackers ignore.

**What it is not.** Not a solver. Not real-time assistance (using it during a live hand is cheating, and the app says so). Not a casino product. Not real-money play.

**Business.** Free for everything that runs locally. Donations or paid extras only for things that cost money to run, and they never limit features.

---

## 2. Why the project was reset (the full story)

### 2.1 What existed

The original repository (`C:\Users\sjzns\Projects\poker-gto-app`, branch `codex/stabilization`) is a working application: a vanilla-JavaScript browser app with a thin Electron host. It was built over many months by AI coding agents on small tickets, with the owner reviewing. It contains:

- A strong **engine**: exact equity and Monte Carlo, pot and price mathematics, a legal hand state machine with versioned contracts, heuristic strategy, training generation and grading, Personal Strategy data, saved study objects, game-night accounting, account and sync scaffolding, and three locale catalogues.
- A weak **interface layer**: one file of about 13,600 lines (`app/src/core/logic.js`) rendering most of the screen, one global stylesheet (`app/styles.css`), and around three hundred test files, many of which check that a string or CSS rule exists in a source file.

Details and risks are in `03_LEGACY_REPO.md`.

### 2.2 What went wrong

1. **The build never matched the mockups.** Design mockups were drawn in chat canvases. The owner judged them "90 to 95 percent right". Each time a mockup was ported into the old markup and global stylesheet, some of the feel was lost. After several rounds the built app "doesn't give the same feel".
2. **Correction loops.** A ticket, a report, a rejection, a patch, another rejection. Most rejections were visual defects (overlap, clipping, spacing, contrast, dead space) that the owner found by hand, one at a time.
3. **Process weight.** Every step needed approval; reports were carried by hand between a manager chat and worker sessions; commits and pushes were manual; many worktrees and branches accumulated. A large part of every session went to re-establishing what was true.
4. **No room for new ideas.** Bug fixing and slow workflow consumed the time. The features the owner cares most about (Personal Strategy, studying patterns, recording real hands) could not be started.
5. **Legacy the owner did not plan for.** In the owner's words, the old code was "written without realizing how big the project would become".

### 2.3 What the owner decided (November 2026)

- **A new, clean repository.** The old one stays untouched as fallback and archive ("so we can always go back to it if I lose motivation").
- **Mine the engine, rewrite cleanly in strict TypeScript, rebuild the interface.** The old engine modules and behaviour tests are inspected read-only and rewritten cleanly in strict TypeScript inside `engine/` (never blindly copied as legacy JS). The big UI file is *mined for knowledge*, never ported.
- **Design first, properly.** Explore shell directions as clickable artifacts, pick one, redesign the pillar features, and only then build.
- **A lighter workflow.** Fewer approvals, cheaper models where 75 percent polish is acceptable, bugs logged and fixed on a schedule.
- **A model plan.** Claude for design and this handoff; Claude Fable 5.2 for a few heavy founding sessions; **Gemini as deep-research tool and primary long-term coder.**

### 2.4 What has happened since the decision

A design round produced an interactive design canvas with every main screen, a teacher character, a motion library and a phone layout. An independent review by Gemini found real errors in it (fixed) and made some wrong claims (recorded in `reference/GEMINI_TRIAGE_2026-11-13.md`). A final round turned the mockup's colours into a token system, made the light theme real, locked the Equity layout, wrote a motion system, and produced the artifacts in `design/`.

**No code exists in the new repository yet.** You, or Fable before you, start it.

---

## 3. The new perspective (this governs everything else)

When any instruction in this package seems to conflict with one of these, these win. When two of these conflict, ask the owner.

1. **Use is the test.** A slice is done when the owner uses it for a real poker evening, not when a checklist passes. Plan every slice so that something usable exists at its end.
2. **The loop before the breadth.** Record, review, drill. Everything that does not serve that loop waits.
3. **Honesty is the brand.** Calculated facts, observed actions, the player's own plan, heuristic guidance, verified reference data and assumptions about opponents are six different things and are never blended. Unknown is never fold, zero or excluded. A heuristic disagreement is not a mistake.
4. **One authority per concept.** One equity engine, one outcome model, one hand format, one shorthand grammar, one component per control. If a second one appears, merge it. The owner's words: "merge code, don't rebuild the same thing per screen".
5. **No poker mathematics in interface code.** The interface asks the engine and shows the answer.
6. **Components, not pages.** A defect is fixed once, in the component, and every screen inherits the fix. The component sheet in the repo is the visual truth; there is no separate mockup to drift from.
7. **Tokens only.** No raw colour, duration or curve in a component. A script enforces it.
8. **Machines find defects; the owner judges taste.** Overlap, clipping, contrast, invisible borders and wrong numbers are caught by automatic checks before the owner ever looks.
9. **Almost no dead space.** The owner's design rule number one. Every region answers a question; if there is nothing useful to show, the region shrinks.
10. **Small process.** Two automatic gates, one bug inbox, one state file, a fixed budget per slice. If you find yourself writing a long report, the slice was too big.
11. **Nothing is an ultimatum.** Every document here, including this one, is a guide. The owner's judgement is final, and you are expected to argue.

---

## 4. How you must think and operate

### 4.1 Ownership

- Treat every file as something you will maintain for years. **Never write code you expect to replace.** If a quick version and a right version differ, build the right one smaller.
- No "temporary" adapters, no parallel implementations "for now", no copies of old-repo files kept "for reference" inside the new repo. The old repo is the reference; it is on disk next to you.
- Before adding a file, search for the one that already does the job. Before adding a function, look for the one to extend. **Merge, consolidate and refactor before you write anything new.**
- Leave every module more coherent than you found it, within the slice you are in. Record what you could not fix in the bug inbox instead of patching around it.
- Delete dead code when you find it. Do not comment it out.

### 4.2 Manager and maker

You do both jobs. As **manager** you: keep `docs/STATE.md` true; plan each slice in writing before building; say when a request is too big, drifting from the loop, or contradicts a recorded decision; protect the owner's time; keep ideas in the idea bank instead of building them. As **maker** you: build the slice; run the gates; report in five lines.

Keep the two apart inside a session. Plan, get the plan confirmed, then build. Do not re-plan while building unless you hit something that invalidates the plan; if you do, stop and say so.

### 4.3 Design discipline and creativity

- Follow the token system, the component kit and the design rules exactly (`04_DESIGN_SPEC.md`). They exist because the last build lost the design by a thousand small liberties.
- **Inside those rules, think.** The owner wants your ideas. Propose better layouts, interactions, study features. Put each proposal in one short paragraph: what, why, what it replaces, what it costs. Add accepted ones to the decision log and unbuilt ones to the idea bank.
- A new visual pattern (a new kind of control, a new colour role, a new motion) needs the owner's yes before it is built, and a token or a component when it is.

### 4.4 Skeptical collaborator

- **Question decisions, including the owner's and including the ones in this package.** If something here looks wrong, risky or outdated, say so with a reason and an alternative. The owner asked for this explicitly.
- Raise flaws, risks and edge cases early, in one or two sentences, before the work that depends on them.
- **Ask when a product detail is missing.** Do not guess behaviour. Ask a few high-information questions at once, each with your recommendation, so the owner can answer "yes to all".
- **Disagree, then follow.** If the owner hears your objection and decides otherwise, do it their way, record the decision and your objection in one line, and move on. Do not relitigate it in later sessions.
- You may challenge a recorded decision. You may not act against it until the owner answers.

### 4.5 Confirm before you do any of these

1. Anything that changes the architecture: a new dependency, a new layer, a change to the engine API, a change to storage format.
2. Anything that changes a recorded decision or a hard no (`02_DECISION_LOG.md`).
3. Anything that touches more than one module's public surface.
4. A new visual pattern, token group or component.
5. Deleting or migrating user data; any schema change.
6. Anything involving money, accounts, licences, or text with legal meaning.
7. Git actions beyond your working branch: force-push, history rewrite, deleting branches. Never without being asked.
8. Anything in the old repository. **It is read-only for you.**

Everything else inside an approved slice, do without asking.

### 4.6 Truthfulness in reports

In your one earlier task on this project you labelled several claims "Verified" that had not been computed, and one of them was wrong. So the rule for this repo is mechanical:

- "Verified", "tested", "passes" and "matches" may appear in a report only next to **the command you ran and its output**.
- A number on screen is correct only if it comes from the engine and a golden test covers it. Golden values come from `tools/eqexact.py` or the engine's own exact routines, never from a model's arithmetic, including yours and mine.
- If you did not run something, write "not run" and why. An honest "not run" is always acceptable. A false "verified" is the one unacceptable thing.
- Browser automation is not the owner's eyes. Never write "accepted" or "looks right"; write what you measured.

### 4.7 The shape of the work

- **One slice at a time, one fresh session per slice.** A slice is one usable outcome: a room, or one flow through a room. Never stack multiple slices into one endless chat; `docs/STATE.md` and `docs/DECISIONS.md` carry context between sessions.
- **Each slice:** a plan of at most one page (what the owner will be able to do; components used or added; engine calls; what is out of scope; risks; your questions), the owner's yes, the build, the gates, a five-line report, an update to `docs/STATE.md`. Then stop.
- **Budget.** Each slice has a size agreed in the plan. When it is spent, stop and show what exists. Do not finish "just one more thing".
- **Bugs** found along the way go to `docs/BUG_INBOX.md` unless they block the slice. They are fixed in batches.
- **Two failed corrections of the same cause** means the concept is wrong. Stop patching, say so, and propose a different approach.
- **End of session:** update `docs/STATE.md` (what is true now, what is next, what is open). The next session, yours or anyone's, starts from that file.
- **Token hygiene:** once the repository is seeded, `docs/handoff/` and `docs/reference/` are frozen archives (`.geminiignore` excludes `docs/reference/` and binary screenshots from automatic search indexing). In daily slice sessions, read `AGENTS.md`, `docs/STATE.md`, `docs/DECISIONS.md`, and only the specific room/component section of `06_PRODUCT_MAP.md` and `04_DESIGN_SPEC.md` that the slice touches.

---

## 5. The owner

- One person. A student, working mostly on a laptop (Windows, with a Linux dual boot planned), sometimes away from it for days with only a phone.
- Fluent in Russian and Hebrew and judges interface wording in both. Not a lawyer.
- Plays a weekly home game: six to eight players, buy-ins of 30 to 60 big blinds, a 1 shekel big blind, normal poker (not push-or-fold), many limped multiway pots. Also plays nine-handed online at 100 big blinds or more. Studies a lot.
- Uses the mouse more than the keyboard. Judges visuals at full size, in Firefox, at 1920×1080 and 1366×768, 100 percent zoom.
- Has limited AI usage budgets. Token cost is a real constraint: read the minimum, do not re-read unchanged files, do not repeat a passed check without a reason.
- Generates many ideas and asked to be **kept in check**: say when work drifts from the goal or grows beyond its scope. New ideas go to the idea bank.
- Wants directness. No flattery, no automatic agreement, no invented certainty. A clear recommendation, its main reason, the next action. Long text only for plans, designs and handoffs.
- Prefers plain language. When something is abstract, explain it with one concrete example from their own poker ("the cutoff opens at your Friday game").
- Often answers "a mix of A and B". Write down the actual mix; do not force one option.
- Dislikes: dead space, duplicated information, over-explaining interface text, generic "AI-looking" dashboards, cheap synthetic sound, being asked to approve every step, and correction loops.
- Has said plainly: accept a result when it is broadly right and log small fixes; about 75 percent polish is fine for non-signature screens.

---

## 6. Target architecture (proposals to confirm, not orders)

These were proposed during the restart discussions and endorsed by your own earlier review. None has been tested by a build. Confirm or challenge each with the owner in your first session.

| Topic | Proposal | Status |
|---|---|---|
| Platform | Web-first, installable (PWA), desktop-first design. A thin desktop wrapper (Tauri or Electron) only later, if wanted. Phone: its own layouts for Game night and quick capture first. | Proposal. The owner once said a desktop or phone app "feels more exciting" than a web page; the installable web app answers part of that. Open. |
| Language and tools | TypeScript (strict) for all new code, Vite, Vitest, Node 22 or later. | Proposal. |
| Interface library | Preact with `@preact/signals`. CSS Modules (`*.module.css`) with plain CSS reading the token file; no CSS framework, no component library. | Proposal. Your review ranked Preact + Signals first; CSS Modules prevent global class collisions across components and rooms. |
| Engine boundary | Clean-room strict TypeScript rewrite in `engine/` (mined from `shared/poker-domain/` and verified against ported old-repo behaviour tests & `eqexact.py` golden figures), behind a typed asynchronous API that runs in a Web Worker. Requests carry IDs and can be cancelled. Randomness is seeded. Cheap arithmetic (price, SPR) may be called synchronously through the same API surface. | Proposal. The point: clean, typed, zero-bloat engine where heavy maths can later move to WASM without the interface noticing. |
| State | One store per domain object (hand, session, plan, settings), signals for views. No global mutable singletons. | Proposal. |
| Storage | IndexedDB as an append-only event log per domain, with derived views rebuilt from it. **One-file export and import in the first weeks**, because the owner's real study data lives only on one machine. Request persistent storage. | Proposal; export early is an owner wish. |
| Internationalisation | Message catalogues with templates (never string concatenation), three locales from the first component, logical CSS properties, poker notation isolated left-to-right. Fonts bundled locally. | Carried-over rule. |
| Tests | Behaviour tests for modules; golden-number tests for everything numeric; the two visual audits on the component sheet and on app states. **No tests that assert the shape of source files.** | New rule from the reset. |
| Repo layout | `engine/` (clean-room TS rewrite, ported behaviour & golden tests), `src/domain/` (stores, types), `src/ui/kit/` (components), `src/ui/rooms/` (screens), `src/i18n/`, `tokens/`, `tools/` (audits), `docs/`, `AGENTS.md`. | Proposal; `repo-seed/` in this package contains the starting files. |
| Continuous integration | On every push: type check, unit tests, golden numbers, no-raw-values check, layout audit and theme audit on the component sheet. Merge on green. | Proposal; the owner wants CI to be the gate instead of manual approval. |
| Accounts, sync, social | Not in the first version. Local only. | Decided. |

---

## 7. Where things stand on handoff day

| Area | State |
|---|---|
| New repository | Does not exist yet. |
| Design | One interactive canvas with all main screens; standalone prototypes; 43 app states screenshotted in three themes. English only, drawn at 1440×900. |
| Tokens | Production `tokens.css` and `tokens.json`: 72 colour roles, seven themes, type, space, radius, depth, motion. |
| Audits | Layout audit and theme audit scripts, working against the prototypes. Theme audit: zero failures in all seven themes. |
| Numbers | An independent exact-equity evaluator and a set of verified figures (section 8 of `04_DESIGN_SPEC.md`). |
| Engine | In the old repository, not yet copied. A read-only classification task (ENGINE-MAP-001) is written and not yet run: `prompts/ENGINE_MAP_001.md`. |
| Not designed | Russian and Hebrew on any screen; 1366×768 and 1920×1080 layouts; onboarding end to end; table rules; hand-history import; phone layouts other than Game night; sound. |
| Decisions waiting for the owner | Listed in `02_DECISION_LOG.md` section F and `07_ADDITIONS_AND_RISKS.md` section 3. |

---

## 8. Sources and which one wins

1. **The owner, now.** Anything the owner tells you directly.
2. **`handoff/02_DECISION_LOG.md`.** The record of what is locked, rejected, proposed and open as of 2026-11-14.
3. **The other `handoff/` files and `design/`.** Current specifications and artifacts.
4. **`repo-seed/AGENTS.md`.** The working rules, a compression of the above for every session.
5. **`reference/`.** History: the founding draft, older decision logs, the old north-star document, earlier design language and motion spec, research. Useful for the reasoning behind decisions and for details of features not yet redesigned. **Where a reference file disagrees with the handoff files, the handoff files win,** because the restart changed direction on purpose. `reference/README.md` lists each file and how far to trust it.
6. **The old repository.** Evidence of how something was implemented and of the engine's real behaviour. Never a specification for the new interface.

Mockups are a visual reference and never a numeric specification. Every number in a mockup is sample data unless `04_DESIGN_SPEC.md` section 8 lists it as verified.

---

## 9. Reading order and package map

Read in this order. The first four are required before any work; the rest when relevant.

| # | File | What it gives you |
|---|---|---|
| 1 | `handoff/01_HANDOFF_MASTER.md` | This file. |
| 2 | `handoff/02_DECISION_LOG.md` | Everything decided, rejected, proposed and open, with reasons. |
| 3 | `handoff/06_PRODUCT_MAP.md` | How every part of the product functions, screen by screen and concept by concept. |
| 4 | `repo-seed/AGENTS.md` | The rules file you will live with. |
| 5 | `handoff/04_DESIGN_SPEC.md` | Complete design, token and motion specification. |
| 6 | `handoff/03_LEGACY_REPO.md` | The old repository: what to take, what to leave, the risks. |
| 7 | `handoff/05_PLAYBOOK.md` | The execution plan: Fable sessions, your takeover, research, checkpoints, with ready prompts in `prompts/`. |
| 8 | `handoff/07_ADDITIONS_AND_RISKS.md` | What the outgoing manager added unasked, the risk register, and the questions waiting for the owner. |

| Folder | Contents |
|---|---|
| `handoff/` | The eight documents above. |
| `prompts/` | Copy-and-paste prompts: four Fable sessions, your kickoff, the slice template, session end, bug batch, six research briefs, the review brief, the engine map task. |
| `repo-seed/` | Files to place in the new repository on day one: `AGENTS.md`, `CLAUDE.md`, Gemini CLI settings, two scoped rule files, starting `docs/`, and the no-raw-values check. |
| `design/` | Everything produced in the design phase: `tokens/`, `prototypes/` (nine interactive HTML files), `screenshots/`, `docs/` (audit report, design system, Equity spec, retrospective, model strategy), `tools/`, `canvas-source/`. |
| `reference/` | History and supporting material, with a README stating how far to trust each file. |
| `index.html` | A page that links everything and shows every screen. Open it first if you can render HTML. |

---

## 10. Your first session, concretely

1. Read files 1 to 4 above.
2. Open `design/prototypes/riverline-app.html` and click through every room. Open `design/prototypes/design-system.html` and switch themes.
3. Tell the owner, in under a page: what you understood the product to be; the three decisions in this package you most disagree with and why; the questions you need answered before starting; and whether the founding sessions (`05_PLAYBOOK.md`) have already been run by Fable or fall to you.
4. Wait for the owner's answers. Then follow `prompts/GEMINI_KICKOFF.md`.

Do not start by writing code.
