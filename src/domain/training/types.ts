import type {
  ActionType,
  ActorCallEconomics,
  DuelBotStyleId,
  EquityResult,
  LegalActionSpec,
  PokerState,
  StrategyEvidenceEntry,
  StrategyFamilyId,
  StrategyLeakMapProjection,
  StrategyStackDepthBb,
  StrategyTableSize,
  TrainingDrillExercise,
  TrainingDrillTarget,
  TrainingGradeOutput,
} from '../../engine-api';
import type { BoardTextureTagId } from '../equity/boardTexture';
import type { SavedHandPayload, TrainingSessionPayload } from '../storage';
import type { PostflopTextureFilter } from './postflopTextureDrill';

export type TrainingViewId = 'hub' | 'drill' | 'duel' | 'leak_lab';

export type TrainingPresetId =
  | 'hub'
  | 'drill_question'
  | 'drill_answered'
  | 'duel_preflop'
  | 'duel_thinking'
  | 'duel_flop_ladder'
  | 'duel_result';

export type TrainingActionTicketId = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in';

export interface DuelPresetOption {
  readonly id: string;
  readonly labelKey?: 'training.duel.allIn';
  readonly pctLabel?: string;
  readonly amountBb: number;
  readonly adjustable: boolean;
  readonly costLineValues: {
    readonly callBb: number;
    readonly potIfCalledBb: number;
    readonly behindBb: number;
    readonly spr: number;
    readonly oddsPct: number;
  };
}

export interface DuelActionBubble {
  readonly type: ActionType;
  readonly amountBb: number | null;
}

export interface DuelHistoryItem {
  readonly id: string;
  readonly street: PokerState['street'];
  readonly actor: 'hero' | 'astra' | 'board';
  readonly actionType?: ActionType | 'deal';
  readonly amountBb?: number | null;
  readonly potBb?: number;
  readonly textKey: string;
  readonly cards?: readonly string[];
}

export interface DuelBotObservationStats {
  readonly handsPlayed: number;
  readonly vpipHands: number;
  readonly pfrHands: number;
  readonly cbetHands: number;
  readonly cbetOpps: number;
  readonly foldToBetCount: number;
  readonly facingBetCount: number;
}

export interface DuelCompletedHandSummary {
  readonly handNumber: number;
  readonly handId: string;
  readonly heroCards: readonly [string, string];
  readonly astraCards: readonly [string, string];
  readonly netBb: number;
  readonly endedAtStreet: PokerState['street'];
  readonly savedPayload: SavedHandPayload;
}

export interface DuelLiveState {
  readonly sessionSeed: number;
  readonly botStyle: DuelBotStyleId;
  readonly handNumber: number;
  readonly totalHands: number;
  readonly heroIsButton: boolean;
  readonly pokerState: PokerState;
  readonly heroCards: readonly [string, string];
  readonly revealedAstraCards: readonly [string, string] | null;
  readonly astraThinking: boolean;
  readonly heroBubble: DuelActionBubble | null;
  readonly astraBubble: DuelActionBubble | null;
  readonly heroCumulativeNetBb: number;
  readonly lastHandNetBb: number | null;
  readonly legalSpec: LegalActionSpec | null;
  readonly callEconomics: ActorCallEconomics | null;
  readonly sizePresets: readonly DuelPresetOption[];
  readonly customSizeAmountsBb: Readonly<Record<string, number>>;
  readonly historyItems: readonly DuelHistoryItem[];
  readonly handEquity: EquityResult | null;
  readonly equityLoading: boolean;
  readonly readTableOpen: boolean;
  readonly botStats: DuelBotObservationStats;
  readonly completedHands: readonly DuelCompletedHandSummary[];
  readonly finishedMatch: boolean;
  readonly savedToReviewCount: number;
}

export interface TrainingWeekStats {
  readonly sessionsCount: number;
  readonly spotsCount: number;
  readonly netDuelBb: number;
}

export interface LeakLabTargetItem {
  readonly key: string;
  readonly position: string;
  readonly familyId: StrategyFamilyId;
  readonly deltaPoints: number | null;
  readonly userCombos: number;
  readonly baselineCombos: number | null;
  readonly drillCount: number;
}

export interface DrillSessionStats {
  readonly answeredCount: number;
  readonly baselineAlignedCount: number;
  readonly planAlignedCount: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly missedCount: number;
  readonly retryingMissed: boolean;
}

export interface DrillEquityCheck {
  readonly loading: boolean;
  readonly heroEquityPct: number | null;
  readonly requiredEquityPct: number;
  readonly marginPct: number | null;
  readonly trials: number | null;
}

export interface TrainingDrillFilters {
  readonly tableSize: StrategyTableSize;
  readonly stackDepthBb: StrategyStackDepthBb;
  readonly target: TrainingDrillTarget | 'auto' | 'postflop_texture';
  readonly boardTextureFilter: PostflopTextureFilter;
  readonly focusPosition: string | null;
  readonly focusFamilyId: StrategyFamilyId | null;
}

export type {
  BoardTextureTagId,
  PostflopTextureFilter,
  TrainingSessionPayload,
  TrainingDrillExercise,
  TrainingGradeOutput,
  StrategyEvidenceEntry,
  StrategyLeakMapProjection,
};
