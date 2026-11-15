import type {
  ActionSizeFacts,
  ActorCallEconomics,
  AllInLuckFacts,
  AllInLuckInput,
  CanonicalHandReplayEvent,
  CanonicalHandReplaySource,
  ChanceEvent,
  CreateHoldemRangeFromEntriesOptions,
  CreateHoldemRangeFromHandClassWeightsOptions,
  CreateOpponentActorInformationInput,
  DispatchableEquityRequest,
  DispatchEquityOptions,
  DispatchedEquityResult,
  DuelCallFacts,
  EconomicsContext,
  EquityEstimateResult,
  EquityHandAnalysisProjection,
  EquityOutcome,
  EquityPlayerResult,
  EquityRequestInput,
  EquityResult,
  GameRulesSnapshot,
  GameRulesSnapshotInput,
  HandCategory,
  HoldemConditionedRange,
  HoldemWeightedRange,
  InitializeLegacyHandConfig,
  InitializeSnapshotHandConfig,
  LegalActionSpec,
  OpponentActorInformation,
  PokerAction,
  PokerHandRank,
  PokerPlayerState,
  PokerState,
  PotAccounting,
  PotOddsFacts,
  PrivateRevealEvent,
  RangeAnalysisFacts,
  RecordedHandSettlementEvidence,
  ReplayFrameOperation,
  ReviewCallEvFacts,
  ReviewCallEvInput,
  RunoutEffectGroup,
  RunoutExplorerOutcome,
  RunoutExplorerResult,
  RunoutRow,
  StrategyActionType,
  StrategyBaselineComparison,
  StrategyContext,
  StrategyDecisionFamily,
  StrategyEvidenceEntry,
  StrategyEvidenceSource,
  StrategyFamilyId,
  StrategyFamilySpec,
  StrategyLeakMapProjection,
  StrategyMatrixCell,
  StrategyMatrixProjection,
  StrategySpotMapProjection,
  StrategySpotRowId,
  StrategySpotState,
  StrategySpotSummary,
  StrategyStackDepthBb,
  StrategyTableSize,
  TrainingMemoryPresentationGate,
  WeightedEquityOutcome,
  WeightedEquityPlayerResult,
  WeightedEquityRequestInput,
  WeightedEquityResult,
} from '../../engine/index';

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

export interface AsyncProgressUpdate {
  readonly completed: number;
  readonly total: number;
  readonly fraction: number;
}

export interface AsyncCallOptions {
  readonly requestId?: string;
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: AsyncProgressUpdate) => void;
  readonly batchSize?: number;
  readonly exactLimit?: number;
  readonly samples?: number;
}

export interface EngineChannel<T> {
  readonly name: string;
  run: (
    executor: (callOptions: AsyncCallOptions) => Promise<EngineResponse<T>>,
  ) => Promise<EngineResponse<T> | null>;
  cancel: () => void;
  dispose: () => void;
}

export interface WorkerPortLike {
  postMessage: (message: unknown) => void;
  terminate?: () => void;
  onmessage: ((event: MessageEvent<unknown>) => void) | ((event: { readonly data: unknown }) => void) | null;
  onerror: ((event: ErrorEvent) => void) | ((event: { readonly message?: string }) => void) | null;
}

export interface StrategyLookupRequest {
  readonly context: StrategyContext;
  readonly evidence?: readonly StrategyEvidenceEntry[];
  readonly familyId?: StrategyFamilyId;
}

export interface StrategyLookupResult {
  readonly tier: 'estimated' | 'unavailable';
  readonly context: StrategyContext;
  readonly projection: StrategyMatrixProjection;
  readonly baselineComparisons: readonly StrategyBaselineComparison[];
}

export interface TrainingDrillResult {
  readonly tier: FactTier;
}

export interface TrainingGradeResult {
  readonly tier: FactTier;
}

export interface EngineSyncApi {
  potOdds(
    callAmountMilliBb: number,
    actorContestablePotAfterCallMilliBb: number,
  ): EngineResponse<PotOddsFacts>;
  potOddsFromPotBeforeCall(
    callAmountMilliBb: number,
    potBeforeCallMilliBb: number,
  ): EngineResponse<PotOddsFacts>;
  duelCallFacts(
    potBeforeBetBb: number,
    betBb: number,
    startingStackBb: number,
  ): EngineResponse<DuelCallFacts>;
  actorCallEconomics(state: PokerState, actorPlayerId: string): EngineResponse<ActorCallEconomics>;
  actionSizeFacts(
    state: PokerState,
    actorPlayerId: string,
    amountToMilliBb: number,
  ): EngineResponse<ActionSizeFacts>;
  stackToPotRatio(context: EconomicsContext): EngineResponse<number | null>;
  minimumDefenseFrequency(context: EconomicsContext): EngineResponse<number | null>;
  allInLuck(input: AllInLuckInput): EngineResponse<AllInLuckFacts>;
  allInLuckAndEv(input: ReviewCallEvInput): EngineResponse<ReviewCallEvFacts>;
  evaluateHand(cards: readonly string[]): EngineResponse<PokerHandRank>;
  compareHandRanks(left: PokerHandRank, right: PokerHandRank): EngineResponse<number>;
  createGameRulesSnapshot(input: GameRulesSnapshotInput): EngineResponse<GameRulesSnapshot>;
  validateGameRulesSnapshot(snapshot: unknown): EngineResponse<GameRulesSnapshot>;
  initializeHand(config: InitializeLegacyHandConfig): EngineResponse<PokerState>;
  initializeHandFromGameRulesSnapshot(
    config: InitializeSnapshotHandConfig,
  ): EngineResponse<PokerState>;
  initializeRecordedHand(config: InitializeSnapshotHandConfig): EngineResponse<PokerState>;
  legalActions(state: PokerState): EngineResponse<LegalActionSpec>;
  applyAction(state: PokerState, action: PokerAction): EngineResponse<PokerState>;
  applyChance(state: PokerState, chance: ChanceEvent): EngineResponse<PokerState>;
  applyPrivateReveal(state: PokerState, revealEvent: PrivateRevealEvent): EngineResponse<PokerState>;
  resolveShowdown(state: PokerState): EngineResponse<PokerState>;
  applyRecordedSettlement(
    state: PokerState,
    evidence: RecordedHandSettlementEvidence,
  ): EngineResponse<PokerState>;
  derivePotAccounting(state: PokerState): EngineResponse<PotAccounting>;
  isChipConserved(state: PokerState): EngineResponse<boolean>;
  validatePokerState(state: PokerState): EngineResponse<PokerState>;
  createWeightedRangeFromHandClasses(
    options?: CreateHoldemRangeFromHandClassWeightsOptions,
  ): EngineResponse<HoldemWeightedRange>;
  createWeightedRangeFromEntries(
    options?: CreateHoldemRangeFromEntriesOptions,
  ): EngineResponse<HoldemWeightedRange>;
  conditionRange(
    range: HoldemWeightedRange,
    deadCards?: readonly string[],
  ): EngineResponse<HoldemConditionedRange>;
  multiplyRangeByActionFrequencies(
    priorRange: HoldemWeightedRange,
    frequencyRange: HoldemWeightedRange,
  ): EngineResponse<HoldemWeightedRange>;
  analyzeRange(requestInput?: Record<string, unknown>): EngineResponse<RangeAnalysisFacts>;
  projectEquityHands(input: {
    readonly players?: readonly { readonly id: string; readonly cards: readonly string[] | null }[];
    readonly board?: readonly string[];
    readonly deadCards?: readonly string[];
  }): EngineResponse<EquityHandAnalysisProjection>;
  groupRunouts(
    rows: readonly RunoutRow[],
    by?: 'rank' | 'suit' | 'category' | 'effect',
  ): EngineResponse<readonly { readonly key: string; readonly rows: readonly RunoutRow[] }[]>;
  projectOpponentInformation(
    input: CreateOpponentActorInformationInput,
  ): EngineResponse<OpponentActorInformation>;
  projectReplayState(source: CanonicalHandReplaySource, stepIndex: number): EngineResponse<PokerState>;
  isHandInProgressEmbargoed(
    session: { readonly mode?: string; readonly status?: string } | null | undefined,
    options?: { readonly fullHandReviewUnlocked?: boolean },
  ): EngineResponse<TrainingMemoryPresentationGate>;
  projectStrategyMatrix(
    context: StrategyContext,
    evidence: readonly StrategyEvidenceEntry[],
  ): EngineResponse<StrategyMatrixProjection>;
  projectStrategySpotMap(
    tableSize: StrategyTableSize,
    stackDepthBb: StrategyStackDepthBb,
    evidence: readonly StrategyEvidenceEntry[],
  ): EngineResponse<StrategySpotMapProjection>;
  compareStrategyBaseline(
    projection: StrategyMatrixProjection,
    familyId: StrategyFamilyId,
  ): EngineResponse<StrategyBaselineComparison>;
  projectStrategyLeakMap(
    tableSize: StrategyTableSize,
    stackDepthBb: StrategyStackDepthBb,
    evidence: readonly StrategyEvidenceEntry[],
  ): EngineResponse<StrategyLeakMapProjection>;
}

export interface EngineAsyncApi {
  estimateEquity(
    request: EquityRequestInput | WeightedEquityRequestInput,
    options?: { readonly exactLimit?: number },
  ): EngineResponse<Exclude<EquityEstimateResult, { readonly ok: false }>>;
  calculateEquity<TReq extends DispatchableEquityRequest>(
    request: TReq,
    options?: AsyncCallOptions,
  ): Promise<EngineResponse<DispatchedEquityResult>>;
  exploreRunouts(
    request: WeightedEquityRequestInput | EquityRequestInput,
    options?: AsyncCallOptions,
  ): Promise<EngineResponse<RunoutExplorerOutcome>>;
  resolveShowdownAsync(
    state: PokerState,
    options?: Pick<AsyncCallOptions, 'requestId' | 'signal'>,
  ): Promise<EngineResponse<PokerState>>;
  lookupStrategy(
    request: StrategyLookupRequest,
    options?: AsyncCallOptions,
  ): Promise<EngineResponse<StrategyLookupResult>>;
  generateTrainingDrill(
    request: unknown,
    options?: AsyncCallOptions,
  ): Promise<EngineResponse<TrainingDrillResult>>;
  gradeTrainingAnswer(
    input: unknown,
    options?: AsyncCallOptions,
  ): Promise<EngineResponse<TrainingGradeResult>>;
}

export interface EngineClient {
  readonly sync: EngineSyncApi;
  readonly async: EngineAsyncApi;
  readonly transport: 'worker' | 'inline';
  cancel(requestId: string): void;
  createChannel<T>(name: string): EngineChannel<T>;
  dispose(): void;
}

export type {
  ActionSizeFacts,
  ActorCallEconomics,
  AllInLuckFacts,
  AllInLuckInput,
  CanonicalHandReplayEvent,
  CanonicalHandReplaySource,
  ChanceEvent,
  DispatchableEquityRequest,
  DispatchEquityOptions,
  DispatchedEquityResult,
  EquityHandAnalysisProjection,
  EquityOutcome,
  EquityPlayerResult,
  EquityRequestInput,
  EquityResult,
  GameRulesSnapshot,
  HandCategory,
  HoldemConditionedRange,
  HoldemWeightedRange,
  LegalActionSpec,
  PokerAction,
  PokerHandRank,
  PokerPlayerState,
  PokerState,
  PotAccounting,
  PotOddsFacts,
  ReplayFrameOperation,
  ReviewCallEvFacts,
  ReviewCallEvInput,
  RunoutEffectGroup,
  RunoutExplorerOutcome,
  RunoutExplorerResult,
  RunoutRow,
  StrategyActionType,
  StrategyBaselineComparison,
  StrategyContext,
  StrategyDecisionFamily,
  StrategyEvidenceEntry,
  StrategyEvidenceSource,
  StrategyFamilyId,
  StrategyFamilySpec,
  StrategyLeakMapProjection,
  StrategyMatrixCell,
  StrategyMatrixProjection,
  StrategySpotMapProjection,
  StrategySpotRowId,
  StrategySpotState,
  StrategySpotSummary,
  StrategyStackDepthBb,
  StrategyTableSize,
  WeightedEquityOutcome,
  WeightedEquityPlayerResult,
  WeightedEquityRequestInput,
  WeightedEquityResult,
};
