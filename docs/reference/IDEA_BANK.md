# Riverline idea bank (2026-10-15)

Every feature idea in one place so nothing is lost, plus fresh ideas to explore. Milestones come from NORTH_STAR; "New" ideas are proposals, not decisions. Add freely; the Manager files each new idea here with a suggested milestone and keeps scope in check.

## Already planned (by milestone)
**M2:** Personal Strategy question flow, three-state matrix, preflop layers 2–3 (both hand groupings); Equity rework, runouts per player, range grid, equity intuition drills; Hand input with presets, "everyone else folds", phone-note paste, money-mode input; Review walkthrough + key moments + single-hand luck; Home continuity and a reason to open Home; Learn hub (B's path + quick trainers with A's order) and onboarding ("Where do you play?"); Table rules v1 + My poker; Game night rework + history + game night → hands → review link; Saved fact filters + tags; Explain quality; exact push/fold; shortcut rebinding; one-file export; Full Hand speed controls; review queue and range recall (late M2/M3); auto-next in drills; "why is this due?" on every revisit.
**M3:** solver library (postflop-solver offline, labelled); plan context in feedback; Orbit with stack carry, rebuys and session reports; adjustment engine (Table / Opponent / Style) + shared opponent model + card-aware bots + bot tables + "read the table"; natural-language narratives and fixed follow-up questions; inline equity and connected workspaces; GGPoker import; backup import + sync groundwork; full audio mixer; Chippy; progression and achievements (no streaks); delight motion; share a hand as text or image; phone capture page and Game night phone view; hover number derivations; similar saved spots; printable strategy sheet; leak report vs your plan; spot of the day; focus mode; guided first week; range vs range; competitive reference pass.
**Later:** official documents (gate for the first real release); sharing and friends; PWA; mobile; PLO; learned estimates; character coaches; Personal-Strategy-as-bot; real-person opponent models (with consent rules).

## New ideas to explore (proposals)
1. **What-if branches in Review:** at any decision, try the other action and see how the hand could have continued (equity, pot, stacks), clearly labelled hypothetical. Fits Review as the signature screen.
2. **Confidence calibration trainer:** before seeing feedback, say how sure you are; over time Riverline shows whether your confidence matches your accuracy. Honest, unusual, and good for learning.
3. **Post-game-night debrief:** the morning after, a short guided flow: settle-up summary, the 2–3 hands you reconstructed, one drill built from them. Ties Game night, Hand, Review and Training together.
4. **Range sculpting by brush:** paint your plan on the matrix with a brush that respects hand groupings (drag along suited connectors), with live combo and percentage counts.
5. **Opponent's-eye replay:** replay a hand from the villain's seat, showing what they could see and what your line represented. Teaches range thinking.
6. **Spot collections:** curated sets ("BB defence vs small opens", "3-bet pots in position") you can drill, review and track as one unit; later shareable.
7. **Session soundscape:** an optional quiet ambient layer for long sessions (soft room tone, distant chips), off by default, separate volume.
8. **Weekly study letter:** a calm in-app summary each week: what you worked on, what moved, one suggestion. No streaks, no pressure.
9. **Mistake-to-drill in one click:** anywhere a decision is shown (Review, Saved, Analyze), "drill 10 like this" builds a focused set instantly.
10. **Table presence for live play:** a study mode for live tells of your own game: timing and sizing patterns from your recorded hands ("you bet bigger with value on the river"), shown as observations with samples, never personality labels.
11. **Theme from your felt:** pick a photo of your home game's felt colour to tint the table theme (local only).
12. **Hand-reading drills:** given a line, narrow the opponent's range step by step on the matrix, then compare with the baseline's range for that line.

## How ideas move
Idea here → Manager suggests a milestone and size → owner decides → NORTH_STAR (direction) or ISSUE_REGISTER (small wants). Research-heavy ideas get a spike first (Claude or Gemini Argon).


## Added 2026-10-18 → 21 (from the away-session interviews)
| Idea | Source | Suggested milestone |
|---|---|---|
| Table brush: sweep several seats as folded / called in one gesture during hand entry | HAND-02 | M2+ (heavy) |
| Role shortcuts in Personal Strategy ("3-bet my usual bluff candidates here") once roles are learned | PS-03 | M3 |
| Exact percentages per hand or band on request | PS-02 | M2 |
| Typed commands in the action bar (r9, c, f, AhKd) | HAND-02 | M2 |
| Phone quick-capture syntax with labelled guesses, completed later on the PC | HAND-04 | M2/M3 |
| Local-network capture page (phone → PC on the same Wi-Fi) as an extra to share-sheet/QR transfer | LT-01 | M3 |
| Own clean-room solver: turn/river first (≈2–4 weeks), flop later; preflop/multiway research | LT-03, LT-06 | M3+ |
| Chippy variants against the "calm teacher" brief | P1-15b | M3 |
| Duolingo / chess.com-style phone study: lessons path, puzzles / spot of the day, quick trainers (no streaks) | MOB-01 | M2/M3 |
| Quick live-decision mode with strong warnings and four hard limits | MOB-01 | Later |
| Community feedback loop (what users want next), sharing content | LT-02 | Later |

## Ideas round 2 (owner: "all look good, implement sometime"; 2026-10-22)
Demos: https://claude.ai/artifact/Ugg4c4w25yrXiw3oZiDLTV (1–5) and https://claude.ai/artifact/1bLPyUScBU4LrA3HwpSQfY (5–22).
| # | Idea | Milestone |
|---|---|---|
| 1 | Confidence lens: one switch tags every number by source | M2 |
| 2 | What-if strip in Analyze (change one thing, before/after) | M2 |
| 3 | Blind mode (guess before sources/mixes are revealed) | M3 |
| 4 | Plan time-machine (plan versions over months) | M3 |
| 5 | "Explain like…" depth control (one line / paragraph / full maths); owner liked it | M2 |
| 6 | Mental maths trainer (pot odds, outs, required equity) | M2 (Learn trainers) |
| 7 | Board texture explorer (how ranges hit a flop, by families/roles) | M3 |
| 8 | Self-notes on decisions, searchable in Review | M2 |
| 9 | Night-after debrief on Home after game night | M2 |
| 10 | Pre-game warm-up drill (home game spots) | M2 |
| 11 | Friend profiles from logged hands (local, sample sizes, actions only; study before the game) | M3 |
| 12 | Session goals set before game night, checked next day | M3 |
| 13 | Bots explain themselves after the hand ("set to aggressive") | M3 |
| 14 | Replay at any speed + jump to the decision | M2 |
| 15 | "Play it again" from any review decision against bots | M3 |
| 16 | Felt lighting by street | M1 design pass (if cheap) |
| 17 | Focus mode (dim everything but the decision) | M2 |
| 18 | Session ambience sound (off by default; after real sound exists) | Later |
| 19 | Sticker book page with peel-in motion and metal tiers | M3 |
| 20 | Hand story cards (share image) | M3 |
| 21 | "Ask a friend" private spot link | Later (needs sharing) |
| 22 | Community wishlist / voting in Settings | Later (needs accounts) |
Owner note: some are "tricks and fun" more than features; keep them, adapt for phone vs PC when built.
| 23 | **Estimation training** (owner; demo https://claude.ai/artifact/4Y7Gw2TFXSJxgKkoKXpQMn with an exact 7-card evaluator: equity, pot size, outs; owner: "good direction; design may change, overall aesthetic really good"): estimate your equity in common matchups (flush draw vs pair, overcards vs pair…), estimate your chances, estimate the pot and a sensible bet size; then see the exact answer and how far off you were. Extends the planned equity-intuition drills. | M2 |
Owner (2026-10-22): "I love all of these ideas… I would love these features to make it into the app." All demos approved in principle.
| 24 | "Where Riverline is weak" page: public, honest list of what the baseline doesn't handle well (from R-05, inspired by PokerSnowie's weaknesses page) | M1 (About & legal / Learn) |
| 25 | Review "retry before reveal": try a key decision again before seeing the analysis (from Chess.com Game Review) | M2 |
| 26 | Limp-family multiway spots: generator, drills, Analyze labels, baseline measurement contexts (owner's game; owner: important, not a declared priority) | M1 generator where cheap / M2 |
| 27 | Uneven stacks per seat as a Table rules option (home games: 40 bb next to 250 bb) | M2 (Table rules) |
| 28 | Multi-street plan coherence notes ("small c-bets work when paired with later pressure") in explanations | M2/M3 |
| 29 | Bounded daily review pack + "nothing due" state, unlimited pause, gentle catch-up (R-04) | M2 (Study hub) |
| 30 | Three weekly focus cards, swappable (R-04) | M2 (Home/Study) |
| 31 | Local reminders tied to the user's own anchor, 3 ignored = silent (R-04) | Phone version |
| 32 | 2-minute minimum drill with a calm stop screen; Zen mode; descriptive rolling log (R-04) | M2 |
| 33 | Optional co-op game-night prompts with a shared dated sticker (R-04) | M3 |
| 34 | Anonymise shared hands automatically (Hero / positions instead of screen names or friends' names) | M3 (sharing) |
| 35 | Learn lesson "Why multiway is different" (exact compound fold maths) | M2 |
| 36 | Honest storage status (persisted vs temporary tab) with a calm install/back-up note | M1 (data safety) |
| 37 | Single-hand QR transfer phone ↔ PC (compressed link, phone camera) | M2 |


## Added 2026-11-13 (restart design rounds + Gemini second opinion)
Status key: BUILT-IN-MOCKUP = exists on the design canvas; ADOPT = accepted from the review; DECIDE = owner decision needed.

| # | Idea | Source | Milestone | Status |
|---|---|---|---|---|
| 38 | Typed hand shorthand (`f f r12 f c f / Qh 7c 2h`) with live validation, shared parser for the recorder and phone | owner | M2 | BUILT-IN-MOCKUP |
| 39 | Hand recorder: tap flow + typed flow on one hand format; "what were you thinking" one-tap reasons asked before any verdict | owner + Gemini | M2 | BUILT-IN-MOCKUP |
| 40 | First-session leak scan with a map that fills in live; replace "six isolated self-reports" with spot-based calibration (cutoff sliders on a family strip) | owner + Gemini | M2 | DECIDE |
| 41 | Family cutoff slider: drag one handle per hand family to set a plan in seconds (instead of single-hand questions) | Gemini | M2 | ADOPT (prototype) |
| 42 | Heads-up duel with a paced bot (thinking dots, visible action bubbles, Calm/Normal/Fast table pace), hover prices, editable bet-size ladder | owner | M2 | BUILT-IN-MOCKUP |
| 43 | Full hand vs five bots, abstract bot marks, "read the table" mode, Watch-rest speed | owner | M3 | BUILT-IN-MOCKUP (Gemini: postpone) |
| 44 | Session report: decisions vs luck with only the exact part measured, moments worth a look, "watching" tendencies | owner | M2 | BUILT-IN-MOCKUP |
| 45 | Counterfactual villain range selector in Review (tight / standard / loose shove range) so a call is judged against a range, never only the revealed hand | Gemini | M2 | ADOPT (numbers need engine check: sets-only vs AhKh on Qh7c2h is 25.6%, not 25.2%) |
| 46 | Weekly teacher letter with "what each line rests on" (source, tier, sample) | owner | M3 | BUILT-IN-MOCKUP (Gemini: fold into Home) |
| 47 | Shareable hand card (image or text; private by default; amounts, names, opponent cards off) | owner | M3 | BUILT-IN-MOCKUP |
| 48 | Game night on a phone: ledger, rebuy and cash-out sheets, balance gate on committed entries, fewest-transfers settlement | owner | M2 | BUILT-IN-MOCKUP |
| 49 | Morning-after receipt card: settlement plus tonight's showdown cards with exact all-in luck, as one image for the group chat | Gemini | M2 | ADOPT |
| 50 | Thumb keypad for phone shorthand (positions, actions, sizes, rank/suit) instead of the OS keyboard | Gemini | M2 | ADOPT (prototype) |
| 51 | Voice dictation into shorthand via a deterministic grammar (offline OS dictation, no LLM) | Gemini | M3 | exploration |
| 52 | Multiway fold-equity calculator ("each of three opponents must fold 69.3% for a half-pot bluff to break even") | Gemini | M2 | ADOPT (verify 0.693^3) |
| 53 | Commitment clock for 30-60 bb home games (flop SPR, automatic turn shove) | Gemini | M2 | ADOPT |
| 54 | Iso-raise and overlimp lab (facing 1 to 3 limpers) | Gemini | M2 | ADOPT |
| 55 | Spaced repetition with FSRS in place of fixed 24 h revisits | Gemini | M2 | DECIDE |
| 56 | Pre-session warm-up card: two rules for tonight and three 15-second spots | Gemini | M2 | exploration |
| 57 | Villain assumption toggle in Review and drills (baseline / passive home player / calling station), always labelled against the baseline | Gemini | M3 | exploration |
| 58 | Evidence gate rework: a credible-interval rule with a small minimum n, instead of a flat n of 15 | Gemini | M2 | DECIDE |
| 59 | Real-time-assistance warning: "close Riverline during live online play" | Gemini | M1 (About and legal) | ADOPT |
| 60 | Game night defaults to chips or points, never cash settlement or rake fields; legal read before any public RU/HE release | Gemini + owner | M2 | ADOPT |
| 61 | Mockup audit tool (DOM overlap, clipping, covered text, tab alignment, small targets) as a cheap permanent gate | this round | M1 | BUILT (riverline_tools/audit.js) |

| 62 | Learn hub: concept path, exact pot-odds trainer with an honest first-try record, EN/RU/HE glossary | owner | M2 | BUILT-IN-MOCKUP |
| 63 | Settings: live accent with calculated contrast, table pace, typing speed, teacher voice, language cards, rebindable shortcuts with clash check, type-to-confirm delete | owner | M1 | BUILT-IN-MOCKUP |
| 64 | Plan builder: click the last hand you would open on a family strip, per position; baseline hidden until you answer; plan matrix and opened-combos total | Gemini idea 4 + owner | M2 | BUILT-IN-MOCKUP |
| 65 | Appearance: six themes plus a custom theme editor (background, panel, text, accent), live accent, corner radius, heading font and weight, card back and card face, calculated contrast | owner (old-app customisability) | M1 | BUILT-IN-MOCKUP |
| 66 | Plan builder drag: drag, click or arrow keys along the strip; the cutoff handle shows its edge | owner | M2 | BUILT-IN-MOCKUP |
| 67 | Saved library: fact-only titles, kind/seat filters, search, sort, tags, archive (never delete), felt preview inspector | north star | M2 | BUILT-IN-MOCKUP |
| 68 | Token-only theming: 72 role tokens, fill and text variants split (accent / accent-text and so on), seven themes incl. true light themes Daylight and Paper | owner (Daylight must be a real theme) | M1 | BUILT-IN-MOCKUP + tokens.css |
| 69 | Theme audit as a permanent gate: pixel-measured contrast, dark leftovers, invisible borders, clipped text over every app state | this round | M1 | BUILT (riverline_tools/snap.js, states.js, analyze.py) |
| 70 | Equity by rows, expanded: typed players (cards / range / any two / saved person), dense rows to ten players, street stepper, arrow-key runout grid, row expand, stable row order | owner (layout locked; Layout B rejected) | M1 | PARTLY BUILT-IN-MOCKUP (cards, 4 rows, stepper, keys); rest in EQUITY_BY_ROWS_SPEC.md |
| 71 | Street ribbon: one strip (preflop, flop, turn, river with pot, SPR, equity) that moves every panel to a street; same control in Review, Equity, Replay, recorder | this round | M2 | PROPOSAL |
| 72 | The Friday loop as a guided path through the rooms (record → review → drill → next Friday's two rules) | this round | M2 | PROPOSAL |
| 73 | Commitment preview on the flop (pot and stacks if called and the same fraction is bet on the turn); overlaps idea 53 | this round | M2 | PROPOSAL (merge with 53) |
| 74 | "Can I call?" strip under the equity table: pot and bet in, required equity out, labelled Exact · price only, never a verdict | this round | M2 | PROPOSAL |
| 75 | Two clocks: interface motion at token speed always; table pace multiplies only thinking time and action beats | owner (slower table actions) | M1 | ADOPT (in DESIGN_SYSTEM.md) |
| 76 | Motion ideas: shared-element card travel into Review, equity tick trail when stepping cards, scrub the hand along the history rail | this round | M3 | PROPOSAL |
| 77 | Follow-the-system theme (Midnight by night, Daylight by day); print stylesheet on Paper tokens for Review and the session report | this round | M2 | PROPOSAL |
| 78 | Phone Game night in Daylight (theme prop) | this round | M2 | BUILT-IN-MOCKUP |
| 79 | "No raw values" build check: fail on a hex colour, rgb(), ms literal or cubic-bezier in component styles | this round | M1 | ADOPT |
