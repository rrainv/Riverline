# Riverline: founding document (running draft, 2026-11-10)

Status: built live in conversation with the owner. Anything marked (proposal) is not yet confirmed. The old repo and its decisions stay as the archive and safety net.

## 1. Purpose and success
Riverline exists to help people get better at poker, and it must be an app people use by choice, regularly, because they enjoy it (the Duolingo kind of pull, without streak pressure). Game nights and everything else support learning.
Success in a year: the owner studies with it weekly by choice; the game-night group uses it and Friday's hands get reviewed on Saturday; a stranger can install it, trust its numbers and the owner is proud to show it.

## 2. Principles
- Never overpromise. Every number says where it comes from and how sure it is. Use only sources we can rely on; improve the maths, sources and solvers over time.
- No real-time assistance: it is a study tool, never advice for use during real play. No real-money play. 18+ notices stay.
- Free forever for everything local. Donations or paid extras only for things that cost money to run (sync, online rooms); paid options never limit features.
- The teacher is blunt, and its claim strength matches its evidence (section 7).

## 3. Platform and code base
- A NEW repo with the proven "engine" copied in (poker maths, Monte Carlo, strategy, training, personal strategy, saved objects, accounts, game night, sync, language catalogs). The old repo stays untouched as fallback and archive. The big UI file is mined, not ported.
- Web-first (installable), desktop-first design (big screen, keyboard, density). Phone layouts come after. A thin desktop wrapper is an optional later step. (proposal)
- The engine sits behind an async API in workers so heavy maths can move to WASM/Rust later and the same engine serves web, desktop and phone. (proposal)
- UI stack: Preact + signals + Vite, TypeScript for new code, plain CSS from the mockups. (proposal, to be tested by the first slice)

## 4. Design
- The mockups are about 90 to 95 percent right in look and motion. The failure was the translation from mockup to app, not the design.
- New method: the mockup's own HTML/CSS/animation becomes the app's starting code (port, do not redraw); an automatic pixel-diff fidelity gate for signature screens; demo data so screens look as in the mockups. (proposal)
- Before building, the owner wants to EXPLORE new shell directions (several clickable artifacts, same sample screens) and to design and redesign the pillar features. Each pillar gets a promise and three signature moments first, then mockups the owner can feel.
- Not generic, not AI-looking: premium, natural, human, alive, with smooth motion.
- DESIGN RULE #1 (owner): almost no dead space. Every pixel useful and the layout makes sense; every region must answer a question. Tested on every screen at 1920 and 1366.

## 5. Workflow (the biggest pain)
- Less ceremony: pre-approved routine actions, CI as the gate, auto-merge on green, reports in the repo, the manager chat only for decisions and design. (proposal)
- Default to cheaper models; accept about 75 percent polish on non-signature screens; Opus only for hard architecture and design.
- Bugs go into one inbox and are fixed on a schedule by a cheap model. No emergency patches while there is no live product (exceptions once friends use it: data loss, wrong money, false numbers).

## 6. Release and business model
Community first, then public. Web app now, native later if it earns it. Free; donations or extras that never gate features.

## 7. Pillar 1: Personal Strategy and the Teacher
Promise: Riverline knows how you actually play, and why, and teaches you from that.
- Data comes from inside the app (Training, Full Hand, Analyze, the teacher's questions); an import door may come later.
- Three layers stay separate: what you intend (your plan), what you do (your play), what is sound (the baseline, with its confidence).
- The teacher understands first, then offers: questions, a manual matrix painter (three states: yours, baseline, unknown), "play this hand through for me" flop to river, and "what were you thinking?" capture. It never interrupts; it offers one next-lesson card.
- Pattern catalogue (grows): range width per position and per hand family (suited kings, offsuit queens and jacks, suited connectors and one-gappers, low pairs, offsuit aces, weak broadways); same range in every position; 3-bet, limp and big-blind defence habits; overbluffing (river bluff share against the balanced share for the bet size, multiway fold requirements, bluffing without equity or blockers, barrel discipline); sizing habits (one size for everything, sizes that reveal strength, ignoring stack depth); calling down too light, over-folding, price mistakes, set-mining at shallow stacks. Reading and timing tells are table-side and out of scope; range reasoning is trainable.
- Voice: blunt and direct, about the play and never the person. Claim strength follows the evidence tier: Exact ("that call was minus EV: you needed 34 percent and had 21"), Verified ("outside the reference range for this spot"), Estimated with a large gap and a large sample ("this is almost certainly costing you money"), small samples ("watch this"). The word "mistake" is used only where evidence earns it. It acknowledges context (a wide range can be exploitative against weak players) and asks about your table.
- Signature moments (proposal): the Leak Map (hand family by position, coloured by deviation from the baseline with sample size); a teacher card that shows a spot from your own play with the numbers; the "why did you do that" tap and the teacher adapting.

## 8. Pillar 2: Equity
Promise: ask any "what are my chances?" question and understand why.
- Players as ROWS (owner's pick; it was the mockup with the least dead space): cards, range or unknown, equity bar, win, tie, combos, outs, in a dense table, with live side panels instead of separate tabs.
- Real calculations: exact when cheap, simulated with a stated margin otherwise; 2 to 10 players; hand vs hand, vs range, range vs range, unknown opponents. Equity is not EV, and it says so.
- Runouts explained: every turn and river card coloured by the equity change; how many cards help you and which; clean and dirty outs; drawing dead (and dead to a chop); cards that pair the board or complete a flush; what happens if a card lands (click it, see who leads and what each player now needs); multiway equity per player and the hand categories each player ends with.
- More ideas (proposal): equity distribution of a hand against a range; range vs range on a board as a heat map on the 13 by 13 matrix; blockers and removal view (ties to bluff teaching); a "can I call?" panel (required equity against actual, exact price-only label); send to or from Analyze, Review and Training; an equity-intuition trainer.
- The current Equity is replaced entirely. The engine's calculators stay.

## 9. Players behind (position, extended)
"How many players are left to act behind me" is a first-class fact everywhere (owner): it drives bluffing, stealing, squeezing and the value of position. It is shown in Analyze's spot sentence and in Personal Strategy's spot map, feeds the baseline and the teacher's bluff and multiway maths, and (proposal) is the table-size-independent way to define situations, because home games vary between 6 and 8 handed.

## 10. One hand format, readable and writable
Every hand is the same canonical object with replay: played against bots, reconstructed from memory, captured at a game night, or (later) imported. The owner wants to WRITE into that system, not only read: a fast hand recorder (table taps, "everyone folds to", size presets, unknown cards allowed and labelled, approximate sizes flagged), reason notes per decision ("what was I thinking"), and hands attached to a game night. Results and money are recorded too. Recorded hands feed Review and the teacher exactly like played ones.

## 11. Pillar 3: Training
The current modes are good and stay: quick drill and Full Hand. New: a DEDICATED heads-up duel (1v1 against a bot, full hands, its own screen and session result). More modes where poker allows, each aimed at understanding what you do and why (proposals: leak scan and leak labs from the teacher, bluff-or-give-up lab, sizing lab, range recall, range reasoning "what does this line represent", equity intuition, "explain yourself" hands). Requirement: a heads-up mode is only worth building with a believable, card-aware bot; bot quality is part of this pillar. Heads-up is also the format with the best free references, so its numbers can be the most trustworthy.

## 12. Alive
Sound, visible progress, a lot of animation, strong motion design, good colour, and a layout that itself feels alive (no dead space, live data, real transitions). A character exists but is MORE SERIOUS than a mascot (direction to be explored in mockups).

## 14. Review (signature screen)
- Headline line on every hand: "Hero did X (folded / showdown / all-in), total −XXbb". This is the physical result everything else is measured against.
- Then: decisions vs luck (the same equity engine as the Equity pillar), the two or three key moments, the teacher's blunt take on the decisions, and a "what would you do differently?" prompt that writes back into the hand record.
- Architecture rule: ONE canonical outcome model and ONE equity engine. Equity, Review's luck analysis, Training grading and the teacher's price maths all consume them; no screen rebuilds its own maths.

## 15. Progress and rewards
- Skill progress answers "am I getting better?" honestly: leaks closed, ranges tightening toward the baseline, sizing variety, well-chosen bluffs. It is built from the teacher's evidence, so it can't be inflated by repeating easy drills.
- Effort layer: stickers and XP for study, with diminishing returns on repeated easy work. Shown separately from skill, never mixed into it.
- Achievements stay and are a cool part of the app. They are tied to real study outcomes ("closed your first leak", "ran a full Leak Scan", "won a 10-hand heads-up duel without going broke"). Reaching for one should always mean learning something.
- Stickers and XP may be a reworked version of today's; the principle holds, not the current implementation.

## 17. Home
- Opens with what matters now: resume where you stopped; one next lesson from the teacher; a snapshot of the Leak Map; the last game night.
- Dead space is filled with OFFERS, a "try this" or "see what to improve" line for every mode, so the app advertises itself through use.
- Rule for offers (owner's design rule #1 applied to content): every offer names a specific reason from YOUR data ("you haven't tested your big-blind defence yet: 10-minute lab"), never a generic promo ("try the duel!"). If there is no reason, the region shrinks instead of being filled. Offers never gate or nag, and each can be dismissed for good.
- Consistent with "never overpromise": an offer that promises an outcome must say what it measures.

## 18. Game night
- Game night is for RECORDING, not playing. Results, money, buy-ins, rebuys and settlement, plus the hands worth keeping.
- Live table tracking is part of the recorder: the same hand writer used for Full Hand and for hands recorded at the table, so there is one hand format and one entry method (owner: "why not, it's the same thing").
- Recorded hands flow into Review and the teacher without extra steps. Settlement stays ("Dan owes Eli 40"), made to feel better.
- Friends: they can see results and their own cards only if they choose to. This is a later decision, not in the first version.

## 19. Learn and onboarding
- The teacher adapts: it learns about you first (experience, the games you play, what you already know) and then shapes the path. No mandatory poker course for players who already play.
- First session = a short diagnostic that doubles as a first lesson (see Leak Scan in section 7), so the first screen already shows something true about your game.
- Learn is a place to explore and practise concepts on demand. Onboarding never blocks the app; everything is skippable and returns later.

## 20. Friends
- Later. The app is a personal study tool with game-night recording first. Social features (sharing hands, friends seeing results) wait until the core is loved. No account or social design work now.

## 21. Pillars still to design
The character (serious direction), the shell (the big open question: three or more directions to feel, not a commitment yet).
