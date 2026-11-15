import { POSITIONS_BY_TABLE_SIZE } from '../positions';
import type {
  StrategyContext,
  StrategyDecisionFamily,
  StrategySpotRowId,
  StrategyStackDepthBb,
  StrategyTableSize,
} from './types';

export const STRATEGY_STACK_DEPTHS: readonly StrategyStackDepthBb[] = Object.freeze([
  30, 40, 50, 60, 100,
]);

export const STRATEGY_TABLE_SIZES: readonly StrategyTableSize[] = Object.freeze([6, 8]);

export const STRATEGY_DECISION_FAMILIES: readonly StrategyDecisionFamily[] = Object.freeze([
  'preflop_rfi',
  'preflop_facing_limp',
  'preflop_facing_open',
  'preflop_facing_3bet',
  'preflop_facing_4bet',
  'preflop_bb_option',
]);

export function positionsForTableSize(tableSize: StrategyTableSize): readonly string[] {
  const list = POSITIONS_BY_TABLE_SIZE[tableSize];
  if (!list) {
    throw new RangeError(`Unsupported table size: ${tableSize}`);
  }
  return list;
}

export function playersBehindForPosition(
  tableSize: StrategyTableSize,
  position: string,
): number {
  const positions = positionsForTableSize(tableSize);
  const index = positions.indexOf(position);
  if (index < 0) {
    throw new RangeError(`Position ${position} does not exist at a ${tableSize}-handed table`);
  }
  return positions.length - 1 - index;
}

/**
 * Determines whether a spot-map cell is structurally possible in Hold'em:
 * - First in (RFI): BB never opens first-in.
 * - Facing an early open (UTG/UTG+1/LJ): UTG cannot face an early open (and at 6-max, UTG is the only early opener so UTG cannot face it).
 * - Facing a late open (CO/BTN): early seats (UTG, UTG+1, LJ, HJ) act before CO/BTN and cannot face a late open first.
 * - Facing a 3-bet: BB cannot open-then-face-3bet in a standard unopened pot (BB only 3-bets or defends).
 */
export function isSpotMapCellPossible(
  tableSize: StrategyTableSize,
  rowId: StrategySpotRowId,
  position: string,
): boolean {
  const positions = positionsForTableSize(tableSize);
  if (!positions.includes(position)) return false;

  if (rowId === 'first_in') {
    return position !== 'BB';
  }
  if (rowId === 'facing_early_open') {
    return position !== 'UTG';
  }
  if (rowId === 'facing_late_open') {
    const coIndex = positions.indexOf('CO');
    const posIndex = positions.indexOf(position);
    return posIndex > coIndex;
  }
  if (rowId === 'facing_3bet') {
    return position !== 'BB';
  }
  return true;
}

export function defaultOpenerForSpotRow(rowId: StrategySpotRowId): string | null {
  if (rowId === 'facing_early_open') return 'UTG';
  if (rowId === 'facing_late_open') return 'CO';
  return null;
}

export function decisionFamilyForSpotRow(rowId: StrategySpotRowId): StrategyDecisionFamily {
  if (rowId === 'first_in') return 'preflop_rfi';
  if (rowId === 'facing_3bet') return 'preflop_facing_3bet';
  return 'preflop_facing_open';
}

export function createStrategyContext(input: StrategyContext): StrategyContext {
  const positions = positionsForTableSize(input.tableSize);
  if (!positions.includes(input.position)) {
    throw new RangeError(
      `Invalid position ${input.position} for ${input.tableSize}-handed table`,
    );
  }
  if (!STRATEGY_STACK_DEPTHS.includes(input.stackDepthBb)) {
    throw new RangeError(`Unsupported stack depth: ${input.stackDepthBb}`);
  }
  return Object.freeze({
    tableSize: input.tableSize,
    stackDepthBb: input.stackDepthBb,
    decisionFamily: input.decisionFamily,
    position: input.position,
    openerPosition: input.openerPosition ?? null,
    gameRulesFingerprint: input.gameRulesFingerprint ?? null,
  });
}

export function strategyContextKey(context: StrategyContext): string {
  const parts = [
    `${context.tableSize}max`,
    `${context.stackDepthBb}bb`,
    context.decisionFamily,
    context.position,
  ];
  if (context.openerPosition) {
    parts.push(`vs:${context.openerPosition}`);
  }
  if (context.gameRulesFingerprint) {
    parts.push(`rules:${context.gameRulesFingerprint}`);
  }
  return parts.join('|');
}
