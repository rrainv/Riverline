# Product map: how every part of Riverline functions

Part 1 explains the concepts every screen depends on. Part 2 walks through the application room by room, as designed in the prototype (`design/prototypes/riverline-app.html`), with the screenshot name for each state (`design/screenshots/<theme>/<name>.jpg`). Part 3 lists what is not designed.

**Status words for screens.** DESIGNED: in the prototype and seen by the owner. PARTLY: some states exist. PLACEHOLDER: a rail entry with no screen. NOT DESIGNED: nothing drawn in the restart.

All figures in the prototype are sample data, except those listed as verified in `04_DESIGN_SPEC.md` section 8.

---

## Part 1. Concepts

### 1.1 Six kinds of statement (never blend them)

| Kind | Example | Rule |
|---|---|---|
| **Calculated fact** | "Calling 9 into 27 needs 25.0 percent." "A♥K♥ has 25.6 percent against Q♠Q♣ on Q♥7♣2♥." | Comes from the engine. Tier Exact. |
| **Observed action** | "You folded 14 of 18 big-blind hands." | Counted from recorded play only. Always with its sample. |
| **Intended plan** (Personal Strategy) | "From under the gun I open K8 suited and better." | What the user said they would do. A preferred action is not "100 percent of the time". |
| **Heuristic guidance** (the baseline) | "The baseline opens KT suited and better here." | Tier Estimated until measured. Disagreeing with it is not a mistake. |
| **Verified reference** | A published range the project is licensed to use, within its exact coverage. | Tier Verified, only inside that coverage. None exists yet. |
| **Assumption about an opponent** | "Against a tight shoving range..." | Always labelled as an assumption; the user can change it. |

A seventh thing, a **normative judgement** ("that call was a mistake"), is allowed only when a calculated fact alone supports it.

### 1.2 Tiers

Exact, Verified, Estimated, Unavailable. One badge per panel, in a fixed place. No numeric confidence. "Exact · price only" when only the arithmetic of the bet is exact. "Exact · known cards" when equity is exact for revealed hands, which is hindsight and says nothing about the opponent's range.

### 1.3 Unknown

Unknown cards are two face-down cards. An unanswered plan cell is dashed and empty. Unknown is never counted as a fold, never as zero, never dropped from a denominator without saying so.

### 1.4 The evidence gate

A pattern is only "noticed" from **dealt** hands (real or against bots), never from drill answers, and only above a sample threshold (15 today; the rule is an open question). Below it the item is shown as "watching" with its count.

### 1.5 The hand

One canonical object for every hand, whatever its origin: seats, stacks, table rules snapshot, a legal sequence of actions by street, board, known hole cards (others unknown), results and money, optional notes ("what was I thinking") per decision, and flags for approximate values. It can always be replayed. Review explains decisions; Replay shows chronology. A **spot** is a single decision point and is lossy (no full history).

### 1.6 Table rules and "players behind"

**Table rules** are the blinds, ante, rake, stack depth and table size. Every hand and every drill carries a snapshot. **Players left to act behind you** is shown wherever a spot is described ("You're on the button, 2 players behind"), because the owner's game varies between six and eight players and position names alone mislead.

### 1.7 Personal Strategy

The user's plan, kept as sparse answers per spot and hand family, with corrections appended (never overwritten). Three states per cell: yours, baseline, unknown. The **spot map** is its home; the **plan builder** is its editor; the **leak map** compares it with the baseline; later, "plan versus play" compares it with recorded hands. Conflicts between answers are asked about, never resolved automatically.

### 1.8 The baseline

The engine's heuristic strategy. Estimated everywhere until measured against a reference. It has no single target game; it must handle 30 to 60 big blinds honestly. Sizes matter: a different bet size is a different choice and is compared against the baseline for that size, or the screen says the size is not modelled.

### 1.9 The teacher and the Lamp

The teacher is the voice that turns evidence into one next step. Blunt about the play, never about the person. Its claim strength follows the tier: Exact ("you needed 45 percent and had 26; that call was the mistake"), Estimated with a large gap and sample ("this is almost certainly costing you"), small samples ("watch this"). It asks before it judges ("what were you thinking?"). **The Lamp** is its face: an abstract desk lamp with eyes, eight moods (including stern), a breathing loop, and rings while it speaks. Two voice settings exist: blunt coach and gentle coach; both state the same facts.

### 1.10 Bots

Named abstract characters (Astra, Lyra, Orion, Vega, Nebula), each with a default playstyle that is shown and changeable (tight-passive, tight-aggressive, loose-aggressive, calling station, balanced). "Read the table" mode hides the labels and shows only what you observed ("raises 3 of 11 hands"), revealing styles in the session report. Bots must be believable and card-aware before the heads-up mode is worth using; today's engine bots are a known weakness.

### 1.11 Progress

Skill progress (gaps closed, built from evidence) and effort (XP, stickers, levels) are shown separately. Achievements are tied to real study. No streaks. The system behind the level chip is not designed.

---

## Part 2. The application

### 2.0 Shell (DESIGNED)

- **Top bar:** logo; a breadcrumb chip; search and jump (Ctrl K) opening a command palette over a scrim (`search_palette`); Settings; Focus; a sample-data chip; the level chip.
- **Dock:** floating, bottom centre, eight rooms: Home, Training, Strategy, Hand, Equity, Review, Nights, Learn. The current room is marked once.
- **Rail:** left, lists the current room's sections ("In this room"); collapses to icons (`collapsed_rail`). Several rail entries are placeholders in the prototype.
- **Focus mode** (`focus_mode`): hides dock and rail for drilling; a small "Show dock" control brings them back.
- Rules: one primary action per view; the dock never covers content; Escape closes the top-most layer.

### 2.1 Home (DESIGNED: `home_coach`, `home_seats`)

*Promise:* open the app and know what to do for the next twenty minutes.

- **Coach layout (chosen):** the Lamp with a greeting and tonight's time estimate; three next steps, each with a reason from the user's data, a duration and one button ("Fix your big blind: you fold 14 of 18 hands your own plan says to defend · 10 min"); a leak-map snapshot; the last game night ("Friday at Dan's · 6 players · settled · 2 hands worth reviewing"); the weekly letter link; XP to the next level; a "Try this" offer with its reason.
- **Seats layout (alternative):** a table whose seats are the rooms, with one line of status each.
- *Rules:* the first step is the only filled button. Offers need a reason from data or they do not appear.
- *Needs:* a "next steps" service over evidence, sessions and saved hands. Not an engine call; a domain service.

### 2.2 Training

**Hub** (DESIGNED: `training_hub`). A table as a menu: pick a seat to pick a mode (Quick drill, Heads-up duel, Full hand, Fix a specific leak). A recommended lab with its reason; this week's activity; leaks with sizes ("Offsuit queens, UTG: 41 points too wide"); recent sessions.

**Quick drill** (DESIGNED: `drill_question`, `drill_answered`).
- Before answering: the spot as a sentence ("You're on the button, 2 players behind. The cutoff raises to 2.5 bb. Folds to you."), a small table, your cards, three option tickets with keys F, C, R, a size on the raise ticket, and a disabled primary button ("Choose an action") that becomes "Confirm".
- Side panels: price ("To call 2.5 bb · Equity needed 38.5% · Exact · price only"); this session; your plan, **hidden until you answer** so it cannot steer you; why this spot was chosen.
- After answering: a verdict line in neutral words ("close · you chose Raise to 8 bb, inside the baseline's mix"); the mix bar wipes left to right with the "you" pointer at your size; one sentence of why; your plan revealed; Next (Enter).
- *Rules:* select then confirm; nothing "counts against you" for answers inside the mix; the baseline badge says Estimated.

**Heads-up duel** (DESIGNED: `duel_preflop`, `duel_thinking`, `duel_flop_ladder`, `duel_result`). Ten hands against one bot.
- The table with both seats, pot, stacks, the bot's style under its name (or "Style hidden").
- Your turn: option tickets; for bets, a **size ladder** (for example 33, 50, 75, 100 percent, all-in) that can be edited and reset; hovering a size shows its price to the opponent; a persistent line states the selected size's price ("Bet 3.8 bb (75%): Astra needs 30% to call"); one confirm button with the amount.
- The bot's turn: "Astra is thinking", visible dots, then an action bubble above her seat; the action ring travels between seats; timing follows the table pace.
- Side: session result (hidden while playing, by choice), table pace, this hand's history rail, "Show equity" (hidden while you decide; when shown, labelled exactly: "Against any two cards, not her range"), "Read the table".
- Feedback comes at the end, in the session report.

**Full hand** (DESIGNED: `full_hand_bot_thinking`, `full_hand_hero_turn`, `full_hand_watch`). You and five bots, six-handed.
- Seats around the felt, hero at the bottom, action bubbles, thinking state, the spot line ("You are in the cutoff. Orion raised to 3 · 3 players behind"), option tickets with a size, confirm.
- Lineup panel with each bot's style and a statistic, or hidden in "Read the table" mode with sample size.
- After you fold: "The hand goes on without you. Watch the rest" with a speed control.
- *Build order:* last. The owner wants it; the mockup exists; it depends on good bots.

**Session report** (DESIGNED: `session_report`). Headline raw result ("+21.5 bb") with the honest caveat that ten hands say almost nothing. **Decisions versus luck:** only the exactly measurable part is measured (all-in luck with both hands known: +7.0 bb, Exact), the rest is named "not measured". Three moments worth a look, each with its tier. Tendencies under "watching" with counts. A per-hand strip.

**Labs** (PLACEHOLDER). Short targeted drills generated from a leak ("big-blind defence, 10 minutes"). Referenced from Home and the hub.

### 2.3 Strategy

**Spot map** (DESIGNED: `plan_spot_map`). Personal Strategy's home. Rows are situations (first in; facing an early open; facing a late open; facing a 3-bet), columns are positions. Each cell shows its state: set (with a summary such as "3b 7 · c 12"), in progress, not asked, conflict, or cannot happen. A "Continue where it matters" card proposes the next spot with its reason. Selecting a cell shows its detail, including a conflict to resolve by asking.

**Plan builder** (DESIGNED: `plan_builder`). For one spot: strips of hand families (suited kings, suited connectors, offsuit aces, pairs...). The user **drags, clicks or uses arrow keys** to mark the weakest hand they would play; the handle shows its edge. Running totals ("You open 6 hands here: 24 combinations"). The baseline is hidden until "Compare with the baseline", then shown side by side ("Your cutoff K8s, baseline KTs: you open 2 hands (8 combinations) wider"), labelled Estimated. A 13×13 plan matrix and progress ("2 of 12 set").

**Leak map** (DESIGNED: `strategy_leak_map`). Hand family by players-behind, each cell coloured by how far the plan is from the baseline (warm: wider; cool: tighter) with the difference in points, a brass tick for the baseline, and the sample. Selecting a cell opens the teacher's note with the number ("+41 points") and a lab.

**Leak scan** (DESIGNED: `scan_where`, `scan_question`, `scan_first_read`). The first-session diagnostic: where do you play (home game, live casino, online 6-max, online 9-max); six one-tap questions ("Do you open 33?" Always / Sometimes / Never) while a small map fills in; a first read that says plainly it is six answers, "a first read, not a verdict". Whether it stays is open (decision log F4).

**Matrix painter, Teacher notes, Plan history** (PLACEHOLDER rail entries).

### 2.4 Hand: the recorder (DESIGNED: `recorder_raise`, `recorder_flop_grid`, `recorder_typed_error`, `recorder_done`)

*Promise:* get a real hand into Riverline in under a minute.

- **Tap flow:** the table; the seat to act with players behind and the price; action tickets with size presets ("3x · 9", "Pot · 10.5", "All-in"); "Everyone else folds to you"; "I don't remember exactly: approximate" (flags the value); a card grid for the board; a history rail of the hand so far.
- **Typed flow:** one line of shorthand, continuing after the actions already entered: `f` fold, `c` call, `r12` raise to 12, `r~12` approximately 12, seat prefixes. Tokens are parsed as you type and shown as chips; a bad token is named ("x is not an action: use f, c or r12").
- **What were you thinking?** One optional tap per decision ("I thought he was stealing", "I had position"...), saved in the user's words.
- Unknown cards stay unknown. On finish: "Hand recorded... Open in Review".
- Rail: Record a hand; From a game night; Paste a history (PLACEHOLDER).
- *Needs:* the engine's legal state machine validates every action; the same writer serves Full hand, the duel and Game night.

### 2.5 Equity (DESIGNED and PARTLY built as a working prototype: `equity_flop`, `equity_turn_card`, `equity_flush_card`, `equity_multiway`)

Full specification: `design/docs/EQUITY_BY_ROWS_SPEC.md`. In short: one table, **each player a row** (who, hand, equity bar with a tick for the previous street, the number with its change, one fact about "right now"); a typed field to add players; a street stepper; a 52-card runout grid coloured by what each turn card does to the hero, navigable by arrow keys; "What the turn does to you" grouped by effect; "By the river, you make" hand categories. Header badge "Exact · all 990 runouts", and the reminder "Equity is not EV".
Rail: Matchup; Runouts; Range vs range; Intuition trainer; Saved matchups (the last four PLACEHOLDER).

### 2.6 Review

**Hand review** (DESIGNED: `review_hand`). Headline: what the hero did and the total ("Hero called an all-in on the flop with a flush draw, and lost at showdown · −100 bb"). Left: the hero's decisions as a rail. Centre: one decision at a time with its tier ("Exact · known cards"), "You needed 45.0% · You had 25.6%", a careful sentence ("It lost to the hand he showed"; the reading against a range is marked Estimated), then **"What were you thinking?"** before the teacher's take. **Decisions vs luck:** the call against his hand (−48.8 bb) and run-out luck, kept apart. Street strip at the bottom.

**Share card** (DESIGNED: `share_card_image`, `share_card_text`). A hand as an image or text for a group chat. Private by default: amounts optional, opponent's cards off, real names off (seats only), your reason optional. "No account, no link." The card keeps a dark look in every theme.

**Saved library** (DESIGNED: `saved_library`). Hands and spots with fact-only titles ("BTN · A♥K♥ · 3-bet pot · flop all-in call"), origin, result, date; filters by kind and seat, search, sort, tags; archive, never delete; an inspector with a felt preview.

Rail: recent hands; All hands; Shared cards; Report; Past sessions.

### 2.7 Nights: Game night (DESIGNED for phone: `design/screenshots/phone/`; desktop NOT DESIGNED)

Recording only. Three tabs.
- **Ledger:** money still on the table; per player buy-ins, rebuys, cash-out, net; Rebuy and Cash out buttons on every row; totals in and out.
- **Player sheet:** buy-in history with "Correct" (corrections are appended, never overwritten), rebuy stepper, cash-out stepper, one commit button.
- **Hands:** type a hand in shorthand (the same grammar as the recorder) and see tonight's hands.
- **Settle:** a gate that says who has not cashed out; the night settles when everything that went in has come out; fewest transfers; a settled night can be reopened and corrected, with history kept.
- Amounts in the mockup are shekels; the default unit is an open question.

### 2.8 Learn (DESIGNED: `learn_concept`, `learn_trainer`)

A path of eight concepts (pot odds, ranges, blockers, position, SPR and commitment, bluffing and fold equity, value betting...) with states understood / in progress / ready / later; any concept can be opened in any order. A concept page: one paragraph, a worked example labelled Exact, "Mark as understood", "Drill it in Training", and the key term in English, Russian and Hebrew. **Quick trainer** (pot odds): a question, four answers, the formula on a miss, and an honest first-try record. Glossary in three languages.

### 2.9 Settings (DESIGNED and LOCKED: `settings_appearance`, `settings_motion`, `settings_teacher`, `settings_language`, `settings_shortcuts`, `settings_data`)

- **Appearance:** seven themes plus Custom (duplicate and customise: background, panel, text, accent); accent swatches and a custom accent with calculated contrast; corners (sharp, soft, round); heading font and weight; card back (forest, lattice, brass); card face (ivory, white, slate); a live preview.
- **Table and motion:** table pace (Calm, Normal, Fast); teacher typing speed with a sample; reduced motion (keeps short pauses so the hand can be followed); minimal card animation.
- **Teacher:** blunt or gentle coach with the same facts; the weekly letter; show the Lamp; ask what I was thinking before the verdict.
- **Language:** three cards showing real examples ("Колл 2.5 bb", "קול 2.5 bb").
- **Shortcuts:** one key per action everywhere; click to rebind; a clash is shown, not silently accepted; reset.
- **Data:** what is stored on this device (counts); delete everything with type-to-confirm. Export belongs here (not drawn).

### 2.10 Weekly letter (DESIGNED: `weekly_letter`)

A short note from the teacher: one thing closed, one thing still open, one hint, one suggested session. Beside it, **"What each line rests on"**: source, tier and sample for every claim. The manager would fold this into Home before giving it a room; the owner has not ruled.

### 2.11 Search palette (DESIGNED: `search_palette`)

Jump to any room, recent hand, concept or setting; keyboard first.

---

## Part 3. Not designed in the restart (do not assume; ask or design first)

| Area | What exists to start from |
|---|---|
| Russian and Hebrew on every screen, right-to-left layout | Terminology sheet; rules in the design spec; no drawn screens |
| 1920×1080 and 1366×768 layouts | The canvas is 1440×900 |
| Onboarding end to end (welcome, where you play, first drill, first review) | The leak scan; an October decision "tour, three questions, five-spot drill, one reviewed hand, all skippable" |
| Table rules editor and "My poker" (saved people, lineups, presets) | October decisions in `reference/` |
| Analyze (single-spot analysis with the baseline) as its own room | In the old app; in the restart its job is split between Training, Strategy and Review. Whether it returns as a room is undecided |
| Replay as a separate view | History rail and street strip exist; a scrubber is a proposal |
| Hand-history import, phone-note paste | Rail placeholder only |
| Game night on desktop; past nights list | Phone only |
| Labs, matrix painter, range versus range, intuition trainer, saved matchups | Rail placeholders |
| Achievements, stickers, XP, levels | Catalogue in `reference/`; a level chip in the top bar |
| Sound | Rules only: real licensed recordings; three quiet sounds proposed |
| About and legal, notices, export and import | Decisions only |
| Empty states, loading states, error pages | Rules only |
