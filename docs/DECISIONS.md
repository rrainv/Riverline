# Riverline decision log (as of 2026-11-14)

Everything decided, rejected, proposed and left open, with the reason where one was given. This is the record you keep alive: copy it to `docs/DECISIONS.md` in the new repository and add to it, never rewrite history in it.

**Status words.** LOCKED: the owner approved it; change only with the owner's yes. HARD NO: the owner rejected it; do not offer it again without new evidence. CARRIED: decided before the restart and still valid. SUPERSEDED: an older decision replaced by a newer one (kept so nobody revives it by accident). PROPOSAL: suggested, not yet approved. OPEN: needs the owner.

**Who "the owner" is:** the one human who owns the project. **Who "the manager" is:** the Claude chat that ran design and planning until this handoff. Ideas marked "manager" or "Gemini review" are suggestions unless the status says LOCKED.

---

## A. Locked decisions of the restart (November 2026)

### A1. Project shape

| # | Decision | Reason given |
|---|---|---|
| A1.1 | New, clean repository. The old one is kept untouched as fallback and archive. | Owner: a base without legacy code; "so we can always go back to it if I lose motivation". |
| A1.2 | Clean-room rewrite in strict TypeScript for `engine/` (never blindly copy legacy JS). In F3, inspect `shared/poker-domain/` + locale number modules and their behaviour tests (read-only), rewrite cleanly in `engine/*.ts` preserving exact poker math & versioned contracts, and port behaviour tests + `eqexact.py` golden tests to prove equivalence. Pull domain modules (`home-game`, `personal-strategy`, `training-memory`, `saved-study-objects`) **only when their slice arrives**, merging any v1 overlaps. Leave `logic.js`, v1 UI glue, account/sync/tutorial modules, and v1 sounds behind. | Owner (2026-11-14): keep the new repo as fresh, clean, and professional as possible without legacy anchor code or v1 sounds. |
| A1.3 | Learning is the core. Game nights and everything else support it. | Owner's vision text. |
| A1.4 | Free for everything local. Donations or paid extras only for things that cost money to run; paid options never limit features. | Owner. |
| A1.5 | Community first, then public. Official documents (privacy, terms, licences, disclaimers) before sharing outside the owner's circle. | Owner. |
| A1.6 | No real-time assistance. A study tool only. 18+ and responsible-play notices present but not excessive. | Using it during a live hand is cheating. |
| A1.7 | The name stays "Riverline", despite a real-money poker room with a similar name. Track trademark and domain questions. | Owner's favourite; alternatives "don't sound as good". |
| A1.8 | Model plan: Claude for design and this handoff; Claude Fable 5.2 for heavy founding bursts; **Gemini as deep-research tool and primary long-term coder, owning the repo as manager and maker.** | Owner, 2026-11-14. |
| A1.9 | Workflow: fewer approvals, less relaying between chats; cheaper effort and about 75 percent polish accepted on non-signature screens; bugs logged and fixed on a schedule; no emergency patches while there is no live product (exceptions once friends use it: data loss, wrong money, false numbers). | Owner: the old flow was too slow. |
| A1.10 | Accept when broadly right; log small fixes as follow-ups instead of stacking correction rounds. | Owner, to end correction loops. |

### A2. Product pillars

| # | Decision | Reason given |
|---|---|---|
| A2.1 | Pillar: **Personal Strategy and the Teacher.** Three layers kept apart: what you intend (your plan), what you do (your play), what is sound (the baseline with its confidence). | Founding draft; owner. |
| A2.2 | The teacher learns from in-app data (Training, Full hand, Analyze, its own questions) and spots habits such as over-wide opens or overbluffing. | Owner's vision. |
| A2.3 | The teacher is **blunt and direct about real mistakes**, about the play and never the person. Claim strength follows the evidence tier. | Owner: prefers blunt to "gently curious". See C-supersession S3. |
| A2.4 | A manual matrix painter with three states: yours, baseline, unknown. | Owner. |
| A2.5 | Pillar: **Equity.** Light, players as rows, real calculations, explained runouts: how many cards help, drawing dead, multiway, what happens if a card lands. The old Equity screen is replaced entirely; the engine's calculators stay. | Owner. |
| A2.6 | **Equity by rows is locked. Layout B (players as cards in a grid) is dropped completely.** | Owner, 2026-11-14: "no layout B, I like equity by rows". Rows had the least dead space, compare at a glance, and keep one shape from 2 to 10 players. Full reasoning: `design/docs/EQUITY_BY_ROWS_SPEC.md` section 9. |
| A2.7 | "Players left to act behind you" is a first-class fact for betting and bluffing, shown in spot descriptions and the spot map. | Owner; home games vary between six and eight players, so position names alone mislead. |
| A2.8 | Pillar: **Training.** Existing modes (quick drill, Full hand) stay. New: a dedicated heads-up duel against a bot. More modes that show what you do and why. | Owner. |
| A2.9 | **One hand format, readable and writable.** Hands played against bots, reconstructed from memory, captured at a game night or imported are the same object with replay. The owner wants to write real hands into it, with results and money. | Owner. |
| A2.10 | **Review** opens with the physical result ("Hero did X, total −XX bb"), then decisions versus luck, built on the one shared equity engine and one outcome model. | Owner: "merge code, don't rebuild the same thing per screen". |
| A2.11 | **Game night is for recording, not playing.** Ledger, buy-ins, rebuys, cash-outs, settlement, plus hands worth keeping, using the same hand writer as everywhere else. | Owner. |
| A2.12 | Stickers, XP and achievements stay, reworked and tied to real study. Skill progress is shown separately from effort and cannot be inflated by repeating easy drills. No streaks. | Owner reopened the old "no achievements" rule as stale. |
| A2.13 | Home fills free space with offers ("try this", "see what to improve") that each name a specific reason from the user's own data. No reason, no offer: the region shrinks. | Owner plus design rule 1. |
| A2.14 | Onboarding adapts by learning about the user first; everything is skippable. The first session is a short diagnostic that already shows something true about your game. | Owner. |
| A2.15 | Friends and social features later. No account or social design work now. | Owner. |
| A2.16 | "Alive" means sound, visible progress, a lot of animation, good motion and colour, and a layout that itself feels alive. | Owner. |
| A2.17 | Estimates are allowed "with the right precautions": always labelled Estimated, with sample or margin, never phrased as fact. | Owner, when asked about showing estimated readings. |

### A3. Shell, character and look

| # | Decision | Reason given |
|---|---|---|
| A3.1 | **Shell: the floating dock ("variant M")** with eight rooms (Home, Training, Strategy, Hand, Equity, Review, Nights, Learn), a collapsible side rail for the current room's sections, and a top bar with search (Ctrl K), Settings and Focus mode. | Owner picked it after two rounds of clickable shell directions. Round 1: liked A (study room with sidebar) and C (card room with dock), D (light ledger) only maybe. Round 2 hybrid: chose M. |
| A3.2 | The collapsed rail shows **icons, not letters**. | Owner. |
| A3.3 | **Home is the "coach" layout** (the teacher, three next steps, leak map snapshot, last game night). A "seats" variant (the table as a menu) exists as an alternative and is kept as an option. | Owner: "probably M, coach". |
| A3.4 | **The table as a menu** is kept for the Training hub (pick a seat to pick a mode). Seats must look like natural seats, not text stamps. | Owner liked it. |
| A3.5 | **The teacher character is "the Lamp"**: an abstract desk lamp with a face for emotion, more serious than a mascot. Eight animated moods. **The stern mood stays.** | Owner: prefers the abstract Lamp, wants a face, "95 percent there"; explicitly kept stern when a review suggested cutting it. |
| A3.6 | Bots are abstract marks with names (Astra, Lyra, Orion, Vega, Nebula). **No star shape** ("too starr-y"); more abstract. | Owner. |
| A3.7 | Identity: dark forest, jade and brass, rich felt; premium, natural, human, alive; not generic, not "AI-looking", never casino. | Carried and reconfirmed. |
| A3.8 | **Design rule 1: almost no dead space.** Every pixel useful; every region answers a question. | Owner, repeatedly. |
| A3.9 | No duplicated information (an equity percentage appears once); one primary action per view; never signal one state twice; show states visually. | Owner. |
| A3.10 | **Daylight is a real theme**, cohesive, not a patched dark theme. Seats must not be blackish. | Owner, 2026-11-14. Done by token refactor; see `design/docs/DAYLIGHT_AUDIT.md`. |
| A3.11 | **Settings customisation as mocked is locked**: themes plus a custom theme editor (background, panel, text, accent), live accent with calculated contrast, corner radius, heading font and weight, card back and face, table pace, teacher typing speed, teacher voice, language cards, rebindable shortcuts with clash check, type-to-confirm delete. Do not cut options. | Owner: "liked settings customizability, your idea cuts options"; later "looks good, keep it locked in". |
| A3.12 | Placeholder items in side rails ("dead buttons") are acceptable **in the mockup** by design. In the app, a control exists only when its feature exists. | Owner accepted them in mockups; the standing rule forbids them in the product. |
| A3.13 | The design canvas was restarted clean because the old one was cluttered. Only useful boards live on the current one. | Owner. |

### A4. Interaction and motion (owner feedback, round by round)

| # | Decision | Reason given |
|---|---|---|
| A4.1 | **Fold animation:** cards lift, turn face down, and are tossed to the muck on an uneven arc. They never overlap each other and are **never face up in flight**. Smooth, no jitter. | Three rounds of owner feedback; final: "fold is good now". |
| A4.2 | **Showdown** keeps the outline on the winning hand. | Owner noticed it had been lost; restored. |
| A4.3 | **Mix bar** fills as one uniform wipe from left to right (not segment by segment). The "you" pointer sits at the position of the chosen raise size: a bigger raise sits further right. | Owner. |
| A4.4 | **Table pacing:** visible delay between table actions, more on some actions; bots visibly think (dots that are actually visible); each action appears in a bubble **above the character**. A table pace setting: Calm, Normal, Fast. | Owner asked twice for more delay and for the action to appear above the character. |
| A4.5 | Text must never clip against the table rim; seat capsules sit clear of neighbours. | Owner. |
| A4.6 | **Heads-up duel sizing:** prices are shown **only on hover**; the bet-size ladder is **customisable** (editable sizes). A persistent line shows the price of the *selected* size and the hover tooltip is labelled with its own size. | Owner; the persistent line was added after a review confused hover and selection. |
| A4.7 | **Teacher typing speed** is a setting. | Owner. |
| A4.8 | **Plan builder:** set the cutoff on a hand-family strip by **dragging**, clicking or arrow keys; the handle shows its edge. | Owner: "dragging would be better". |
| A4.9 | **Hand recorder:** tap flow and typed shorthand on one hand format. The typed syntax is "good enough" as designed. | Owner. |
| A4.10 | Chip animations stay light; card animations get the craft. | Owner. |
| A4.11 | Outline and border-draw animations must not be buggy or jittery. | Owner. |
| A4.12 | Motion direction (carried from October and reconfirmed): rich, crafted animation designed across the whole app; frequency decides how much; keyboard-triggered actions are instant; 60 frames per second using transform and opacity only. | Owner approved the motion catalogue as "the direction for Riverline". |

---

## B. Hard nos

| # | Rejected | Why |
|---|---|---|
| B1 | **Equity Layout B** (each player on a card in a grid, board in the middle), as a default, an option, a toggle or a setting. | Dead space at odd player counts; bars on separate cards cannot be compared; the screen changes shape as players are added; it duplicates the table metaphor other rooms own. Owner: "no layout B". |
| B2 | Fake authority: "GTO says", "optimal", mastery scores, EV-loss figures from heuristics, personality labels, numeric confidence percentages. | Honesty is the brand. |
| B3 | Streaks, urgency mechanics, engagement theatre, praise for nothing. | Owner; habit-design research is guidance, but streak pressure is out. |
| B4 | Casino styling: neon, jackpots, confetti, fake 3D. | Identity. |
| B5 | Real-time assistance; real-money play. | A1.6. |
| B6 | Poker mathematics in interface code; a second equity, training, strategy or state engine. | One authority per concept. |
| B7 | A solver or a language model in the product at runtime. No API costs; everything local. | Owner. |
| B8 | Porting or wrapping the old `logic.js`, the old stylesheet, or old markup. | They are the cause of the reset. |
| B9 | Tests that assert the shape of source files (a class name exists, a string appears in a CSS file). | They passed while screens were wrong. |
| B10 | Treating unknown as fold, zero or excluded. Treating a preferred action as 100 percent frequency. Treating a heuristic disagreement as a mistake. | Project truth rules. |
| B11 | Synthesized placeholder sounds. Sound comes from real, properly licensed recordings only. | Owner: "synthesized slop". |
| B12 | A playful mascot (big glossy eyes, cartoon antics, jokes about losses). A star-shaped bot mark. | Owner. |
| B13 | Phone-first design. The desktop comes first; phone layouts are separate and later, except Game night and quick capture. | Owner called earlier phone-first work "drift". |
| B14 | Automatically changing the user's plan when play conflicts with it. Conflicts are asked about. | Owner. |
| B15 | Cloud accounts, sync or social features as an early step. | A2.15. |
| B16 | Em dashes and en dashes in user-facing sentences. "Selected" labels on things already highlighted. The word "heuristic" in user-facing text. | Copy rules. |
| B17 | Cutting the dock and rail, the table as a menu, XP and achievements, or the Lamp's moods. | Suggested by the Gemini review; each contradicts an explicit owner choice. |
| B18 | Emergency bug patches and a ticket per bug. | A1.9. |
| B19 | Illustration style "felt and flat"; the horizontal action path (the vertical street-grouped history rail is the one history component). | Carried from October. |
| B20 | Paying for tools before free options are exhausted; copyleft code without an explicit decision; any outside code or data without its licence recorded first. | Owner's sourcing policy. |

---

## C. Carried decisions (made before the restart, still valid)

The full older logs are in `reference/` (`PHASE1_DECISIONS.md`, `HAND_DESIGN_DECISIONS.md`, `PS_DESIGN_DECISIONS.md`, `MOBILE_DESIGN_DECISIONS.md`, `LONG_TERM_NOTES.md`, `NORTH_STAR.md`). The ones that matter most:

| # | Decision |
|---|---|
| C1 | **Fact tiers:** Exact (correct by construction), Verified (measured against references within a stated tolerance), Estimated (heuristic, unverified), Unavailable (say so). Baseline output is Estimated until measured. Price facts are "Exact · price only". |
| C2 | Frequency statistics (VPIP, c-bet and so on) come only from **dealt** hands, never from drills, and are labelled "watching" below a sample threshold. |
| C3 | **Actions use select then confirm** by default, with a setting for instant or hold, and a one-time prompt offering the switch. |
| C4 | Accent colour means action (the one primary action, focus, navigation), never approval. Tiers and "inside or outside the baseline" use neutral colours so that green never reads as "correct". Note: the restart mockup's default accent is brass, with jade as an option. |
| C5 | No interactive element inside another. Every control works by keyboard. |
| C6 | Fonts are bundled locally; no font requests at runtime. |
| C7 | Logical CSS properties everywhere; poker data isolated left to right; sentences built from translation templates, never by concatenation. |
| C8 | **Russian and Hebrew terminology:** general interface terms get standard translations; poker terms follow real player usage (Russian loanwords except fold = пас; Hebrew loanwords throughout); abbreviations and position codes stay Latin; the 13×13 matrix is never mirrored; Russian uses the casual «ты»; Hebrew uses masculine singular. Full sheet: `reference/TERMINOLOGY_SHEET.md`. |
| C9 | Amounts can be entered in money or big blinds. The owner's game uses a 1 shekel big blind. |
| C10 | Names: the Personal Strategy container is a "Game"; the rules object (blinds, rake, stacks, table size) is "Table rules"; they are separate. The workspace is called "Game night" (shown as "Nights" in the dock). Things that are not grouped together do not share a name. |
| C11 | Game night: per-player buy-ins; sessions independent, carrying over only saved people and presets; settled sessions can be reopened with changes visibly kept (append-only corrections); settlement by fewest transfers by default or through a banker; chips or money chosen per session. |
| C12 | Bots: each character has a default playstyle, always shown and changeable; named presets with sliders underneath; an optional "read the table" mode that hides labels and reveals them in the session report; bots see only what a player in their seat could know. |
| C13 | Orbit sessions carry stacks from hand to hand; busting leads to a rebuy like a real session. |
| C14 | Empty states: a useful starter from real data where there is one; otherwise an illustration, one line and one action. |
| C15 | Illustration style: soft depth with fine line accents. Two cards together: one face up in front, one face down behind. |
| C16 | Data safety: request persistent storage; guard "Delete all data" with type-to-confirm; export early; import, then sync, later. |
| C17 | Sourcing policy: quality first, legal certainty always; record the licence of any outside code, data or tool before using it; reuse permissive code; copyleft only by explicit decision; buy only when terms allow and the owner agrees; build when nothing lawful is good enough or it is core. |
| C18 | Engine invariants (versioned contracts, immutable recorded evidence, exact decision economics, range-maths distinctions, privacy fences for bots and replay): listed in `03_LEGACY_REPO.md` section 5. |
| C19 | Mockup hygiene (17 rules from bugs the owner found): `reference/MOCKUP_QA.md`. Several are now automated by the audits. |
| C20 | Screen mockups for desktop are drawn at 1920×1080. (The restart canvas was drawn at 1440×900; see OPEN F12.) |

---

## D. Superseded (do not revive)

| # | Old decision | Replaced by | Why |
|---|---|---|---|
| S1 | Sidebar with hubs (Home, Study, Tools, Library), October. | The floating dock with eight rooms (A3.1). | The owner explored new shell directions and chose the dock. |
| S2 | "Chippy", a poker-chip teacher character, October. | The Lamp (A3.5). Chip and spade characters were also liked and are parked, not rejected. | The owner preferred the abstract Lamp with a face. |
| S3 | Voice rule "never use the word mistake", October voice guide. | "Mistake" is allowed where **Exact** price/equity math earns it (or, in future, against a **Verified** solver-backed reference within stated tolerance). It stays banned for unverified **Estimated** heuristic baselines or range assumptions. | Owner (2026-11-14): wants blunt teacher + ability to mark mistakes once math is Verified without needing live solver calls. |
| S4 | Equity "version C" with players as cards (October), and Layout B in the restart round. | Equity by rows (A2.6). | See B1. |
| S5 | "Port the mockup's HTML as starting code, with a pixel-diff fidelity gate" (founding draft proposal). | Build 18 shared components in `/kit` from tokens, matching the mockups' exact look/measurements/motion, gated by `audit:layout` + `audit:theme` + owner visual check against `design/screenshots/`. Port the visuals and behaviour, not the 1440×900 English HTML shims. | **LOCKED (2026-11-14):** preserves mockup fidelity while supporting 1920×1080, 1366×768, Russian (2–3× strings) and Hebrew RTL. |
| S6 | Motion tempo model "base duration divided by a per-moment tempo", with a global Instant / Faster / Standard / Reduced setting (October motion spec). | Four duration tokens (`--dur-1..4`), four curves, and a `--pace` multiplier that affects only table time (`04_DESIGN_SPEC.md` section 6). The 41 catalogued moments remain the inventory of what should move. | **LOCKED by owner (2026-11-14)** ("makes sense yes"); exact millisecond values still tunable on `/kit`. |
| S7 | A flat evidence gate of 15 hands as final. | OPEN F1. | The Gemini review called it arbitrary; the manager agrees a credible-interval rule is better. |
| S8 | Hard milestone gates M1, M2, M3 with long plans. | Slices judged by use (`05_PLAYBOOK.md`). The milestone labels in the idea bank are rough priorities only. | The reset. |
| S9 | Manager chat plus separate worker sessions with hand-carried reports. | One owner of the repo (Gemini) with checkpoint reviews. | A1.8, A1.9. |
| S10 | Old role table: Gemini as researcher and reviewer only, "never a concurrent writer". | Gemini as primary coder (A1.8). | Owner's decision; guardrails in `05_PLAYBOOK.md`. |
| S11 | Daylight as a set of light overrides on the dark theme. | Daylight and Paper as full token sets. | A3.10. |

---

## E. Proposals (not approved; the owner can cut any of them)

| # | Proposal | From | Notes |
|---|---|---|---|
| E1 | Stack: TypeScript strict, Vite, Preact with `@preact/signals`, Vitest, CSS Modules (`*.module.css`) with plain CSS on tokens. | Manager; endorsed by the Gemini review | Untested by a build; CSS Modules added to enforce component style scoping. |
| E2 | Engine behind a typed worker API with request IDs, cancellation and seeded randomness. | Manager | |
| E3 | IndexedDB append-only event log; one-file export and import early. | Manager; owner wants export early | |
| E4 | Two automatic gates only (layout audit, golden numbers), plus the theme audit and the no-raw-values check as part of the first. | Manager | Scripts exist. |
| E5 | **Paper** theme (warm light). | Manager | Built in the mockup; the owner has not commented. |
| E6 | Follow-the-system theme; a separate table theme; a print stylesheet; a "sepia night" theme. | Manager | Not built. |
| E7 | Equity expansions: range and "any two" rows, dense mode to ten rows, row expand, sort control, river step, "Can I call?" strip, links to and from Review, recorder and Training. | Manager | Spec in `design/docs/EQUITY_BY_ROWS_SPEC.md`; typed card players, four rows, the street stepper and keyboard stepping are built in the prototype. |
| E8 | The street ribbon: one strip (preflop, flop, turn, river with pot, SPR and equity) that moves every panel to a street, the same in Review, Equity, Replay and the recorder. | Manager | Not drawn. |
| E9 | The Friday loop as a guided path through the rooms. | Manager | |
| E10 | "What were you thinking?" asked before any verdict in Review. | Gemini review; manager adopted | In the recorder mockup. |
| E11 | A range for the opponent in Review (tight, standard, loose) so a call is never judged only against the revealed hand. | Gemini review; adopted | Needs the engine. |
| E12 | Replace the six-question leak scan with spot-based calibration (cutoff sliders on family strips). | Gemini review | The plan builder exists in the mockup; the scan still exists too. See F4. |
| E13 | Game night defaults to chips or points; a legal read before any public release in Russian or Hebrew. | Gemini review | Conflicts partly with the owner's earlier wish to keep money mode. See F2. |
| E14 | A real-time-assistance warning ("close Riverline during live online play") in About and legal. | Gemini review; adopted | |
| E15 | Morning-after receipt card; thumb keypad for phone shorthand; multiway fold-equity calculator; commitment clock; iso-raise and overlimp lab; pre-session warm-up card; villain assumption toggle; voice dictation into shorthand. | Gemini review | In the idea bank (49 to 57) with statuses. |
| E16 | Motion ideas: shared-element card travel into Review; equity tick trail; scrub the hand along the history rail; three quiet sounds; phone haptics. | Manager | |
| E17 | Disabled buttons use a grey track with grey text instead of a faded accent. | Manager | Shown on the design-system page; not applied on the app board. |
| E18 | The founding sessions (split into `F1a`/`F1b` and `F2a`/`F2b`/`F2c`, plus `F3` and `F4`) and the slice order in `05_PLAYBOOK.md`. | Manager | The owner has not confirmed the number of Fable sessions or the first slice. |
| E19 | Level chip in the top bar ("Level 4"). | In the mockup | The system behind it is undesigned. The manager would not build it before the loop is used weekly; the owner wants XP and achievements to stay (A2.12). Sequence is the open part. |

Every idea ever recorded, built or not, is in `reference/IDEA_BANK.md` (79 entries with source, rough priority and status).

---

## F. Open questions for the owner

| # | Question | Manager's view |
|---|---|---|
| F1 | Evidence gate: a flat 15 hands, or a credible-interval rule with a small minimum? | Interval rule. |
| F2 | Game night default units: shekels as now, or chips and points with money as an option? | Chips by default before any public release; money for the owner's own use. |
| F3 | Open source or closed? | Decide when a dependency forces it; keep copyleft code out until then. |
| F4 | Keep the six-question leak scan, replace it with the plan builder as first session, or offer both? | Plan builder first; the scan as a two-minute alternative. |
| F5 | Spaced repetition: fixed revisit intervals or FSRS? | Fixed first; FSRS when there is data. |
| F6 | Desktop wrapper: none, Tauri or Electron? And is "an installable web app" exciting enough? | Installable web app first. |
| F7 | How many Fable 5.2 sessions are affordable: four, or two (foundation and component kit)? | Do not skip the component kit. |
| F8 | First slice after Equity: Review plus Hand recorder? | Yes: it is the loop only Riverline has. |
| F9 | Confirm the change in method (S5): components and audits instead of ported markup and a pixel-diff gate. | **Settled (LOCKED):** `/kit` components + audits matching mockup visuals/measurements. |
| F10 | Heading font: serifs were rejected in October, but the Settings mockup offers Georgia as a heading option. Keep or drop? | Drop it unless the owner likes it in use. |
| F11 | Is Paper wanted as a shipped theme? | Yes: it costs nine values. |
| F12 | The canvas is 1440×900; the standing rule is 1920×1080 with 1366×768 as the functional minimum. Redraw, or let the component kit settle sizes? | Let the kit settle it, and test both sizes there. |
| F13 | Whose turn at the table: the mockups use a travelling ring, thinking dots and an action bubble. In October the owner said this needed "further review". Is the current version accepted? | It answers the later feedback; ask once on a real build. |
| F14 | Decision controls: option tickets (cards) everywhere, or seat buttons at the table in some modes? | Tickets everywhere until a mode proves otherwise. |
| F15 | Where do sound and the Lamp's voice come in? | After the first Friday. |
| F16 | Legal reading for Israel and Russia, and for the name. | A human must do it before any public release. |
| F17 | Does the owner's real study data in the old app need migrating, or only exporting for safekeeping? | Export for safekeeping first; migrate only saved hands. |

---

## G. Future threads (not now; do not lose them)

Solver work (an offline pilot on the owner's own machine; `reference/SOLVER_PATH_RESEARCH_unverified.md` is one model's research and is unverified); a measured "Verified" baseline for 30 to 60 big blinds; card-aware bots built as one opponent model; hand-history import (strict, fail-closed); phone layouts for the full app; sound; friends and sharing; accounts and sync; native apps; PLO; achievements catalogue (`reference/ACHIEVEMENTS_CATALOGUE.md`); learning paths; range versus range heat maps; blockers view; natural-language explanations without a language model.

---

## H. Outcome of the Gemini second-opinion review (2026-11-13)

Full table: `reference/GEMINI_TRIAGE_2026-11-13.md`. The review itself: `reference/GEMINI_SECOND_OPINION_2026-11-13.md`.

- **Correct and fixed:** a turn card wrongly called a blank (jacks and tens give a gutshot: 22.7 percent, not 15.9); Review graded a call using the opponent's revealed hand; an implausible fold share for A K suited; a count mismatch in the scan result; mixed meanings in the scan map; a wrong sample in the session report; a letter citing fewer answers than the evidence gate; duplicated "You" label; multiple gold accents; missing rebuy and cash-out buttons on the phone.
- **Wrong:** the claim that a duel tooltip's price was miscalculated (it belonged to the hovered size, not the selected one); a sets-only equity figure of 25.2 percent (exact: 25.6).
- **Unverified:** market prices, law, partnerships.
- **Rejected because they contradict owner decisions:** B17.
- **Changed the manager's mind:** S5, F1, E10, E13, and "cheap automated gates beat big plans".
- **Process lesson, now a rule:** a "Verified" label needs the command and its output.

---

## I. Session F1a additions (2026-11-14)

- **E1 confirmed (LOCKED 2026-11-14):** Stack is TypeScript strict, Vite, Preact with `@preact/signals`, Vitest (`jsdom`), CSS Modules (`*.module.css`) on `tokens/tokens.css`, plus bundled local variable fonts (`@fontsource-variable/inter` and `@fontsource-variable/rubik`). Licences recorded in `docs/THIRD_PARTY.md`.
- **F1a shell scoping (LOCKED 2026-11-14):** Top bar omits unbuilt `Sample data` and `Level` chips; collapsible rail shows one real active overview entry per room (`Appearance` in Settings, `Component sheet` in `/kit`); Settings renders the four F1a Appearance controls (7 themes, table pace, reduced motion, language) directly without placeholder tabs.
- **Routing and deterministic audit hook (LOCKED 2026-11-14):** History API routing (`/`, `/training`, ..., `/settings`, `/kit`) with `?room=` query parameter taking precedence; URL query params and `window.__riverlineTest.setState(...)` apply ephemerally without overwriting `localStorage` (`riverline.appearance.v1`).
- **Branch merge policy for Foundation (LOCKED 2026-11-14):** Keep `feat/f1a-skeleton` unmerged; F1b builds on `feat/f1a-skeleton` (or branches off it), and merges to `main` only after F1b passes all Playwright layout/theme audits, golden harness, and CI setup so `main` stays green on every gate from day one.

## J. Session F1b additions (2026-11-14)

- **Playwright devDependency (LOCKED 2026-11-14):** Added `playwright@1.65.1` (`Apache-2.0`, recorded in `docs/THIRD_PARTY.md`) to `devDependencies` so `npm run audit:layout` and `npm run audit:theme` run reproducibly against `vite preview` locally and in CI.
- **Desktop target floor in `audit:layout` (LOCKED 2026-11-14):** `tools/audit-layout.mjs` enforces a `28px` minimum control height/width on desktop viewports (`1920×1080` and `1366×768`, matching `--h-chip`) and `40px` when `vw < 600` (`--tap-min`), alongside 4-edge clipping (LTR+RTL), overlap, modal-scoped covered text, rim text, and tab alignment across 546 states (7 themes × 3 languages × 2 viewports × 13 F1 states).
- **Theme audit matrix and swatch exemption (LOCKED 2026-11-14):** `tools/audit-theme.mjs` + `tools/analyze-theme.py` measure 22 runs (7 themes in `en` + `ru`/`he` in `midnight` and `daylight`, across `1920×1080` and `1366×768`, 13 states each); intentional dark theme-preview swatches inside light themes are tagged explicitly with `data-audit-allow="theme-swatch"` rather than weakening luminance checks.
- **Section 8 golden suite (LOCKED 2026-11-14):** `npm run golden` verifies `tools/golden/section8.golden.json` against `python tools/eqexact.py --section8 --with-vs-any` (including `KdJd_vs_any_on_Ks8h4h` and all §8 pot-odds, SPR, all-in luck, and Review EV facts) and executes `src/test/section8.golden.test.ts`.

## K. Session F2a additions (2026-11-14)

- **State matrix applicability and forced states on `/kit` (LOCKED 2026-11-14):** Each component on `/kit` renders only the states that genuinely apply to it (with non-applicable states listed in a header chip) and supports `data-state="hover|pressed|focus"` alongside `:hover`, `:active`, and `:focus-visible` in CSS Modules so side-by-side state cells are audited by `audit:layout` and `audit:theme`.
- **`Panel` single-corner `tier` slot (LOCKED 2026-11-14):** `TierBadge` sits in `Panel`'s inline-end header corner via the `tier` prop and formats qualified forms (`{tier} · {detail}`, `{source} · {tier}`) through `tNodes()` templates rather than string concatenation.
- **`TokenInput` caller-supplied validator (LOCKED 2026-11-14):** `TokenInput` splits tokens on whitespace/Enter and delegates validation to a `validateToken` callback prop (fixture map on `/kit`, `engine/` in F3/F4) so UI code never implements a second shorthand parser.
- **Destructive `Dialog` type-to-confirm (LOCKED 2026-11-14):** Destructive dialogs require typing the exact target object name (for example `Friday-100bb` in `<PokerNotation>`) rather than a translated keyword.
- **Full 42-run `/kit` sweep in `audit:theme` (LOCKED 2026-11-14):** `tools/audit-theme.mjs` sweeps all 8 `/kit` sections across all 7 themes × 3 languages × 2 viewports (42 runs total) while keeping the full 20-state sweep on the 11 locked theme/locale pairs.

## L. Session F2c additions (2026-11-15)

- **Five `--lamp-*` tokens across all 7 themes (LOCKED 2026-11-15):** Added `--lamp-bulb`, `--lamp-rim`, `--lamp-eye`, `--lamp-glow`, and `--lamp-stern` to `tokens/tokens.css` and `tokens/tokens.json` so the Lamp SVG uses zero raw colour literals outside `tokens/`.
- **Runout grid colour semantics (LOCKED 2026-11-15):** Runout view in `HeatGrid` uses `--ok`/`--ok-text` for turn cards that help hero and `--over`/`--over-text` for turn cards that hurt hero, leaving `--under` for low-frequency leak cells.
- **Appearance preferences extended backwards-compatibly (LOCKED 2026-11-15):** Added `showLamp` (default `true`) and `teacherTypingSpeed` (`'slow' | 'normal' | 'fast' | 'instant'`, default `'normal'`) to `AppearancePreferences` (`riverline.appearance.v1`) and `/kit` controls; Settings UI for teacher preferences waits for its Settings slice.
- **`matrix13` states and forced LTR orientation (LOCKED 2026-11-15):** `HeatGrid` `matrix13` supports `yours | baseline | match | unknown` cell states at `>= 28px` cells with `dir="ltr"` preserved in RTL Hebrew.
- **`leakMap` summary footer (LOCKED 2026-11-15):** `HeatGrid` `leakMap` includes a column summary footer alongside `--over`/`--under` fills, brass baseline tick, and sample counts.
- **`FamilyStrip` non-nested slider contract (LOCKED 2026-11-15):** `FamilyStrip` forces `dir="ltr"` on a single horizontal `role="slider"` track (no nested interactive elements inside cells) with pointer/click/keyboard cutoff control and localized hand/combo counts.
- **`TeacherCallout` progressive typing (LOCKED 2026-11-15):** `TeacherCallout` reveals copy progressively at `teacherTypingSpeed` while supporting instant completion on click/Enter/Space and under reduced motion.


## M. Session F3 additions (2026-11-15)

- **F3 clean-room engine & helper scope (LOCKED 2026-11-15):** Rewrote all 31 `shared/poker-domain/` modules cleanly in strict TypeScript (`engine/*.ts`), plus `deriveActionSizeFacts` (`poker-gto-app` `f2bc809`), pure analysis/worker modules (`range-analysis`, `equity-hand-analysis`, `runout-explorer`, `worker-handler`), §8 `economics-facts`, and `privacy-fences` (`ownCards` bot allowlist, non-leaking replay frames, full-hand training embargo). Deferred `home-game/`, `personal-strategy/`, `training-memory/`, `saved-study-objects/`, and hand-history persistence to their respective feature slices.
- **Typed `src/engine-api` boundary & envelope (LOCKED 2026-11-15):** Approved `docs/ENGINE_API.md` surface with synchronous cheap arithmetic/rules/state transitions (`sync`), asynchronous Worker-backed equity & runout computation (`async`), unified `{ ok, requestId, tier, qualifier, method, data }` response envelopes, request-ID cancellation + `AbortSignal` + `createChannel` latest-wins supersession, and typed `tier: 'unavailable'` stubs for `lookupStrategy`, `generateTrainingDrill`, and `gradeTrainingAnswer`.
- **Engine strict purity & CI `95%` confidence margins (LOCKED 2026-11-15):** Enforced via `engine/tsconfig.json` (`lib: ["ES2022"]`, zero `DOM`, `window`, storage, or network globals), with `margin95` and optional `{ exactLimit }` overrides surfaced uniformly across `equity` and `weighted-equity`.
- **Merged `i18n` locale number formatting & input (LOCKED 2026-11-15):** Consolidated `localeNumbers.ts` (`0921c04`) and `localeNumberInput.ts` (`origin/codex/stabilization` `48fdb56` / `ae61622`, including optional `setSelectionRange?.` hardening) into `src/i18n/` without legacy global `window` bridges.
