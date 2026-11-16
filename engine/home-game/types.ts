export const HOME_GAME_ENGINE_SCHEMA_VERSION = 'home-game/v2' as const;

export type HomeGameUnitPresetId = 'chips' | 'ils';

export interface HomeGameCurrency {
  readonly code: 'PTS' | 'ILS';
  readonly label: string;
  readonly minorUnit: 0 | 2;
  readonly unitPreset: HomeGameUnitPresetId;
  readonly defaultBuyInMinor: number;
  readonly stepMinor: number;
}

export const HOME_GAME_CURRENCY_PRESETS: Readonly<
  Record<HomeGameUnitPresetId, HomeGameCurrency>
> = Object.freeze({
  chips: Object.freeze({
    code: 'PTS',
    label: 'pts',
    minorUnit: 0,
    unitPreset: 'chips',
    defaultBuyInMinor: 200,
    stepMinor: 50,
  }),
  ils: Object.freeze({
    code: 'ILS',
    label: '₪',
    minorUnit: 2,
    unitPreset: 'ils',
    defaultBuyInMinor: 20_000,
    stepMinor: 5_000,
  }),
});

export type HomeGameSessionStatus = 'active' | 'completed';

export type HomeGameParticipantStatus = 'active' | 'cashed_out';

export type HomeGameTransactionType =
  | 'buy_in'
  | 'rebuy'
  | 'add_on'
  | 'cash_out'
  | 'correction';

export interface HomeGameParticipant {
  readonly playerId: string;
  readonly displayName: string;
  readonly seatNumber: number;
  readonly status: HomeGameParticipantStatus;
}

export type HomeGameLifecycleEventType =
  | 'created'
  | 'settled'
  | 'reopened'
  | 'archived'
  | 'restored';

export interface HomeGameLifecycleEvent {
  readonly type: HomeGameLifecycleEventType;
  readonly at: string;
  readonly revision: number;
}

export interface HomeGameSession {
  readonly sessionId: string;
  readonly title: string;
  readonly status: HomeGameSessionStatus;
  readonly currency: HomeGameCurrency;
  readonly participants: readonly HomeGameParticipant[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly settledAt: string | null;
  readonly archived: boolean;
  readonly revision: number;
  readonly lifecycleEvents: readonly HomeGameLifecycleEvent[];
}

export interface HomeGameTransaction {
  readonly transactionId: string;
  readonly sessionId: string;
  readonly playerId: string;
  readonly type: HomeGameTransactionType;
  readonly amountMinor: number;
  readonly createdAt: string;
  readonly note: string | null;
  readonly correctionOfTransactionId: string | null;
  readonly replacementOfTransactionId: string | null;
}

export interface HomeGameLedgerValidation {
  readonly transactions: readonly HomeGameTransaction[];
  readonly correctedTransactionIds: readonly string[];
}

export interface HomeGameLedgerHistoryItem {
  readonly order: number;
  readonly original: HomeGameTransaction;
  readonly corrected: boolean;
  readonly correction: HomeGameTransaction | null;
  readonly replacement: HomeGameTransaction | null;
}

export interface HomeGameParticipantResult {
  readonly playerId: string;
  readonly displayName: string;
  readonly seatNumber: number;
  readonly status: HomeGameParticipantStatus;
  readonly totalInMinor: number;
  readonly totalOutMinor: number;
  readonly netMinor: number;
  readonly buyInCount: number;
}

export interface HomeGameAccounting {
  readonly sessionId: string;
  readonly currency: HomeGameCurrency;
  readonly totalInMinor: number;
  readonly totalOutMinor: number;
  readonly balanceMinor: number;
  readonly balanced: boolean;
  readonly pendingPlayerIds: readonly string[];
  readonly readyToSettle: boolean;
  readonly participantResults: readonly HomeGameParticipantResult[];
}

export type HomeGameSettleBlockReason =
  | 'already_settled'
  | 'pending_cashout'
  | 'more_in_than_out'
  | 'more_out_than_in';

export type HomeGameSettleReadiness =
  | {
      readonly ok: true;
      readonly accounting: HomeGameAccounting;
    }
  | {
      readonly ok: false;
      readonly reason: HomeGameSettleBlockReason;
      readonly pendingPlayerIds: readonly string[];
      readonly balanceMinor: number;
      readonly accounting: HomeGameAccounting;
    };

export interface HomeGameTransfer {
  readonly fromPlayerId: string;
  readonly fromName: string;
  readonly toPlayerId: string;
  readonly toName: string;
  readonly amountMinor: number;
}

export interface HomeGameSettlement {
  readonly sessionId: string;
  readonly currency: HomeGameCurrency;
  readonly totalTransferredMinor: number;
  readonly transfers: readonly HomeGameTransfer[];
}

export interface HomeGameMorningSummary {
  readonly sessionId: string;
  readonly title: string;
  readonly settled: boolean;
  readonly settledAt: string | null;
  readonly currency: HomeGameCurrency;
  readonly totalInMinor: number;
  readonly totalOutMinor: number;
  readonly playerCount: number;
  readonly transferCount: number;
  readonly transfers: readonly HomeGameTransfer[];
  readonly standings: readonly HomeGameParticipantResult[];
  readonly largestWinner: HomeGameParticipantResult | null;
  readonly largestSwing: HomeGameParticipantResult | null;
}
