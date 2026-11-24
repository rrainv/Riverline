import type { ReadonlySignal, Signal } from '@preact/signals';
import type {
  EngineClient,
  HomeGameAccounting,
  HomeGameLedgerHistoryItem,
  HomeGameMorningSummary,
  HomeGameSettlement,
  HomeGameSettleReadiness,
  HomeGameUnitPresetId,
} from '../../engine-api';
import type {
  NightSessionRecord,
  SavedHandRecord,
  StudyRepository,
} from '../storage';

export type NightsTabId = 'ledger' | 'hands' | 'settle' | 'past';

export type NightsPresetId =
  | 'empty'
  | 'ledger'
  | 'sheet'
  | 'hands'
  | 'settle_blocked'
  | 'settle_ready'
  | 'morning_after';

export type NightsSheetFocus = 'rebuy' | 'cash' | null;

export type NightsHandStackBb = 30 | 40 | 50 | 60 | 100;

export interface NightsHandSeatPosition {
  readonly seatIndex: number;
  readonly position: string;
}

export interface NightsShorthandTokenChip {
  readonly text: string;
  readonly valid: boolean;
}

export interface NightsShorthandPreview {
  readonly tokens: readonly NightsShorthandTokenChip[];
  readonly valid: boolean;
  readonly actionCount: number;
  readonly boardCardCount: number;
  readonly errorToken: string | null;
  readonly errorMessage?: string | null;
}

export interface CreateNightInput {
  readonly title: string;
  readonly unitPreset: HomeGameUnitPresetId;
  readonly players: readonly {
    readonly displayName: string;
    readonly initialBuyInInput: string;
  }[];
}

export interface NightsStore {
  readonly engine: EngineClient;
  readonly repository: StudyRepository;

  readonly sessionsSignal: Signal<readonly NightSessionRecord[]>;
  readonly savedHandsByIdSignal: Signal<Readonly<Record<string, SavedHandRecord>>>;
  readonly activeNightIdSignal: Signal<string | null>;
  readonly activeTabSignal: Signal<NightsTabId>;
  readonly selectedPlayerIdSignal: Signal<string | null>;
  readonly sheetFocusSignal: Signal<NightsSheetFocus>;
  readonly rebuyDraftMajorSignal: Signal<number>;
  readonly cashOutDraftTextSignal: Signal<string>;
  readonly handShorthandInputSignal: Signal<string>;
  readonly handHeroCardsSignal: Signal<readonly [string, string]>;
  readonly handSeatCountSignal: Signal<6 | 8>;
  readonly handHeroSeatIndexSignal: Signal<number>;
  readonly handStartingStackBbSignal: Signal<NightsHandStackBb>;
  readonly handNoteDraftSignal: Signal<string>;
  readonly errorMessageSignal: Signal<string | null>;
  readonly toastMessageSignal: Signal<string | null>;
  readonly showArchivedSignal: Signal<boolean>;
  readonly createModalOpenSignal: Signal<boolean>;
  readonly isEphemeralPresetSignal: Signal<boolean>;

  readonly activeNightSignal: ReadonlySignal<NightSessionRecord | null>;
  readonly activeAccountingSignal: ReadonlySignal<HomeGameAccounting | null>;
  readonly settleReadinessSignal: ReadonlySignal<HomeGameSettleReadiness | null>;
  readonly settlementSignal: ReadonlySignal<HomeGameSettlement | null>;
  readonly ledgerHistorySignal: ReadonlySignal<readonly HomeGameLedgerHistoryItem[]>;
  readonly morningSummarySignal: ReadonlySignal<HomeGameMorningSummary | null>;
  readonly remainingOnTableMinorSignal: ReadonlySignal<number | null>;
  readonly shorthandPreviewSignal: ReadonlySignal<NightsShorthandPreview>;
  readonly handSeatPositionsSignal: ReadonlySignal<readonly NightsHandSeatPosition[]>;
  readonly recentPlayerNamesSignal: ReadonlySignal<readonly string[]>;

  hydrate(): Promise<void>;
  selectNight(sessionId: string): void;
  setActiveTab(tab: NightsTabId): void;
  setCreateModalOpen(open: boolean): void;

  createNight(input: CreateNightInput): Promise<NightSessionRecord | null>;
  addPlayer(displayName: string, initialBuyInInput?: string): Promise<boolean>;
  openPlayerSheet(playerId: string, focus?: NightsSheetFocus): void;
  closePlayerSheet(): void;
  setRebuyDraftMajor(amountMajor: number): void;
  setCashOutDraftText(text: string): void;
  stepCashOutDraft(deltaMajor: number): void;
  fillRemainingCashOut(): void;

  addRebuy(playerId: string, amountMajor: number, txType?: 'rebuy' | 'add_on'): Promise<boolean>;
  cashOutPlayer(playerId: string, amountText: string): Promise<boolean>;
  returnPlayerToTable(playerId: string): Promise<boolean>;
  correctLedgerEntry(transactionId: string): Promise<boolean>;
  restoreLedgerEntry(originalTransactionId: string): Promise<boolean>;

  settleActiveNight(): Promise<boolean>;
  reconcileDiscrepancy(
    mode: 'assign_player' | 'split_even',
    targetPlayerId?: string,
  ): Promise<boolean>;
  reopenActiveNight(): Promise<boolean>;
  archiveNight(sessionId: string, archived: boolean): Promise<boolean>;
  exportActiveNightPack(): { readonly filename: string; readonly json: string } | null;
  importNightPackJson(raw: string): Promise<boolean>;

  setHandShorthandInput(text: string): void;
  setHandHeroCard(slotIndex: 0 | 1, card: string): void;
  randomizeHandHeroCards(): void;
  setHandSeatCount(count: 6 | 8): void;
  setHandHeroSeatIndex(seatIndex: number): void;
  setHandStartingStackBb(bb: NightsHandStackBb): void;
  setHandNoteDraft(text: string): void;
  updateActiveNightNote(text: string): Promise<void>;
  saveQuickShorthandHand(): Promise<SavedHandRecord | null>;
  dismissToast(): void;
  clearError(): void;

  applyPreset(preset: NightsPresetId): void;
  dispose(): void;
}
