# Fable 5.2 session F4: First vertical slice, Equity by rows

**Paste everything below the line into a new Claude Fable 5.2 session opened in the new repository** (after F1 to F3).

---

You are finishing the founding of **Riverline**. Read `AGENTS.md`, `docs/STATE.md`, `docs/design/docs/EQUITY_BY_ROWS_SPEC.md` in full, `docs/handoff/06_PRODUCT_MAP.md` section 2.5, and open `docs/design/prototypes/equity-by-rows.html`.

## Why this slice
It is the simplest pillar and it exercises the whole chain: tokens, kit, engine API, worker, golden numbers, audits, three languages. It leaves the next owner of the repository a complete worked example to copy for every later room.

## Outcome
The owner can open Equity, set a board, add two to ten players by typing cards, a range or "any two", step through streets and runout cards with the mouse or the arrow keys, and trust every number, in any theme and any of the three languages.

## Build
1. The room in `src/ui/rooms/equity/` from kit components only. The layout is **locked**: one table, each player a row. Never a card-per-player layout.
2. The board: five positions, slots when empty, a card picker, random and clear.
3. Rows: who and input kind; hand (cards, a range thumbnail with combo count, or two face-down cards); equity bar with the previous-street tick; the number with its change; one "right now" fact; remove. Dense mode from three rows; compact from six. **Row order never changes on its own.**
4. Typed input, one field, parsed as you type with a one-line preview and named errors: exact cards, range notation (`QQ+, AKs`, `22-77`, `A5s-A2s`), `any`. Put the parser in `src/domain/shorthand/` as the single grammar module; the Hand recorder will extend it.
5. The street stepper; the runout grid (heat grid from the kit) with arrow keys, Escape, and struck cards; "what this card does to you" grouped by effect; "by the river you make".
6. Method badge once in the header: "Exact · all N runouts" or "Estimated ± x · N samples". "Equity is not EV."
7. Engine: all numbers through `src/engine-api`. Cancel on change. Exact when cheap; sampled with a visible estimating state otherwise. Nothing computed for a collapsed panel.
8. Save a matchup as a saved object with a fact-only title; reopen it. This needs the first slice of storage: design the event-log shape as a short note, get the owner's yes, then build only what saving a matchup needs, plus **one-file export** of everything stored.
9. Messages in English, Russian and Hebrew. Poker notation stays left-to-right.
10. Tests: behaviour tests for the parser and the room's state; golden tests for every figure in section 2 of the Equity spec; audits walking the room's states (flop, turn card chosen, three and four players, ten players, range row, error) in every theme and language at both sizes.

## Decide with the owner before building (section 10 of the Equity spec)
Range thumbnail inline or on expand; whether a sort control exists at all; how the river step is shown.

## Do not
- Do not build the "Can I call?" strip, links to Review or Training, or the intuition trainer. Note them in the idea bank if not already there.
- Do not build a general storage layer beyond what saving a matchup and exporting need.

## Before you write code
Disagreements, questions, a one-page plan in the shape of `docs/SLICE_TEMPLATE.md`. Wait for the owner's reply.

## Finish with
The five-line report with gate outputs, and a short file `docs/HOW_A_ROOM_IS_BUILT.md` that walks through this slice as the pattern for the next ones: where things live, how a room talks to the engine, how messages and tests are added, how the audits are extended.
