import {
  EQUITY_REQUEST_SCHEMA_VERSION,
  type DispatchableEquityRequest,
  type EquityResult,
  type HandCategory,
  type WeightedEquityResult,
} from '../../engine-api';
import type { RunoutCalculationSnapshot } from './types';

export const EMPTY_CATEGORIES: Readonly<Record<HandCategory, number>> = {
  high_card: 0,
  one_pair: 0,
  two_pair: 0,
  three_of_a_kind: 0,
  straight: 0,
  flush: 0,
  full_house: 0,
  four_of_a_kind: 0,
  straight_flush: 0,
};

export const IDLE_RUNOUT_SNAPSHOT: RunoutCalculationSnapshot = Object.freeze({
  status: 'idle',
  method: 'exact',
  baseEquityPct: null,
  rowsByCard: Object.freeze({}),
  groups: Object.freeze([]),
  result: null,
});

export const MAX_EQUITY_CACHE_SIZE = 64;

const SUITS = ['s', 'h', 'd', 'c'] as const;
type SuitChar = (typeof SUITS)[number];

const SUIT_PERMUTATIONS: readonly (readonly [SuitChar, SuitChar, SuitChar, SuitChar])[] = [
  ['s', 'h', 'd', 'c'],
  ['s', 'h', 'c', 'd'],
  ['s', 'd', 'h', 'c'],
  ['s', 'd', 'c', 'h'],
  ['s', 'c', 'h', 'd'],
  ['s', 'c', 'd', 'h'],
  ['h', 's', 'd', 'c'],
  ['h', 's', 'c', 'd'],
  ['h', 'd', 's', 'c'],
  ['h', 'd', 'c', 's'],
  ['h', 'c', 's', 'd'],
  ['h', 'c', 'd', 's'],
  ['d', 's', 'h', 'c'],
  ['d', 's', 'c', 'h'],
  ['d', 'h', 's', 'c'],
  ['d', 'h', 'c', 's'],
  ['d', 'c', 's', 'h'],
  ['d', 'c', 'h', 's'],
  ['c', 's', 'h', 'd'],
  ['c', 's', 'd', 'h'],
  ['c', 'h', 's', 'd'],
  ['c', 'h', 'd', 's'],
  ['c', 'd', 's', 'h'],
  ['c', 'd', 'h', 's'],
];

function mapSuitChar(suit: string, perm: readonly [SuitChar, SuitChar, SuitChar, SuitChar]): string {
  if (suit === 's') return perm[0];
  if (suit === 'h') return perm[1];
  if (suit === 'd') return perm[2];
  if (suit === 'c') return perm[3];
  return suit;
}

export function canonicalizePreflopExactHoldings(
  holdings: readonly (readonly [string, string])[],
): string {
  if (holdings.length === 0) return '';
  let best: string | null = null;
  for (const perm of SUIT_PERMUTATIONS) {
    const parts: string[] = [];
    for (const [c0, c1] of holdings) {
      const m0 = `${c0[0] ?? ''}${mapSuitChar(c0[1] ?? '', perm)}`;
      const m1 = `${c1[0] ?? ''}${mapSuitChar(c1[1] ?? '', perm)}`;
      const pair = m0 <= m1 ? `${m0}+${m1}` : `${m1}+${m0}`;
      parts.push(pair);
    }
    const candidate = parts.join('|');
    if (best === null || candidate < best) {
      best = candidate;
    }
  }
  return best ?? '';
}

export function buildMainCacheKey(request: DispatchableEquityRequest): string {
  if (
    request.schemaVersion === EQUITY_REQUEST_SCHEMA_VERSION &&
    (request.board ?? []).length === 0 &&
    (request.deadCards ?? []).length === 0 &&
    request.players.length >= 2 &&
    request.players.every((p) => Array.isArray(p.cards) && p.cards.length === 2)
  ) {
    const holdings = request.players.map(
      (p) => [p.cards![0]!, p.cards![1]!] as const,
    );
    const canonicalHoldings = canonicalizePreflopExactHoldings(holdings);
    return `preflop-exact:${request.method ?? 'auto'}:${request.samples ?? 0}:${canonicalHoldings}`;
  }
  return JSON.stringify(request);
}

export function isWeightedResult(
  data: unknown,
): data is WeightedEquityResult {
  return (
    Boolean(data) &&
    typeof data === 'object' &&
    (data as { schemaVersion?: string }).schemaVersion === 'weighted-equity-result/v1'
  );
}

export function isExactOrMcResult(
  data: unknown,
): data is EquityResult {
  return (
    Boolean(data) &&
    typeof data === 'object' &&
    (data as { schemaVersion?: string }).schemaVersion === 'equity-result/v1'
  );
}

