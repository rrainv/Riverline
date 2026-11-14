# Equity by rows: locked layout and expansion spec (2026-11-14)

Status: **the layout is locked by the owner.** Layout B is rejected and removed (see section 9). Everything in sections 3 to 8 beyond what the prototype already does is a proposal the owner can cut.
Working prototype: `prototypes/equity-by-rows.html` (also the Equity room inside `prototypes/riverline-app.html`).

## 1. What is locked

One results table. **Each player is a row.** The table grows downward as players are added, from 2 to 10. Nothing about a matchup lives in a separate tab, a separate page or a second layout mode. The side panels (runout grid, "what the turn does", "by the river you make") are live views of the same table and change with it.

Why this layout won (owner's words and the measured reasons):
- It was the mockup with the least dead space. A row uses the full panel width for one player's facts; a card-per-player layout (Layout B) left a ragged grid with empty cells at 3, 5 and 7 players.
- It scales without changing shape. Two players and nine players are the same screen; only the row count differs.
- It reads like the question. "Who is ahead, and why" is a ranking question, and a table with one bar per row answers it at a glance.
- Rows compare. Aligned bars and aligned numbers let the eye compare players; separate cards do not.

## 2. What the prototype does today (verified)

| Behaviour | State |
|---|---|
| Two default rows: Hero A♥K♥, Villain 1 Q♠Q♣, flop Q♥ 7♣ 2♥ | works |
| Add a player by typing two cards (`Th9h`, `th 9h`, `7d,7s`) and pressing Enter, or by a quick chip | works |
| Validation: wrong format, the same card twice, a card already in play; message says which card | works |
| Remove a player (rows 3 and 4) | works |
| Street stepper: Flop, or Turn with a chosen card | works |
| Runout grid: click a card, or focus the grid and use the arrow keys; Escape returns to the flop | works |
| Every number recomputed for the current set of players, exactly | works, checked against an independent evaluator |
| Dense rows from three players up | works |
| Limit of four rows | prototype limit only; the app goes to ten |

Numbers checked against `tools/eqexact.py` (independent Python enumeration):

| Case | Prototype | Independent |
|---|---|---|
| A♥K♥ vs Q♠Q♣, flop | 25.6 / 74.4 (990 runouts) | 25.6 / 74.4 |
| same, turn J♠ | 22.7 / 77.3 (44 rivers) | 22.7 / 77.3 |
| plus T♥9♥, flop | 20.5 / 76.4 / 3.1 (903 runouts) | 20.49 / 76.41 / 3.10 |
| same, turn 3♥ | 76.2 / 23.8 / 0.0 (42 rivers) | 76.19 / 23.81 / 0.00 |
| plus 7♦7♠, flop | 22.6 / 69.3 / 3.4 / 4.8 (820 runouts) | 22.56 / 69.27 / 3.41 / 4.76 |

**Important boundary.** The prototype counts in the page so that it can be real without a build. That is a stand-in. In the app, **all equity comes from the engine through the worker API; no poker maths lives in UI code.** The numbers above become golden tests for that engine call.

## 3. The row (anatomy and hierarchy)

Left to right, in reading order (mirrors for Hebrew; cards and numbers stay left to right):

1. **Who**: seat mark and name; under it the *input kind* in small text: Cards, Range, Any two.
2. **Hand**: two cards; a range shows a small 13×13 thumbnail and a combo count; unknown shows two face-down cards (state shown, not written).
3. **Equity**: one bar and one big number. The bar has a tick for "equity on the previous street", so a change is visible without reading. The delta sits next to the number, in the meaning colours as text.
4. **Right now**: one short fact: "ahead now · three of a kind", "wins 10 of 44 rivers", "drawing dead", "only splits possible".
5. **Remove** (rows 3+).

Hierarchy rules:
- The equity number is the only large number in a row. Win, tie and combos are one step away (expand, section 4), not columns that push the bar to a stub.
- **Row order never changes on its own.** Rows stay in seat order while you step through cards. Re-sorting while someone reads is the fastest way to lose them. A "sort by equity" control is allowed; automatic sorting is not.
- The method badge sits once, in the panel header ("Exact · all 990 runouts", or "Estimated ± 0.4 · 200,000 samples"), not on every row.

## 4. Density (2 to 10 rows)

| Rows | Row height | Cards | What changes |
|---|---|---|---|
| 2 | 70 px | standard | roomy; "right now" text may wrap to two lines |
| 3 to 5 | 54 px | small | dense mode (in the prototype) |
| 6 to 10 | 40 px | mini | name and input kind on one line; "right now" column shortens to the key phrase; the turn panel below collapses to its headline until asked |

At ten rows the table is 400 px plus header: it still fits above the fold at 1366×768 with the turn panel collapsed. The table never scrolls inside its panel at 1920×1080.

Expand a row (Enter or click the chevron): win %, tie %, combos (for ranges), hand categories by the river, and "cards that help" as a strip. One row open at a time; opening another closes the first, so the table height changes by one known amount.

## 5. Typed input (the fast path)

The add field is the only input. It accepts three kinds and says which it understood before you commit:

| You type | Understood as | Row label |
|---|---|---|
| `Th9h`, `th 9h` | two exact cards | Cards |
| `QQ+, AKs`, `22-77`, `A5s-A2s`, `top 15%` | a range | Range · N combos |
| `?`, `any`, `random` | any two cards | Any two |
| `Dan` (a saved person) | that person's saved range for this spot, if one exists | Range · Dan · saved |

Rules: parse as you type and show a one-line preview under the field ("Range: 34 combos, 4 removed by cards in play"); Enter commits; a parse error names the token that failed, never just "invalid". Cards in play are removed from ranges automatically and the count says so. The same shorthand parser serves the Hand recorder: one grammar, one module.

## 6. Keyboard

| Key | Does |
|---|---|
| `/` or `A` | focus the add field |
| Enter (in field) | add the player |
| ↑ ↓ | move between rows |
| Enter (on a row) | expand or collapse it |
| Delete (on a row 3+) | remove it, with undo in a toast |
| `G` | focus the runout grid |
| ← → ↑ ↓ (in grid) | step through cards; in-play cards are skipped |
| Escape (in grid) | back to the flop |
| `[` `]` | previous or next street |
| `S` | save the matchup |

Keyboard actions are instant (no animation delay before the result). Focus is always visible and survives re-renders.

## 7. Streets

Flop, turn and river are one stepper, not three screens. The board row shows five positions; empty ones are slots. Choosing a turn card fills the fourth slot and the grid becomes the river grid for that turn (proposal: a small breadcrumb "Flop › J♠ › river" replaces the two chips when a river is chosen). Each row's tick always marks the previous street's equity, so the bar shows this card's effect, not the whole history.

Preflop (no board) uses the same table; exact enumeration is too slow for many players, so the header badge switches to "Estimated ± x" with the sample count. That switch is the only visible difference.

## 8. Integration (one table, many doors)

- **From Review:** "Open in Equity" on any decision loads the players and board; the hero row is the reviewed player. Back returns to the same decision.
- **From the Hand recorder:** a recorded all-in opens here with unknown opponents as "Any two" rows.
- **To Training:** "Drill this" turns the current board and hero hand into an equity-intuition question (guess first, then see the row).
- **Save:** a matchup is a saved object with a fact-only title ("A♥K♥ vs Q♠Q♣ on Q♥ 7♣ 2♥").
- **"Can I call?" strip (proposal):** type a pot and a bet under the table; it shows required equity next to the hero row's equity, labelled "Exact · price only". It never says "call" or "fold".

## 9. Why Layout B was rejected (so nobody rebuilds it)

Layout B put each player on a card in a grid, with the board in the middle. The owner rejected it outright ("no layout B, I like equity by rows"). The reasons, for the record:
1. Dead space: a grid of cards leaves holes at odd player counts and wastes the corners.
2. No comparison: bars on separate cards do not line up.
3. It changes shape as players are added; the eye has to re-learn the screen.
4. It duplicated the table metaphor that Training and Hand already own. Equity is an analysis surface, not a table.

Do not offer it as an option, a toggle or a setting.

## 10. Open questions (owner)

1. Should a range row show its thumbnail inline, or only on expand? (Inline costs 40 px of row width.)
2. Sort control: needed at all? My view: not until someone asks; stable order is the feature.
3. River step: second grid in the same panel, or the same grid re-coloured for the river? I lean to the same grid, re-coloured, with the turn card struck.
4. Ten rows on a phone: rows become two-line cards. Acceptable, or is phone Equity limited to four players?
