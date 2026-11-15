# Engine API Contract (`src/engine-api` & `engine/`)

**Status:** Draft for owner confirmation (Session F3). No TypeScript implementation begins until the owner confirms F3 module scope and this API surface.

## 1. Architecture & Boundaries

- **`engine/`**: Pure strict TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`, no `any`). Zero access to DOM, `window`, `document`, storage (`localStorage`, `IndexedDB`), `fetch`, or unseeded randomness. All canonical poker amounts use integer `milliBb` (`1 bb = 1000 milliBb`).
- **`src/engine-api/`**: Thin typed client running heavy computations in a dedicated Web Worker (`engine/worker.ts`) while exposing deterministic $O(1)$ arithmetic, state transitions, and evaluator primitives synchronously through the same client surface.
- **`src/i18n/` + `src/ui/`**: Pure locale number formatting/parsing (`locale-number-format`) lives outside `engine/` (presentation layer in `src/i18n/`), and the DOM input binder (`locale-number-input`) stays in UI/i18n code so `engine/` remains 100% DOM-free.

## 2. Uniform Envelope, Honesty Tiers & Metadata

Every call on `src/engine-api` returns a typed result envelope (never bare numbers without tier/method provenance):

```ts
export type FactTier = 'exact' | 'verified' | 'estimated' | 'unavailable';

export type FactQualifier =
  | 'price_only'
  | 'known_cards'
  | 'partial_known_mass'
  | 'sampled';

export type ComputationMethod =
  | 'exact_enumeration'
  | 'monte_carlo'
  | 'canonical_rules'
  | 'heuristic_baseline'
  | 'unavailable';

export interface EngineSuccess<T> {
  readonly ok: true;
  readonly requestId: string;
  readonly tier: Exclude<FactTier, 'unavailable'>;
  readonly qualifier?: FactQualifier;
  readonly method: Exclude<ComputationMethod, 'unavailable'>;
  readonly data: T;
}

export interface EngineFailure {
  readonly ok: false;
  readonly requestId: string;
  readonly tier: 'unavailable';
  readonly method: 'unavailable';
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
  };
}

export type EngineResponse<T> = EngineSuccess<T> | EngineFailure;
```

- **No numeric confidence:** Tiers are strictly `exact | verified | estimated | unavailable`.
- **Monte Carlo disclosures:** Any `monte_carlo` result includes `seed: number`, `samplesRequested: number`, `samplesCompleted: number`, and per-player `margin95: number` (95% half-width `1.96 * Math.sqrt(sampleVariance / trials)` computed in `engine/`).
- **Unknown stays unknown:** Hidden hole cards (`poker-hidden-hole-cards/v1`) and `unknown` range combos (`holdem-weighted-range/v1`) are never coerced to fold, zero, or dropped silently; when partial ranges use `'known_only'` conditioning, `qualifier: 'partial_known_mass'` and `conditionalOnKnownMass: true` are returned.

## 3. Request IDs, Cancellation & Worker Transport

```ts
export interface AsyncCallOptions {
  readonly requestId?: string;
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: {
    readonly completed: number;
    readonly total: number;
    readonly fraction: number;
  }) => void;
  readonly batchSize?: number;
}
```

- Every async worker request carries a unique `requestId` (`string`). Calling `client.cancel(requestId)` or aborting `signal` posts `{ type: 'engine/cancel', requestId }`; the worker cooperatively checks abort status every `batchSize` iterations (`yieldControl`) and halts cleanly.
- A channel helper (`client.createChannel(name)`) tracks the latest `requestId` per UI panel/slot, cancels superseded requests automatically, and drops stale responses before any store/UI state updates.
- **Worker copy discipline:** Large `1,326`-entry range objects are sent once per top-level request and never echoed inside progress updates or per-card runout rows (`runout-explorer` strips `recipe` and per-combo `provenance` from sub-rows).
- **Seeded randomness:** Every stochastic routine accepts an explicit uint32 `seed` (default `DEFAULT_EQUITY_SEED = 0x6d2b79f5`) using the ported deterministic PRNG (`createSeededRandom`).

## 4. Typed API Surface (`EngineClient`)

### 4.1 Synchronous Cheap Arithmetic & Canonical Rules (`client.sync`)

All calls execute synchronously on the main thread with zero worker round-trip and return `EngineResponse<T>` (`tier: 'exact'`):

- **Decision economics & quick math (`qualifier: 'price_only'`):**
  - `potOdds(callAmountMilliBb, actorContestablePotAfterCallMilliBb)` -> `{ requiredRawEquity, requiredPercent }`
  - `actorCallEconomics(state, actorPlayerId)` -> `PokerActorCallEconomicsV1`
  - `actionSizeFacts(state, actorPlayerId, amountToMilliBb)` -> `{ potShare, sprAfterCalled }` *(pending owner confirmation to include from `origin/wip/TRAINING-FULLHAND-001`)*
  - `stackToPotRatio(context)` / `minimumDefenseFrequency(context)`
  - `allInLuckAndEv(input)` -> `{ expectedShareBb, handEvBb, callVsFoldEvBb, runoutLuckBb }` (exact EV vs luck decomposition when cards are known)
- **Evaluator & hand categories:**
  - `evaluateHand(cards)` (5, 6, or 7 cards) -> `PokerHandRankV1` (`category`, `categoryRank`, `tiebreakers`, `bestFiveCards`, `score`)
  - `compareHandRanks(left, right)` -> `-1 | 0 | 1`
- **Hand state machine & accounting:**
  - `createGameRulesSnapshot(...)` / `validateGameRulesSnapshot(...)`
  - `initializeHand(...)` / `initializeHandFromGameRulesSnapshot(...)` / `initializeRecordedHand(...)`
  - `legalActions(state)` -> `LegalActionSpec` (all sizes wager-to in `milliBb`)
  - `applyAction(state, action)` / `applyChance(state, chance)` / `applyPrivateReveal(state, revealEvent)`
  - `resolveShowdown(state)` / `applyRecordedSettlement(state, evidence)`
  - `derivePotAccounting(state)` / `isChipConserved(state)` / `validatePokerState(state)`
- **Ranges & combos:**
  - `createWeightedRangeFromHandClasses(...)` / `createWeightedRangeFromEntries(...)`
  - `conditionRange(range, deadCards)` -> keeps inclusion weight, action probability, conditioned reach, and uncertainty (`unknownCombos`, bounds) strictly separate.
- **Privacy fences** *(scope confirmation requested for F3 vs deferred slice)*:
  - `projectOpponentInformation({ pokerState, actorSeat, ownCards })` (allowlist only; never a redacted `PokerState`)
  - `projectReplayState(source, stepIndex)` / `isHandInProgressEmbargoed(state)`

### 4.2 Asynchronous Worker Calls (`client.async`)

- **`estimateEquity(request)`**: Returns `{ combinations, combinationsText, exactFeasible, exactLimit }` (`exactLimit = 100_000`).
- **`calculateEquity(request, opts)`**: Accepts `EquityRequestV1` (known cards + `null` unknown hands) or `WeightedEquityRequestV1` (known cards, `'uniform_unknown'`, weighted ranges). When `method === 'auto'`, uses `'exact_enumeration'` if `combinations <= exactLimit` (`tier: 'exact'`), otherwise seeded `'monte_carlo'` (`tier: 'estimated'`, with `seed`, `samples`, `margin95`). Joint sampling rejects colliding tuples rather than sequentially renormalizing.
- **`exploreRunouts(request, opts)`**: Computes baseline + per-turn/river card equity, equity deltas, hand category improvements, and card removal counts (`qualifier: 'known_cards'` or `'sampled'`).
- **`resolveShowdownAsync(state)`**: Optional async worker route for batch showdown resolution.
- **`lookupStrategy(context, opts)`** *(pending owner scope confirmation)*:
  - Returns `StrategyResultV1` with `tier: 'estimated'` (heuristic baseline) / `'verified'` (licensed reference within coverage) / `'unavailable'` + provenance.
  - **Question for owner:** Implement in F3 by rewriting `app/src/strategy/*` + `decision-context` + `strategy-provider`, or keep stubbed as `tier: 'unavailable'` (`code: 'deferred_to_strategy_slice'`) until the Strategy slice?
- **`generateTrainingDrill(request, opts)` & `gradeTrainingAnswer(input)`** *(pending owner scope confirmation)*:
  - Generates deterministic seeded drill scenarios and grades chosen actions via `strategy-truth/v1` without conflating heuristic disagreement with `'mistake'`.
  - **Question for owner:** Implement in F3 or keep stubbed as `tier: 'unavailable'` (`code: 'deferred_to_training_slice'`) until the Training slice?

## 5. Preserved Versioned Data Contracts

All schemas carried over from `shared/poker-domain/` keep their exact version tags and JSON shapes unless the owner approves a migration:

- `poker-state/v1`, `poker-state/v2`, `poker-state/v3`
- `poker-action/v1`, `poker-action-record/v1`
- `poker-pot-layer/v1`, `poker-pot-layer/v2`, `poker-unmatched-contribution/v1`
- `poker-actor-call-economics/v1`, `poker-hand-rank/v1`, `poker-showdown-layer-result/v1`
- `poker-hidden-hole-cards/v1`, `recorded-hand-settlement/v1`
- `game-rules-definition/v1|v2`, `game-rules-snapshot/v1|v2`, `game-rules-preset/v1`
- `equity-request/v1`, `equity-result/v1`, `equity-error/v1`, `equity-estimate/v1`
- `weighted-equity-request/v1`, `weighted-equity-result/v1`
- `holdem-weighted-range/v1`, `holdem-range-provenance/v1`, `holdem-conditioned-range/v1`
- `locale-number-format/v1`, `locale-number-input/v1`
