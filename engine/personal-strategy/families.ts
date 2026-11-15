import { getHoldemCombosForHandClass } from '../holdem-combos';
import type {
  StrategyFamilyHand,
  StrategyFamilyId,
  StrategyFamilySpec,
  StrategyMatrixProjection,
} from './types';

function makeHands(handClasses: readonly string[]): readonly StrategyFamilyHand[] {
  return Object.freeze(
    handClasses.map((handClass) =>
      Object.freeze({
        handClass,
        combos: getHoldemCombosForHandClass(handClass).length,
      }),
    ),
  );
}

function makeFamily(id: StrategyFamilyId, handClasses: readonly string[]): StrategyFamilySpec {
  const hands = makeHands(handClasses);
  const totalCombos = hands.reduce((sum, h) => sum + h.combos, 0);
  return Object.freeze({ id, hands, totalCombos });
}

export const STRATEGY_FAMILIES: readonly StrategyFamilySpec[] = Object.freeze([
  makeFamily('pairs', [
    'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
  ]),
  makeFamily('suited_aces', [
    'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
  ]),
  makeFamily('suited_kings', [
    'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s', 'K2s',
  ]),
  makeFamily('suited_queens_jacks', [
    'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s', 'Q6s', 'Q5s', 'Q4s', 'Q3s', 'Q2s',
    'JTs', 'J9s', 'J8s', 'J7s',
  ]),
  makeFamily('suited_connectors', [
    'T9s', '98s', '87s', '76s', '65s', '54s',
  ]),
  makeFamily('suited_one_gappers', [
    'T8s', '97s', '86s', '75s', '64s', '53s',
  ]),
  makeFamily('offsuit_aces', [
    'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'A8o', 'A7o', 'A6o', 'A5o', 'A4o', 'A3o', 'A2o',
  ]),
  makeFamily('offsuit_broadways', [
    'KQo', 'KJo', 'KTo', 'QJo', 'QTo', 'JTo',
  ]),
]);

const FAMILY_BY_ID = new Map<StrategyFamilyId, StrategyFamilySpec>(
  STRATEGY_FAMILIES.map((f) => [f.id, f]),
);

export function getStrategyFamily(id: StrategyFamilyId): StrategyFamilySpec {
  const family = FAMILY_BY_ID.get(id);
  if (!family) {
    throw new RangeError(`Unknown strategy family: ${id}`);
  }
  return family;
}

/**
 * Derives the current cutoff index (-1 when none are set to raise/all_in)
 * for a family strip from a projected 13x13 matrix.
 */
export function deriveFamilyCutoffFromProjection(
  projection: StrategyMatrixProjection,
  familyId: StrategyFamilyId,
): number {
  const family = getStrategyFamily(familyId);
  const byHand = new Map(projection.cells.map((c) => [c.handClass, c]));
  let lastRaised = -1;
  for (let i = 0; i < family.hands.length; i += 1) {
    const cell = byHand.get(family.hands[i]!.handClass);
    if (cell && (cell.dominantAction === 'raise' || cell.dominantAction === 'all_in')) {
      lastRaised = i;
    }
  }
  return lastRaised;
}

/**
 * Counts how many families have at least one non-unknown hand in a projection.
 */
export function countSetFamiliesInProjection(projection: StrategyMatrixProjection): number {
  const byHand = new Map(projection.cells.map((c) => [c.handClass, c]));
  let count = 0;
  for (const family of STRATEGY_FAMILIES) {
    const hasSet = family.hands.some((h) => {
      const cell = byHand.get(h.handClass);
      return cell !== undefined && cell.status !== 'unknown';
    });
    if (hasSet) count += 1;
  }
  return count;
}

export function familyRaiseCombosFromProjection(
  projection: StrategyMatrixProjection,
  familyId: StrategyFamilyId,
): number {
  const family = getStrategyFamily(familyId);
  const byHand = new Map(projection.cells.map((c) => [c.handClass, c]));
  let combos = 0;
  for (const h of family.hands) {
    const cell = byHand.get(h.handClass);
    if (cell && (cell.dominantAction === 'raise' || cell.dominantAction === 'all_in')) {
      combos += h.combos;
    }
  }
  return combos;
}
