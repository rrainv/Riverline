import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals';
import {
  EQUITY_REQUEST_SCHEMA_VERSION,
  getSharedEngineClient,
  HOLDEM_DECK,
  WEIGHTED_EQUITY_REQUEST_VERSION,
  type DispatchableEquityRequest,
  type DispatchedEquityResult,
  type EngineChannel,
  type EngineClient,
  type EngineResponse,
  type EquityHandAnalysisProjection,
  type EquityPlayerResult,
  type RunoutEffectGroup,
  type RunoutExplorerOutcome,
  type RunoutExplorerResult,
  type RunoutRow,
  type WeightedEquityPlayerResult,
  type WeightedEquityRequestInput,
} from '../../engine-api';
import {
  normalizeDeadCardSet,
  parsePlayerHandInput,
  type ParsePlayerHandResult,
} from '../shorthand';
import {
  getDefaultStudyRepository,
  type EquityStreet,
  type SavedMatchupPayload,
  type SavedMatchupRecord,
  type StudyRepository,
} from '../storage';
import type {
  EquityCalculationSnapshot,
  EquityComputedPlayer,
  EquityDensity,
  EquityPlayerEntry,
  EquityPresetId,
  RunoutCalculationSnapshot,
  RunoutGroupedBucket,
} from './types';

export const DEFAULT_INTERACTIVE_SAMPLES = 15_000;
export const REFINED_INTERACTIVE_SAMPLES = 60_000;
export const DEFAULT_RUNOUT_SAMPLES = 500;
export const REFINED_RUNOUT_SAMPLES = 1_500;

import {
  computePostflopRangeBreakdown,
  filterWeightedRangeByBuckets,
  filterWeightedRangeByBucketWeights,
  RANGE_BREAKDOWN_BUCKET_ORDER,
  type RangeBreakdownBucketId,
} from './rangeBreakdown';
import {
  buildMainCacheKey,
  canonicalizePreflopExactHoldings,
  EMPTY_CATEGORIES,
  IDLE_RUNOUT_SNAPSHOT,
  isExactOrMcResult,
  isWeightedResult,
  MAX_EQUITY_CACHE_SIZE,
} from './equityHelpers';
export { canonicalizePreflopExactHoldings, buildMainCacheKey };
export interface EquityStore {
  readonly engine: EngineClient;
  readonly repository: StudyRepository;
  readonly boardSignal: Signal<readonly string[]>;
  readonly streetSignal: Signal<EquityStreet>;
  readonly turnCardSignal: Signal<string | null>;
  readonly riverCardSignal: Signal<string | null>;
  readonly playersSignal: Signal<readonly EquityPlayerEntry[]>;
  readonly draftInputSignal: Signal<string>;
  readonly submitAttemptedErrorSignal: Signal<string | null>;
  readonly runoutsExpandedSignal: Signal<boolean>;
  readonly riverDistExpandedSignal: ReadonlySignal<boolean>;
  readonly riverDistManualOverrideSignal: Signal<boolean | null>;
  readonly refinedSamplesSignal: Signal<boolean>;
  readonly randomKeepHeroSignal: Signal<boolean>;
  readonly randomKeepVillainsSignal: Signal<boolean>;
  readonly randomKeepBoardSignal: Signal<boolean>;
  readonly potBeforeBetBbSignal: Signal<number>;
  readonly betToCallBbSignal: Signal<number>;
  readonly remainingStackBbSignal: Signal<number>;
  readonly savedMatchupsSignal: Signal<readonly SavedMatchupRecord[]>;
  readonly activeSideTabSignal: Signal<'matchup' | 'saved'>;
  readonly rangeFilterBucketsSignal: Signal<Readonly<Record<string, readonly RangeBreakdownBucketId[]>>>;
  readonly rangeBucketWeightsSignal: Signal<
    Readonly<Record<string, Partial<Record<RangeBreakdownBucketId, number>>>>
  >;
  readonly equitySnapshotSignal: Signal<EquityCalculationSnapshot>;
  readonly handProjectionSignal: Signal<EquityHandAnalysisProjection | null>;
  readonly runoutSnapshotSignal: Signal<RunoutCalculationSnapshot>;
  readonly densitySignal: ReadonlySignal<EquityDensity>;
  readonly customDeadCardsSignal: Signal<readonly string[]>;
  readonly deadCardsSignal: ReadonlySignal<readonly string[]>;
  readonly draftPreviewSignal: ReadonlySignal<ParsePlayerHandResult>;
  readonly effectiveBoardSignal: ReadonlySignal<readonly string[]>;
  addPlayer(rawInput?: string): boolean;
  updatePlayerInput(id: string, rawInput: string): boolean;
  setPlayerCard(id: string, slotIndex: 0 | 1, card: string): boolean;
  removePlayer(id: string): void;
  setRandomKeep(key: 'hero' | 'villains' | 'board', value: boolean): void;
  randomizePlayer(id: string): void;
  randomizeVillains(): void;
  randomizeMatchup(targetStreet?: 'preflop' | 'flop' | 'turn' | 'river'): void;
  setBoardCards(cards: readonly string[]): void;
  setBoardSlotCard(slotIndex: number, card: string | null): void;
  clearBoard(): void;
  addDeadCard(card: string): void;
  removeDeadCard(card: string): void;
  clearDeadCards(): void;
  dealRandomBoard(targetStreet?: 'current' | 'flop' | 'turn' | 'river'): void;
  setStreet(street: EquityStreet): void;
  selectRunoutCard(card: string): void;
  clearRunoutSelection(): void;
  stepBackWithEscape(): boolean;
  setDraftInput(value: string): void;
  setRunoutsExpanded(expanded: boolean): void;
  setRiverDistExpanded(expanded: boolean): void;
  setRefinedSamples(refined: boolean): void;
  refreshSavedMatchups(): Promise<void>;
  saveCurrentMatchup(): Promise<SavedMatchupRecord | null>;
  loadSavedMatchup(record: SavedMatchupRecord): void;
  loadExternalMatchup(input: {
    readonly board: readonly string[];
    readonly players: readonly {
      readonly label: string;
      readonly rawInput: string;
      readonly isHero: boolean;
    }[];
    readonly potBeforeBetBb?: number;
    readonly betToCallBb?: number;
    readonly remainingStackBb?: number;
  }): void;
  archiveSavedMatchup(objectId: string): Promise<void>;
  applyPreset(preset: EquityPresetId): void;
  toggleRangeBreakdownBucket(playerId: string, bucketId: RangeBreakdownBucketId): void;
  cycleRangeBreakdownBucketWeight(playerId: string, bucketId: RangeBreakdownBucketId): void;
  setRangeBreakdownFilter(playerId: string, buckets: readonly RangeBreakdownBucketId[] | null): void;
  recompute(): Promise<void>;
  dispose(): void;
}

export function createEquityStore(options: {
  readonly engine?: EngineClient;
  readonly repository?: StudyRepository;
  readonly autoCompute?: boolean;
} = {}): EquityStore {
  const engine = options.engine ?? getSharedEngineClient();
  const repository = options.repository ?? getDefaultStudyRepository();
  const autoCompute = options.autoCompute ?? true;

  const boardSignal = signal<readonly string[]>(['Qh', '7c', '2h']);
  const streetSignal = signal<EquityStreet>('flop');
  const turnCardSignal = signal<string | null>(null);
  const riverCardSignal = signal<string | null>(null);
  const playersSignal = signal<readonly EquityPlayerEntry[]>([]);
  const draftInputSignal = signal<string>('');
  const submitAttemptedErrorSignal = signal<string | null>(null);
  const runoutsExpandedSignal = signal<boolean>(true);
  const riverDistManualOverrideSignal = signal<boolean | null>(null);
  const refinedSamplesSignal = signal<boolean>(false);
  const randomKeepHeroSignal = signal<boolean>(false);
  const randomKeepVillainsSignal = signal<boolean>(false);
  const randomKeepBoardSignal = signal<boolean>(false);
  const potBeforeBetBbSignal = signal<number>(12);
  const betToCallBbSignal = signal<number>(6);
  const remainingStackBbSignal = signal<number>(40);
  const savedMatchupsSignal = signal<readonly SavedMatchupRecord[]>([]);
  const activeSideTabSignal = signal<'matchup' | 'saved'>('matchup');
  const rangeFilterBucketsSignal = signal<Readonly<Record<string, readonly RangeBreakdownBucketId[]>>>({});
  const rangeBucketWeightsSignal = signal<
    Readonly<Record<string, Partial<Record<RangeBreakdownBucketId, number>>>>
  >({});
  const customDeadCardsSignal = signal<readonly string[]>([]);
  const handProjectionSignal = signal<EquityHandAnalysisProjection | null>(null);

  const riverDistExpandedSignal = computed(() => {
    if (riverDistManualOverrideSignal.value !== null) {
      return riverDistManualOverrideSignal.value;
    }
    // Spec §4: at 6-10 players collapse secondary left-column panel until asked
    return playersSignal.value.length < 6;
  });

  const densitySignal = computed<EquityDensity>(() => {
    const count = playersSignal.value.length;
    if (count >= 6) return 'compact';
    if (count >= 3) return 'dense';
    return 'roomy';
  });

  const effectiveBoardSignal = computed<readonly string[]>(() => {
    const board = boardSignal.value;
    const street = streetSignal.value;
    const turn = turnCardSignal.value;
    const river = riverCardSignal.value;
    if (street === 'preflop') return [];
    const flop = board.slice(0, 3);
    if (flop.length < 3) return board;
    if (street === 'flop') return flop;
    const resolvedTurn = turn ?? board[3] ?? null;
    if (!resolvedTurn) return flop;
    if (street === 'turn') return [...flop, resolvedTurn];
    const resolvedRiver = river ?? board[4] ?? null;
    if (!resolvedRiver || resolvedRiver === resolvedTurn) return [...flop, resolvedTurn];
    return [...flop, resolvedTurn, resolvedRiver];
  });

  const deadCardsSignal = computed<readonly string[]>(() => {
    const cards = new Set<string>(customDeadCardsSignal.value);
    for (const c of effectiveBoardSignal.value) cards.add(c);
    for (const p of playersSignal.value) {
      if (p.cards) {
        cards.add(p.cards[0]);
        cards.add(p.cards[1]);
      }
    }
    return [...cards];
  });

  const draftPreviewSignal = computed<ParsePlayerHandResult>(() => {
    return parsePlayerHandInput(draftInputSignal.value, {
      deadCards: deadCardsSignal.value,
      engine,
    });
  });

  const equitySnapshotSignal = signal<EquityCalculationSnapshot>({
    status: 'idle',
    method: 'exact',
    partial: false,
    trials: 0,
    maxMargin95Pct: 0,
    players: {},
  });

  const runoutSnapshotSignal = signal<RunoutCalculationSnapshot>(IDLE_RUNOUT_SNAPSHOT);

  const equityChannel: EngineChannel<unknown> = engine.createChannel('equity-main');
  const prevChannel: EngineChannel<unknown> = engine.createChannel('equity-prev');
  const runoutsChannel: EngineChannel<RunoutExplorerOutcome> = engine.createChannel('equity-runouts');
  const equityCache = new Map<string, EngineResponse<DispatchedEquityResult>>();
  let playerCounter = 0;
  let suppressRecompute = false;
  let inApplyPreset = false;
  let activePreset: EquityPresetId | null = null;
  let recomputeNonce = 0;
  let recomputeQueued = false;
  let disposed = false;

  function cacheKeyForRequest(request: DispatchableEquityRequest): string {
    return buildMainCacheKey(request);
  }

  function getCachedEquity(key: string): EngineResponse<DispatchedEquityResult> | undefined {
    const hit = equityCache.get(key);
    if (!hit) return undefined;
    equityCache.delete(key);
    equityCache.set(key, hit);
    return hit;
  }

  function setCachedEquity(key: string, response: EngineResponse<DispatchedEquityResult>): void {
    if (!response.ok) return;
    if (equityCache.has(key)) {
      equityCache.delete(key);
    } else if (equityCache.size >= MAX_EQUITY_CACHE_SIZE) {
      const oldestKey = equityCache.keys().next().value;
      if (oldestKey !== undefined) equityCache.delete(oldestKey);
    }
    equityCache.set(key, response);
  }

  function makeEntry(
    rawInput: string,
    isHero: boolean,
    label: string,
    deadCards: readonly string[],
    id?: string,
  ): EquityPlayerEntry | null {
    const parsed = parsePlayerHandInput(rawInput, { deadCards, engine });
    if (!parsed.ok) return null;
    playerCounter += 1;
    const entryId = id ?? (isHero ? 'hero' : `villain-${playerCounter}`);
    if (parsed.kind === 'exact') {
      return {
        id: entryId,
        label,
        isHero,
        rawInput,
        inputKind: 'exact',
        canonical: parsed.canonical,
        cards: parsed.cards,
        totalCombosBefore: 1,
        eligibleCombos: 1,
        removedCombos: 0,
      };
    }
    if (parsed.kind === 'any') {
      return {
        id: entryId,
        label,
        isHero,
        rawInput,
        inputKind: 'any',
        canonical: parsed.canonical,
        totalCombosBefore: 1326,
        eligibleCombos: parsed.eligibleCombos,
        removedCombos: parsed.removedCombos,
      };
    }
    return {
      id: entryId,
      label,
      isHero,
      rawInput,
      inputKind: 'range',
      canonical: parsed.canonical,
      handClasses: parsed.handClasses,
      weightedRange: parsed.weightedRange,
      totalCombosBefore: parsed.totalCombosBefore,
      eligibleCombos: parsed.eligibleCombos,
      weightedEligibleCombos: parsed.weightedEligibleCombos,
      hasPartialWeights: parsed.hasPartialWeights,
      removedCombos: parsed.removedCombos,
    };
  }

  function initDefaultMatchup(): void {
    playerCounter = 0;
    const board = ['Qh', '7c', '2h'];
    const hero = makeEntry('AhKh', true, 'Hero', board, 'hero')!;
    const v1 = makeEntry('QsQc', false, 'Villain 1', [...board, 'Ah', 'Kh'], 'villain-1')!;
    boardSignal.value = board;
    streetSignal.value = 'flop';
    turnCardSignal.value = null;
    riverCardSignal.value = null;
    playersSignal.value = [hero, v1];
  }

  initDefaultMatchup();

  function buildDispatchRequest(
    players: readonly EquityPlayerEntry[],
    board: readonly string[],
  ): DispatchableEquityRequest {
    const hasRange = players.some((p) => p.inputKind === 'range');
    const samples = refinedSamplesSignal.value
      ? REFINED_INTERACTIVE_SAMPLES
      : DEFAULT_INTERACTIVE_SAMPLES;

    if (!hasRange) {
      return {
        schemaVersion: EQUITY_REQUEST_SCHEMA_VERSION,
        board: [...board],
        deadCards: [...customDeadCardsSignal.value],
        method: 'auto',
        samples,
        players: players.map((p) => ({
          id: p.id,
          cards: p.inputKind === 'exact' && p.cards ? [...p.cards] : null,
        })),
      };
    }

    return {
      schemaVersion: WEIGHTED_EQUITY_REQUEST_VERSION,
      board: [...board],
      deadCards: [...customDeadCardsSignal.value],
      method: 'auto',
      samples,
      players: players.map((p): WeightedEquityRequestInput['players'][number] => {
        if (p.inputKind === 'exact' && p.cards) {
          return { id: p.id, kind: 'exact', cards: [...p.cards] };
        }
        if (p.inputKind === 'range' && p.weightedRange) {
          let activeRange = p.weightedRange;
          const bucketWeights = rangeBucketWeightsSignal.value[p.id];
          const activeBuckets = rangeFilterBucketsSignal.value[p.id];
          if (board.length >= 3) {
            if (bucketWeights && Object.keys(bucketWeights).length > 0) {
              const breakdown = computePostflopRangeBreakdown(
                p.weightedRange,
                board,
                deadCardsSignal.value,
              );
              if (breakdown) {
                const hasLive = breakdown.buckets.some(
                  (b) => (bucketWeights[b.id] ?? 1) > 0 && b.comboCount > 0,
                );
                if (hasLive) {
                  activeRange = filterWeightedRangeByBucketWeights(
                    p.weightedRange,
                    breakdown,
                    bucketWeights,
                  );
                }
              }
            } else if (
              activeBuckets &&
              activeBuckets.length > 0 &&
              activeBuckets.length < RANGE_BREAKDOWN_BUCKET_ORDER.length
            ) {
              const breakdown = computePostflopRangeBreakdown(
                p.weightedRange,
                board,
                deadCardsSignal.value,
              );
              if (breakdown) {
                const allowed = new Set<RangeBreakdownBucketId>(activeBuckets);
                const hasLive = breakdown.buckets.some((b) => allowed.has(b.id) && b.comboCount > 0);
                if (hasLive) {
                  activeRange = filterWeightedRangeByBuckets(p.weightedRange, breakdown, allowed);
                }
              }
            }
          }
          return {
            id: p.id,
            kind: 'range',
            range: activeRange,
            sourceRole: p.isHero ? 'personal_intended' : 'explicit_opponent_model',
            sourceId: `shorthand:${p.canonical}`,
            weightSemantics: 'relative_combo_likelihood',
          };
        }
        return { id: p.id, kind: 'uniform_unknown' };
      }),
    };
  }

  function previousBoardForDelta(street: EquityStreet, effBoard: readonly string[]): readonly string[] | null {
    if (street === 'turn' && effBoard.length >= 4) return effBoard.slice(0, 3);
    if (street === 'river' && effBoard.length === 5) return effBoard.slice(0, 4);
    if (street === 'flop' && effBoard.length === 3) return [];
    return null;
  }

  async function recompute(): Promise<void> {
    recomputeNonce += 1;
    const runNonce = recomputeNonce;
    const players = playersSignal.value;
    const effBoard = effectiveBoardSignal.value;
    const street = streetSignal.value;

    if (players.length < 2) return;
    if (![0, 3, 4, 5].includes(effBoard.length)) {
      equityChannel.cancel();
      prevChannel.cancel();
      runoutsChannel.cancel();
      equitySnapshotSignal.value = {
        status: 'error',
        method: 'exact',
        partial: false,
        trials: 0,
        maxMargin95Pct: 0,
        players: {},
        errorMessage: 'incomplete_flop',
      };
      if (runoutSnapshotSignal.value !== IDLE_RUNOUT_SNAPSHOT) {
        runoutSnapshotSignal.value = IDLE_RUNOUT_SNAPSHOT;
      }
      return;
    }

    const req = buildDispatchRequest(players, effBoard);
    const prevBoard = previousBoardForDelta(street, effBoard);
    const mainKey = cacheKeyForRequest(req);
    const cachedMain = getCachedEquity(mainKey);
    const prevReq = prevBoard !== null ? buildDispatchRequest(players, prevBoard) : null;
    const prevKey = prevReq ? cacheKeyForRequest(prevReq) : null;
    const cachedPrev = prevKey ? getCachedEquity(prevKey) : undefined;

    if (!cachedMain || (prevReq !== null && !cachedPrev)) {
      equitySnapshotSignal.value = {
        ...equitySnapshotSignal.value,
        status: 'calculating',
        errorMessage: undefined,
      };
    }

    const gridBoard =
      street === 'flop' && effBoard.length === 3
        ? effBoard
        : (street === 'turn' || street === 'river') && effBoard.length >= 4
          ? effBoard.slice(0, 4)
          : null;
    const shouldRunRunouts = runoutsExpandedSignal.value && gridBoard !== null;
    if (!shouldRunRunouts) {
      runoutsChannel.cancel();
      if (runoutSnapshotSignal.value !== IDLE_RUNOUT_SNAPSHOT) {
        runoutSnapshotSignal.value = IDLE_RUNOUT_SNAPSHOT;
      }
    }

    const runMain = cachedMain
      ? (equityChannel.cancel(), Promise.resolve(cachedMain))
      : (equityChannel.run((opts) => engine.async.calculateEquity(req, opts)) as Promise<
          EngineResponse<DispatchedEquityResult> | null
        >);
    const runPrev = prevReq
      ? cachedPrev
        ? (prevChannel.cancel(), Promise.resolve(cachedPrev))
        : (prevChannel.run((opts) => engine.async.calculateEquity(prevReq, opts)) as Promise<
            EngineResponse<DispatchedEquityResult> | null
          >)
      : (prevChannel.cancel(), Promise.resolve(null));

    const [mainRes, prevRes] = await Promise.all([runMain, runPrev]);
    if (runNonce !== recomputeNonce || disposed) return;

    if (mainRes) {
      if (!mainRes.ok) {
        equitySnapshotSignal.value = {
          status: 'error',
          method: 'exact',
          partial: false,
          trials: 0,
          maxMargin95Pct: 0,
          players: {},
          errorMessage: mainRes.error.message,
        };
      } else {
        setCachedEquity(mainKey, mainRes);
        if (prevRes && prevRes.ok && prevKey) {
          setCachedEquity(prevKey, prevRes);
        }

        const handFactsResp =
          effBoard.length >= 3
            ? engine.sync.projectEquityHands({
                board: effBoard,
                deadCards: [...customDeadCardsSignal.value],
                players: players.map((p) => ({
                  id: p.id,
                  cards: p.inputKind === 'exact' && p.cards ? [...p.cards] : null,
                })),
              })
            : null;
        const handFacts = handFactsResp && handFactsResp.ok ? handFactsResp.data : null;
        handProjectionSignal.value = handFacts;

        const prevMap = new Map<string, number>();
        if (prevRes && prevRes.ok) {
          const prevData = prevRes.data;
          if (isExactOrMcResult(prevData) || isWeightedResult(prevData)) {
            prevData.players.forEach((p, idx) => {
              const targetId = players[idx]?.id ?? p.id;
              prevMap.set(targetId, p.equity * 100);
            });
          }
        }

        const data = mainRes.data;
        const mappedPlayers: Record<string, EquityComputedPlayer> = {};
        let method: 'exact' | 'estimated' = 'exact';
        let trials = 0;
        let maxMargin = 0;
        let partial = false;

        if (isExactOrMcResult(data)) {
          method = data.exact ? 'exact' : 'estimated';
          trials = data.trials;
          (data.players as readonly EquityPlayerResult[]).forEach((p, idx) => {
            const targetId = players[idx]?.id ?? p.id;
            const pct = p.equity * 100;
            const prevPct = prevMap.get(targetId);
            const marginPct = p.margin95 * 100;
            maxMargin = Math.max(maxMargin, marginPct);
            const projPlayer = handFacts?.players.find((fp) => fp.id === targetId);
            const outcomePlayer = handFacts?.exactOutcomes.available
              ? handFacts.exactOutcomes.players.find((op) => op.id === targetId)
              : undefined;
            mappedPlayers[targetId] = {
              id: targetId,
              equityPct: pct,
              previousEquityPct: street === 'preflop' ? undefined : prevPct,
              deltaPct: street === 'preflop' || prevPct === undefined ? undefined : pct - prevPct,
              wins: p.wins,
              ties: p.ties,
              trials: data.trials,
              isExactCount: data.exact,
              margin95Pct: marginPct,
              standing: outcomePlayer?.currentStanding,
              currentCategory: projPlayer?.facts?.exactHand.primaryCategory ?? undefined,
              hasFlushDraw: projPlayer?.facts?.exactHand.draws.flushDraw ?? false,
              hasStraightDraw: Boolean(
                projPlayer?.facts?.exactHand.draws.openEndedStraightDraw ||
                  projPlayer?.facts?.exactHand.draws.gutshot ||
                  projPlayer?.facts?.exactHand.draws.doubleGutshot,
              ),
              riverCategoryShares: p.riverCategoryShares ?? EMPTY_CATEGORIES,
            };
          });
        } else if (isWeightedResult(data)) {
          method = data.method === 'exact' ? 'exact' : 'estimated';
          partial = data.conditionalOnKnownMass;
          trials = data.trials;
          (data.players as readonly WeightedEquityPlayerResult[]).forEach((p, idx) => {
            const targetId = players[idx]?.id ?? p.id;
            const pct = p.equity * 100;
            const prevPct = prevMap.get(targetId);
            const marginPct = p.margin95 * 100;
            maxMargin = Math.max(maxMargin, marginPct);
            const projPlayer = handFacts?.players.find((fp) => fp.id === targetId);
            mappedPlayers[targetId] = {
              id: targetId,
              equityPct: pct,
              previousEquityPct: street === 'preflop' ? undefined : prevPct,
              deltaPct: street === 'preflop' || prevPct === undefined ? undefined : pct - prevPct,
              wins: Math.round(p.wins),
              ties: Math.round(p.ties),
              trials: Math.round(p.totalMass) || data.trials,
              isExactCount: data.method === 'exact',
              margin95Pct: marginPct,
              currentCategory: projPlayer?.facts?.exactHand.primaryCategory ?? undefined,
              hasFlushDraw: projPlayer?.facts?.exactHand.draws.flushDraw ?? false,
              hasStraightDraw: Boolean(
                projPlayer?.facts?.exactHand.draws.openEndedStraightDraw ||
                  projPlayer?.facts?.exactHand.draws.gutshot ||
                  projPlayer?.facts?.exactHand.draws.doubleGutshot,
              ),
              riverCategoryShares: p.riverCategoryShares ?? EMPTY_CATEGORIES,
            };
          });
        }

        equitySnapshotSignal.value = {
          status: 'ready',
          method,
          partial,
          trials,
          maxMargin95Pct: maxMargin,
          players: mappedPlayers,
        };
      }
    }

    if (!shouldRunRunouts || !gridBoard || (mainRes && !mainRes.ok)) {
      runoutsChannel.cancel();
      if (runoutSnapshotSignal.value !== IDLE_RUNOUT_SNAPSHOT) {
        runoutSnapshotSignal.value = IDLE_RUNOUT_SNAPSHOT;
      }
      return;
    }

    runoutSnapshotSignal.value = {
      ...runoutSnapshotSignal.value,
      status: 'calculating',
      reason: undefined,
    };
    const runoutReq = buildDispatchRequest(players, gridBoard);
    const runoutSamples = refinedSamplesSignal.value
      ? REFINED_RUNOUT_SAMPLES
      : DEFAULT_RUNOUT_SAMPLES;
    const runoutRes = await runoutsChannel.run((opts) =>
      engine.async.exploreRunouts(
        runoutReq as Exclude<DispatchableEquityRequest, { schemaVersion: 'runout-request/v1' }>,
        {
          ...opts,
          samples: runoutSamples,
        },
      ),
    );
    if (runNonce !== recomputeNonce || disposed) return;

    if (runoutRes) {
      if (
        !runoutRes.ok ||
        !runoutRes.data ||
        runoutRes.data.status === 'unavailable' ||
        ('reason' in runoutRes.data && runoutRes.data.reason !== null)
      ) {
        runoutSnapshotSignal.value = {
          status: 'unavailable',
          method: 'exact',
          baseEquityPct: null,
          rowsByCard: {},
          groups: [],
          result: null,
          reason: runoutRes.ok
            ? String((runoutRes.data as { reason?: string }).reason ?? 'unavailable')
            : runoutRes.error.code,
        };
      } else {
        const res = runoutRes.data as RunoutExplorerResult;
        const rowsByCard: Record<string, RunoutRow> = {};
        for (const row of res.rows) {
          const card = row.cards[0];
          if (card) rowsByCard[card] = row;
        }
        const groupedResp = engine.sync.groupRunouts(res.rows, 'effect');
        const grouped = groupedResp.ok ? groupedResp.data : [];
        const groups: RunoutGroupedBucket[] = grouped.map((g) => {
          const avgDelta =
            g.rows.reduce((sum, r) => sum + (r.equityDelta ?? 0), 0) / Math.max(1, g.rows.length);
          const bestRow = g.rows.reduce((best, r) =>
            (r.equity ?? -1) > (best.equity ?? -1) ? r : best,
          );
          return {
            effectGroup: g.key as RunoutEffectGroup,
            rows: g.rows,
            avgDeltaPct: avgDelta * 100,
            bestRow,
          };
        });

        const baseHero = res.baseline.players.find((p) => p.id === res.heroId);
        runoutSnapshotSignal.value = {
          status: 'ready',
          method: res.baseline.method === 'exact' ? 'exact' : 'estimated',
          baseEquityPct: baseHero ? baseHero.equity * 100 : null,
          rowsByCard,
          groups,
          result: res,
        };
      }
    }
  }

  function triggerRecompute(): void {
    if (suppressRecompute) return;
    if (!inApplyPreset) {
      activePreset = null;
    }
    if (!autoCompute || recomputeQueued) return;
    recomputeQueued = true;
    queueMicrotask(() => {
      recomputeQueued = false;
      if (!disposed) {
        void recompute();
      }
    });
  }

  function addPlayer(rawInput?: string): boolean {
    const candidate = rawInput !== undefined ? rawInput : draftInputSignal.value;
    if (playersSignal.value.length >= 10) {
      submitAttemptedErrorSignal.value = 'max_players';
      return false;
    }
    const parsed = parsePlayerHandInput(candidate, {
      deadCards: deadCardsSignal.value,
      engine,
    });
    if (!parsed.ok) {
      submitAttemptedErrorSignal.value = parsed.errorCode;
      return false;
    }
    submitAttemptedErrorSignal.value = null;
    const idx = playersSignal.value.length;
    const label = `Villain ${idx}`;
    const entry = makeEntry(candidate, false, label, deadCardsSignal.value);
    if (!entry) return false;
    playersSignal.value = [...playersSignal.value, entry];
    if (rawInput === undefined) {
      draftInputSignal.value = '';
    }
    reconditionRangesAgainstBoardAndHands();
    triggerRecompute();
    return true;
  }

  function reconditionRangesAgainstBoardAndHands(): void {
    // Re-evaluate combo counts for range/any players as dead cards change
    const players = playersSignal.value;
    const baseDead = new Set<string>(effectiveBoardSignal.value);
    for (const p of players) {
      if (p.cards) {
        baseDead.add(p.cards[0]);
        baseDead.add(p.cards[1]);
      }
    }
    const updated = players.map((p) => {
      if (p.inputKind === 'exact') return p;
      const otherDead = [...baseDead];
      const reparsed = parsePlayerHandInput(p.rawInput, { deadCards: otherDead, engine });
      if (!reparsed.ok) return p;
      if (reparsed.kind === 'any') {
        return {
          ...p,
          eligibleCombos: reparsed.eligibleCombos,
          removedCombos: reparsed.removedCombos,
        };
      }
      if (reparsed.kind === 'range') {
        return {
          ...p,
          totalCombosBefore: reparsed.totalCombosBefore,
          eligibleCombos: reparsed.eligibleCombos,
          removedCombos: reparsed.removedCombos,
        };
      }
      return p;
    });
    playersSignal.value = updated;
  }

  function updatePlayerInput(id: string, rawInput: string): boolean {
    const existing = playersSignal.value.find((p) => p.id === id);
    if (!existing) return false;
    const otherDeadSet = new Set<string>(effectiveBoardSignal.value);
    for (const c of boardSignal.value) otherDeadSet.add(c);
    if (turnCardSignal.value) otherDeadSet.add(turnCardSignal.value);
    if (riverCardSignal.value) otherDeadSet.add(riverCardSignal.value);
    for (const p of playersSignal.value) {
      if (p.id !== id && p.cards) {
        otherDeadSet.add(p.cards[0]);
        otherDeadSet.add(p.cards[1]);
      }
    }
    const otherDead = [...otherDeadSet];
    const parsed = parsePlayerHandInput(rawInput, {
      deadCards: otherDead,
      engine,
    });
    if (!parsed.ok) {
      submitAttemptedErrorSignal.value = parsed.errorCode;
      return false;
    }
    const nextEntry = makeEntry(rawInput, existing.isHero, existing.label, otherDead, existing.id);
    if (!nextEntry) return false;
    submitAttemptedErrorSignal.value = null;
    playersSignal.value = playersSignal.value.map((p) => (p.id === id ? nextEntry : p));
    if (rangeFilterBucketsSignal.value[id]) {
      const nextFilters = { ...rangeFilterBucketsSignal.value };
      delete nextFilters[id];
      rangeFilterBucketsSignal.value = nextFilters;
    }
    reconditionRangesAgainstBoardAndHands();
    triggerRecompute();
    return true;
  }

  function setPlayerCard(id: string, slotIndex: 0 | 1, card: string): boolean {
    const existing = playersSignal.value.find((p) => p.id === id);
    if (!existing) return false;
    const otherDeadSet = new Set<string>(effectiveBoardSignal.value);
    for (const c of boardSignal.value) otherDeadSet.add(c);
    if (turnCardSignal.value) otherDeadSet.add(turnCardSignal.value);
    if (riverCardSignal.value) otherDeadSet.add(riverCardSignal.value);
    for (const p of playersSignal.value) {
      if (p.id !== id && p.cards) {
        otherDeadSet.add(p.cards[0]);
        otherDeadSet.add(p.cards[1]);
      }
    }
    if (otherDeadSet.has(card)) {
      submitAttemptedErrorSignal.value = 'card_in_play';
      return false;
    }
    const otherSlot = slotIndex === 0 ? 1 : 0;
    let partnerCard = existing.cards?.[otherSlot];
    if (!partnerCard || partnerCard === card || otherDeadSet.has(partnerCard)) {
      partnerCard = HOLDEM_DECK.find((c) => c !== card && !otherDeadSet.has(c));
    }
    if (!partnerCard) return false;
    const c0 = slotIndex === 0 ? card : partnerCard;
    const c1 = slotIndex === 1 ? card : partnerCard;
    return updatePlayerInput(id, `${c0}${c1}`);
  }

  function removePlayer(id: string): void {
    const next = playersSignal.value.filter((p) => p.id !== id);
    if (next.length < 2 || next.length === playersSignal.value.length) return;
    // Keep seat 0 as Hero and keep sequential "Villain 1..N" naming for remaining seats
    let vNum = 0;
    playersSignal.value = next.map((p, idx) => {
      if (idx === 0) {
        return { ...p, isHero: true, label: p.isHero ? p.label : 'Hero' };
      }
      vNum += 1;
      return { ...p, isHero: false, label: `Villain ${vNum}` };
    });
    reconditionRangesAgainstBoardAndHands();
    triggerRecompute();
  }

  function setRandomKeep(key: 'hero' | 'villains' | 'board', value: boolean): void {
    if (key === 'hero') randomKeepHeroSignal.value = value;
    else if (key === 'villains') randomKeepVillainsSignal.value = value;
    else randomKeepBoardSignal.value = value;
  }

  function pickRandomCards(pool: readonly string[], count: number): string[] {
    const copy = [...pool];
    const picked: string[] = [];
    while (picked.length < count && copy.length > 0) {
      const idx = Math.floor(Math.random() * copy.length);
      picked.push(copy.splice(idx, 1)[0]!);
    }
    return picked;
  }

  function randomizePlayer(id: string): void {
    const existing = playersSignal.value.find((p) => p.id === id);
    if (!existing) return;
    const used = new Set<string>(effectiveBoardSignal.value);
    for (const c of boardSignal.value) used.add(c);
    if (turnCardSignal.value) used.add(turnCardSignal.value);
    if (riverCardSignal.value) used.add(riverCardSignal.value);
    for (const p of playersSignal.value) {
      if (p.id !== id && p.cards) {
        used.add(p.cards[0]);
        used.add(p.cards[1]);
      }
    }
    const pool = HOLDEM_DECK.filter((c) => !used.has(c));
    if (pool.length < 2) return;
    const [c0, c1] = pickRandomCards(pool, 2);
    if (!c0 || !c1) return;
    updatePlayerInput(id, `${c0}${c1}`);
  }

  function randomizeVillains(): void {
    const used = new Set<string>(effectiveBoardSignal.value);
    for (const c of boardSignal.value) used.add(c);
    if (turnCardSignal.value) used.add(turnCardSignal.value);
    if (riverCardSignal.value) used.add(riverCardSignal.value);
    for (const p of playersSignal.value) {
      if (p.isHero && p.cards) {
        used.add(p.cards[0]);
        used.add(p.cards[1]);
      }
    }
    const pool = HOLDEM_DECK.filter((c) => !used.has(c));
    suppressRecompute = true;
    rangeFilterBucketsSignal.value = {};
    try {
      const updated = playersSignal.value.map((p) => {
        if (p.isHero) return p;
        const [c0, c1] = pickRandomCards(pool, 2);
        if (!c0 || !c1) return p;
        pool.splice(pool.indexOf(c0), 1);
        pool.splice(pool.indexOf(c1), 1);
        const entry = makeEntry(`${c0}${c1}`, false, p.label, [...used], p.id);
        if (!entry) return p;
        used.add(c0);
        used.add(c1);
        return entry;
      });
      playersSignal.value = updated;
      reconditionRangesAgainstBoardAndHands();
    } finally {
      suppressRecompute = false;
    }
    triggerRecompute();
  }

  function randomizeMatchup(targetStreet?: 'preflop' | 'flop' | 'turn' | 'river'): void {
    const keepHero = randomKeepHeroSignal.value;
    const keepVillains = randomKeepVillainsSignal.value;
    const keepBoard = randomKeepBoardSignal.value;

    const currentEffBoard = effectiveBoardSignal.value;
    const desiredStreet =
      targetStreet ?? (streetSignal.value === 'preflop' ? 'flop' : streetSignal.value);
    const desiredBoardCount =
      desiredStreet === 'preflop'
        ? 0
        : desiredStreet === 'flop'
          ? 3
          : desiredStreet === 'turn'
            ? 4
            : 5;

    const used = new Set<string>();
    const nextBoard = keepBoard ? [...currentEffBoard] : [];
    for (const c of nextBoard) used.add(c);

    for (const p of playersSignal.value) {
      const keepThisPlayer = p.isHero ? keepHero : keepVillains;
      if (keepThisPlayer && p.cards) {
        used.add(p.cards[0]);
        used.add(p.cards[1]);
      }
    }

    const pool = HOLDEM_DECK.filter((c) => !used.has(c));

    suppressRecompute = true;
    rangeFilterBucketsSignal.value = {};
    try {
      const updatedPlayers = playersSignal.value.map((p) => {
        const keepThisPlayer = p.isHero ? keepHero : keepVillains;
        if (keepThisPlayer) {
          return p;
        }
        if (pool.length < 2) return p;
        const [c0, c1] = pickRandomCards(pool, 2);
        if (!c0 || !c1) return p;
        pool.splice(pool.indexOf(c0), 1);
        pool.splice(pool.indexOf(c1), 1);
        const entry = makeEntry(`${c0}${c1}`, p.isHero, p.label, [...used], p.id);
        if (!entry) return p;
        used.add(c0);
        used.add(c1);
        return entry;
      });

      let finalBoard = nextBoard;
      if (!keepBoard) {
        finalBoard = pickRandomCards(
          HOLDEM_DECK.filter((c) => !used.has(c)),
          desiredBoardCount,
        );
      }

      playersSignal.value = updatedPlayers;
      boardSignal.value = finalBoard;
      turnCardSignal.value = finalBoard[3] ?? null;
      riverCardSignal.value = finalBoard[4] ?? null;
      if (finalBoard.length === 0) streetSignal.value = 'preflop';
      else if (finalBoard.length <= 3) streetSignal.value = 'flop';
      else if (finalBoard.length === 4) streetSignal.value = 'turn';
      else streetSignal.value = 'river';

      reconditionRangesAgainstBoardAndHands();
    } finally {
      suppressRecompute = false;
    }
    triggerRecompute();
  }

  function setBoardCards(cards: readonly string[]): void {
    const cleaned = cards.slice(0, 5);
    boardSignal.value = cleaned;
    turnCardSignal.value = cleaned[3] ?? null;
    riverCardSignal.value = cleaned[4] ?? null;
    if (cleaned.length === 0) streetSignal.value = 'preflop';
    else if (cleaned.length <= 3) streetSignal.value = 'flop';
    else if (cleaned.length === 4) streetSignal.value = 'turn';
    else streetSignal.value = 'river';
    reconditionRangesAgainstBoardAndHands();
    triggerRecompute();
  }

  function setBoardSlotCard(slotIndex: number, card: string | null): void {
    if (slotIndex < 0 || slotIndex > 4) return;
    const current = [...boardSignal.value];
    if (card === null) {
      if (slotIndex <= 2) {
        current.splice(slotIndex, 1);
      } else if (slotIndex === 3) {
        current.splice(3);
        turnCardSignal.value = null;
        riverCardSignal.value = null;
      } else {
        current.splice(4);
        riverCardSignal.value = null;
      }
      setBoardCards(current);
      return;
    }

    const usedElsewhere = new Set(
      playersSignal.value.flatMap((p) => (p.cards ? [...p.cards] : [])),
    );
    current.forEach((c, idx) => {
      if (idx !== slotIndex) usedElsewhere.add(c);
    });
    if (usedElsewhere.has(card)) return;

    while (current.length < slotIndex) {
      const next = HOLDEM_DECK.find((d) => !usedElsewhere.has(d));
      if (!next) break;
      current.push(next);
      usedElsewhere.add(next);
    }
    current[slotIndex] = card;
    setBoardCards(current);
  }

  function clearBoard(): void {
    setBoardCards([]);
  }

  function dealRandomBoard(targetStreet?: 'current' | 'flop' | 'turn' | 'river'): void {
    const used = new Set<string>(
      playersSignal.value.flatMap((p) => (p.cards ? [...p.cards] : [])),
    );
    const effLen = effectiveBoardSignal.value.length;
    let targetLen = 3;
    if (targetStreet === 'flop') targetLen = 3;
    else if (targetStreet === 'turn') targetLen = 4;
    else if (targetStreet === 'river') targetLen = 5;
    else {
      targetLen = effLen >= 3 ? effLen : 3;
    }
    const pool = HOLDEM_DECK.filter((c) => !used.has(c));
    const nextBase = pickRandomCards(pool, targetLen);
    setBoardCards(nextBase);
  }

  function setStreet(street: EquityStreet): void {
    const currentBoard = boardSignal.value;
    if (street === 'preflop') {
      streetSignal.value = 'preflop';
      if (Object.keys(rangeFilterBucketsSignal.value).length > 0) {
        rangeFilterBucketsSignal.value = {};
      }
    } else if (street === 'flop') {
      if (currentBoard.length < 3) {
        dealRandomBoard();
        return;
      }
      streetSignal.value = 'flop';
      turnCardSignal.value = null;
      riverCardSignal.value = null;
    } else if (street === 'turn') {
      if (currentBoard.length < 3) return;
      if (!turnCardSignal.value) {
        if (currentBoard[3]) {
          turnCardSignal.value = currentBoard[3];
        } else {
          const dead = normalizeDeadCardSet(deadCardsSignal.value);
          const fallback = HOLDEM_DECK.find((c) => !dead.has(c)) ?? null;
          turnCardSignal.value = fallback;
        }
      }
      riverCardSignal.value = null;
      streetSignal.value = 'turn';
    } else {
      if (currentBoard.length < 3) return;
      if (!turnCardSignal.value) {
        const dead = normalizeDeadCardSet(deadCardsSignal.value);
        turnCardSignal.value = currentBoard[3] ?? HOLDEM_DECK.find((c) => !dead.has(c)) ?? null;
      }
      if (!riverCardSignal.value) {
        const dead = normalizeDeadCardSet([...deadCardsSignal.value, ...(turnCardSignal.value ? [turnCardSignal.value] : [])]);
        riverCardSignal.value =
          currentBoard[4] && currentBoard[4] !== turnCardSignal.value
            ? currentBoard[4]
            : HOLDEM_DECK.find((c) => !dead.has(c)) ?? null;
      }
      streetSignal.value = 'river';
    }
    reconditionRangesAgainstBoardAndHands();
    triggerRecompute();
  }

  function selectRunoutCard(card: string): void {
    const street = streetSignal.value;
    if (street === 'flop') {
      turnCardSignal.value = card;
      riverCardSignal.value = null;
      streetSignal.value = 'turn';
    } else if (street === 'turn' || street === 'river') {
      if (card === turnCardSignal.value) return;
      riverCardSignal.value = card;
      streetSignal.value = 'river';
    }
    reconditionRangesAgainstBoardAndHands();
    triggerRecompute();
  }

  function clearRunoutSelection(): void {
    turnCardSignal.value = null;
    riverCardSignal.value = null;
    if (boardSignal.value.length >= 3) {
      streetSignal.value = 'flop';
      boardSignal.value = boardSignal.value.slice(0, 3);
    }
    reconditionRangesAgainstBoardAndHands();
    triggerRecompute();
  }

  function stepBackWithEscape(): boolean {
    if (streetSignal.value === 'river') {
      riverCardSignal.value = null;
      streetSignal.value = 'turn';
      reconditionRangesAgainstBoardAndHands();
      triggerRecompute();
      return true;
    }
    if (streetSignal.value === 'turn') {
      turnCardSignal.value = null;
      riverCardSignal.value = null;
      streetSignal.value = 'flop';
      if (boardSignal.value.length > 3) {
        boardSignal.value = boardSignal.value.slice(0, 3);
      }
      reconditionRangesAgainstBoardAndHands();
      triggerRecompute();
      return true;
    }
    return false;
  }

  function setDraftInput(value: string): void {
    draftInputSignal.value = value;
    submitAttemptedErrorSignal.value = null;
  }

  function setRunoutsExpanded(expanded: boolean): void {
    runoutsExpandedSignal.value = expanded;
    triggerRecompute();
  }

  function setRiverDistExpanded(expanded: boolean): void {
    riverDistManualOverrideSignal.value = expanded;
  }

  function setRefinedSamples(refined: boolean): void {
    refinedSamplesSignal.value = refined;
    triggerRecompute();
  }

  async function refreshSavedMatchups(): Promise<void> {
    savedMatchupsSignal.value = await repository.listSavedMatchups();
  }

  async function saveCurrentMatchup(): Promise<SavedMatchupRecord | null> {
    const players = playersSignal.value;
    if (players.length < 2) return null;
    const saved = await repository.saveMatchup({
      board: boardSignal.value.slice(0, 3),
      players: players.map((p) => ({
        id: p.id,
        label: p.label,
        isHero: p.isHero,
        rawInput: p.rawInput,
        inputKind: p.inputKind,
      })),
      street: streetSignal.value,
      ...(turnCardSignal.value ? { selectedTurnCard: turnCardSignal.value } : {}),
      ...(riverCardSignal.value ? { selectedRiverCard: riverCardSignal.value } : {}),
    });
    await refreshSavedMatchups();
    return saved;
  }

  function loadSavedMatchup(record: SavedMatchupRecord): void {
    const payload: SavedMatchupPayload = record.payload;
    playerCounter = 0;
    const loaded: EquityPlayerEntry[] = [];
    const used = new Set<string>(payload.board);
    if (payload.selectedTurnCard) used.add(payload.selectedTurnCard);
    if (payload.selectedRiverCard) used.add(payload.selectedRiverCard);

    for (const p of payload.players) {
      const entry = makeEntry(p.rawInput, p.isHero, p.label, [...used], p.id);
      if (entry) {
        loaded.push(entry);
        if (entry.cards) {
          used.add(entry.cards[0]);
          used.add(entry.cards[1]);
        }
      }
    }
    if (loaded.length < 2) return;
    const fullBoard = [...payload.board];
    if (payload.selectedTurnCard && !fullBoard.includes(payload.selectedTurnCard)) {
      fullBoard.push(payload.selectedTurnCard);
    }
    if (payload.selectedRiverCard && !fullBoard.includes(payload.selectedRiverCard)) {
      fullBoard.push(payload.selectedRiverCard);
    }
    boardSignal.value = fullBoard;
    turnCardSignal.value = payload.selectedTurnCard ?? null;
    riverCardSignal.value = payload.selectedRiverCard ?? null;
    streetSignal.value = payload.street;
    playersSignal.value = loaded;
    activeSideTabSignal.value = 'matchup';
    riverDistManualOverrideSignal.value = null;
    reconditionRangesAgainstBoardAndHands();
    triggerRecompute();
  }

  function loadExternalMatchup(input: {
    readonly board: readonly string[];
    readonly players: readonly {
      readonly label: string;
      readonly rawInput: string;
      readonly isHero: boolean;
    }[];
    readonly potBeforeBetBb?: number;
    readonly betToCallBb?: number;
    readonly remainingStackBb?: number;
  }): void {
    const cleanedBoard = input.board.slice(0, 5);
    playerCounter = 0;
    const loaded: EquityPlayerEntry[] = [];
    const used = new Set<string>(cleanedBoard);
    for (const p of input.players) {
      const entry = makeEntry(
        p.rawInput,
        p.isHero,
        p.label,
        [...used],
        p.isHero ? 'hero' : undefined,
      );
      if (entry) {
        loaded.push(entry);
        if (entry.cards) {
          used.add(entry.cards[0]);
          used.add(entry.cards[1]);
        }
      }
    }
    if (loaded.length < 2) return;
    if (typeof input.potBeforeBetBb === 'number' && Number.isFinite(input.potBeforeBetBb) && input.potBeforeBetBb > 0) {
      potBeforeBetBbSignal.value = Math.round(input.potBeforeBetBb * 10) / 10;
    }
    if (typeof input.betToCallBb === 'number' && Number.isFinite(input.betToCallBb) && input.betToCallBb > 0) {
      betToCallBbSignal.value = Math.round(input.betToCallBb * 10) / 10;
    }
    if (typeof input.remainingStackBb === 'number' && Number.isFinite(input.remainingStackBb) && input.remainingStackBb > 0) {
      remainingStackBbSignal.value = Math.round(input.remainingStackBb * 10) / 10;
    }
    boardSignal.value = cleanedBoard;
    turnCardSignal.value = cleanedBoard[3] ?? null;
    riverCardSignal.value = cleanedBoard[4] ?? null;
    if (cleanedBoard.length === 0) streetSignal.value = 'preflop';
    else if (cleanedBoard.length <= 3) streetSignal.value = 'flop';
    else if (cleanedBoard.length === 4) streetSignal.value = 'turn';
    else streetSignal.value = 'river';
    playersSignal.value = loaded;
    activeSideTabSignal.value = 'matchup';
    riverDistManualOverrideSignal.value = null;
    reconditionRangesAgainstBoardAndHands();
    triggerRecompute();
  }

  async function archiveSavedMatchup(objectId: string): Promise<void> {
    await repository.archiveSavedMatchup(objectId);
    await refreshSavedMatchups();
  }

  function applyPreset(preset: EquityPresetId): void {
    if (activePreset === preset) {
      return;
    }
    suppressRecompute = true;
    rangeFilterBucketsSignal.value = {};
    try {
      initDefaultMatchup();
      draftInputSignal.value = '';
      submitAttemptedErrorSignal.value = null;
      riverDistManualOverrideSignal.value = null;
      activeSideTabSignal.value = 'matchup';
      runoutsExpandedSignal.value = true;

      if (preset === 'flop') {
        activePreset = preset;
      } else if (preset === 'turn_chosen') {
        turnCardSignal.value = 'Js';
        streetSignal.value = 'turn';
        activePreset = preset;
      } else if (preset === 'players_3') {
        addPlayer('Th9h');
        activePreset = preset;
      } else if (preset === 'players_4') {
        addPlayer('Th9h');
        addPlayer('7d7s');
        activePreset = preset;
      } else if (preset === 'players_10') {
        const extras = ['Th9h', '7d7s', 'AcQd', 'JcTd', '8h8s', '6c5c', 'KsJd', 'any'];
        for (const h of extras) addPlayer(h);
        activePreset = preset;
      } else if (preset === 'range_row') {
        playerCounter = 0;
        const board = ['Qh', '7c', '2h'];
        const hero = makeEntry('AhKh', true, 'Hero', board, 'hero')!;
        const r1 = makeEntry('QQ+, AKs', false, 'Villain 1', [...board, 'Ah', 'Kh'], 'villain-1')!;
        const r2 = makeEntry('22-77, A5s-A2s', false, 'Villain 2', [...board, 'Ah', 'Kh'], 'villain-2')!;
        boardSignal.value = board;
        streetSignal.value = 'flop';
        playersSignal.value = [hero, r1, r2];
        activePreset = preset;
      } else if (preset === 'error') {
        draftInputSignal.value = 'QhKd';
        submitAttemptedErrorSignal.value = 'card_in_play';
        activePreset = preset;
      }
    } finally {
      suppressRecompute = false;
    }
    inApplyPreset = true;
    try {
      triggerRecompute();
    } finally {
      inApplyPreset = false;
    }
  }

  function setRangeBreakdownFilter(
    playerId: string,
    buckets: readonly RangeBreakdownBucketId[] | null,
  ): void {
    const nextFilters = { ...rangeFilterBucketsSignal.value };
    const nextWeights = { ...rangeBucketWeightsSignal.value };
    delete nextWeights[playerId];
    rangeBucketWeightsSignal.value = nextWeights;

    if (!buckets || buckets.length === 0 || buckets.length >= RANGE_BREAKDOWN_BUCKET_ORDER.length) {
      delete nextFilters[playerId];
      rangeFilterBucketsSignal.value = nextFilters;
      triggerRecompute();
      return;
    }
    const player = playersSignal.value.find((p) => p.id === playerId);
    const effBoard = effectiveBoardSignal.value;
    if (player?.inputKind === 'range' && player.weightedRange && effBoard.length >= 3) {
      const breakdown = computePostflopRangeBreakdown(
        player.weightedRange,
        effBoard,
        deadCardsSignal.value,
      );
      if (breakdown) {
        const selected = new Set(buckets);
        const hasLive = breakdown.buckets.some((b) => selected.has(b.id) && b.comboCount > 0);
        if (!hasLive) return;
      }
    }
    nextFilters[playerId] = [...buckets];
    rangeFilterBucketsSignal.value = nextFilters;
    triggerRecompute();
  }

  function cycleRangeBreakdownBucketWeight(
    playerId: string,
    bucketId: RangeBreakdownBucketId,
  ): void {
    const curWeights = rangeBucketWeightsSignal.value[playerId] ?? {};
    const curVal = curWeights[bucketId] ?? 1;
    const nextVal = curVal >= 0.99 ? 0.5 : curVal >= 0.49 ? 0.25 : curVal >= 0.24 ? 0 : 1;
    const updated: Partial<Record<RangeBreakdownBucketId, number>> = {
      ...curWeights,
      [bucketId]: nextVal,
    };
    if (nextVal === 1) delete updated[bucketId];

    // Guard against filtering all live combos to 0
    const player = playersSignal.value.find((p) => p.id === playerId);
    const effBoard = effectiveBoardSignal.value;
    if (player?.inputKind === 'range' && player.weightedRange && effBoard.length >= 3) {
      const breakdown = computePostflopRangeBreakdown(
        player.weightedRange,
        effBoard,
        deadCardsSignal.value,
      );
      if (breakdown) {
        const hasLive = breakdown.buckets.some(
          (b) => (updated[b.id] ?? 1) > 0 && b.comboCount > 0,
        );
        if (!hasLive) return;
      }
    }

    const nextAll = { ...rangeBucketWeightsSignal.value };
    if (Object.keys(updated).length === 0) {
      delete nextAll[playerId];
    } else {
      nextAll[playerId] = updated;
    }
    rangeBucketWeightsSignal.value = nextAll;
    triggerRecompute();
  }

  function toggleRangeBreakdownBucket(playerId: string, bucketId: RangeBreakdownBucketId): void {
    const current = rangeFilterBucketsSignal.value[playerId];
    const activeSet = new Set<RangeBreakdownBucketId>(
      current && current.length > 0 ? current : RANGE_BREAKDOWN_BUCKET_ORDER,
    );
    if (activeSet.has(bucketId)) {
      if (activeSet.size <= 1) return;
      activeSet.delete(bucketId);
    } else {
      activeSet.add(bucketId);
    }
    const ordered = RANGE_BREAKDOWN_BUCKET_ORDER.filter((id) => activeSet.has(id));
    setRangeBreakdownFilter(
      playerId,
      ordered.length === RANGE_BREAKDOWN_BUCKET_ORDER.length ? null : ordered,
    );
  }

  return {
    engine,
    repository,
    boardSignal,
    streetSignal,
    turnCardSignal,
    riverCardSignal,
    playersSignal,
    draftInputSignal,
    submitAttemptedErrorSignal,
    runoutsExpandedSignal,
    riverDistExpandedSignal,
    riverDistManualOverrideSignal,
    refinedSamplesSignal,
    randomKeepHeroSignal,
    randomKeepVillainsSignal,
    randomKeepBoardSignal,
    potBeforeBetBbSignal,
    betToCallBbSignal,
    remainingStackBbSignal,
    savedMatchupsSignal,
    activeSideTabSignal,
    rangeFilterBucketsSignal,
    rangeBucketWeightsSignal,
    equitySnapshotSignal,
    handProjectionSignal,
    runoutSnapshotSignal,
    densitySignal,
    customDeadCardsSignal,
    deadCardsSignal,
    draftPreviewSignal,
    effectiveBoardSignal,
    addPlayer,
    updatePlayerInput,
    setPlayerCard,
    removePlayer,
    setRandomKeep,
    randomizePlayer,
    randomizeVillains,
    randomizeMatchup,
    setBoardCards,
    setBoardSlotCard,
    clearBoard,
    addDeadCard(card: string) {
      if (customDeadCardsSignal.value.length >= 6) return;
      if (deadCardsSignal.value.includes(card)) return;
      customDeadCardsSignal.value = [...customDeadCardsSignal.value, card];
      void recompute();
    },
    removeDeadCard(card: string) {
      if (!customDeadCardsSignal.value.includes(card)) return;
      customDeadCardsSignal.value = customDeadCardsSignal.value.filter((c) => c !== card);
      void recompute();
    },
    clearDeadCards() {
      if (customDeadCardsSignal.value.length === 0) return;
      customDeadCardsSignal.value = [];
      void recompute();
    },
    dealRandomBoard,
    setStreet,
    selectRunoutCard,
    clearRunoutSelection,
    stepBackWithEscape,
    setDraftInput,
    setRunoutsExpanded,
    setRiverDistExpanded,
    setRefinedSamples,
    refreshSavedMatchups,
    saveCurrentMatchup,
    loadSavedMatchup,
    loadExternalMatchup,
    archiveSavedMatchup,
    applyPreset,
    toggleRangeBreakdownBucket,
    cycleRangeBreakdownBucketWeight,
    setRangeBreakdownFilter,
    recompute,
    dispose() {
      disposed = true;
      equityChannel.dispose();
      prevChannel.dispose();
      runoutsChannel.dispose();
    },
  };
}

let sharedEquityStore: EquityStore | null = null;

export function getSharedEquityStore(): EquityStore {
  if (!sharedEquityStore) {
    sharedEquityStore = createEquityStore();
  }
  return sharedEquityStore;
}

export function resetSharedEquityStore(): void {
  if (sharedEquityStore) {
    sharedEquityStore.dispose();
    sharedEquityStore = null;
  }
}
