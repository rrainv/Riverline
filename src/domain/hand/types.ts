import type { Signal, ReadonlySignal } from '@preact/signals';
import type {
  ActorCallEconomics,
  EngineClient,
  LegalActionSpec,
  PokerState,
} from '../../engine-api';
import type {
  EquityStreet,
  HeroDecisionNote,
  RecordedActionMeta,
  SavedHandPayload,
  SavedHandRecord,
  StudyRepository,
  TableRulesPresetId,
  ThinkingReasonId,
} from '../storage';

export type RecorderPresetId = 'raise' | 'flop_grid' | 'typed_error' | 'done';
export type RecorderInputMode = 'tap' | 'shorthand';
export type RecorderSideTab = 'record' | 'saved';
export type TicketChoiceId = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in';

export const RECORDER_STACK_DEPTHS_BB = [30, 40, 50, 60, 100, 150, 200] as const;
export type RecorderStackDepthBb = (typeof RECORDER_STACK_DEPTHS_BB)[number];

export const RECORDER_ANTE_MODES = ['none', 'bb_ante_1', 'per_player_0_2'] as const;
export type RecorderAnteMode = (typeof RECORDER_ANTE_MODES)[number];

export const RECORDER_BLIND_PRESETS = ['0.5/1', '1/2', '2/5', '5/10'] as const;
export type RecorderBlindPreset = (typeof RECORDER_BLIND_PRESETS)[number];

export interface TablePresetSpec {
  readonly id: TableRulesPresetId;
  readonly unitLabel: 'bb' | '₪';
  readonly defaultSeatCount: 6 | 8;
  readonly allowedSeats: readonly (6 | 8)[];
  readonly startingStackBb: number;
}

export interface AvailableSeatPosition {
  readonly seatIndex: number;
  readonly position: string;
}

export type RecordedStep =
  | {
      readonly kind: 'action';
      readonly playerId: string;
      readonly type: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in';
      readonly amountToMilliBb: number | null;
      readonly approximate: boolean;
    }
  | {
      readonly kind: 'chance';
      readonly chanceType: 'deal_flop' | 'deal_turn' | 'deal_river';
      readonly cards: readonly string[];
    }
  | {
      readonly kind: 'reveal';
      readonly playerId: string;
      readonly cards: readonly [string, string];
    };

export interface RecorderLadderOption {
  readonly id: 's1' | 's2' | 's3';
  readonly value: number;
  readonly unit: 'bb' | '₪';
  readonly amountMilliBb: number;
  readonly potShare: number | null;
  readonly sprAfterCalled: number | null;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly isAllIn: boolean;
}

export interface RecorderHandSnapshot {
  readonly pokerState: PokerState;
  readonly recordedActions: readonly RecordedActionMeta[];
  readonly legalActions: LegalActionSpec | null;
  readonly callEconomics: ActorCallEconomics | null;
  readonly availablePositions: readonly AvailableSeatPosition[];
  readonly shorthandLine: string;
  readonly shorthandTokens: readonly string[];
  readonly deadCards: readonly string[];
}

export interface HandRecorderStore {
  readonly engine: EngineClient;
  readonly repository: StudyRepository;

  readonly tablePresetSignal: Signal<TableRulesPresetId>;
  readonly seatCountSignal: Signal<6 | 8>;
  readonly startingStackOverrideBbSignal: Signal<number | null>;
  readonly seatStackOverridesBbSignal: Signal<Readonly<Record<number, number>>>;
  readonly anteModeSignal: Signal<RecorderAnteMode>;
  readonly blindPresetSignal: Signal<RecorderBlindPreset>;
  readonly quickTapVillainsSignal: Signal<boolean>;
  readonly heroSeatIndexSignal: Signal<number>;
  readonly heroCardsSignal: Signal<readonly [string, string]>;
  readonly stepsSignal: Signal<readonly RecordedStep[]>;
  readonly heroNotesSignal: Signal<readonly HeroDecisionNote[]>;

  readonly inputModeSignal: Signal<RecorderInputMode>;
  readonly activeSideTabSignal: Signal<RecorderSideTab>;
  readonly selectedTicketSignal: Signal<TicketChoiceId | undefined>;
  readonly selectedSizeIdSignal: Signal<'s1' | 's2' | 's3'>;
  readonly sizeOverridesSignal: Signal<Partial<Record<'s1' | 's2' | 's3', number>>>;
  readonly approximateSizeSignal: Signal<boolean>;
  readonly pendingBoardCardsSignal: Signal<readonly string[]>;

  readonly shorthandTokensSignal: Signal<readonly string[]>;
  readonly shorthandDraftSignal: Signal<string>;
  readonly shorthandErrorSignal: Signal<string | null>;
  readonly shorthandErrorDetailSignal: Signal<import('./shorthandCompiler').ShorthandCompileError | null>;

  readonly selectedNoteActionSeqSignal: Signal<number | null>;
  readonly handNoteSignal: Signal<string>;
  readonly savedHandsSignal: Signal<readonly SavedHandRecord[]>;
  readonly linkedNightSessionIdSignal: Signal<string | null>;
  readonly linkedNightTitleSignal: Signal<string | null>;

  readonly unitLabelSignal: ReadonlySignal<'bb' | '₪'>;
  readonly startingStackBbSignal: ReadonlySignal<number>;
  readonly handSnapshotSignal: ReadonlySignal<RecorderHandSnapshot>;
  readonly ladderOptionsSignal: ReadonlySignal<readonly RecorderLadderOption[]>;
  readonly currentStreetSignal: ReadonlySignal<EquityStreet>;
  readonly canFoldRemainingToHeroSignal: ReadonlySignal<boolean>;
  readonly activeHeroNoteSignal: ReadonlySignal<{
    readonly keySeq: number;
    readonly street: EquityStreet;
    readonly reasonChip?: ThinkingReasonId;
    readonly customText: string;
  }>;

  setTablePreset(preset: TableRulesPresetId): void;
  setSeatCount(count: 6 | 8): void;
  setStartingStackBb(stackBb: number | null): void;
  setSeatStackOverrideBb(seatIndex: number, stackBb: number | null): void;
  setAnteMode(mode: RecorderAnteMode): void;
  setBlindPreset(preset: RecorderBlindPreset): void;
  setQuickTapVillains(enabled: boolean): void;
  setLinkedNightSessionId(nightId: string | null): void;
  configureFromNight(opts: {
    readonly nightSessionId: string;
    readonly nightTitle: string;
    readonly unitPreset: 'chips' | 'ils';
    readonly seatCount: 6 | 8;
    readonly heroCards?: readonly [string, string];
    readonly heroSeatIndex?: number;
    readonly startingStackBb?: number;
  }): void;
  setHeroSeatIndex(seatIndex: number): void;
  setHeroCard(slotIndex: 0 | 1, card: string): void;
  randomizeHeroCards(): void;
  setInputMode(mode: RecorderInputMode): void;
  setActiveSideTab(tab: RecorderSideTab): void;

  selectTicket(ticket: TicketChoiceId | undefined): void;
  selectSizeId(sizeId: 's1' | 's2' | 's3'): void;
  adjustLadderSize(sizeId: 's1' | 's2' | 's3', nextValue: number): void;
  resetSizeLadder(): void;
  setApproximateSize(next: boolean): void;

  confirmTicketAction(): boolean;
  foldRemainingToHeroOrEnd(): number;
  togglePendingBoardCard(card: string): void;
  commitPendingBoardCards(): boolean;
  dealRandomPendingStreet(seed?: number): boolean;
  revealOpponentHoleCards(playerId: string, cards: readonly [string, string]): boolean;
  stepBack(): boolean;
  resetHand(): void;

  setShorthandTokens(tokens: readonly string[]): void;
  setShorthandDraft(draft: string): void;
  applyShorthandLine(): boolean;

  selectNoteActionSeq(seq: number | null): void;
  toggleHeroReasonChip(reason: ThinkingReasonId): void;
  setHeroCustomNote(text: string): void;
  setHandNote(text: string): void;

  refreshSavedHands(): Promise<SavedHandRecord[]>;
  saveCurrentHand(): Promise<SavedHandRecord>;
  loadSavedHand(record: SavedHandRecord): void;
  archiveSavedHand(objectId: string): Promise<void>;
  applyPreset(preset: RecorderPresetId): void;
  buildSavedPayload(): SavedHandPayload;
  dispose(): void;
}
