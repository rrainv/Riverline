export interface DcfrParams {
  readonly alpha: number;
  readonly beta: number;
  readonly gamma: number;
  readonly iterations: number;
}

export const DEFAULT_DCFR_PARAMS: DcfrParams = Object.freeze({
  alpha: 1.5,
  beta: 0,
  gamma: 2,
  iterations: 350,
});

export interface RiverBetMenu {
  readonly betPcts: readonly number[];
  readonly raisePcts: readonly number[];
  readonly raiseCap: number;
  readonly includeAllIn: boolean;
}

export interface RiverSubgameSpec {
  readonly spotId: string;
  readonly board: readonly [string, string, string, string, string];
  readonly deadCards?: readonly string[];
  readonly potBb: number;
  readonly effectiveStackBb: number;
  readonly oopRangeByCombo: Readonly<Record<string, number>>;
  readonly ipRangeByCombo: Readonly<Record<string, number>>;
  readonly betMenu: RiverBetMenu;
}

export type SolverActionKind = 'check' | 'call' | 'fold' | 'bet' | 'raise' | 'all_in';

export interface SolvedRootActionSummary {
  readonly actionLabel: string;
  readonly kind: SolverActionKind;
  readonly amountBb: number | null;
  readonly frequency: number;
}

export interface SolvedHandClassMix {
  readonly handClass: string;
  readonly combos: number;
  readonly checkOrCallFreq: number;
  readonly betOrRaiseFreq: number;
  readonly foldFreq: number;
}

export interface SolvedSpotArtifact {
  readonly spotId: string;
  readonly titleKey: string;
  readonly provenanceId: string;
  readonly abstractionLabel: string;
  readonly board: readonly [string, string, string, string, string];
  readonly potBb: number;
  readonly effectiveStackBb: number;
  readonly iterations: number;
  readonly oopEvBb: number;
  readonly ipEvBb: number;
  readonly exploitabilityBb: number;
  readonly exploitabilityPctPot: number;
  readonly oopRootActions: readonly SolvedRootActionSummary[];
  readonly ipFacingCheckActions: readonly SolvedRootActionSummary[];
  readonly ipHandClassMixes: readonly SolvedHandClassMix[];
}

export interface SolvedActionOption {
  readonly actionIndex: number;
  readonly label: string;
  readonly kind: SolverActionKind;
  readonly amountBb: number | null;
  readonly nextNodeId: number;
  readonly isTerminal: boolean;
  readonly frequency: number;
}

export interface SolvedComboDetail {
  readonly comboId: string;
  readonly cards: readonly [string, string];
  readonly handClass: string;
  readonly weight: number;
  readonly actionFrequencies: Readonly<Record<string, number>>;
  readonly evBb: number;
  readonly evGapBb: number;
  readonly isCloseCall: boolean;
}

export interface SolvedMatrixCell {
  readonly handClass: string;
  readonly combos: number;
  readonly actionFrequencies: Readonly<Record<string, number>>;
  readonly dominantActionLabel: string;
  readonly evBb: number;
  readonly evGapBb: number;
  readonly isCloseCall: boolean;
}

export interface SolvedNodeInspection {
  readonly nodeId: number;
  readonly player: 0 | 1;
  readonly invest0: number;
  readonly invest1: number;
  readonly potBb: number;
  readonly actions: readonly SolvedActionOption[];
  readonly matrix169: readonly SolvedMatrixCell[];
  readonly combosByHandClass: Readonly<Record<string, readonly SolvedComboDetail[]>>;
}
