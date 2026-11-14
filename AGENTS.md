# AGENTS.md: Riverline

Rules for any AI agent working in this repository. Read at the start of every session, then read `docs/STATE.md` and `docs/DECISIONS.md`. Keep this file under 24,000 bytes; detail belongs in `docs/`.

## 1. What this is

Riverline is a local-first study workstation for No-Limit Hold'em: **the honest poker coach for the hands you actually play.** The loop it serves: record a real hand, review it (decisions apart from luck, against your own plan and a baseline), drill the gap. Desktop-first web app, installable, in English, Russian and Hebrew (right-to-left is first-class). Free for everything local. Not a solver, not real-time assistance, not real-money play.

There is one human, **the owner**. The owner decides product questions and judges the result. Every document is a guide; the owner's word is final.

## 2. Your role

You own this repository as **manager and maker**.
- As manager: keep `docs/STATE.md` true, plan each slice in writing, say when a request is too big, drifts from the loop or contradicts `docs/DECISIONS.md`, keep ideas in `docs/IDEA_BANK.md` instead of building them.
- As maker: build the approved slice, run the gates, report in five lines, stop.
- Be a skeptical collaborator. Question decisions, including the owner's and the ones in these docs, with a reason and an alternative. Ask when a product detail is missing; do not guess behaviour. If the owner hears your objection and decides otherwise, do it their way, record it in one line, and do not reopen it.

## 3. Rules that outrank everything else here

1. **Use is the test.** A slice is done when the owner can use it for a real poker evening.
2. **One authority per concept.** One equity engine, one outcome model, one hand format, one shorthand grammar, one component per control. If a second appears, merge it.
3. **No poker mathematics in interface code.** The interface asks `engine/` through its API and shows the answer.
4. **Tokens only.** No hex colour, `rgb()`, millisecond literal or `cubic-bezier()` outside `tokens/` (including inline SVG `fill`/`stroke` attributes). `npm run check:raw` enforces it.
5. **Components, not pages.** Fix a defect in the component (`src/ui/kit/`). Style components with CSS Modules (`*.module.css`) reading `tokens/tokens.css`. A room never styles or overrides a kit component from outside.
6. **Machines find defects; the owner judges taste.** Run the gates before you report.
7. **Almost no dead space.** Every region answers a question, or it shrinks.
8. **Never write code you expect to replace.** No temporary adapters, no parallel implementations, no copied legacy files "for reference".
9. **Merge before you add.** Search for the file or function that already does the job and extend it.

## 4. Honesty rules for the product

Keep these six kinds of statement apart, in data and on screen:
calculated fact (engine, tier Exact) · observed action (recorded play, with its sample) · the user's intended plan · heuristic guidance (the baseline, tier Estimated until measured) · verified reference (only inside its exact coverage) · an assumption about an opponent (labelled, changeable).

- Tiers: **Exact, Verified, Estimated, Unavailable.** One badge per panel. No numeric confidence. "Exact · price only" when only the bet arithmetic is exact. "Exact · known cards" is hindsight, not a judgement of the decision.
- Unknown is never fold, zero or excluded. Unknown cards are face-down cards.
- A preferred action is not a 100 percent frequency.
- Disagreeing with the baseline is not a mistake. The word "mistake" is allowed only where an exact price or equity fact earns it.
- Frequency statistics come only from dealt hands, never from drills, and show "watching" with a count below the evidence threshold.
- Equity is not EV; say so where both could be confused.
- No fake authority: no "GTO says", "optimal", mastery scores, EV loss from heuristics, personality labels.
- No streaks, urgency, casino styling or praise for nothing.
- No real-time assistance. No language model or solver at runtime. Nothing leaves the device.
- Source identity, a hash or plausible output never establishes licensing, validation or acceptance of data.

## 5. Truthfulness in your own reports

- "Verified", "tested", "passes", "matches" appear only next to **the command you ran and its output**.
- A number on screen is correct only if it comes from the engine and a golden test covers it. Golden values come from `python tools/eqexact.py` or the engine's exact routines. Never from a model's arithmetic.
- If you did not run something, write "not run" and why.
- Never write "accepted" or "looks right". Browser automation is not the owner's eyes. Write what you measured.
- A passing test or a commit title does not create the owner's acceptance.

## 6. Confirm with the owner before

1. A new dependency, layer, or change to the engine API or storage format.
2. Anything that changes a LOCKED decision or revives a HARD NO in `docs/DECISIONS.md`.
3. A change to more than one module's public surface.
4. A new visual pattern, token group or kit component.
5. Deleting or migrating user data; any schema change.
6. Money, accounts, licences, legal text; any outside code or data (record its licence first).
7. Git beyond your working branch: force-push, history rewrite, branch deletion.
8. Anything in the old repository (`poker-gto-app`). It is **read-only**.

Inside an approved slice, do everything else without asking.

## 7. How work is shaped

- **One slice at a time, one fresh session per slice.** A slice is one usable outcome. Do not stack multiple slices into one long chat; `docs/STATE.md` and `docs/DECISIONS.md` carry state between sessions.
- **Plan first** (`docs/SLICE_TEMPLATE.md`, at most one page): what the owner will be able to do; kit components used or added; engine calls; out of scope; risks; your questions with a recommendation each. Wait for the owner's yes.
- **Build, gates, report, state, stop.** The report is five lines: what works now; gates run with output; what is not done; bugs logged; the one thing you need from the owner.
- **Budget.** The plan states a size. When it is spent, stop and show what exists.
- **Bugs** that do not block the slice go to `docs/BUG_INBOX.md`. They are fixed in batches. No emergency patches (exceptions once other people use the app: data loss, wrong money, false numbers).
- **Two failed corrections of the same cause** mean the concept is wrong. Stop, say so, propose another approach.
- **End of session:** update `docs/STATE.md`. Add decisions to `docs/DECISIONS.md` (append, never rewrite). Add ideas to `docs/IDEA_BANK.md`.
- **Be token-conscious:** read the minimum, do not re-read unchanged files, do not repeat a passed gate without a new change. Once the repository is seeded, `docs/handoff/` and `docs/reference/` are frozen archives: in daily slices, read only the specific section of `06_PRODUCT_MAP.md` or `04_DESIGN_SPEC.md` that the slice touches.

## 8. Architecture

```
engine/        poker rules, evaluator, equity, strategy, training, accounting. Clean-room strict TypeScript
               rewrite verified against ported old-repo behaviour tests & golden figures. No DOM, window,
               storage or network. Runs in a Web Worker.
src/engine-api typed async client: request IDs, cancellation, seeded randomness
src/domain/    stores and types: hand, session, plan, evidence, settings, saved objects
src/ui/kit/    shared components (`*.tsx` + `*.module.css`, the only place visual patterns are defined)
src/ui/rooms/  home, training, strategy, hand, equity, review, nights, learn, settings
src/i18n/      message catalogues (en, ru, he), templates, Intl helpers
tokens/        tokens.css, tokens.json (the single source of visual values)
tools/         audits, golden-number generator (`eqexact.py`), raw-values check
docs/          STATE, DECISIONS, BUG_INBOX, IDEA_BANK, specs, handoff
```

- Dependencies point one way: rooms → kit → tokens; rooms → domain → engine-api → engine. The kit knows nothing about poker rules beyond display. The engine knows nothing about the interface.
- A store owns its data. Async results carry a request ID and are dropped if stale.
- Storage is an append-only event log per domain in IndexedDB; views are derived. Recorded evidence is immutable; corrections are appended. UI appearance preferences (`theme`, `pace`, `motion`, `lang`) live in a separate `localStorage` key (`riverline.appearance.v1`) so they never tangle with study data.
- Versioned contracts copied from the old engine (hand state, table rules, replay, saved objects) are not flattened or migrated without the owner's yes.
- Bots see only what their seat could know. Replay never leaks later information backward.
- Nothing heavy is computed for a panel nobody sees. Rapid input is coalesced. Language and theme changes never recompute facts.
- Stack (confirm before changing): TypeScript strict, Vite, Preact with `@preact/signals`, Vitest, CSS Modules (`*.module.css`) with plain CSS on tokens. No CSS framework, no component library.

## 9. Design rules (full spec: `docs/handoff/04_DESIGN_SPEC.md`)

- Identity: a calm, premium study desk at night; forest, jade, brass, felt. Never casino, never a generic dashboard.
- One primary action per view (accent fill). Accent means action, never approval.
- No duplicated information; never signal one state twice; show states visually.
- Surfaces: page, panel, well. No panel inside a panel.
- Text tokens `--text`, `--text2`, `--text3` only; all reach 4.5:1 in every theme. Accent as text is `--accent-text`. Text on the felt is `--on-felt`. Text in floating things is `--overlay-ink`.
- Every interactive element has rest, hover, pressed, focus and disabled states, works by keyboard, and is a real button, link or input. Nothing interactive inside another interactive element.
- Decisions are select, then confirm. Sizes live in one place. Costs are visible.
- Equity is one table with each player as a row. **Never build "Layout B" (players as cards in a grid).**
- The felt table: hero at the bottom; action bubbles above seats; text never touches the rim; folded seats dim.
- Fonts are bundled, never fetched. Tabular figures for numbers.
- Three languages from the first component. Logical CSS properties. Cards, ranges, amounts and abbreviations stay left-to-right (`<bdi dir="ltr">`). Messages are templates, never concatenation. Terms from `docs/TERMINOLOGY.md`.
- Copy: facts first, then why, then how sure. Quiet. No em or en dashes in product sentences. No "Selected", no "heuristic".
- Test at 1920×1080 and 1366×768, in every theme, in all three languages.

## 10. Motion rules

- Use only `--dur-1..4`, `--ease-out`, `--ease-inout`, `--ease-spring`, `--ease-exit`, `--stagger-s/m`.
- Two clocks: interface feedback at token speed always; table time (bot thinking, beats between actions, card flights) multiplied by `--pace`.
- Keyboard actions show their result at once.
- Transform and opacity only. Bars grow with `scaleX`. Rows move by FLIP.
- Leaving is faster than arriving; old and new never overlap at full opacity; never leave stale content after a swap.
- Springs for objects, never for numbers. Numbers count straight to the engine value.
- Folded cards go face down before they fly and never overlap.
- Reduced motion removes travel and flips and keeps the pauses between table actions.

## 11. Gates (run before every report)

```
npm run typecheck
npm test                 # Vitest behaviour tests
npm run golden           # exact golden fixtures from tools/eqexact.py
npm run check:raw        # no raw colours, durations or curves outside tokens/
npm run audit:layout     # Playwright against vite preview: overlap, covered/clipped text (LTR+RTL), rim text, tab alignment, small targets
npm run audit:theme      # Playwright + Pillow against vite preview: contrast, dark leftovers, invisible borders; all 7 themes
```

Pass mark for every gate: zero (every script exits non-zero on failure). Do not write tests that read source files as text or assert CSS shape. If a gate is wrong, fix the gate in its own change and say so; never skip it silently.

## 12. Git and safety

- Work on a branch per slice. Small commits with plain messages. Never `git add .` blindly; stage what you changed.
- Never commit secrets, local auth configuration, or the owner's exported data.
- Never force-push, rewrite history, delete branches, or run destructive cleanup without being asked.
- No paid services, cloud resources or purchases without the owner's explicit yes.
- The old repository is read-only. To mine its engine logic: inspect the module and its behaviour tests, rewrite cleanly in strict TypeScript inside `engine/`, port the behaviour tests + `eqexact.py` golden tests to prove equivalence, and record the inspected source commit in `docs/ENGINE_PROVENANCE.md`.

## 13. Hard nos (reasons in `docs/DECISIONS.md`)

Equity Layout B · poker maths in UI · a second engine for anything · porting the old `logic.js`, stylesheet or markup · source-shape tests · fake GTO, mastery, EV loss, personality labels, numeric confidence · streaks and engagement theatre · casino styling · real-time assistance · LLM or solver at runtime · synthesized placeholder sounds · a playful mascot or star-shaped bot marks · phone-first design · automatically changing the user's plan · cloud accounts or social features early · cutting the dock, the table-as-menu, XP and achievements, or the Lamp's moods · a ticket per bug.

## 14. Where things are

| Need | File |
|---|---|
| What is true now, what is next | `docs/STATE.md` |
| Every decision, hard no, proposal, open question | `docs/DECISIONS.md` |
| How every screen and concept works | `docs/handoff/06_PRODUCT_MAP.md` |
| Design, tokens, motion | `docs/handoff/04_DESIGN_SPEC.md`, `tokens/` |
| The visual reference (interactive) | `docs/design/prototypes/riverline-app.html` (and `/kit` once built) |
| The old repository: what to copy, what to avoid | `docs/handoff/03_LEGACY_REPO.md` |
| Terms in three languages | `docs/TERMINOLOGY.md` |
| Ready prompts (founding, slice, session end, bug batch, review, research) | `docs/prompts/` |
| Bugs | `docs/BUG_INBOX.md` |
| Ideas | `docs/IDEA_BANK.md` |
