export const LEARN_CONCEPT_IDS = [
  'pot_odds',
  'equity',
  'ranges',
  'blockers',
  'position',
  'spr',
  'bluffing',
  'value',
  'multiway',
] as const;

export type LearnConceptId = (typeof LEARN_CONCEPT_IDS)[number];

export type LearnTrainerMode = 'pot_odds' | 'outs';

export interface LearnConceptExample {
  readonly conceptId: LearnConceptId;
  readonly tier: 'exact';
  readonly qualifier?: 'price_only' | 'known_cards';
  readonly cards?: readonly string[];
  readonly board?: readonly string[];
  readonly opponentCards?: readonly string[];
  readonly thirdPlayerCards?: readonly string[];
  readonly numbers: Readonly<Record<string, number>>;
}

export interface LearnPotOddsSpot {
  readonly id: string;
  readonly potBeforeBetBb: number;
  readonly betBb: number;
}

export interface LearnOutsSpot {
  readonly id: string;
  readonly heroCards: readonly [string, string];
  readonly board: readonly string[];
  readonly drawKind: 'flush' | 'oesd' | 'gutshot' | 'combo_oesd_flush' | 'combo_gutshot_flush' | 'double_gutshot';
}

export interface LearnTrainerOption {
  readonly index: number;
  readonly value: number;
  readonly isCorrect: boolean;
}

export interface LearnTrainerRound {
  readonly mode: LearnTrainerMode;
  readonly spotIndex: number;
  readonly totalSpots: number;
  readonly spotId: string;
  readonly potBeforeBetBb?: number;
  readonly betBb?: number;
  readonly heroCards?: readonly [string, string];
  readonly board?: readonly string[];
  readonly drawKind?: LearnOutsSpot['drawKind'];
  readonly options: readonly LearnTrainerOption[];
}

export interface LearnTrainerGrade {
  readonly mode: LearnTrainerMode;
  readonly spotId: string;
  readonly spotIndex: number;
  readonly chosenOptionIndex: number;
  readonly correctOptionIndex: number;
  readonly correctValue: number;
  readonly isCorrect: boolean;
  readonly tier: 'exact';
  readonly qualifier?: 'price_only';
  readonly potBeforeBetBb?: number;
  readonly betBb?: number;
  readonly potAfterBetBb?: number;
  readonly potAfterCallBb?: number;
  readonly flushCount?: number;
  readonly straightCount?: number;
  readonly overlapCount?: number;
  readonly uniqueOutsCount?: number;
  readonly completionCards?: readonly string[];
}

export type LearnWeaknessId =
  | 'postflop_fallbacks'
  | 'facing_3bet_4bet'
  | 'multiway_postflop'
  | 'duel_bot_model'
  | 'postflop_personal_plan'
  | 'solver_and_imports';

export interface LearnWeaknessSpec {
  readonly id: LearnWeaknessId;
  readonly tier: 'estimated' | 'unavailable';
  readonly sourceCode: string;
  readonly targetRoom: 'strategy' | 'training' | 'equity' | 'hand' | 'review';
}
