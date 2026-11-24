import type {
  ActionType,
  DuelBotStyleId,
  LegalActionSpec,
  PokerState,
} from '../../engine-api';
import type { SavedHandPayload } from '../storage';
import type { DuelActionBubble, DuelLiveState, DuelPresetOption } from './types';

export const ORBIT_TOTAL_HANDS = 6;
export const ORBIT_STARTING_STACK_BB = 100;

export type OrbitStreet = PokerState['street'];

export type OrbitLineupId = 'standard_mix' | 'home_game_loose' | 'pressure_regs';

export const ORBIT_LINEUPS: Readonly<Record<OrbitLineupId, Readonly<Record<string, DuelBotStyleId>>>> = {
  standard_mix: {
    'bot-1': 'balanced',
    'bot-2': 'tight_aggressive',
    'bot-3': 'loose_aggressive',
    'bot-4': 'balanced',
    'bot-5': 'tight_aggressive',
  },
  home_game_loose: {
    'bot-1': 'loose_aggressive',
    'bot-2': 'loose_aggressive',
    'bot-3': 'balanced',
    'bot-4': 'loose_aggressive',
    'bot-5': 'balanced',
  },
  pressure_regs: {
    'bot-1': 'tight_aggressive',
    'bot-2': 'tight_aggressive',
    'bot-3': 'loose_aggressive',
    'bot-4': 'tight_aggressive',
    'bot-5': 'balanced',
  },
};

export interface OrbitBotProfile {
  readonly playerId: string;
  readonly seat: number;
  readonly name: string;
  readonly style: DuelBotStyleId;
}

export const ORBIT_BOTS: readonly OrbitBotProfile[] = [
  { playerId: 'bot-1', seat: 1, name: 'Astra', style: 'balanced' },
  { playerId: 'bot-2', seat: 2, name: 'Nora', style: 'tight_aggressive' },
  { playerId: 'bot-3', seat: 3, name: 'Leo', style: 'loose_aggressive' },
  { playerId: 'bot-4', seat: 4, name: 'Sam', style: 'balanced' },
  { playerId: 'bot-5', seat: 5, name: 'Mika', style: 'tight_aggressive' },
];

export interface OrbitHistoryItem {
  readonly id: string;
  readonly street: OrbitStreet;
  readonly actor: string;
  readonly actorName: string;
  readonly actionType: ActionType | 'deal';
  readonly amountBb?: number | null;
  readonly textKey: string;
  readonly cards?: readonly string[];
}

export interface OrbitCompletedHandSummary {
  readonly handNumber: number;
  readonly handId: string;
  readonly heroPositionLabel: string;
  readonly heroCards: readonly [string, string];
  readonly revealedCardsByPlayer: Readonly<Record<string, readonly [string, string]>>;
  readonly netBb: number;
  readonly endedAtStreet: OrbitStreet;
  readonly winnerPlayerIds: readonly string[];
  readonly savedPayload: SavedHandPayload;
}

export interface OrbitBotStatRow {
  readonly playerId: string;
  readonly name: string;
  readonly handsPlayed: number;
  readonly vpipHands: number;
  readonly pfrHands: number;
  readonly aggressiveActions: number;
}

export interface OrbitLiveState {
  readonly sessionSeed: number;
  readonly lineupId: OrbitLineupId;
  readonly readTableOpen: boolean;
  readonly botStatsByPlayer: Readonly<Record<string, OrbitBotStatRow>>;
  readonly handNumber: number;
  readonly totalHands: number;
  readonly buttonSeat: number;
  readonly heroPositionLabel: string;
  readonly heroCards: readonly [string, string];
  readonly pokerState: PokerState;
  readonly revealedCardsByPlayer: Readonly<Record<string, readonly [string, string]>>;
  readonly thinkingPlayerId: string | null;
  readonly bubblesByPlayer: Readonly<Record<string, DuelActionBubble | null>>;
  readonly legalSpec: LegalActionSpec | null;
  readonly callEconomics: DuelLiveState['callEconomics'];
  readonly sizePresets: readonly DuelPresetOption[];
  readonly customSizeAmountsBb: Readonly<Record<string, number>>;
  readonly heroCumulativeNetBb: number;
  readonly lastHandNetBb: number | null;
  readonly historyItems: readonly OrbitHistoryItem[];
  readonly completedHands: readonly OrbitCompletedHandSummary[];
  readonly finishedOrbit: boolean;
  readonly savedToReviewCount: number | null;
}
