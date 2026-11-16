import type {
  HomeGameCurrency,
  HomeGameParticipant,
  HomeGameSession,
  HomeGameTransaction,
  LearnConceptId,
  LearnTrainerMode,
  PokerState,
  StrategyEvidenceEntry,
} from '../../engine-api';
import type { AppearancePreferences } from '../appearance';

export const STUDY_DB_NAME = 'riverline-study-v1';
export const STUDY_DB_VERSION = 1;
export const STUDY_EVENTS_STORE = 'events';
export const SAVED_MATCHUP_SCHEMA_VERSION = 1;
export const STUDY_BUNDLE_SCHEMA_VERSION = 1;

export type EquityStreet = 'preflop' | 'flop' | 'turn' | 'river';

export type TableRulesPresetId = 'six_max_100bb' | 'home_game_50bb';

export type ThinkingReasonId =
  | 'stealing'
  | 'value'
  | 'draw'
  | 'pot_committed'
  | 'bluff_catch';

export type SavedObjectTagId = 'review_later' | 'unsure' | 'study';

export interface SavedHandAnnotatedPayload {
  readonly tags?: readonly SavedObjectTagId[];
  readonly heroNotes?: readonly HeroDecisionNote[];
}

export interface RecordedActionMeta {
  readonly seq: number;
  readonly street: EquityStreet;
  readonly playerId: string;
  readonly seatIndex: number;
  readonly positionLabel: string;
  readonly isHero: boolean;
  readonly type: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in';
  readonly amountMilliBb?: number;
  readonly approximate?: boolean;
}

export interface HeroDecisionNote {
  readonly actionSeq: number;
  readonly street: EquityStreet;
  readonly reasonChip?: ThinkingReasonId;
  readonly customText?: string;
}

export interface SavedHandPayload {
  readonly handId: string;
  readonly tablePreset: TableRulesPresetId;
  readonly unitLabel: 'bb' | '₪';
  readonly seatCount: 2 | 6 | 8;
  readonly startingStackBb: number;
  readonly heroPlayerId: string;
  readonly heroSeat: number;
  readonly heroPositionLabel: string;
  readonly heroCards: readonly [string, string];
  readonly pokerState: PokerState;
  readonly recordedActions: readonly RecordedActionMeta[];
  readonly heroNotes: readonly HeroDecisionNote[];
  readonly shorthandLine: string;
  readonly savedKind: 'completed_hand' | 'mid_hand_spot';
  readonly tags?: readonly SavedObjectTagId[];
}

export interface SavedHandRecord {
  readonly objectId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archived: boolean;
  readonly factTitle: string;
  readonly tags: readonly SavedObjectTagId[];
  readonly payload: SavedHandPayload;
}

export interface SavedMatchupPlayer {
  readonly id: string;
  readonly label: string;
  readonly isHero: boolean;
  readonly rawInput: string;
  readonly inputKind: 'exact' | 'range' | 'any';
}

export interface SavedMatchupPayload {
  readonly schemaVersion: typeof SAVED_MATCHUP_SCHEMA_VERSION;
  readonly factTitle: string;
  readonly board: readonly string[];
  readonly players: readonly SavedMatchupPlayer[];
  readonly street: EquityStreet;
  readonly selectedTurnCard?: string;
  readonly selectedRiverCard?: string;
}

export type StudyEventType =
  | 'saved_matchup.created'
  | 'saved_matchup.archived'
  | 'saved_hand.created'
  | 'saved_hand.archived'
  | 'saved_hand.restored'
  | 'saved_hand.annotated'
  | 'strategy_evidence.recorded'
  | 'training_session.recorded'
  | 'night_session.created'
  | 'night_session.updated'
  | 'night_session.settled'
  | 'night_session.reopened'
  | 'night_session.archived'
  | 'night_ledger.appended'
  | 'night_hand.linked'
  | 'learn_concept.updated'
  | 'learn_trainer.recorded';

export interface NightSessionCreatedPayload {
  readonly session: HomeGameSession;
}

export interface NightSessionUpdatedPayload {
  readonly title?: string;
  readonly currency?: HomeGameCurrency;
  readonly participants?: readonly HomeGameParticipant[];
}

export interface NightSessionArchivedPayload {
  readonly archived: boolean;
}

export interface NightHandLinkedPayload {
  readonly nightSessionId: string;
  readonly handObjectId: string;
  readonly shorthandSummary?: string;
  readonly linkedAt: string;
}

export interface NightLinkedHandRef {
  readonly handObjectId: string;
  readonly linkedAt: string;
  readonly shorthandSummary?: string;
}

export interface NightSessionRecord {
  readonly session: HomeGameSession;
  readonly transactions: readonly HomeGameTransaction[];
  readonly linkedHands: readonly NightLinkedHandRef[];
}

export interface StrategyEvidenceBatchPayload {
  readonly entries: readonly StrategyEvidenceEntry[];
}

export interface TrainingSessionPayload {
  readonly sessionId: string;
  readonly mode: 'quick_drill' | 'heads_up_duel';
  readonly completedAt: string;
  readonly spotsCount: number;
  readonly planAlignedCount: number;
  readonly baselineAlignedCount: number;
  readonly netBb?: number;
  readonly handsPlayed?: number;
  readonly focusLabel?: string;
}

export interface LearnConceptUpdatedPayload {
  readonly conceptId: LearnConceptId;
  readonly understood: boolean;
  readonly updatedAt: string;
}

export interface LearnTrainerRecordedPayload {
  readonly mode: LearnTrainerMode;
  readonly spotId: string;
  readonly firstTryCorrect: boolean;
  readonly answeredAt: string;
}

export interface LearnProgressSnapshot {
  readonly understoodById: Readonly<Partial<Record<LearnConceptId, boolean>>>;
  readonly trainerAttempts: readonly LearnTrainerRecordedPayload[];
}

export interface StudyEvent {
  readonly id: string;
  readonly seq: number;
  readonly ts: string;
  readonly domain: 'savedObjects';
  readonly type: StudyEventType;
  readonly objectId: string;
  readonly payload:
    | SavedMatchupPayload
    | SavedHandPayload
    | SavedHandAnnotatedPayload
    | StrategyEvidenceBatchPayload
    | TrainingSessionPayload
    | LearnConceptUpdatedPayload
    | LearnTrainerRecordedPayload
    | NightSessionCreatedPayload
    | NightSessionUpdatedPayload
    | NightSessionArchivedPayload
    | HomeGameTransaction
    | NightHandLinkedPayload
    | { readonly reason?: string; readonly settledAt?: string; readonly reopenedAt?: string };
}

export interface SavedMatchupRecord {
  readonly objectId: string;
  readonly createdAt: string;
  readonly factTitle: string;
  readonly payload: SavedMatchupPayload;
}

export interface StudyExportBundle {
  readonly schemaVersion: typeof STUDY_BUNDLE_SCHEMA_VERSION;
  readonly exportedAt: string;
  readonly appearance: AppearancePreferences;
  readonly events: readonly StudyEvent[];
}

export type StudyImportErrorCode =
  | 'invalid_json'
  | 'unsupported_schema_version'
  | 'invalid_bundle'
  | 'invalid_event';

export type StudyImportResult =
  | {
      readonly ok: true;
      readonly importedCount: number;
      readonly skippedDuplicates: number;
      readonly savedMatchups: readonly SavedMatchupRecord[];
      readonly savedHands: readonly SavedHandRecord[];
    }
  | {
      readonly ok: false;
      readonly errorCode: StudyImportErrorCode;
      readonly detail?: string;
    };
