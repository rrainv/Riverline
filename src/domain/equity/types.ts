import type {
  EngineResponse,
  HandCategory,
  HoldemWeightedRange,
  RunoutEffectGroup,
  RunoutExplorerResult,
  RunoutRow,
} from '../../engine-api';

export type EquityInputKind = 'exact' | 'range' | 'any';

export interface EquityPlayerEntry {
  readonly id: string;
  readonly label: string;
  readonly isHero: boolean;
  readonly rawInput: string;
  readonly inputKind: EquityInputKind;
  readonly canonical: string;
  readonly cards?: readonly [string, string];
  readonly handClasses?: ReadonlySet<string>;
  readonly weightedRange?: HoldemWeightedRange;
  readonly totalCombosBefore: number;
  readonly eligibleCombos: number;
  readonly weightedEligibleCombos?: number;
  readonly hasPartialWeights?: boolean;
  readonly removedCombos: number;
}

export type EquityDensity = 'roomy' | 'dense' | 'compact';

export interface EquityComputedPlayer {
  readonly id: string;
  readonly equityPct: number;
  readonly previousEquityPct?: number;
  readonly deltaPct?: number;
  readonly wins: number;
  readonly ties: number;
  readonly trials: number;
  readonly isExactCount: boolean;
  readonly margin95Pct: number;
  readonly standing?: 'leading' | 'tied' | 'behind';
  readonly currentCategory?: HandCategory;
  readonly hasFlushDraw?: boolean;
  readonly hasStraightDraw?: boolean;
  readonly riverCategoryShares: Readonly<Record<HandCategory, number>>;
}

export interface EquityCalculationSnapshot {
  readonly status: 'idle' | 'calculating' | 'ready' | 'error';
  readonly method: 'exact' | 'estimated';
  readonly partial: boolean;
  readonly trials: number;
  readonly maxMargin95Pct: number;
  readonly players: Readonly<Record<string, EquityComputedPlayer>>;
  readonly errorMessage?: string;
}

export interface RunoutGroupedBucket {
  readonly effectGroup: RunoutEffectGroup;
  readonly rows: readonly RunoutRow[];
  readonly avgDeltaPct: number;
  readonly bestRow: RunoutRow;
}

export interface RunoutCalculationSnapshot {
  readonly status: 'idle' | 'calculating' | 'ready' | 'unavailable';
  readonly method: 'exact' | 'estimated';
  readonly baseEquityPct: number | null;
  readonly rowsByCard: Readonly<Record<string, RunoutRow>>;
  readonly groups: readonly RunoutGroupedBucket[];
  readonly result: RunoutExplorerResult | null;
  readonly reason?: string;
}

export type EquityPresetId =
  | 'flop'
  | 'turn_chosen'
  | 'players_3'
  | 'players_4'
  | 'players_10'
  | 'range_row'
  | 'error';

export type LastCalcResponse = EngineResponse<unknown>;
