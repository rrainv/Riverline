export type StrategyDecisionFamily =
  | 'preflop_rfi'
  | 'preflop_facing_limp'
  | 'preflop_facing_open'
  | 'preflop_facing_3bet'
  | 'preflop_facing_4bet'
  | 'preflop_bb_option';

export type StrategySpotRowId =
  | 'first_in'
  | 'facing_early_open'
  | 'facing_late_open'
  | 'facing_3bet';

export type StrategyActionType = 'fold' | 'check' | 'call' | 'raise' | 'all_in';

export type StrategyTableSize = 6 | 8;

export type StrategyStackDepthBb = 30 | 40 | 50 | 60 | 100;

export interface StrategyContext {
  readonly tableSize: StrategyTableSize;
  readonly stackDepthBb: StrategyStackDepthBb;
  readonly decisionFamily: StrategyDecisionFamily;
  readonly position: string;
  readonly openerPosition?: string | null;
  readonly gameRulesFingerprint?: string | null;
}

export type StrategyEvidenceSource =
  | 'calibration'
  | 'matrix'
  | 'drill'
  | 'conflict_resolution';

export type StrategyActionFrequencies = Readonly<Partial<Record<StrategyActionType, number>>>;

export interface StrategyEvidenceEntry {
  readonly evidenceId: string;
  readonly occurredAt: string;
  readonly contextKey: string;
  readonly handClass: string;
  readonly source: StrategyEvidenceSource;
  readonly action: StrategyActionType;
  readonly frequencies?: StrategyActionFrequencies | null;
  readonly retracted?: boolean;
  readonly supersedesEvidenceId?: string | null;
}

export type StrategyCellStatus =
  | 'direct'
  | 'inferred_high'
  | 'inferred_medium'
  | 'uncertain'
  | 'conflicting'
  | 'unknown';

export type StrategyCellPrecision =
  | 'unknown'
  | 'dominant_only'
  | 'pure_explicit'
  | 'exact_mix'
  | 'tied_exact_mix';

export interface StrategyMatrixCell {
  readonly handClass: string;
  readonly row: number;
  readonly col: number;
  readonly combos: number;
  readonly status: StrategyCellStatus;
  readonly precision: StrategyCellPrecision;
  readonly dominantAction: StrategyActionType | null;
  readonly frequencies: StrategyActionFrequencies | null;
  readonly hasConflict: boolean;
  readonly directCount: number;
  readonly drillEvidenceCount: number;
  readonly drillFoldCount: number;
}

export interface StrategyMatrixProjection {
  readonly contextKey: string;
  readonly context: StrategyContext;
  readonly cells: readonly StrategyMatrixCell[];
  readonly totalCombos: 1326;
  readonly knownCombos: number;
  readonly unknownCombos: number;
  readonly openCombos: number;
  readonly openPct: number;
  readonly setHandCount: number;
  readonly conflictHands: readonly string[];
}

export type StrategyFamilyId =
  | 'pairs'
  | 'suited_aces'
  | 'suited_kings'
  | 'suited_queens_jacks'
  | 'suited_connectors'
  | 'suited_one_gappers'
  | 'offsuit_aces'
  | 'offsuit_broadways';

export interface StrategyFamilyHand {
  readonly handClass: string;
  readonly combos: number;
}

export interface StrategyFamilySpec {
  readonly id: StrategyFamilyId;
  readonly hands: readonly StrategyFamilyHand[];
  readonly totalCombos: number;
}

export interface StrategyBaselineComparison {
  readonly tier: 'estimated' | 'unavailable';
  readonly available: boolean;
  readonly contextKey: string;
  readonly familyId: StrategyFamilyId;
  readonly position: string;
  readonly playersBehind: number;
  readonly userCutoffIndex: number;
  readonly baselineCutoffIndex: number | null;
  readonly userCutoffHand: string | null;
  readonly baselineCutoffHand: string | null;
  readonly deltaHands: number | null;
  readonly deltaCombos: number | null;
}

export type StrategySpotState =
  | 'set'
  | 'in_progress'
  | 'not_asked'
  | 'conflict'
  | 'cannot_happen';

export interface StrategySpotSummary {
  readonly rowId: StrategySpotRowId;
  readonly decisionFamily: StrategyDecisionFamily;
  readonly position: string;
  readonly openerPosition: string | null;
  readonly contextKey: string;
  readonly state: StrategySpotState;
  readonly setFamilyCount: number;
  readonly totalFamilyCount: number;
  readonly openPct: number | null;
  readonly raisePct: number | null;
  readonly callPct: number | null;
  readonly conflictHands: readonly string[];
}

export interface StrategySpotMapProjection {
  readonly tableSize: StrategyTableSize;
  readonly stackDepthBb: StrategyStackDepthBb;
  readonly positions: readonly string[];
  readonly rows: readonly {
    readonly rowId: StrategySpotRowId;
    readonly decisionFamily: StrategyDecisionFamily;
    readonly cells: readonly StrategySpotSummary[];
  }[];
  readonly setSpotsCount: number;
  readonly totalValidSpotsCount: number;
  readonly recommendedSpot: StrategySpotSummary | null;
}

export interface StrategyLeakMapCell {
  readonly familyId: StrategyFamilyId;
  readonly position: string;
  readonly playersBehind: number;
  readonly contextKey: string;
  readonly userCombos: number;
  readonly baselineCombos: number | null;
  readonly deltaPoints: number | null;
  readonly available: boolean;
}

export interface StrategyLeakMapColumnFooter {
  readonly position: string;
  readonly playersBehind: number;
  readonly userOpenPct: number;
  readonly baselineOpenPct: number | null;
  readonly sampleHands: number;
}

export interface StrategyLeakMapProjection {
  readonly tableSize: StrategyTableSize;
  readonly stackDepthBb: StrategyStackDepthBb;
  readonly tier: 'estimated' | 'unavailable';
  readonly positions: readonly string[];
  readonly rows: readonly {
    readonly familyId: StrategyFamilyId;
    readonly cells: readonly StrategyLeakMapCell[];
  }[];
  readonly columnFooters: readonly StrategyLeakMapColumnFooter[];
}
