import type { OpponentActorInformation } from '../privacy-fences';
import type {
  ActionType,
  ActorCallEconomics,
  LegalActionSpec,
  PokerAction,
  PokerState,
} from '../schema';
import type {
  StrategyActionType,
  StrategyCellStatus,
  StrategyContext,
  StrategyEvidenceEntry,
  StrategyFamilyId,
  StrategyStackDepthBb,
  StrategyTableSize,
} from '../personal-strategy/types';

export type TrainingDrillTarget =
  | 'preflop_rfi'
  | 'preflop_facing_open'
  | 'preflop_facing_3bet';

export interface TrainingDrillRequest {
  readonly seed?: number;
  readonly tableSize?: StrategyTableSize;
  readonly stackDepthBb?: StrategyStackDepthBb;
  readonly target?: TrainingDrillTarget | 'auto';
  readonly focusPosition?: string;
  readonly focusFamilyId?: StrategyFamilyId;
  readonly evidence?: readonly StrategyEvidenceEntry[];
}

export type TrainingMixSegmentTone =
  | 'fold'
  | 'call'
  | 'raise1'
  | 'raise2'
  | 'raise3';

export interface TrainingDrillMixSegment {
  readonly id: string;
  readonly action: StrategyActionType;
  readonly labelKind: 'fold' | 'call' | 'raise';
  readonly amountBb: number | null;
  readonly pct: number;
  readonly tone: TrainingMixSegmentTone;
}

export type TrainingDrillReasonKind =
  | 'leak_gap'
  | 'baseline_edge'
  | 'spot_practice';

export interface TrainingDrillExercise {
  readonly exerciseId: string;
  readonly seed: number;
  readonly tableSize: StrategyTableSize;
  readonly stackDepthBb: StrategyStackDepthBb;
  readonly decisionFamily: TrainingDrillTarget;
  readonly heroPosition: string;
  readonly openerPosition: string | null;
  readonly openerBetBb: number | null;
  readonly playersBehind: number;
  readonly heroCards: readonly [string, string];
  readonly handClass: string;
  readonly familyId: StrategyFamilyId | null;
  readonly pokerState: PokerState;
  readonly legalSpec: LegalActionSpec;
  readonly callEconomics: ActorCallEconomics;
  readonly toCallBb: number;
  readonly potBeforeActionBb: number;
  readonly potAfterCallBb: number;
  readonly requiredEquityPct: number;
  readonly raisePresetsBb: readonly number[];
  readonly baselineMix: readonly TrainingDrillMixSegment[];
  readonly baselineTier: 'estimated' | 'unavailable';
  readonly strategyContext: StrategyContext;
  readonly reasonKind: TrainingDrillReasonKind;
}

export interface TrainingGradeInput {
  readonly exercise: TrainingDrillExercise;
  readonly chosenActionType: ActionType;
  readonly chosenAmountToBb?: number | null;
  readonly evidence?: readonly StrategyEvidenceEntry[];
  readonly occurredAt?: string;
}

export type TrainingGradeComparison =
  | 'matches'
  | 'close'
  | 'differs'
  | 'unavailable';

export type TrainingLampMood = 'idle' | 'speaking' | 'curious' | 'approving';

export interface TrainingGradeOutput {
  readonly exerciseId: string;
  readonly chosenActionType: ActionType;
  readonly chosenAmountToBb: number | null;
  readonly baselineTier: 'estimated' | 'unavailable';
  readonly comparison: TrainingGradeComparison;
  readonly grade: null;
  readonly isMathMistake: false;
  readonly chosenPct: number | null;
  readonly bestActionType: StrategyActionType | null;
  readonly bestPct: number | null;
  readonly youPointerPct: number;
  readonly mixSegments: readonly TrainingDrillMixSegment[];
  readonly userPlanAction: StrategyActionType | null;
  readonly userPlanStatus: StrategyCellStatus;
  readonly matchesUserPlan: boolean | null;
  readonly lampMood: TrainingLampMood;
  readonly evidenceEntry: StrategyEvidenceEntry;
}

export type DuelBotStyleId = 'balanced' | 'tight_aggressive' | 'loose_aggressive';

export interface DuelBotDecisionInput {
  readonly actorInfo: OpponentActorInformation;
  readonly seed: number;
  readonly style?: DuelBotStyleId;
}

export interface DuelBotDecision {
  readonly action: PokerAction;
  readonly reasonCode:
    | 'preflop_value_raise'
    | 'preflop_call'
    | 'preflop_fold'
    | 'postflop_value_bet'
    | 'postflop_bluff_bet'
    | 'postflop_call_odds'
    | 'postflop_check'
    | 'postflop_fold';
}
