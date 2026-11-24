import {
  getHoldemCombosForHandClass,
  HOLDEM_DECK,
  PREFLOP_MATRIX_RANKS,
  type EngineClient,
  type HoldemWeightedRange,
} from '../../engine-api';

/**
 * Single source-of-truth shorthand grammar for Riverline (used by Equity today
 * and extended by Hand recorder later). Zero UI or theme dependencies.
 */

export type ShorthandErrorCode =
  | 'empty'
  | 'incomplete_hand'
  | 'too_many_cards'
  | 'invalid_rank'
  | 'invalid_suit'
  | 'duplicate_in_hand'
  | 'card_in_play'
  | 'invalid_range'
  | 'zero_combos'
  | 'invalid_syntax';

export interface ParsedExactHand {
  readonly ok: true;
  readonly kind: 'exact';
  readonly canonical: string;
  readonly cards: readonly [string, string];
  readonly eligibleCombos: 1;
  readonly removedCombos: 0;
}

export interface ParsedAnyHand {
  readonly ok: true;
  readonly kind: 'any';
  readonly canonical: 'any';
  readonly eligibleCombos: number;
  readonly removedCombos: number;
}

export interface ParsedRangeHand {
  readonly ok: true;
  readonly kind: 'range';
  readonly canonical: string;
  readonly clauses: readonly string[];
  readonly handClasses: ReadonlySet<string>;
  readonly handClassWeights: Readonly<Record<string, number>>;
  readonly hasPartialWeights: boolean;
  readonly weightedRange: HoldemWeightedRange;
  readonly totalCombosBefore: number;
  readonly eligibleCombos: number;
  readonly weightedEligibleCombos: number;
  readonly removedCombos: number;
}

export interface ParsedHandError {
  readonly ok: false;
  readonly errorCode: ShorthandErrorCode;
  readonly detail?: string;
}

export type ParsePlayerHandResult =
  | ParsedExactHand
  | ParsedAnyHand
  | ParsedRangeHand
  | ParsedHandError;

const RANKS_LOW_TO_HIGH = '23456789TJQKA';
const SUIT_GLYPH_MAP: Readonly<Record<string, string>> = {
  '♠': 's',
  '♥': 'h',
  '♦': 'd',
  '♣': 'c',
};

function rankIndex(rank: string): number {
  return RANKS_LOW_TO_HIGH.indexOf(rank.toUpperCase());
}

function normalizeSuitsAndTens(raw: string): string {
  let out = raw.trim();
  for (const [glyph, ascii] of Object.entries(SUIT_GLYPH_MAP)) {
    out = out.split(glyph).join(ascii);
  }
  // Allow "10h" / "10♠" style card entry without affecting unrelated tokens.
  out = out.replace(/10([shdcSHDC])/g, 'T$1');
  return out;
}

function isRangeLetter(ch: string): boolean {
  return '23456789TJQKA'.includes(ch.toUpperCase());
}

function tryParseCard(token: string):
  | { readonly ok: true; readonly card: string }
  | { readonly ok: false; readonly reason: 'not_card' | 'invalid_rank' | 'invalid_suit' } {
  if (token.length !== 2) return { ok: false, reason: 'not_card' };
  const rawRank = token[0]!.toUpperCase();
  const rawSuit = token[1]!.toLowerCase();
  const rankOk = RANKS_LOW_TO_HIGH.includes(rawRank);
  const suitOk = 'shdc'.includes(rawSuit);
  if (rankOk && suitOk) return { ok: true, card: `${rawRank}${rawSuit}` };
  if (!rankOk && suitOk && /[0-9A-Z]/i.test(rawRank)) return { ok: false, reason: 'invalid_rank' };
  if (rankOk && !suitOk && !isRangeLetter(rawSuit) && /[a-z]/i.test(rawSuit)) {
    return { ok: false, reason: 'invalid_suit' };
  }
  return { ok: false, reason: 'not_card' };
}

function canonicalPairOrUnpaired(
  rawFirst: string,
  rawSecond: string,
  rawSuit?: string,
): { readonly hi: string; readonly lo: string; readonly suffix: 's' | 'o' | '' } {
  const r1 = rawFirst.toUpperCase();
  const r2 = rawSecond.toUpperCase();
  const i1 = rankIndex(r1);
  const i2 = rankIndex(r2);
  const [hi, lo] = i1 >= i2 ? [r1, r2] : [r2, r1];
  const suffix = rawSuit ? (rawSuit.toLowerCase() as 's' | 'o') : '';
  return { hi, lo, suffix };
}

const SEEDED_169_ORDER: readonly string[] = [
  'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', 'AKs', '77', 'AQs', 'AJs', 'AKo', 'ATs', 'AQo',
  'AJo', 'KQs', '66', 'A9s', 'ATo', 'KJs', 'KTs', 'KQo', 'QJs', '55', 'A8s', 'A7s', 'K9s',
  'QTs', 'KJo', 'A5s', 'A6s', 'A4s', 'QJo', 'JTs', 'A9o', 'A3s', 'KTo', 'Q9s', 'K8s', '44',
  'A2s', 'J9s', 'QTo', 'A8o', 'K7s', 'K6s', 'K5s', 'JTo', 'T9s', 'A7o', 'K9o', 'Q8s', 'K4s',
  '33', 'A5o', 'Q7s', 'A6o', 'K3s', 'J8s', 'A4o', 'Q9o', 'T8s', 'K2s', 'Q6s', 'A3o', 'J9o',
  '98s', 'K8o', '22', 'Q5s', 'A2o', 'J7s', 'T9o', 'Q4s', 'Q8o', 'T7s', 'K7o', 'J6s', 'Q3s',
  '87s', 'K6o', '97s', 'J8o', 'Q2s', 'T8o', 'J5s', 'K5o', 'T6s', 'J4s', '98o', 'K4o', '76s',
  '86s', '96s', 'J3s', 'Q7o', 'T7o', 'J2s', 'K3o', 'T5s', 'Q6o', '65s', '75s', 'J7o', '87o',
  '85s', 'K2o', 'T4s', 'Q5o', '95s', '97o', '54s', 'T3s', 'Q4o', '64s', '76o', 'T2s', '86o',
  '74s', 'Q3o', '96o', 'J6o', '53s', '84s', '65o', 'Q2o', 'T6o', '94s', '43s', 'J5o', '93s',
  '63s', '75o', '54o', '92s', '73s', 'J4o', '85o', '83s', '42s', '52s', '64o', 'T5o', 'J3o',
  '82s', '95o', '32s', '72s', '62s', '43o', '74o', 'J2o', 'T4o', '53o', '84o', 'T3o', '63o',
  '94o', '52o', '73o', 'T2o', '93o', '83o', '42o', '92o', '62o', '32o', '82o', '72o',
];

const ORDERED_169_HAND_CLASSES: readonly string[] = (() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const hc of SEEDED_169_ORDER) {
    if (!seen.has(hc)) {
      seen.add(hc);
      out.push(hc);
    }
  }
  for (let i = 0; i < PREFLOP_MATRIX_RANKS.length; i += 1) {
    const hi = PREFLOP_MATRIX_RANKS[i]!;
    const pair = `${hi}${hi}`;
    if (!seen.has(pair)) {
      seen.add(pair);
      out.push(pair);
    }
    for (let j = i + 1; j < PREFLOP_MATRIX_RANKS.length; j += 1) {
      const lo = PREFLOP_MATRIX_RANKS[j]!;
      for (const suf of ['s', 'o'] as const) {
        const hc = `${hi}${lo}${suf}`;
        if (!seen.has(hc)) {
          seen.add(hc);
          out.push(hc);
        }
      }
    }
  }
  return out;
})();

function handClassComboCount(handClass: string): number {
  if (handClass.length === 2) return 6;
  return handClass.endsWith('s') ? 4 : 12;
}

function expandTopPercentClasses(pct: number): string[] {
  if (pct >= 100) return [...ORDERED_169_HAND_CLASSES];
  const targetCombos = Math.max(1, Math.round((pct / 100) * 1326));
  const out: string[] = [];
  let accumulated = 0;
  for (const hc of ORDERED_169_HAND_CLASSES) {
    if (accumulated >= targetCombos) break;
    out.push(hc);
    accumulated += handClassComboCount(hc);
  }
  return out;
}

function expandRangeClause(clause: string): {
  readonly canonical: string;
  readonly classes: string[];
} | null {
  const cleaned = clause.trim();
  if (!cleaned) return null;

  // Top X% preflop range: "top15%", "top15", "15%"
  const topPctMatch = /^(?:top)?(\d+(?:\.\d+)?)%$/i.exec(cleaned) ?? /^top(\d+(?:\.\d+)?)$/i.exec(cleaned);
  if (topPctMatch) {
    const pct = Number(topPctMatch[1]);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return null;
    return {
      canonical: `top ${pct}%`,
      classes: expandTopPercentClasses(pct),
    };
  }

  // Pair: AA, AA+, 22-77
  const pairMatch = /^([2-9tjqka])\1$/i.exec(cleaned);
  if (pairMatch) {
    const r = pairMatch[1]!.toUpperCase();
    return { canonical: `${r}${r}`, classes: [`${r}${r}`] };
  }

  const pairPlusMatch = /^([2-9tjqka])\1\+$/i.exec(cleaned);
  if (pairPlusMatch) {
    const r = pairPlusMatch[1]!.toUpperCase();
    const start = rankIndex(r);
    const classes: string[] = [];
    for (let i = start; i < RANKS_LOW_TO_HIGH.length; i += 1) {
      const rank = RANKS_LOW_TO_HIGH[i]!;
      classes.push(`${rank}${rank}`);
    }
    return { canonical: `${r}${r}+`, classes };
  }

  const pairDashMatch = /^([2-9tjqka])\1-([2-9tjqka])\2$/i.exec(cleaned);
  if (pairDashMatch) {
    const a = pairDashMatch[1]!.toUpperCase();
    const b = pairDashMatch[2]!.toUpperCase();
    const lo = Math.min(rankIndex(a), rankIndex(b));
    const hi = Math.max(rankIndex(a), rankIndex(b));
    const classes: string[] = [];
    for (let i = lo; i <= hi; i += 1) {
      const rank = RANKS_LOW_TO_HIGH[i]!;
      classes.push(`${rank}${rank}`);
    }
    return {
      canonical: `${RANKS_LOW_TO_HIGH[lo]}${RANKS_LOW_TO_HIGH[lo]}-${RANKS_LOW_TO_HIGH[hi]}${RANKS_LOW_TO_HIGH[hi]}`,
      classes,
    };
  }

  // Unpaired single: AKs, AKo, AK
  const singleMatch = /^([2-9tjqka])([2-9tjqka])([so])?$/i.exec(cleaned);
  if (singleMatch) {
    if (singleMatch[1]!.toUpperCase() === singleMatch[2]!.toUpperCase()) return null;
    const { hi, lo, suffix } = canonicalPairOrUnpaired(singleMatch[1]!, singleMatch[2]!, singleMatch[3]);
    if (suffix === 's' || suffix === 'o') {
      return { canonical: `${hi}${lo}${suffix}`, classes: [`${hi}${lo}${suffix}`] };
    }
    return { canonical: `${hi}${lo}`, classes: [`${hi}${lo}s`, `${hi}${lo}o`] };
  }

  // Unpaired plus: AJs+, KTo+, AT+
  const plusMatch = /^([2-9tjqka])([2-9tjqka])([so])?\+$/i.exec(cleaned);
  if (plusMatch) {
    if (plusMatch[1]!.toUpperCase() === plusMatch[2]!.toUpperCase()) return null;
    const { hi, lo, suffix } = canonicalPairOrUnpaired(plusMatch[1]!, plusMatch[2]!, plusMatch[3]);
    const hiIdx = rankIndex(hi);
    const loIdx = rankIndex(lo);
    const suffixes: readonly ('s' | 'o')[] = suffix ? [suffix] : ['s', 'o'];
    const classes: string[] = [];
    for (let i = loIdx; i < hiIdx; i += 1) {
      const kicker = RANKS_LOW_TO_HIGH[i]!;
      for (const suf of suffixes) {
        classes.push(`${hi}${kicker}${suf}`);
      }
    }
    return { canonical: `${hi}${lo}${suffix}+`, classes };
  }

  // Unpaired dash: A5s-A2s or T9s-76s
  const dashMatch = /^([2-9tjqka])([2-9tjqka])([so])?-([2-9tjqka])([2-9tjqka])([so])?$/i.exec(
    cleaned,
  );
  if (dashMatch) {
    if (
      dashMatch[1]!.toUpperCase() === dashMatch[2]!.toUpperCase() ||
      dashMatch[4]!.toUpperCase() === dashMatch[5]!.toUpperCase()
    ) {
      return null;
    }
    const left = canonicalPairOrUnpaired(dashMatch[1]!, dashMatch[2]!, dashMatch[3]);
    const right = canonicalPairOrUnpaired(dashMatch[4]!, dashMatch[5]!, dashMatch[6]);
    if (left.suffix !== right.suffix) return null;
    const suffixes: readonly ('s' | 'o')[] = left.suffix ? [left.suffix] : ['s', 'o'];
    const classes: string[] = [];

    if (left.hi === right.hi) {
      const start = Math.min(rankIndex(left.lo), rankIndex(right.lo));
      const end = Math.max(rankIndex(left.lo), rankIndex(right.lo));
      for (let i = start; i <= end; i += 1) {
        for (const suf of suffixes) {
          classes.push(`${left.hi}${RANKS_LOW_TO_HIGH[i]}${suf}`);
        }
      }
      const hiLabel = `${left.hi}${RANKS_LOW_TO_HIGH[end]}${left.suffix}`;
      const loLabel = `${left.hi}${RANKS_LOW_TO_HIGH[start]}${left.suffix}`;
      return { canonical: `${hiLabel}-${loLabel}`, classes };
    }

    const gapLeft = rankIndex(left.hi) - rankIndex(left.lo);
    const gapRight = rankIndex(right.hi) - rankIndex(right.lo);
    if (gapLeft === gapRight) {
      const startLo = Math.min(rankIndex(left.lo), rankIndex(right.lo));
      const endLo = Math.max(rankIndex(left.lo), rankIndex(right.lo));
      for (let i = startLo; i <= endLo; i += 1) {
        for (const suf of suffixes) {
          classes.push(`${RANKS_LOW_TO_HIGH[i + gapLeft]}${RANKS_LOW_TO_HIGH[i]}${suf}`);
        }
      }
      const hiLabel = `${RANKS_LOW_TO_HIGH[endLo + gapLeft]}${RANKS_LOW_TO_HIGH[endLo]}${left.suffix}`;
      const loLabel = `${RANKS_LOW_TO_HIGH[startLo + gapLeft]}${RANKS_LOW_TO_HIGH[startLo]}${left.suffix}`;
      return { canonical: `${hiLabel}-${loLabel}`, classes };
    }
  }

  return null;
}

export function normalizeDeadCardSet(deadCards: readonly string[]): ReadonlySet<string> {
  return new Set(deadCards.filter((card) => HOLDEM_DECK.includes(card)));
}

/**
 * Parses a single player entry string (exact cards, range notation, or "any")
 * against current dead cards and the engine's canonical range conditioning.
 */
export function parsePlayerHandInput(
  rawInput: string,
  options: {
    readonly deadCards?: readonly string[];
    readonly engine: EngineClient;
  },
): ParsePlayerHandResult {
  const normalized = normalizeSuitsAndTens(rawInput);
  if (!normalized) {
    return { ok: false, errorCode: 'empty' };
  }

  const deadSet = normalizeDeadCardSet(options.deadCards ?? []);
  const lower = normalized.toLowerCase();

  if (lower === 'any' || lower === 'any two' || lower === '?' || lower === 'random') {
    const remainingDeck = 52 - deadSet.size;
    const eligibleCombos = Math.floor((remainingDeck * (remainingDeck - 1)) / 2);
    const removedCombos = 1326 - eligibleCombos;
    if (eligibleCombos <= 0) {
      return { ok: false, errorCode: 'zero_combos', detail: 'any' };
    }
    return {
      ok: true,
      kind: 'any',
      canonical: 'any',
      eligibleCombos,
      removedCombos,
    };
  }

  // Exact-card form: allow "AhKh", "th 9h", "Ah, Kh"
  const hasRangeOperator = /[+%:-]|\btop\s*\d/i.test(normalized);
  const compact = normalized.replace(/[\s,]+/g, '');
  if (!hasRangeOperator && compact.length > 0 && compact.length % 2 === 0 && compact.length <= 6) {
    if (compact.length === 2) {
      const single = tryParseCard(compact);
      if (single.ok) {
        return { ok: false, errorCode: 'incomplete_hand', detail: single.card };
      }
      if (single.reason === 'invalid_rank') {
        return { ok: false, errorCode: 'invalid_rank', detail: compact };
      }
      if (single.reason === 'invalid_suit' && !/[so]/i.test(compact[1]!)) {
        return { ok: false, errorCode: 'invalid_suit', detail: compact };
      }
    }
    if (compact.length === 4) {
      const c1 = tryParseCard(compact.slice(0, 2));
      const c2 = tryParseCard(compact.slice(2, 4));
      if (c1.ok && c2.ok) {
        if (c1.card === c2.card) {
          return { ok: false, errorCode: 'duplicate_in_hand', detail: c1.card };
        }
        if (deadSet.has(c1.card)) {
          return { ok: false, errorCode: 'card_in_play', detail: c1.card };
        }
        if (deadSet.has(c2.card)) {
          return { ok: false, errorCode: 'card_in_play', detail: c2.card };
        }
        return {
          ok: true,
          kind: 'exact',
          canonical: `${c1.card}${c2.card}`,
          cards: [c1.card, c2.card],
          eligibleCombos: 1,
          removedCombos: 0,
        };
      }
      if (!c1.ok && c1.reason === 'invalid_rank') {
        return { ok: false, errorCode: 'invalid_rank', detail: compact.slice(0, 2) };
      }
      if (!c1.ok && c1.reason === 'invalid_suit') {
        return { ok: false, errorCode: 'invalid_suit', detail: compact.slice(0, 2) };
      }
      if (c1.ok && !c2.ok && c2.reason !== 'not_card') {
        return { ok: false, errorCode: c2.reason, detail: compact.slice(2, 4) };
      }
    }
    if (compact.length === 6) {
      const c1 = tryParseCard(compact.slice(0, 2));
      const c2 = tryParseCard(compact.slice(2, 4));
      const c3 = tryParseCard(compact.slice(4, 6));
      if (c1.ok && c2.ok && c3.ok) {
        return { ok: false, errorCode: 'too_many_cards', detail: normalized };
      }
    }
  }

  // Range notation: split comma/whitespace clauses ("QQ+, AKs", "22-77, A5s-A2s", "top 15%", "AKo:50")
  const preSplit = normalized.replace(/\btop\s+(\d+(?:\.\d+)?%?)/gi, 'top$1');
  const rawClauses = preSplit
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (rawClauses.length === 0) {
    return { ok: false, errorCode: 'empty' };
  }

  const matchedClasses = new Set<string>();
  const handClassWeights: Record<string, number> = {};
  const canonicalClauses: string[] = [];
  for (const clause of rawClauses) {
    const colonIdx = clause.lastIndexOf(':');
    let baseClause = clause;
    let weight = 1;
    if (colonIdx >= 0) {
      baseClause = clause.slice(0, colonIdx).trim();
      const rawWeight = clause.slice(colonIdx + 1).trim();
      if (!baseClause || !rawWeight) {
        return { ok: false, errorCode: 'invalid_range', detail: clause };
      }
      const hasPct = rawWeight.endsWith('%');
      const numericPart = hasPct ? rawWeight.slice(0, -1).trim() : rawWeight;
      const num = Number(numericPart);
      if (!Number.isFinite(num) || num <= 0) {
        return { ok: false, errorCode: 'invalid_range', detail: clause };
      }
      if (hasPct) {
        if (num > 100) {
          return { ok: false, errorCode: 'invalid_range', detail: clause };
        }
        weight = num / 100;
      } else if (num <= 1) {
        weight = num;
      } else if (num <= 100) {
        weight = num / 100;
      } else {
        return { ok: false, errorCode: 'invalid_range', detail: clause };
      }
    }

    const expanded = expandRangeClause(baseClause);
    if (!expanded || expanded.classes.length === 0) {
      return { ok: false, errorCode: 'invalid_range', detail: clause };
    }
    const weightSuffix = weight < 0.9999 ? `:${Math.round(weight * 100)}%` : '';
    canonicalClauses.push(`${expanded.canonical}${weightSuffix}`);
    for (const hc of expanded.classes) {
      matchedClasses.add(hc);
      handClassWeights[hc] = weight;
    }
  }

  const hasPartialWeights = Object.values(handClassWeights).some((w) => w < 0.9999);

  const buildResp = options.engine.sync.createWeightedRangeFromHandClasses({
    handClassWeights,
    unlistedState: 'known_zero',
    rangeId: canonicalClauses.join(', '),
  });
  if (!buildResp.ok) {
    return { ok: false, errorCode: 'invalid_syntax', detail: buildResp.error.message };
  }

  const condResp = options.engine.sync.conditionRange(buildResp.data, [...deadSet]);
  if (!condResp.ok) {
    return { ok: false, errorCode: 'invalid_syntax', detail: condResp.error.message };
  }

  let totalCombosBefore = 0;
  for (const hc of matchedClasses) {
    totalCombosBefore += getHoldemCombosForHandClass(hc).length;
  }
  let eligibleCombos = 0;
  let weightedComboSum = 0;
  for (const entry of condResp.data.eligibleEntries) {
    if (entry.state === 'known' && entry.weight > 0) {
      eligibleCombos += 1;
      weightedComboSum += entry.weight;
    }
  }
  const weightedEligibleCombos = Math.round(weightedComboSum * 10) / 10;
  const removedCombos = condResp.data.blockedEntries.filter(
    (entry) => entry.state === 'known' && entry.weight > 0,
  ).length;

  if (eligibleCombos === 0) {
    return { ok: false, errorCode: 'zero_combos', detail: canonicalClauses.join(', ') };
  }

  return {
    ok: true,
    kind: 'range',
    canonical: canonicalClauses.join(', '),
    clauses: canonicalClauses,
    handClasses: matchedClasses,
    handClassWeights,
    hasPartialWeights,
    weightedRange: buildResp.data,
    totalCombosBefore,
    eligibleCombos,
    weightedEligibleCombos,
    removedCombos,
  };
}

/** Projects a set of selected preflop hand classes into a 13x13 boolean matrix ordered A..2. */
export function buildRangeMatrixMask(handClasses: ReadonlySet<string>): readonly (readonly boolean[])[] {
  return PREFLOP_MATRIX_RANKS.map((rowRank, rowIdx) =>
    PREFLOP_MATRIX_RANKS.map((colRank, colIdx) => {
      const hc =
        rowIdx === colIdx
          ? `${rowRank}${colRank}`
          : rowIdx < colIdx
            ? `${rowRank}${colRank}s`
            : `${colRank}${rowRank}o`;
      return handClasses.has(hc);
    }),
  );
}
