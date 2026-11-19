# Checkpoint review and performance audit

**Date:** 2026-11-17. **Scope:** `docs/prompts/REVIEW_CHECKPOINT.md` plus a read-only performance and render audit.
**State read:** the repository as it stands on disk; `docs/STATE.md` says the branch is `fix/bug-batch-b` (I did not read `.git`).
**Read-only:** no application code was changed. This file is the only thing written.

## How this was done (read this first)

- I had no shell on your computer. The `device_bash` tool did not load, so I could only list and copy files and read them.
- **Nothing in the repository was executed.** `npm run typecheck`, `npm test`, `npm run golden`, `npm run check:raw`, `npm run audit:layout` and `npm run audit:theme` are all **not run**.
- **What I ran:** `grep` over copies of the files, and one independent Python script (`bruteforce_check.py`, written from scratch, in my own scratch folder) that recomputes three golden equity figures.
- **What I only read:** everything else. Timing and GPU claims below are reasoned from code and constants, not measured. Each is marked "unmeasured".
- Staged copies covered: all `engine/` sources, all 54 test files, all stores, `App.tsx`, `src/engine-api/`, `src/domain/storage/`, 36 CSS modules, `tokens/tokens.css`, and about 25 room and kit `.tsx` files. Not copied: `docs/DECISIONS.md`, the locale catalogues, and about 40 other `.tsx` files.

---

# Part A. Checkpoint review

**Verdict:** One P1 honesty defect: the Review room labels sampled equity "Exact" and can raise a "mistake" from it. Structure is otherwise tidy. Storage and worker plumbing will not scale to a season of recorded hands. No gate was reproduced.

## Findings, most serious first

### P1-1. Review labels Monte Carlo equity "Exact" and can raise a math "mistake" from it
- **Where:** `src/domain/review/reviewStore.ts`
  - Guard: lines 90-92. `isExactResult` only checks `schemaVersion === 'equity-result/v1'`.
  - Known-cards call: lines 998-1004. `method: 'auto'`, `samples: 10_000`.
  - Verdict: lines 1019-1058. `tier: 'exact'` is hard-coded at about 1048. `isMistake = isCallAction && heroPct + 0.05 < reqPct` (lines 1042-1043) feeds `isMathMistake: isMistake` (1058).
  - Luck and EV: lines 1288-1345. Same guard (1307), `tier: 'exact'` at about 1339, then `allInLuckAndEv` is fed `equityFraction: eqFrac`.
- **Why it matters:** the engine only enumerates when the runout count is at most `EXACT_EQUITY_COMBINATION_LIMIT = 100_000` (`engine/equity.ts:45`). Past that it samples. The result carries `exact: boolean` (`engine/equity.ts:139,598`), and the review store never reads it. The Equity room does read it (`equityStore.ts:470-471`), so the room that gets it right is the Equity room.
  - A preflop decision against a revealed hand (empty board) has C(48,5) = 1,712,304 runouts, which is over the limit. It would be sampled at 10,000 trials and still be labelled Exact.
  - The 95% half-width of 10,000 samples at p = 0.5 is 0.98 points. The verdict threshold is 0.05 points. So a "mistake" can come from sampling noise.
  - This breaks `AGENTS.md` section 4: "Exact" on something sampled, and the word "mistake" only where an exact price or equity fact earns it.
- **Evidence level:** confirmed by reading the code and the arithmetic above. **Not reproduced by running.** Repro to try: record a preflop 3-bet call with the opponent's cards shown, open Review, open the Decision panel, and check the badge.
- **Smallest fix:** after the call, `if (!resp.data.exact)` then set `tier: 'estimated'` and `isMathMistake: false`. Do the same for the luck block, using `unavailable` or `estimated`. Add one test with an empty board.
- **Also check, not read:** `trainingStore.ts:1151-1160` (duel hand equity, `samples: 10000`, opponent unknown, so it is sampled). I did not read which tier the duel UI shows for it.

### P2-1. Engine clients: one Worker, many main-thread clients
- `AGENTS.md` section 8 says the engine runs in a Web Worker. Only `equityStore.ts:131` uses the default (Worker) client.
- Seven stores create their own `createEngineClient({ mode: 'inline' })`: `homeStore.ts:214`, `learnStore.ts:43`, `strategyStore.ts:83`, `nightsStore.ts:244,410`, `handRecorderStore.ts:128`, `trainingStore.ts:309`, `reviewStore.ts:130,741`.
- The heavy calls in those stores therefore run on the main thread: three Monte Carlo calls in Review (10,000 and 6,000 samples) and the duel equity (10,000 samples).
- This is one engine with many clients, so "one equity engine" still holds. It is a structure and responsiveness problem. See B3.

### P2-2. A poker verdict is computed in the domain layer, not `engine/`
- `reviewStore.ts:1037-1043` and `1167` compute `deltaVsRequiredPct` and the mistake rule from rounded numbers. `AGENTS.md` rule 3 says poker maths belongs in `engine/` behind the API.
- The inputs (`requiredRawEquity`, equity) do come from the engine. The decision rule and the 0.05 threshold do not.
- Smallest fix: move the comparison into an engine fact that also reports whether its equity was exact (this fixes P1-1 at the source).

### P2-3. SettingsRoom re-declares the Panel surface
- `src/ui/rooms/SettingsRoom.module.css:8-18` copies `Panel.module.css:2-12` (padding, background, border, radius, shadow, blur). `SettingsRoom.tsx` does not use `Panel`.
- This breaks "one component per control" and "a room never styles a kit component". The smallest fix is to use `<Panel>`.

### P2-4. Duplicate `hydrate()` calls on every room entry
- Structural as well as performance. Detail and line numbers in B1.

### P3-1. Millisecond literals in timers
- `src/ui/rooms/equity/EquityRoom.tsx:127` (`2200`) and `src/ui/rooms/hand/HandRoom.tsx:160-162` (`2400`).
- My regex found no `NNNms`, hex, `rgb()` or `cubic-bezier()` in the files I copied, so these numeric literals are probably what `check:raw` cannot see. I did not read `tools/check-no-raw-values.mjs`, so what it matches is unverified.

### P3-2. A layout property is animated
- `src/ui/rooms/home/HomeRoom.module.css:328` has `transition: block-size`. `AGENTS.md` section 10 says transform and opacity only.

### P3-3. A wall-clock default inside `engine/`
- `engine/training/grade.ts:158` defaults `occurredAt` to `new Date().toISOString()`. That is not a DOM, storage or network violation. It does make that function non-deterministic when the caller omits the value.

### P3-4. `docs/STATE.md` Checkpoints table is empty
- Add a row after you have read this. I did not touch `STATE.md`.

## What I checked and found sound
- **Test count (read):** 54 `*.test.ts(x)` files under `src/` and `engine/`, which matches "54 passed (54) files" in `STATE.md`. Pass status not reproduced.
- **Golden figures (ran):** `python3 -I bruteforce_check.py`, an independent brute-force evaluator, printed:
  - `1 flop AhKh v QsQc: runouts=990 wins=[253, 737] ties=[0, 0] ... MATCH`
  - `2 turn Js AhKh v QsQc: runouts=44 wins=[10, 34] ... MATCH`
  - `3 flop 3-way +Th9h: runouts=903 wins=[185, 690, 28] ... MATCH`
  - These are the figures asserted in `src/test/equityRoom.golden.test.ts`. That confirms the expected values are true. It does not confirm the engine produces them. I did not run the engine.
- **Engine boundary (grep):** no `window`, `document`, storage, `fetch` or `XMLHttpRequest` in the non-test `engine/` files I copied. The `window` hits are variable names (`STRAIGHT_WINDOWS`). No `Math.random`.
- **Interface to engine imports (grep):** only `src/engine-api/` imports from `engine/` (`client.ts:68`, `index.ts:159`, `engine.worker.ts:1`).
- **Tests (grep over all 54):** none read source files, snapshots, CSS modules or computed styles. A few kit tests select contract attributes (`data-tier`, `data-seat-id`, `data-strip-index`, `data-exact-value`). That is borderline against "asserts markup shape"; I left it as a judgement for you.
- **Hard nos (grep):** "Layout B" appears only in a comment (`EquityRow.tsx:60`). No "GTO", "optimal", "mastery", "streak" or "EV loss" in `src/` outside the locale files.
- **Stale-result handling (read):** `client.ts:732-770` cancels the previous request on a channel and drops stale results. It works as the architecture says.
- **Equity room badge (read):** it uses `data.exact` (`equityStore.ts:470-471`).
- **`AGENTS.md` size:** 14,633 bytes, under the 24,000 limit.
- **Dead code and temporary code (grep):** no TODO, FIXME or "temporary adapter". The hits were the shimmer loading style and `legacy_*` rule-source enums.

## What I could not check, and why
- **All six gates:** no shell on your computer. They are **not run**.
- **Checkpoint item 2 (ten numbers):** I recomputed three of ten. Pot odds, SPR, luck and the others need the engine to run.
- **Item 5 (honesty rules):** found P1-1 only. I did not audit every tier badge, and "unknown is never fold" was not exhaustively traced.
- **Item 9 (languages at 1366x768):** needs a running app and a browser.
- **Item 10 (decisions):** `docs/DECISIONS.md` (50 KB) was not read, so LOCKED decisions were not cross-checked beyond the hard-no grep.
- **Item 3 (duplicate logic):** only partial. I found the SettingsRoom panel copy. I did not diff parsers or hunt copies of small functions.
- **Item 6 (files nothing imports):** no import graph.

---

# Part B. Performance and render audit

All figures here are derived from code and constants. None are timings.

## B1. Repeated IndexedDB `readAllEvents()` across room switches

**What happens.** `readAllEvents()` (`src/domain/storage/eventLog.ts:158-174`) opens a transaction, calls `store.getAll()` on the whole events store, copies the array and sorts it by `seq`. There is no cache. The in-memory backend does the same sort (`eventLog.ts:105-107`).

**Every repository method reads everything.** There are 26 call sites inside `createStudyRepository` (lines 865-1334). That includes all 12 writers, which read the whole log only to compute `maxSeq`:

```
const existing = await backend.readAllEvents();
const maxSeq = existing.reduce((max, e) => Math.max(max, e.seq), 0);
```
(for example lines 870-871, 908-909, 928-929).

**Each derive step then sorts again.** `deriveSavedMatchups` (248-249), `deriveSavedHands` (268-272), `deriveLearnProgress` (332-333) and `deriveNightSessions` (358-362) each run `[...events].sort(...)` on an array that is already sorted. `listStrategyEvidence` (1016-1018) sorts a third time.

**Events are heavy.** A saved hand event carries the whole `pokerState` (`types.ts:66`). So `getAll()` structured-clones every saved hand even when the caller wants a Learn progress flag or strategy evidence. Cost scales with total stored bytes, not with what the room shows.

**Reads per room entry (static count):**

| Entry | Full reads | Source |
|---|---|---|
| Home | 5 (hands, matchups, evidence, training, nights; run in parallel) | `homeStore.ts:521-528`, called from `App.tsx:50` |
| Strategy | 1 per entry. 2 on the first ever entry. 2 per entry from Home | `App.tsx:52`; creation hydrate `strategyStore.ts:360`; Home path `App.tsx:291` |
| Training | 2 per hydrate (evidence and sessions). 4 per entry. 6 on the first ever entry. 4 from Home | `trainingStore.ts:854-858`; creation hydrate `:1396`; `App.tsx:54,271` |
| Nights | 2 per hydrate (nights and hands). 4 from Home | `nightsStore.ts:565-568`; `App.tsx:56,337` |
| Learn | 1 | `learnStore.ts:120` |
| Equity "Saved" tab click | 1 per click | `App.tsx:79`, `equityStore.ts:862` |
| Hand "Saved" to Review | 1 | `App.tsx:101` |

The duplicates are structural. `getSharedStrategyStore()` and `getSharedTrainingStore()` call `hydrate()` when they are created, the route effect in `App.tsx:48-60` calls it again, and the Home `onOpen*` callbacks (`App.tsx:268-340`) call it a third time before navigating. The second and third reads are the same query.

**The room-switch moment is the worst moment.** At the same time as the reads above, every `Panel` mounts with `animation: panelRise` over a blurred surface (see B2). The main thread is busy with clone, sort and derive while the compositor starts blur layers. This is a reasoned inference, unmeasured.

## B2. `backdrop-filter: blur()` GPU cost

Eight declarations in seven files:

| File:line | Blur | What it is |
|---|---|---|
| `kit/panel/Panel.module.css:11` | 14px | every Panel (used in 9 files), runs `panelRise` on mount (13, 21-30) |
| `kit/shell/SideRail.module.css:10` | 14px | side rail |
| `rooms/SettingsRoom.module.css:14` | 14px | a copy of the Panel surface (see P2-3) |
| `kit/shell/TopBar.module.css:75` | 10px | top-bar pill |
| `kit/shell/FloatingDock.module.css:14` | 18px | the dock, `position: fixed` over scrolling content |
| `kit/shell/FloatingDock.module.css:80` | 10px | dock restore pill |
| `kit/overlay/Overlay.module.css:69` | 6px | dialog scrim, full viewport |
| `kit/overlay/CommandPalette.module.css:52` | 6px | palette scrim, full viewport |

**The panel, rail and Settings blurs buy almost nothing.**
- `--panel-bg` is a 78-88% opaque gradient in the four dark themes (`tokens/tokens.css:20,159,189,221`) and fully opaque in the other three (`:250,287,364`; theme names inferred from the order in `STATE.md`).
- What sits behind the panels is `--root-bg` plus one radial glow (`AppShell.module.css:12-23`), which is close to flat. Blurring a near-flat gradient through a mostly opaque surface is close to an identity operation.

**The dock blur is the one with a real cost.** A fixed element with `backdrop-filter` over scrolling panels forces the compositor to re-read and re-blur its backdrop whenever the content under it moves. The dock is also the one place where the blur is visible, so it earns its cost more than the panels do.

**Cost mechanism (unmeasured).** Each blurred layer needs an offscreen read of its backdrop plus a blur pass. A Review screen at 1440x900 carries three Panel columns, the rail, a top-bar pill and the dock, all blurred at once. 1366x768 laptops, which `AGENTS.md` section 9 names as a target, are the likeliest to show it. Scrims stack on top of the panels' blurs when a dialog opens.

## B3. Worker equity and runout dispatch frequency

**Fan-out per recompute (`src/domain/equity/equityStore.ts:350-591`).** One recompute posts up to three jobs into a single Worker at once:
- main equity (lines 381, 15,000 samples; 60,000 when refined; `:44-47`)
- previous-street delta (382-387; on the flop the previous board is empty, so it is a second 15,000-sample job)
- runout explorer (398-413; on by default, `runoutsExpandedSignal` is `true` at line 142). `exploreRunouts` runs one baseline plus up to 52 sequential `calculate` calls (`engine/runout-explorer.ts:395-431`).

The Worker interleaves them by yielding (below), so the main result is slowed by the other two. The main answer should not wait behind a 52-row preview.

**No coalescing.** `triggerRecompute` (`equityStore.ts:593-601`) starts a recompute for every state change that reaches it. It relies on cancelling the previous run (`client.ts:732-770`), which does work, but each cancel is one more message and a restart. `AGENTS.md` says "Rapid input is coalesced".

**Progress flood.** `worker-handler.ts:225-230` always passes `onProgress`, so the Worker posts a message every 250 trials (`engine/equity.ts:46,911-913`; the weighted path batches similarly at `weighted-equity.ts:620-628`). The Equity store never subscribes (the channel executor passes only `requestId` and `signal`), so the main thread receives and discards them. By the constants:
- 15,000 samples is 60 messages; 60,000 refined is 240; an exact job at the 100,000 limit is 400.
- A flop recompute sends two main-class jobs plus up to 52 runout row messages: about 172 cross-thread messages at the default setting, none used.

**Yield cost.** `defaultYieldControl` (`engine/equity.ts:849-857`) yields with `setTimeout(resolve, 0)` every 250 trials. Browsers clamp nested `setTimeout` to at least about 4 ms after five nested levels (HTML spec behaviour, not measured here). If that clamp applies, 60 yields is at least about 240 ms of idle waiting per default job. This could be the largest fixed cost in the Worker. **Unmeasured; measure before acting.**

**Main-thread equity.** Seven stores use inline clients (P2-1), so Review's three Monte Carlo calls and the duel equity run on the main thread, yielding the same way. One shared Worker client would take them off the UI thread.

**Runout explorer UI.** Nothing is shown until all 53 calculations finish (status stays `calculating`). The rows exist incrementally inside the loop (`runout-explorer.ts:423-430`), they are just not streamed.

## B4. Unnecessary Preact signal re-renders

**Caveat:** this section assumes `@preact/signals` subscribes a component to any signal whose `.value` it reads during render. That is the library's documented behaviour; I did not run it.

1. **`t()` subscribes every translated component to all appearance changes.** `src/i18n/index.ts:36,45,90,121` use `locale = appearanceSignal.value.lang` as a default argument. Reading `.value` while rendering subscribes the caller to the whole appearance object. A theme, pace, motion, lamp or typing-speed change re-renders every mounted component that calls `t()`, not just a language change. `App.tsx:29` does the same. Rare event, low cost; trivial fix.
2. **`App` re-renders the whole room.** `App.tsx:62-261` reads store signals while building the side-rail items (badges and active tabs), then passes fresh inline callbacks into the room (`:268-340`). No component in `src/` uses `memo`, `useComputed`, or `useSignal` (the only memo is `useMemo` in `CommandPalette.tsx`). A rail-only change re-renders `AppShell` and the active room. The rooms mostly read the same signals anyway, so the gain is small. Measure first.
3. **Equity room re-renders on every snapshot flip.** `EquityRoom.tsx:47-48` reads both `equitySnapshotSignal` and `runoutSnapshotSignal` at the top. A recompute flips `calculating` then `ready` on both, so at least four whole-room renders per recompute. Each rebuilds the 52-cell grid with about 52 `t()` calls and a new `Set` (`RunoutExplorerPanel.tsx:37,60-90`). Row keys are stable (`EquityRoom.tsx:240`), so the `rowEnter` stagger does not replay.
4. **A no-op write notifies subscribers.** When runouts are collapsed or the board has no 4-card grid, every recompute writes a fresh idle object into `runoutSnapshotSignal` (`equityStore.ts:416-423`). New identity means subscribers fire with nothing changed. A single frozen idle constant would not notify.
5. **`FeltTable` re-renders per frame during the pot count-up.** `FeltTable.tsx:260-282` calls `setDisplayPot` on every animation frame for `--dur-4`, re-rendering the whole table (8 seats) each frame. Writing the text through a ref would avoid it.
6. **`Lamp` re-renders per typed character.** `Lamp.tsx:266-280` calls `setVisibleChars` on a timer, re-rendering the SVG lamp with each character. Moving the text into a small child component isolates it.

---

# Part C. Prioritized speed-fix plan (no code changed yet)

**Order of work:** measure first (C0), then the one honesty fix (C1), then speed fixes by value over risk. Gate for every item: `npm run typecheck`, `npm test`, `npm run golden`. Add `audit:layout` and `audit:theme` for the CSS items. All "effect" lines are expected, not measured.

## C0. Baseline measurement (before any change)
1. Import a realistic export (several hundred saved hands) via Settings, or generate events with `createMemoryStudyBackend`.
2. Wrap `readAllEvents` in a counting test double and record calls per `hydrate()` for Home, Strategy, Training and Nights.
3. In Chrome DevTools Performance, record a Home to Training to Strategy to Nights switch. Note main-thread time in `getAll`, sort and derive, and the GPU track.
4. Toggle `backdrop-filter` off for `.panel` in DevTools Elements and compare frame times on a 1366x768 viewport.
5. In a Worker profile, record one flop recompute with runouts open. Count `postMessage` calls and time spent in `setTimeout` yields.

## C1. Fix the "Exact" label in Review (P1-1)
- **Files:** `reviewStore.ts` (the two blocks above), plus a test with an empty board.
- **Effect:** honesty, not speed. Small, local, safe.
- **Owner confirmation:** none (inside an approved slice). Record in `DECISIONS.md`.

## C2. Cache the event log in the IndexedDB backend (biggest single win)
- **Change:** keep the sorted events array in memory inside `createIndexedDbStudyBackend` (`eventLog.ts:152-205`). `readAllEvents` returns the cache. `appendEvent` and `putManyEvents` update the cache and the store. Keep a running `maxSeq` so writers stop reading the log at all. Drop the redundant `[...events].sort` calls at 249, 272, 333, 362, 1018, with a documented invariant that the backend returns events sorted by `seq`.
- **Effect:** 26 call sites go from a full `getAll()` plus sort to a memory read. All the reads in the B1 table collapse to one.
- **Risk:** another browser tab writing the same database makes the cache stale. Add a `BroadcastChannel` message on every write that drops the cache, and handle `db.onversionchange`. Expose no mutable array.
- **Needs owner:** not a storage format or schema change, so likely not. It does touch the storage module's behaviour; mention it in the plan.
- **Verify:** `eventLog.test.ts` plus a new test that counts backend reads.

## C3. Make `hydrate()` idempotent and shared
- **Change:** each store keeps an in-flight promise, so concurrent `hydrate()` calls share one read. Remove the creation-time `void ...hydrate()` at `strategyStore.ts:360` and `trainingStore.ts:1396`, or remove the `App.tsx:48-60` effect for those routes (pick one). Keep the Home callbacks' `await hydrate().then(...)` but they now reuse the in-flight call.
- **Effect:** the 2-6 reads per entry drop to 1 before C2, and to a cache hit after C2.
- **Risk:** low. The `.then` chains at `App.tsx:271,291,337` need the data loaded first, so they must keep awaiting the shared promise.

## C4. Remove `backdrop-filter` from panel surfaces
- **Change:** delete the blur from `Panel.module.css:11`, `SideRail.module.css:10` and `SettingsRoom.module.css:14` (and use `<Panel>` in Settings, P2-3). Keep it on the dock (`FloatingDock.module.css:14`), palette and scrim for now.
- **Effect:** removes up to about five blurred layers from a typical room, and the compositor work during `panelRise` on every room switch. Visual change should be close to none because the surfaces are 78-100% opaque, but that is the owner's call.
- **Needs owner:** yes. It changes a visual pattern (`AGENTS.md` section 6.4). Run `audit:theme` across all seven themes and review screenshots.
- **Optional second step:** replace the dock blur with the opaque-ish `--dock-bg` plus shadow in the three opaque themes only if the dock still shows in the C0 trace.

## C5. Stop the equity fan-out from slowing the main answer
- **Change:** in `equityStore.recompute()`, start the runout job only after the main result arrives; or at least start it after the main job. Add a short trailing coalesce (for example one animation frame) in `triggerRecompute`. Cache previous-street deltas and recent main results by a key of players, board and samples.
- **Cache condition:** check first that the Monte Carlo sampler is seeded and returns identical results for an identical request (`monteCarloCodeRealizations` in `engine/equity.ts`; I did not read the seed handling). If it is not deterministic, only cache exact results.
- **Effect:** main equity latency drops toward its isolated time; street back-and-forth becomes instant.
- **Verify:** `equityStore.test.ts`, `equityRoom.golden.test.ts`, `npm run golden`.

## C6. Make progress messages opt-in
- **Change:** `worker-handler.ts:225-230` attaches `onProgress` only when the request asks for it (a new field on the CALCULATE message), and throttle to about 50 ms when it does.
- **Effect:** about 172 discarded messages per default flop recompute go to zero.
- **Needs owner:** yes, a change to the engine API (`AGENTS.md` section 6.1), though it is additive.

## C7. Time-slice the engine's yielding
- **Change:** in `engine/equity.ts` (911-913) and `engine/weighted-equity.ts` (620-628), yield when about 12-16 ms have elapsed, or use a `MessageChannel` yield instead of `setTimeout(0)`. Keep `batchSize` semantics for tests.
- **Effect:** removes the possible 4 ms-per-yield clamp cost (unmeasured; confirm with C0 step 5 first).
- **Risk:** result determinism must not change. `npm run golden` and the engine tests guard it.

## C8. One shared Worker client for the heavy stores
- **Change:** add a lazily created shared Worker engine client in `src/engine-api/` and make Review, Training duel and Home use it for the async calls. Keep `mode: 'inline'` for tests through the existing options.
- **Effect:** the Monte Carlo calls in Review and the duel leave the UI thread; one Worker instead of an inline handler per store.
- **Needs owner:** yes. New export and changed module surface (`AGENTS.md` section 6.1 and 6.3).

## C9. Signal and animation hygiene (small, batch together)
- `langSignal = computed(() => appearanceSignal.value.lang)` and have `t()` and `App.tsx:29` read it.
- Replace the idle object at `equityStore.ts:416-423` with a shared frozen constant.
- `FeltTable` pot count-up through a ref; `Lamp` typing text in a child component.
- Replace the `block-size` transition at `HomeRoom.module.css:328` with a transform, and move the two timer literals (P3-1) to tokens or named constants.
- **Effect:** small each. Do them only after C0 shows renders on the hot path.

## C10. Larger structural options (owner decision)
- Add a `type` index (requires bumping the database version) or split the heavy `saved_hand.*` payloads from a light index event. Needed only if C2 is not enough once the log is large.
- **Needs owner:** yes (`AGENTS.md` section 6.5, schema change).

## Owner confirmations needed
C4 (visual change), C6 and C8 (engine API surface), C10 (schema). C1, C2, C3, C5, C7 and C9 are inside an approved slice, but C5 depends on the determinism check.

## Suggested order
C0, C1, C3 (cheap), C2, C4, C5, C6, C7, C8, C9.

## Sources
- Repository files cited with line numbers above; copies were read from `C:\Users\sjzns\Projects\riverline` on 2026-11-17.
- Independent check: `bruteforce_check.py` (my own script, Python 3.13, run with `python3 -I`), output quoted in Part A.
