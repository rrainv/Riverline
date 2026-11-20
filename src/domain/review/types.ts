import type { ReadonlySignal, Signal } from '@preact/signals';
import type {
  ActorCallEconomics,
  CanonicalHandReplaySource,
  EngineClient,
  PokerState,
  ReplayFrameOperation,
} from '../../engine-api';
import type {
  EquityStreet,
  HeroDecisionNote,
  RecordedActionMeta,
  SavedHandRecord,
  SavedObjectTagId,
  StudyImportResult,
  StudyRepository,
  ThinkingReasonId,
} from '../storage';

export type ReviewPresetId = 'hand' | 'counterfactual' | 'saved';
export type ReviewSideTab = 'review' | 'saved';
export type CounterfactualRangeId = 'showed' | 'tight' | 'standard' | 'loose';
export type SavedLibraryFilter = 'all' | 'hands' | 'spots' | 'archived';
export type SavedLibrarySort = 'new' | 'big';

export type ReviewLimitationCode =
  | 'no_showdown_cards'
  | 'spot_incomplete'
  | 'multiway_pot'
  | 'approximate_sizing';

export interface ReplayFrameMeta {
  readonly index: number;
  readonly operation: ReplayFrameOperation;
  readonly street: EquityStreet;
  readonly actionSeq?: number;
  readonly playerId?: string;
  readonly positionLabel?: string;
  readonly isHero?: boolean;
  readonly actionType?: RecordedActionMeta['type'];
  readonly amountMilliBb?: number;
  readonly approximate?: boolean;
  readonly boardAdded?: readonly string[];
  readonly revealedPlayerId?: string;
  readonly potMilliBb: number;
  readonly isDecisionFrame: boolean;
}

export interface HeroDecisionRecord {
  readonly decisionIndex: number;
  readonly actionMeta: RecordedActionMeta;
  readonly preActionFrameIndex: number;
  readonly actionFrameIndex: number;
  readonly street: EquityStreet;
  readonly boardAtDecision: readonly string[];
  readonly potBeforeDecisionMilliBb: number;
  readonly heroInvestedBeforeDecisionMilliBb: number;
  readonly callEconomics: ActorCallEconomics;
  readonly facingBet: boolean;
  readonly requiredEquityPct: number | null;
  readonly livePlayerIds: readonly string[];
  readonly villainIds: readonly string[];
}

export interface CounterfactualRangeSpec {
  readonly id: CounterfactualRangeId;
  readonly rangeString: string;
  readonly canonical: string;
  readonly eligibleCombos: number;
  readonly removedCombos: number;
  readonly rangeMatrix: readonly (readonly boolean[])[];
}

export interface DecisionEquityEvaluation {
  readonly decisionIndex: number;
  readonly mode: CounterfactualRangeId;
  readonly tier: 'exact' | 'estimated' | 'unavailable';
  readonly detailKey: 'showdown_exact' | 'showdown_sampled' | 'opponent_assumption' | 'unavailable';
  readonly trials: number | null;
  readonly heroEquityPct: number | null;
  readonly villainEquityPct: number | null;
  readonly requiredEquityPct: number | null;
  readonly deltaVsRequiredPct: number | null;
  readonly villainRangeSpec: CounterfactualRangeSpec | null;
  readonly villainPositionLabel: string | null;
  readonly villainRevealedCards: readonly string[] | null;
  readonly isMathMistake: boolean;
  readonly rangeSampled?: boolean;
  readonly isLoading: boolean;
}

export interface DecisionsVsLuckSummary {
  readonly tier: 'exact' | 'estimated' | 'unavailable';
  readonly isAvailable: boolean;
  readonly unavailableReason: 'spot_incomplete' | 'no_showdown_cards' | null;
  readonly trials: number | null;
  readonly showdownHeroEquityPct: number | null;
  readonly decisiveCallNeededPct: number | null;
  readonly decisiveCallAmountBb: number | null;
  readonly callVsFoldEvBb: number | null;
  readonly handEvBb: number | null;
  readonly runoutLuckBb: number | null;
  readonly actualNetBb: number | null;
  readonly finalPotBb: number;
  readonly wonShowdown: boolean;
  readonly unitLabel: 'bb' | '₪';
  readonly isLoading: boolean;
}

export interface ReviewStreetSummary {
  readonly street: EquityStreet;
  readonly firstFrameIndex: number;
  readonly available: boolean;
  readonly potMilliBb: number;
  readonly spr: number | null;
  readonly boardCards: readonly string[];
}

export interface ReviewSessionSnapshot {
  readonly record: SavedHandRecord;
  readonly isStarterSample: boolean;
  readonly replaySource: CanonicalHandReplaySource;
  readonly frames: readonly ReplayFrameMeta[];
  readonly decisions: readonly HeroDecisionRecord[];
  readonly revealedVillainIds: readonly string[];
  readonly revealedVillainCardsById: Readonly<Record<string, readonly string[]>>;
  readonly streetSummaries: readonly ReviewStreetSummary[];
  readonly limitationCodes: readonly ReviewLimitationCode[];
  readonly totalActionsCount: number;
}

export interface SavedLibraryItemSummary {
  readonly record: SavedHandRecord;
  readonly isStarterSample: boolean;
  readonly isCompleted: boolean;
  readonly finalPotBb: number;
  readonly board: readonly string[];
  readonly heroPosition: string;
  readonly actionCount: number;
  readonly heroNetBb: number | null;
}

export interface ReviewStore {
  readonly engine: EngineClient;
  readonly repository: StudyRepository;

  readonly activeSideTabSignal: Signal<ReviewSideTab>;
  readonly activeRecordSignal: Signal<SavedHandRecord>;
  readonly frameIndexSignal: Signal<number>;
  readonly selectedDecisionIndexSignal: Signal<number>;
  readonly counterfactualRangeSignal: Signal<CounterfactualRangeId>;
  readonly feltExpandedSignal: Signal<boolean>;
  readonly savedHandsSignal: Signal<readonly SavedHandRecord[]>;

  readonly savedFilterSignal: Signal<SavedLibraryFilter>;
  readonly savedSortSignal: Signal<SavedLibrarySort>;
  readonly savedSeatFilterSignal: Signal<string>;
  readonly savedSearchSignal: Signal<string>;
  readonly backupStatusSignal: Signal<
    | { readonly kind: 'idle' }
    | { readonly kind: 'imported'; readonly importedCount: number }
    | { readonly kind: 'error'; readonly detail: string }
  >;

  readonly replaySnapshotSignal: ReadonlySignal<ReviewSessionSnapshot>;
  readonly currentFrameMetaSignal: ReadonlySignal<ReplayFrameMeta>;
  readonly currentPokerStateSignal: ReadonlySignal<PokerState>;
  readonly currentDecisionSignal: ReadonlySignal<HeroDecisionRecord | null>;
  readonly activeHeroNoteSignal: ReadonlySignal<HeroDecisionNote | null>;
  readonly decisionEvaluationSignal: Signal<DecisionEquityEvaluation>;
  readonly decisionsVsLuckSignal: Signal<DecisionsVsLuckSummary>;
  readonly savedLibraryItemsSignal: ReadonlySignal<readonly SavedLibraryItemSummary[]>;
  readonly filteredSavedItemsSignal: ReadonlySignal<readonly SavedLibraryItemSummary[]>;
  readonly availableSeatFiltersSignal: ReadonlySignal<readonly string[]>;

  setActiveSideTab(tab: ReviewSideTab): void;
  openSavedHand(record: SavedHandRecord): void;
  openStarterFridayHand(): void;
  jumpToFrame(frameIndex: number): void;
  stepFrame(delta: -1 | 1): void;
  selectDecision(decisionIndex: number): void;
  selectStreet(street: EquityStreet): void;
  setCounterfactualRange(mode: CounterfactualRangeId): void;
  toggleFeltExpanded(): void;
  toggleThinkingReason(reason: ThinkingReasonId): Promise<void>;
  setThinkingCustomText(text: string): Promise<void>;
  setHandSummaryNote(text: string): Promise<void>;
  toggleActiveHandTag(tag: SavedObjectTagId): Promise<void>;

  refreshSavedLibrary(): Promise<SavedHandRecord[]>;
  setSavedFilter(filter: SavedLibraryFilter): void;
  setSavedSort(sort: SavedLibrarySort): void;
  setSavedSeatFilter(seatLabel: string): void;
  setSavedSearch(query: string): void;
  toggleSavedTag(objectId: string, tag: SavedObjectTagId): Promise<void>;
  archiveSavedItem(objectId: string): Promise<void>;
  restoreSavedItem(objectId: string): Promise<void>;
  exportBackupJson(): Promise<string>;
  importBackupJson(rawText: string): Promise<StudyImportResult>;

  applyPreset(preset: ReviewPresetId): void;
  dispose(): void;
}
