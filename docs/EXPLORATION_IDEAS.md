# Exploration ideas (2026-11-17)

Creative R&D after all eight rooms went live. Nothing here touches `src/`, `engine/` or `docs/DECISIONS.md`. Every idea is a proposal; the owner decides. Three of them have clickable prototypes (links at the bottom).

**How to read the labels.** The prototypes use one badge per panel, coloured by meaning: green is **Exact**, teal is **Estimated**, brass is **Your plan / Your assumption**, dashed grey is **Unavailable**. Hindsight is always named: "Exact · known cards" says nothing about whether a decision was good.

## At a glance

Idea numbers: `docs/IDEA_BANK.md` has a first list (1 to 12) and a round 2 (1 to 37) that reuse numbers; ambiguous references are marked. Bare numbers from #38 up are unique.

| # | Idea | Rooms | Size | Prototype | Merges / refines |
|---|---|---|---|---|---|
| A | **Inline Equity Overlay**, reimagined | Review, Hand, Training | Medium | yes | #82, #74 |
| B | **Range Walk** (read the line street by street) | Review, Learn | Medium | yes | first-list #12, #5; round-2 #7 |
| C | **Commitment River** (stack, SPR, price per street) | Strategy, Review, Training | Small | yes | #52, #53, #54, #73 |
| D | **What-If Branches** in Review | Review | Medium | no | first-list #1; round-2 #2 |
| E | **Morning-after Receipt** | Nights, Home | Small to Medium | no | #49; round-2 #9, #20 |
| F | **Friday Warm-up** (three cards, no clock) | Home, Training | Small to Medium | no | round-2 #10; #56 |
| G | **Texture Sort** (guess first, then count) | Learn, Training | Medium | no | round-2 #7, #23; #80 |
| H | **Same-Spot Echo** | Review | Medium | no | M3 "similar saved spots" |

## A. Inline Equity Overlay, reimagined (#82)

**Hook.** You are mid-review, wondering "how bad was that flop call?", and the answer is one keypress away without leaving the hand, the decision or your notes. Today that means a trip to Equity and a rebuild of the state.

**In 30 seconds.** Press `E` (or the Equity button on any decision). A docked overlay opens; the room makes space instead of being covered (decisions collapse to a strip, the felt narrows), so no control is ever hidden. Inside: one table with You and Villain as rows, equity bars, a "Villain is" chip row (revealed hand, your range, any two cards), the Exact price beside your equity, and an **"if the next card is" map**: all 47 next cards, each shaded by how your equity moves; click one to step the board, "Back a card" to undo. **Pin to decision** drops the number into the decision's notes with its tier badge. It lives in the same component in three rooms:
- **Review**: hero and board come from the decision; villain defaults to the revealed hand.
- **Hand**: villain defaults to "Any two cards" because unknown is never a fold.
- **Training**: before you confirm an answer the overlay shows **only the Exact price** and says equity is locked; it unlocks after you answer. Otherwise the overlay would hand you the drill.

**Honesty and math check.**
- Exact: every equity figure (all runouts enumerated), the price (`call / (pot + bet + call)`).
- "Exact · known cards" on a revealed hand, captioned "Hindsight. Not a judgement of the decision."
- "Exact · vs your range": the range is the user's assumption, so the badge says so.
- "Equity is not EV" sits next to the price, as AGENTS §4 requires.
- **Unavailable** preflop: equity against a range before the flop needs the full five-card runout. The prototype shows that state instead of guessing.

**Size and dependencies.** Medium.
- New kit component (`EquityOverlay`) composed from `EquityRow`, `TierBadge`, `Chip`, `CardPicker`: needs owner confirmation (AGENTS §6.4).
- The next-card map is 47 engine calls per refresh (about 2 million hand evaluations for a 1,081-combo range); run in the worker, coalesce, fill progressively.
- Preflop needs either a streamed Monte Carlo (which would be Estimated) or a precomputed class-versus-class table (Exact, generated offline).

**Critique.** The risk is equity becoming a verdict in Review. Mitigations are built in (tier badge, hindsight caption, price beside equity, no colour on the number itself). A second risk: pinned numbers going stale if the user edits the hand; pins should store the state they were computed from.

## B. Range Walk: read the line, one street at a time

**Hook.** "Where did his hand leave my range?" Everyone has had the river bet that "made no sense". This makes you look at your own read, street by street, using the 13×13 matrix you already know.

**In 30 seconds.** Open a recorded hand in Review and choose **Walk the line**. Step 1: pick a starting assumption for his preflop call (any two, tight, medium, wide; these are your presets, never a claim about what is right). At each later street you see the combos entering it split by what they have (two pair or better, top pair or overpair, lower pair, flush or straight draw, nothing), and you keep or drop each kind, or click a matrix cell to drop one hand type. The matrix cells fill with category colours, the funnel across the top narrows, and your **exact equity against your own range** counts straight to the new value. At the river, the price sits beside it. Then **Show what he had**: it tells you which street his hand left your range, and what it was on each street.

In the prototype the hand ends with 5♥4♥ on Q♦ 8♥ 3♣ 6♥ 2♦: "Nothing" on the flop, a combined draw on the turn, a straight on the river. A natural "drop the nothing" on the flop removes the hand he actually had. The tool does not call that a mistake; it says "his hand left your range on the flop" and that the numbers after that were counted without it.

**Honesty and math check.**
- Exact: combos remaining, category counts, equity against the kept combos, the river price.
- Your assumption (brass): every keep or drop, the starting template.
- Unavailable: "Riverline's own range for this line", shown as a dashed row, because postflop baselines are not built (#81 is deferred). It is deliberately visible so the gap is honest.
- It is a study tool for after the hand. It is **not** a live table aid (see "Live-table hand-reading" below).

**Size and dependencies.** Medium.
- Needs a new engine function that classifies a combo against a board (category plus draw flags). That is an engine API change, so owner confirmation (AGENTS §6.1).
- Reuses `calculateEquityExact`, `conditionHoldemRange`, and `buildRangeMatrixMask`.
- Preflop equity stays Unavailable until the class table in A exists.

**Critique.** The coarse categories are the weak point, and the prototype shows why: backdoors and weak draws fall into "Nothing". A later version should let the user keep "backdoor draws" separately. There is also a framing risk: it must never feel like solving. The reveal copy states facts about the assumption, not about the player.

## C. Commitment River: where does your stack go?

**Hook.** At 30 to 60 bb a flop bet often decides the whole stack, and nothing in the app shows that. This is the tool for Friday-night maths that is usually done badly in your head.

**In 30 seconds.** Pick a preflop spot (raised pot heads-up, iso-raise over 1 to 3 limpers, limped pot), a stack from 30 to 60 bb, a raise size. Then choose a bet size per street (1/3, 1/2, 2/3, pot, 1.5×, all-in) and watch the teal stack flow into the brass pot across Flop, Turn, River and the final pot "if called every time". Each street shows pot, stacks behind and SPR. Drag **your commitment line** (SPR at or below N) and the street where you reach it is marked. Below, each bet shows what it needs from them: the fold rate at which a bluff breaks even, and, multiway, the rate **each** opponent must fold. A slider for "each opponent folds X%" (yours) shows all-fold probability `X^n` next to the requirement.

**Honesty and math check.**
- Exact (price only): pot, stack behind, SPR, the break-even fold rate `bet / (bet + pot)`, per-opponent `need^(1/n)`.
- Your plan (brass): the commitment line. "Committed" is not an exact term, so Riverline does not define it.
- Your assumption (brass): the fold rate. Riverline does not know your opponents.
- Labelled simplifications: "if called every time", equal effective stacks, independent folding multiway.

**Size and dependencies.** **Small.** Pure arithmetic; no engine API change if the figures come from the existing economics functions (`actionSizeFacts`, `actorCallEconomics`). The "stack tower" is a new visual pattern, so owner confirmation (AGENTS §6.4). It overlaps #52, #53, #54, #73, which can then be closed.

**Critique.** "If called every time" is the honest minimum but can read as optimistic; showing a "he folds here" branch would help (see D). Unequal stacks (idea #27) need a second stack input.

## D. What-If Branches in Review

**Hook.** "What if I had raised?" asked and answered without the app pretending to know how he would have played.

**In 30 seconds.** At any hero decision in Review, a small branch rail offers Fold, Call, and Raise to a size. Each branch shows the new pot, stacks, SPR and price facing him. For a raise, two sub-branches are always shown together: **if he folds** (you win the pot, an exact number) and **if he calls** (exact equity against his revealed hand, hindsight, plus the price he faced). Never a prediction of which one happens. The branch can be pinned or turned into a Training spot.

**Honesty and math check.** Exact: every pot, price, and equity vs revealed cards (hindsight). User-defined: the raise size. Unavailable: any claim about what he would have done. Both responses are always shown to avoid outcome bias.

**Size and dependencies.** Medium. Reuses the overlay (A) and the river arithmetic (C). Needs a hand-state "branch" that never writes to the recorded evidence (corrections are appended; hypotheticals must stay out of the log). That is a domain-layer decision for the owner.

**Critique.** The danger is results-oriented thinking: showing only the branch that "would have won". The always-both-responses rule is the guard.

## E. Morning-after Receipt

**Hook.** The thing you actually send to the group chat on Saturday: who settles with whom, and the hands everyone remembers.

**In 30 seconds.** On Home's "Last game night" card, **Make receipt** opens a preview of one image: fewest-transfer settlement in chips or points, and up to three showdown hands with the **exact equity at the all-in moment**. Toggles: names on or off, amounts on or off, cards on or off. Export as an image or copy as text. It pairs with the shareable hand card (#47), so the same card style works for a single hand.

**Honesty and math check.**
- Exact: settlement arithmetic; all-in equity only where all cards were known, labelled "Exact · known cards".
- Default is chips or points, never cash (#60).
- It reports what happened and how the cards ran. No ranking of players, no "biggest loser", no scores.

**Size and dependencies.** Small to Medium. Local canvas export; trilingual and right-to-left layout is the cost. The receipt leaves the device only by the user's own share action; there are no accounts and nothing is sent by Riverline, which keeps it clear of the "social features early" hard no, but the owner should confirm that reading.

**Critique.** Shaming is the risk (a visible loser), so the design shows balances neutrally. A legal read is needed before any public RU/HE release when amounts are shown (#60).

## F. Friday Warm-up (three cards, no clock)

**Hook.** Ten minutes before you leave: "what am I playing for tonight?" Not a lesson, a loosening-up.

**In 30 seconds.** Three cards you swipe or press through. 1) **Your two rules** from your own plan, verbatim (Your plan). 2) **Three spots from your own last night**, each a single price question with the Exact answer afterwards. 3) **Tonight's stack depth**, opening Commitment River (C) at the starting stack you set for the game. Then a calm "That's it." No countdown, no streak, no points.

**Honesty and math check.** Your plan (verbatim), observed hands (with sample), Exact prices. Nothing generated about opponents. If you have no recorded hands yet, card 2 is replaced by a fixed pair of price spots labelled as drills, never as your hands.

**Size and dependencies.** Small to Medium. Uses Strategy (plan), Review/Saved (hands), Training (spots), and C. Needs a "tonight" setting for the stack depth.

**Critique.** Easy to turn into a habit loop; the "no clock, no streak, no reminder" rule must hold. If the owner rarely records hands, card 2 is mostly the fallback, which weakens it.

## G. Texture Sort: guess first, then count

**Hook.** Intuition for how boards hit ranges is the thing home players lack. This trains it the way Estimation training (#23) trains equity: you commit to a guess, then the app counts.

**In 30 seconds.** The drill states a range ("big blind calls a 2.5 bb open: this list"). Four flops appear. You drag them into order from "hits his range least" to "most", by one stated measure (for example, share of his combos with a pair or better). Reveal: the exact counts, and how far off each of your placements was.

**Honesty and math check.** Exact: the count of combos in each category. The range is **stated by the drill**, not claimed to be right. Never "so you should c-bet here". The measure is named every time.

**Size and dependencies.** Medium. Shares the board-classification function with B, which makes B and G a natural pair.

**Critique.** The classic trap is implying texture determines strategy. The copy must stay at "how many combos", and the trainer must say that a count is not a recommendation.

## H. Same-Spot Echo

**Hook.** "I keep doing this" is the sentence players say and rarely check. After you review a hand, Riverline shows the other hands you recorded in the same structure.

**In 30 seconds.** Under the decision, an **Echo** strip: "3 hands in this structure: BTN open, BB call, flop ace-high dry. You bet small twice, checked once." Each is a link back to that hand. Below the evidence threshold it says "Watching · n = 3".

**Honesty and math check.** Observed actions with their sample. No labels ("passive", "aggressive"), no percentages below the threshold, no inference about why.

**Size and dependencies.** Medium. The similarity key (what counts as "the same spot") is a product decision for the owner. With roughly one night of hands recorded a week, "watching" will dominate for months.

**Critique.** Honest but possibly empty at first. Coarser buckets help; a good empty state ("Record a few more Friday hands and this fills in") is part of the idea.

## Considered and dropped

- **Live-table hand-reading.** Narrowing a villain's range during live play is real-time assistance, a hard no. B delivers the skill after the hand. A phone-first version would also hit the phone-first hard no.
- **Multiway limp lab as its own room.** Folded into C, where the iso-raise and limped-pot scenarios are one input.
- **Opponent confidence scores.** Any numeric "how sure" breaks the six-kinds rule.

## Assumptions worth challenging

1. **"Equity is for the Equity room."** Equity is most useful where the question arises. The overlay (A) keeps the Equity room as the full tool and makes it a summonable detail elsewhere.
2. **"Review is a read-only replay."** D and B make it a place to ask questions, with every hypothetical labelled.
3. **"Baseline comparisons are the teacher's job."** B shows the tool can be useful with the baseline row **Unavailable**, which makes the postflop baseline (#81) less of a blocker.
4. **"Estimation drills only for equity."** G and C extend the same guess-then-count loop to textures and stack commitment.

## Cross-cutting dependencies

| Need | Used by | Notes |
|---|---|---|
| Engine: classify a combo against a board (category + draw flags) | B, G, A (optional) | API change, owner confirmation |
| Engine: preflop class-versus-class exact table (generated offline) | A (preflop), B | Exact, not a solver |
| Kit: `EquityOverlay` | A, D | New component, confirm |
| Kit: stack tower and `Slider` | C, F | New visual pattern, confirm |
| Domain: hypothetical branch that never enters the evidence log | D | Owner decision |

## Hard-no check

No fake GTO, mastery, EV loss or numeric confidence anywhere. No streaks, urgency, casino styling or reminders. No runtime solver or LLM. No real-time assistance (B is post-hand, stated in the interface). Nothing leaves the device without a user share action. Equity Layout B is not used; every equity view is one table with players as rows.

## Prototypes

Open in a browser, no server needed; each links `tokens/tokens.css` (keep the `tokens/` folder where it is).

- [`explore_inline_equity_overlay.html`](design/prototypes/explore_inline_equity_overlay.html): A. Review, Hand and Training tabs; press `E`.
- [`explore_range_walk.html`](design/prototypes/explore_range_walk.html): B. Pick a starting range, narrow it on each street, reveal.
- [`explore_commitment_river.html`](design/prototypes/explore_commitment_river.html): C. Move the sliders, pick bet sizes.

**What was verified.** The prototypes carry their own small hold'em evaluator **for demonstration only**; it is not engine code and nothing in `src/` or `engine/` was read for it. Its output was compared with an independent brute-force Python implementation (best five of seven cards, a different algorithm) on four spots, including two range-based ones, with identical win, tie and lose counts: Ah9h vs KdJd on Jh8h3c (463 / 0 / 527 of 990), AhQs vs 5h4h on the river, 7s7d vs a king-or-pair range on Ks7h2c (143,922 / 3 / 8,535 of 152,460), and AhQs vs a 100-combo range on the turn (3,707 / 0 / 693 of 4,400). Commitment River's numbers were checked by hand (for example 6 into 9 needs 40.0%, and √0.4 = 63.2% each for two opponents). The pages were exercised in Chrome across four themes at 1920×1080 and 1366×768 with no console errors, no horizontal overflow and no clipped controls. **Not run:** the repository gates (`typecheck`, `npm test`, `golden`, `check:raw`, `audit:layout`, `audit:theme`), because no repository code changed, and no RTL or Russian and Hebrew pass.

## Recommendation

Make **A, the Inline Equity Overlay**, the next feature slice. It is the owner's own deferred `#82`, one new component serves three rooms (the "components, not pages" rule at its best), it needs no engine API change for the flop-and-later cases, and every Review session benefits. Commitment River (C) is the cheapest fast follow and the best answer to the 30 to 60 bb brief; Range Walk (B) is the most distinctive, and should follow once the engine can classify a combo against a board.
