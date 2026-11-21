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

## N. Equity by rows slice additions (2026-11-15)

- **Inline 13×13 range matrix thumbnail in `EquityRow` (LOCKED 2026-11-15):** `EquityRow` renders a single-path `<svg>` 13×13 thumbnail alongside the combo count for range seats, reserving the expand drawer for wins/trials counts, hand classes, and top river categories.
- **No sort control on Equity rows (LOCKED 2026-11-15):** Seat insertion order remains fixed so players do not reorder unpredictably as streets and cards change; row removal is shown for non-hero seats when 3+ players are seated.
- **Single reused 4×13 `HeatGrid` for Turn & River (LOCKED 2026-11-15):** `RunoutExplorerPanel` reuses one `variant="runout"` `HeatGrid` with the selected turn card struck in play; `Escape` steps River -> Turn -> Flop.
- **Additive Equity engine projections (`riverCategoryShares`, `wins`/`ties`/`trials`, `'effect'` runout grouping) (LOCKED 2026-11-15):** Exposed inside `engine/` + `src/engine-api/` without computing any poker math in UI modules.
- **Single shorthand grammar module (`src/domain/shorthand/`) (LOCKED 2026-11-15):** Supports exact cards, range notation (`QQ+`, `AKs`, `22-77`, `A5s-A2s`), and `any`/`?`/`random` (`top X%` and saved player profiles deferred). Default interactive sample count is `15,000` with optional `60,000` Refine toggle.
- **`riverline-study-v1` IndexedDB event log + one-file JSON Export/Import (LOCKED 2026-11-15):** Append-only object-store event log with fact-only saved matchup titles, archive events, schemaVersion-`1` JSON export, and deduplicating JSON import (kept strictly separate from `riverline.appearance.v1`).
- **Scrollpane & `section[aria-busy="true"]` handling in Playwright gates (LOCKED 2026-11-15):** Updated `tools/audit-layout.mjs` and `tools/audit-theme.mjs` to respect vertical `overflow-y: auto` scrollports on `<main>` (without relaxing horizontal overflow, overlap, target-size, contrast, or visible occlusion checks) and scoped `waitForSettled` in `tools/f1-states.mjs` to `section[aria-busy="true"]` so permanent loading demos in `/kit` do not stall while async room worker runs settle completely before screenshots.


## M. Session F3 additions (2026-11-15)

- **F3 clean-room engine & helper scope (LOCKED 2026-11-15):** Rewrote all 31 `shared/poker-domain/` modules cleanly in strict TypeScript (`engine/*.ts`), plus `deriveActionSizeFacts` (`poker-gto-app` `f2bc809`), pure analysis/worker modules (`range-analysis`, `equity-hand-analysis`, `runout-explorer`, `worker-handler`), §8 `economics-facts`, and `privacy-fences` (`ownCards` bot allowlist, non-leaking replay frames, full-hand training embargo). Deferred `home-game/`, `personal-strategy/`, `training-memory/`, `saved-study-objects/`, and hand-history persistence to their respective feature slices.
- **Typed `src/engine-api` boundary & envelope (LOCKED 2026-11-15):** Approved `docs/ENGINE_API.md` surface with synchronous cheap arithmetic/rules/state transitions (`sync`), asynchronous Worker-backed equity & runout computation (`async`), unified `{ ok, requestId, tier, qualifier, method, data }` response envelopes, request-ID cancellation + `AbortSignal` + `createChannel` latest-wins supersession, and typed `tier: 'unavailable'` stubs for `lookupStrategy`, `generateTrainingDrill`, and `gradeTrainingAnswer`.
- **Engine strict purity & CI `95%` confidence margins (LOCKED 2026-11-15):** Enforced via `engine/tsconfig.json` (`lib: ["ES2022"]`, zero `DOM`, `window`, storage, or network globals), with `margin95` and optional `{ exactLimit }` overrides surfaced uniformly across `equity` and `weighted-equity`.
- **Merged `i18n` locale number formatting & input (LOCKED 2026-11-15):** Consolidated `localeNumbers.ts` (`0921c04`) and `localeNumberInput.ts` (`origin/codex/stabilization` `48fdb56` / `ae61622`, including optional `setSelectionRange?.` hardening) into `src/i18n/` without legacy global `window` bridges.

## O. Hand recorder slice additions (2026-11-15)

- **Split Hand recorder (`/hand`) and Review (`/review`) into separate slices (LOCKED 2026-11-15):** Delivered `/hand` recording, shorthand entry, and local `saved_hand.*` persistence cleanly in Slice 1 (`feat/hand-recorder`), leaving step-by-step replay & analysis UI in `/review` to Slice 2.
- **Two header table presets in `/hand` (LOCKED 2026-11-15):** `6-max · 100 bb · 0.5/1 bb` (`bb`, 6 seats) default and `Home game · 50 bb · ₪0.5/₪1` (`₪`, selectable 6 or 8 seats), backed by `GameRulesSnapshot` v2 and exact seat positions from `engine/positions.ts` (`UTG`, `HJ`, `CO`, `BTN`, `SB`, `BB`, plus `UTG+1`, `LJ` at 8 seats).
- **Mid-hand and completed-hand local persistence (LOCKED 2026-11-15):** `/hand` saves both settled hands (`savedKind: 'completed_hand'`) and unsettled/mucked spots (`savedKind: 'mid_hand_spot'`) alongside optional `"What were you thinking?"` reason chips and notes into `riverline-study-v1` (`saved_hand.created` / `saved_hand.archived`).
- **Scoped daily Playwright layout audit matrix & `--beat-*` tokens (LOCKED 2026-11-15):** `tools/audit-layout.mjs` mirrors `tools/audit-theme.mjs`'s `buildSweepTargets()` (`fullSet` of all 7 `en` themes + `ru`/`he` in `midnight` & `daylight` runs every state in `F1_STATES`, while the remaining 10 theme/locale pairs sweep `kit_*` at both `1920x1080` and `1366x768`); added `--beat-action` (`480ms`) and `--beat-think` (`720ms`) to `tokens/` (`docs/BUG_INBOX.md` #3).

## P. Review & Saved library slice additions (2026-11-15)

- **Additive `saved_hand.restored` and `saved_hand.annotated` storage events (LOCKED 2026-11-15):** Appended non-breaking study-log event kinds `'saved_hand.restored'` and `'saved_hand.annotated'` (`tags` + updated `heroNotes`) to `riverline-study-v1` while keeping `schemaVersion: 1` backup compatibility.
- **Counterfactual villain ranges vs exact `Decisions vs luck` (LOCKED 2026-11-15):** Switching a decision's counterfactual villain assumption (`showed` vs `tight` / `standard` / `loose`) evaluates weighted hero equity in the Decision panel and labels it `Estimated · opponent assumption` (with `isMathMistake: false`), while **Decisions vs luck** remains strictly under `Exact · known cards` (or `Unavailable` when cards are mucked or spot incomplete).
- **Explicit dual EV display in `Decisions vs luck` (LOCKED 2026-11-15):** Show both `callVsFoldEvBb` (`-38.8 bb` on §8 Friday showdown) and `handEvBb` (`-48.8 bb`) side-by-side in `FactTile` tiles alongside `runoutLuckBb` (`-51.2 bb`) and `actualNetBb` (`-100.0 bb`) so marginal call EV and whole-hand EV are never conflated.
- **Unified Saved library in `/review` (LOCKED 2026-11-15):** Merged `/hand`'s `SavedHandsView.tsx` into `/review`'s `Saved library` tab (`SavedLibraryView.tsx`), with `/hand` offering an `"Open in Review"` button on save and routing its `Saved hands` SideRail tab directly to `/review` (`saved` tab).

## Q. Personal Strategy slice additions (2026-11-16)

- **Preflop-only Personal Strategy in Slice 3 (LOCKED 2026-11-16):** Implemented preflop Spot Map, Plan Builder, and Leak Map in `engine/personal-strategy/`, `src/domain/strategy/`, and `src/ui/rooms/strategy/` matching `docs/handoff/06_PRODUCT_MAP.md` §2.3; postflop strategy rules remain logged in `docs/IDEA_BANK.md` (#81).
- **Stack depth & table size presets (LOCKED 2026-11-16):** Support `30`, `40`, `50`, `60`, and `100 bb` stack depths across `6-max` and `8-max` home game tables (`100 bb · 6-max` default), with baseline comparisons labelled `Estimated` (or `Verified` where exact baseline coverage applies) and never overriding the user's own plan.
- **Additive `strategy_evidence.recorded` storage event (LOCKED 2026-11-16):** Added `'strategy_evidence.recorded'` (`StrategyEvidenceBatchPayload`) alongside `'strategy_rule.set'` in `riverline-study-v1` so Leak Map drift counts persist append-only and show `"watching"` below the 20-hand evidence threshold.
- **`Choice` & `HeatGrid` unknown-cell contrast/border fixes (LOCKED 2026-11-16):** Updated `Choice.module.css` (`.chipButton` and `.selected` use `var(--text)`) so chips maintain >= 4.5:1 contrast on both page and panel backgrounds across all 7 themes, and updated `HeatGrid.module.css` `.stateUnknown` to `border: 1px solid var(--line2)` with `var(--tint)` fill so cell borders remain reliably visible.

## R. Training slice additions (2026-11-16)

- **3-seat Training Hub + omitted `Full hand` seat (LOCKED 2026-11-16):** `TrainingHubView` renders `FeltTable` `mode="menu"` with 3 active seats (`Quick drill`, `Heads-up duel`, `Leak lab`) using `SLOTS_MENU_THREE` in `FeltTable.tsx`, keeping `Full hand` omitted per `DECISIONS.md` A3.12 (`Full hand` deferred).
- **Plan hidden until drill answer confirmed (LOCKED 2026-11-16):** `QuickDrillView` keeps both the user's Personal Strategy plan for the spot and the `MixBar` estimated baseline mix hidden until the user selects and confirms an action, so the plan never steers the drill. `MixBar` renders strictly `dir="ltr"` with the `"you"` pointer mapped linearly across segments.
- **Additive `training_session.recorded` & `seatCount: 2` Review bridge (LOCKED 2026-11-16):** Added `'training_session.recorded'` (`TrainingSessionPayload`) and widened `SavedHandPayload.seatCount` to `2 | 6 | 8` in `riverline-study-v1` so completed drill stats roll up into `This week` tiles and 10-hand Heads-up duel matches save directly into `/review`.
- **Single-source token beat timing & Astra duel scoping (LOCKED 2026-11-16):** `src/ui/kit/state.ts` (`readTableBeatMs`) reads `--beat-action` and `--beat-think` multiplied by `--pace` from CSS tokens (`0` under reduced motion); Astra (`chooseDuelBotAction` in `engine/training/duel-bot.ts`) reads only her own hole cards, board, pot, and legal actions; `OptionTickets` `.kbd` uses `--text2` for >= 4.5:1 contrast across all 7 themes.
- **Scoped daily Playwright audits `--room` and `--only-new` (LOCKED 2026-11-16):** Added `--room=<room[,room2]>` and `--only-new` flags to `tools/audit-layout.mjs` and `tools/audit-theme.mjs` (`tools/f1-states.mjs`) for rapid daily slice verification, reserving full all-room 7-theme sweeps for pre-release and CI.

## S. Game Night slice additions (2026-11-16)

- **Default Chips/Points (`minorUnit: 0`) with optional `₪` preset (`minorUnit: 2`), no rake (LOCKED 2026-11-16):** New Game Night sessions default to `Chips / Points` (`pts`, `minorUnit: 0`, step `50`) with an optional `₪` preset (`minorUnit: 2`, step `₪50`), zero rake, and exact integer minor-unit arithmetic (`BigInt` decimal parsing in `engine/home-game/`).
- **Exact-pair + bipartite minimum-transfer settlement (LOCKED 2026-11-16):** `calculateFewestTransfersSettlement` pairs exact opposite balances first and solves remaining direct debtor-to-creditor transfers with an exact bipartite DFS (`<= 12` remaining non-zero balances; largest-first greedy above `12`), preserving `sum(transfers) === sum(positiveNets)` with zero pass-through transfers.
- **Additive `riverline-study-v1` `night_*` events & shared shorthand compiler (LOCKED 2026-11-16):** Added `'night_session.created'`, `'night_session.updated'`, `'night_session.settled'`, `'night_session.reopened'`, `'night_session.archived'`, `'night_ledger.appended'`, and `'night_hand.linked'` to `riverline-study-v1` (`schemaVersion: 1` compatible); extracted `src/domain/hand/shorthandCompiler.ts` and added optional `position` tokens (`UTG..BB`) to `parseActionShorthandToken` so `/hand` and `/nights` share one shorthand pipeline.
- **Kit `Stepper` `unitPosition` & `Chip` page-background contrast fix (LOCKED 2026-11-16):** Extended `Stepper` with `unitPosition?: 'prefix' | 'suffix'` (`₪100` vs `3.5 bb`) and updated `.chip` in `Chip.module.css` to `color: var(--text)` so chips meet `>= 4.5:1` contrast over page gradients in `felt` theme.

## T. Home continuity slice additions (2026-11-16)

- **Coach layout only in Slice 6 with `HeatGrid` `compact` snapshot (LOCKED 2026-11-16):** `/` ships the Coach layout (`HomeRoom` with `128px` `Lamp`, greeting, compact 4-row `HeatGrid` `variant="leakMap"` `compact`, up to 3 prioritized Next Steps with `primary` on step 1 only, adaptive Last game night card, This week card, and Try this offers), deferring the alternative `home_seats` view.
- **Token-styled 7-day activity bars in `HomeRoom.module.css` & `"This week"` link to `/training` (LOCKED 2026-11-16):** Kept the 7-day bar strip inside `HomeRoom.module.css` using tokens only (no 19th kit component), shared rolling weekly aggregation via `computeWeeklyStudySummary` / `computeTrainingWeekStats` across Home and `TrainingStore`, routed the `"This week"` header link to `/training`, and omitted undesigned `XP / Level` and `Weekly letter` controls.
- **Zero-sample honesty guard on Home leak selection (LOCKED 2026-11-16):** Positions with `sampleHands === 0` show `—` (`neutral`) in the compact snapshot and are excluded from `topLeakSignal` so `unknown` is never presented as a `-100` tight leak; `< 20` samples display `"Watching · n = {count}"`.

## U. Learn slice additions (2026-11-16)

- **9-concept Learn path with "Why multiway is different" & engine-computed worked examples (LOCKED 2026-11-16):** Added `engine/learn/` (`buildLearnConceptExample`, `getLearnTrainerRound`, `gradeLearnTrainerAnswer`, `getLearnWeaknesses`) so every worked example, pot-odds percentage, and unique draw-out count (including overlapping straight-flush cards counted once via `createRangeAnalysisFacts` `drawOuts`) comes from `engine/`.
- **One-click Pot-odds / Outs Quick trainer & `OptionTickets` `outcome` prop (LOCKED 2026-11-16):** Extended `OptionTicketItem` with `outcome?: 'correct' | 'wrong'` in `OptionTickets.tsx`/`OptionTickets.module.css` for zero-stakes one-click grading (`showConfirm={false}`), persisting `'learn_concept.updated'` and `'learn_trainer.recorded'` first-try records in `riverline-study-v1`.
- **Trilingual `TERMINOLOGY.md` glossary, "Where Riverline is weak" page, and `EmptyRoom` removal (LOCKED 2026-11-16):** Delivered `LearnGlossaryView` and `LearnWeaknessesView` under `/learn` `SideRail` sections (`Path & trainer`, `Glossary`, `Honest limits`) and deleted the unused `EmptyRoom` fallback now that all 8 rooms are live.

## V. Checkpoint P1-1 honesty & performance slice (2026-11-19)

- **Review sampled-equity honesty (`C1` / P1-1, LOCKED 2026-11-19):** Renamed `isExactResult` to `isEquityResult` in `reviewStore.ts` and read `resp.data.exact` for both Decision evaluation (`runDecisionEvaluation`) and Decisions vs luck (`runDecisionsVsLuckEvaluation`). When `!resp.data.exact` (for example preflop known-card calls where `C(48,5) > 100,000` falls back to 10,000 samples), both panels badge `Estimated` with sample count (`review.decision.tierSampledDetail` / `review.luck.tierSampledDetail`) and `isMathMistake` stays `false`.
- **Event-log read-through memory cache & coalesced `hydrate()` (`C2`–`C3`, LOCKED 2026-11-19):** Added `createCachingStudyBackend` (`src/domain/storage/eventLog.ts`) with single-flight read coalescing, incremental `seq`-sorted updates on writes, `BroadcastChannel` (`riverline-study-v1-sync`) cross-tab invalidation, and `db.onversionchange` cache clearing; eliminated redundant unconditional array copies/sorts (`ensureSortedBySeq` / `maxSeqFromSorted`). Coalesced concurrent `hydrate()` calls via `inFlightHydrate` across `homeStore`, `strategyStore`, `trainingStore`, `nightsStore`, and `learnStore`, removing duplicate creation-time `hydrate()` calls in `strategyStore` and `trainingStore`.
- **Opaque panel blur removal & Settings `<Panel>` unification (`C4` / P2-3, LOCKED 2026-11-19):** Removed `backdrop-filter: blur(14px)` from `Panel.module.css` and `SideRail.module.css` while keeping backdrop blur on `FloatingDock`, `CommandPalette`, and `Overlay`, and replaced `SettingsRoom`'s duplicated `.panel` class with `<Panel as="div">` plus `EquityRoom` header `--text` contrast compliance.
- **Shared Worker client, opt-in progress, time-sliced yields, & sequenced/cached Equity (`C5`–`C9` / P3-2, LOCKED 2026-11-19):** Added singleton `getSharedEngineClient()` (`mode: 'auto'`) across all 8 stores (never disposing the shared client inside individual store `dispose()`), made Worker `PROGRESS` posts opt-in (`reportProgress` throttled to `>= 50ms`), switched un-instrumented default `calculateEquity` / `calculateWeightedEquity` loops to `>= 12ms` time-sliced yielding while preserving RNG/batch semantics in tests, added LRU cache (`64`) + `IDLE_RUNOUT_SNAPSHOT` + microtask `triggerRecompute()` coalescing + main-before-runout sequencing in `equityStore.ts`, added `langSignal` for locale-only subscriptions, and converted `HomeRoom` `.weekBarFill` transitions to GPU `scaleY()`.
- **Scrim-covered background box exclusion in `tools/audit-theme.mjs` (LOCKED 2026-11-19):** Guarded `boxes.push` in `collectFn` with center-point `elementFromPoint` occlusion checks matching `leaves` and `borders`, preventing darkened elements behind `--scrim` overlays (`[search_palette]` on light themes) from registering as false dark artifacts.

## W. QA Batch C honesty, RTL, and Duel fixes (2026-11-19)

- **Showdown card-1 -> card-2 reveal & overlay close labelling (LOCKED 2026-11-19):** Extended `CardPicker` with `closeOnSelect` so `HandRoom` showdown reveal keeps the picker open from card 1 to card 2, restricted table bet chips to `state.phase === 'betting'`, removed the duplicate inner showdown heading, and replaced `palette.close` on `Dialog`/`Toast`/`PhoneSheet` scrims and close buttons with `kit.overlay.close` (`"Close"`).
- **Strategy Leak Map `unknown !== fold` & combo-count parity (LOCKED 2026-11-19):** Added `familyKnownCombosFromProjection` in `engine/personal-strategy/families.ts`; `projectStrategyLeakMap` now emits `deltaPoints: null` (`baselineCombos: null, available: true`) when `knownCombos === 0`, surfaces `openCombos` on column footers, and `LeakLab` filters `deltaPoints !== null && deltaPoints !== 0`.
- **Hebrew RTL `Choice` indicator & isolated `<PokerNotation>` (LOCKED 2026-11-19):** Pinned `Choice.module.css` `.indicator` to `top: 0; left: 0` matching `offsetLeft`, added `direction: ltr` inside `.notation`, wrapped numeric/card tokens rather than full prose in `ReviewRoom` `priceLine` and `TrainingHubView` `duelSub` via `tNodes`, widened `TableMenuSeat.subtitle` and `TableSeat.actionBubble` to `ComponentChildren`, and gave `HandRoom` `.headingGroup` `flex: 1 1 260px`.
- **Heads-up Duel honest amounts, All-in dispatch, & "any two cards" row (LOCKED 2026-11-19):** Computed exact call commitments (`computeCallCommitBb`) and pre-dealt street `potBb` on `board` history items, sourced `'allin'` preset amounts from `legalSpec.allIn.amountToMilliBb` dispatching `action.type = 'all_in'` (`action_all_in` / `formatDuelBubble`), removed redundant `{actor}` grammar (`"You calls"`), formatted `equityTitle` with `formatCardGlyph` + street, and kept the opponent equity row fixed to `"Any two cards"` (`[{ state: 'back' }, { state: 'back' }]`, `rangeLabel="any"`) even after showdown reveal.
- **Review counterfactual `method: 'auto'` & hindsight revealed-hand framing (LOCKED 2026-11-19):** Switched `reviewStore` counterfactual weighted-equity evaluation to `method: 'auto'` with `rangeSampled` dishonesty guard (`tierAssumptionSampledDetail` vs exact), and reframed `mistakeTitle`/`mistakeBody` under owner policy as **hindsight** behind-the-price comparison alongside the player's recorded thinking note and opponent range assumptions (`coachMood = 'curious'`).
- **P2 keyboard, Focus-mode, Runout loading, Nights currency/status, & copy polish (LOCKED 2026-11-19):** Guarded `RunoutExplorerPanel` loading state before marking cards `struck` and removed its duplicate `Escape` handler; moved `OptionTickets` shortcut keys to a `WeakSet`-deduped `window` listener suppressed on inputs/dialogs; added Focus-mode `useEscapeLayer` in `AppShell` and single `Focus` label in `TopBar`; added `FactTile` `unitPosition?: 'prefix' | 'suffix'` (`₪250`), fixed settled Nights status/gate copy, and scrubbed internal `TERMINOLOGY.md`, `/hand`, and `hand(s)` references from user copy.

## X. Checkpoint cleanup & #82 Inline Equity Overlay (2026-11-19)

- **Baseline index/comment alignment (LOCKED 2026-11-19):** Aligned the 3 off-by-1 entries in `engine/personal-strategy/baseline.ts` to their comments (`BTN.suited_queens_jacks: 8` (`Q3s`), `SB.suited_kings: 7` (`K5s`), `SB.suited_queens_jacks: 5` (`Q6s`)) with cutoff-to-hand-class tests in `engine/personal-strategy/personal-strategy.test.ts`.
- **Engine call-vs-required verdict & deterministic grading (`P2-2`, `P3-3`) (LOCKED 2026-11-19):** Moved the `0.05%` call-price comparison rule (`compareCallEquityToRequired`, `isExact && isCallAction`) into `engine/economics-facts.ts` and `EngineSyncApi`, replacing manual arithmetic in `src/domain/review/reviewStore.ts`. Defaulted `occurredAt` in `engine/training/grade.ts` to `'1970-01-01T00:00:00.000Z'` and injected `new Date().toISOString()` from `trainingStore.ts`.
- **Notice duration token & animation isolation (`P3-1`, `C9`) (LOCKED 2026-11-19):** Added `--dur-notice` (`2400ms`) across `tokens/`, `DurationToken`, `EquityRoom.tsx`, and `HandRoom.tsx`, and isolated rAF/interval state into `AnimatedPotValue` (`FeltTable.tsx`) and `TypedCalloutText` (`Lamp.tsx`).
- **#82 / #82a Inline Equity Overlay (LOCKED 2026-11-19):** Built pure display kit drawer `EquityOverlay` (`src/ui/kit/equity-overlay/`), extracted shared `buildRunoutHeatGridRows` (`src/ui/rooms/equity/equityFormatters.tsx`), and wired shared container `InlineEquityDrawer` (`E`/`Escape`, Worker channel cancellation, next-card stepping, `Pin to decision note`) across Review, Hand, and Training (`QuickDrillView`, `HeadsUpDuelView`), keeping equity locked while showing exact pot-odds price pre-answer in Training.

## Y. Wave 1 — Core Everyday Utility (2026-11-20)

- **Additive `handNote` & `sessionNote` storage (`schemaVersion: 1`, LOCKED 2026-11-20):** Added optional `handNote?: string` on `SavedHandPayload` / `SavedHandAnnotatedPayload` and optional `sessionNote?: string` on `NightSessionUpdatedPayload` / `NightSessionRecord` (`src/domain/storage/`), keeping IndexedDB v1 and JSON export/import `schemaVersion: 1` backward-compatible, forwarding `handNote` through `shorthandCompiler`, and matching `handNote` in Saved Library search.
- **Multiline `TextField` & Room Notes (LOCKED 2026-11-20):** Extended kit `TextField` (`src/ui/kit/input/TextField.tsx`) with `multiline?: boolean` (`rows`, `Ctrl`/`Cmd+Enter` submit, vertical token-sized resize) and wired multiline per-decision notes, hand summary notes, and game-night session notes (read-only when night is settled) across Hand, Review, and Nights.
- **Game Night real hand capture & `/hand` context handoff (LOCKED 2026-11-20):** Exposed Hero 2-card slots (`CardPicker`), 6/8 seats, Hero seat selector (`positionsForTableSize`), stack depth presets (`30–100 bb`), and hand note inside `NightsHandsView`; updated `configureFromNight` and `"Back to tonight's game"` return actions between Nights and Hand.
- **Saved Library Sticky Inspector, Grouped `Ctrl K` Palette, & Cross-Room Bridges (LOCKED 2026-11-20):** Built responsive 2-column Saved Library (`SavedLibraryView`) with a sticky `FeltTable` + notes inspector (zero nested buttons); extended `CommandPalette` (`src/ui/kit/overlay/CommandPalette.tsx`) with overlay-contrast grouped search across Rooms, Saved Hands & Notes, Learn Concepts, and Game Nights; added `returnContextSignal`, `equityStore.loadExternalMatchup`, `"Open in Equity"`, `"Back to {room}"`, and `"Drill this"` bridges across Hand, Review, Equity, and Training.

## Z. Wave 2 — Feel, Craft & Settings (2026-11-21)

- **Extended Appearance & Preferences (`riverline.appearance.v1`, LOCKED 2026-11-21):** Extended `AppearancePreferences` (`src/domain/appearance.ts`) backward-compatibly with `minimalCards`, `cornerStyle` (`sharp`/`soft`/`round`), `headingWeight` (`500`/`600`/`700`), `cardFace` (`ivory`/`white`/`slate`), `cardBack` (`forest`/`lattice`/`brass`), `accentPreset` (`default` + 6 WCAG-checked light/dark presets in `tokens/tokens.css`), `customTheme` (with live WCAG 2.1 `4.5:1` contrast evaluation), `teacherVoice` (`blunt`/`gentle`), `askBeforeVerdict`, and `shortcuts` (`palette`, `focus`, `settings`, `inlineEquity`, `fold`, `call`, `raise`, `allIn`) with `findShortcutClash` collision blocking.
- **Full 7-Section LOCKED Settings & Data Safety (`SettingsRoom`, LOCKED 2026-11-21):** Expanded `SettingsRoom` across 7 modular `SETTINGS_SECTION_IDS` tabs (`appearance`, `motion`, `teacher`, `language`, `shortcuts`, `data`, `about`) wired into `SideRail`, `TopBar`, `CommandPalette`, and `__riverlineTest.setState`. Added `getStorageCounts()` and `clearAllData()` to `StudyRepository` (`src/domain/storage/eventLog.ts`), JSON Export/Import inside Settings Data alongside `navigator.storage` persistence status/request and type-to-confirm `"Delete all data"` (`DELETE RIVERLINE DATA`), plus 18+ / RTA / Third-party licences in About & Legal.
- **Live Table Motions, Rebound Shortcuts, & `Lamp` Craft Polish (LOCKED 2026-11-21):** Wired `PlayingCard` `motion` (`'deal'`/`'flip'`/`'fold'`) and `FeltTable` `chipsToPotTrigger`/`chipsToPotSeats` into `HandRoom`, `HeadsUpDuelView`, `QuickDrillView`, and `ReviewRoom` (gated off under `motion === 'reduced'` and `minimalCards`). Switched `OptionTickets`, `InlineEquityDrawer`, and `AppShell` global shortcuts to `matchesShortcutEvent`, respected `askBeforeVerdict` and `teacherVoice` in `ReviewRoom` without altering numbers/honesty tiers, and aligned all 8 `Lamp` SVG moods (`idle`, `thinking`, `curious`, `speaking`, `approving`, `celebrating`, `stern`, `resting`) with `lamp-moods.html` using `--lamp-*`/`--dur-*`/`--ease-*` tokens only.
- **No synthesized placeholder audio (`B11`, LOCKED 2026-11-21):** Kept Riverline silent and documented audio foley status in About & Legal; real CC0 sound effects wait on licensed recording curation.

## AA. Wave 3 — Perf & Engine Foundations (2026-11-21)

- **Acyclic Rollup Bundle Splitting (`vite.config.ts`, LOCKED 2026-11-21):** Replaced the single `1,054.58 kB` bundle with an acyclic 8-chunk DAG (`index` `9.45 kB`, `vendor` `22.37 kB`, `kit-sheet` `42.22 kB`, `ui-kit` `103.51 kB`, `domain-stores` `172.56 kB`, `ui-rooms` `209.93 kB`, `engine-core` `215.54 kB`, `i18n-locales` `290.80 kB`), eliminating all `> 500 kB` and circular-chunk Rollup warnings while preserving synchronous `<App />` test rendering.
- **Streaming `onCardProgress` Runout Explorer & Suit-Isomorphism Preflop Cache (LOCKED 2026-11-21):** Added optional `onCardProgress(completedCards, totalCards, card, entry)` to `exploreRunouts` (`engine/runout-explorer.ts`) with pre-filtered candidate deck slicing, and added 24-permutation suit-isomorphism key canonicalization (`canonicalizePreflopExactHoldings` / `buildMainCacheKey` in `src/domain/equity/equityStore.ts`) so suit-equivalent preflop holdings (`AhKh vs QsQc`, `AsKs vs QhQd`, `AdKd vs QcQh`) hit one shared cache entry with seat-indexed result remapping.
- **Hand Recorder Table Rules v1 (`handRecorderStore.ts`, `HandRoom.tsx`, LOCKED 2026-11-21):** Enabled 6 or 8 seats across both presets, added configurable default stack depths (`30`, `40`, `50`, `60`, `100`, `150`, `200 bb`), ante modes (`none`, `bb_ante_1`, `per_player_0_2` backed by `GameRulesSnapshot` v2), and per-seat uneven stack overrides with a collapsible `"Table rules"` panel in `/hand`.
- **Heads-Up Duel Session Report (`HeadsUpDuelView.tsx`, LOCKED 2026-11-21):** Upgraded the end-of-match view in `/training` Heads-Up Duel into a full Session Report featuring an explicit 10-hand variance caveat, an interactive 10-hand log strip (`#1..#10`) with per-hand inspection (hole cards, street reached, board, shorthand, net `bb`), Top 3 Key Moments sorted by `|netBb|`, and Astra's observed VPIP/PFR/C-bet/fold-to-bet tendencies.

## AB. Wave 4 — High-Impact Differentiators (2026-11-21)

- **Equity `"Can I call?"` & Commitment Price Strip (`#74` / `#84`, `EquityRoom.tsx`, LOCKED 2026-11-21):** Added the `"Can I call? (Pot price & commitment)"` panel in `/equity` backed strictly by `engine.sync.duelCallFacts`, `engine.sync.minimumDefenseFrequency`, and `engine.sync.compareCallEquityToRequired` (`Exact · price only`, using `color: var(--text)` with a `2px` inline-start indicator bar so green never reads as a colour-only verdict per `C4`).
- **Blocker X-Ray (`#91`) & Runout Volatility Shape (`#94`) (`EquityRoom.tsx`, `RunoutExplorerPanel.tsx`, LOCKED 2026-11-21):** Surfaced `engine.sync.analyzeRange` (`heroRemovedKnownComboCount`, `perHeroCard` direct removals, and top 6 `mostAffectedClasses`) when Hero holds exact cards against an opponent range, and added a 3-bucket Runout Volatility Shape summary (`Upgrades +5%+`, `Bricks within 5%`, `Dangers -5%+`) above the 47-card `HeatGrid`.
- **`"What Were You Thinking?"` Assumption Mirror (`#92`, `SavedLibraryView.tsx`, LOCKED 2026-11-21):** Added the pre-reveal reason-chip mirror in Saved Library grouping active saved hands by `ThinkingReasonId` (`stealing`, `value`, `draw`, `pot_committed`, `bluff_catch`) with `"Watching · n = {count}"` below 20 samples (`C2`) and one-click filtering by thinking reason.
- **Morning-After Receipt v2 (`#86`, `NightsSettleView.tsx`, LOCKED 2026-11-21):** Added a local-only exportable text receipt in Game Night Settle with privacy toggles (`Show names`, `Show amounts`, `Show hands` up to 3 linked hands), zero player ranking, one-click clipboard copy, and `.txt` download.
