import { CARD_RANKS, CARD_SUITS, assertCard, assertCardArray } from './cards';
import { PREFLOP_HAND_CLASSES, isPreflopHandClass, preflopHandClassForCards } from './hand-class';
import { deepFreeze } from './freeze';

export const HOLDEM_COMBO_SCHEMA_VERSION = 'holdem-hole-card-combo/v1' as const;
export const HOLDEM_COMBO_ID_PREFIX = 'holdem-combo/v1:' as const;

export interface HoldemCombo {
  readonly schemaVersion: typeof HOLDEM_COMBO_SCHEMA_VERSION;
  readonly id: string;
  readonly cards: readonly [string, string];
  readonly handClass: string;
}

/**
 * Canonical structural card order: rank 2 through A, then suit s, h, d, c.
 * Persistence-relevant for Hold'em combo IDs and enumeration.
 */
export const HOLDEM_DECK: readonly string[] = Object.freeze(
  [...CARD_RANKS].flatMap((rank) => [...CARD_SUITS].map((suit) => `${rank}${suit}`)),
);

const CARD_INDEX = new Map<string, number>(HOLDEM_DECK.map((card, index) => [card, index]));

export function compareHoldemCards(left: string, right: string): number {
  assertCard(left, 'left card');
  assertCard(right, 'right card');
  return CARD_INDEX.get(left)! - CARD_INDEX.get(right)!;
}

function canonicalCards(cards: readonly string[]): [string, string] {
  assertCardArray(cards, 'Holdem combo cards');
  if (cards.length !== 2) throw new RangeError('A Holdem combo requires exactly two cards');
  if (cards[0] === cards[1]) throw new RangeError('A Holdem combo cannot repeat one physical card');
  const sorted = [...cards].sort(compareHoldemCards);
  return [sorted[0]!, sorted[1]!];
}

function comboIdForCanonicalCards(cards: readonly [string, string]): string {
  return `${HOLDEM_COMBO_ID_PREFIX}${cards[0]}:${cards[1]}`;
}

const combos: HoldemCombo[] = [];
for (let first = 0; first < HOLDEM_DECK.length - 1; first += 1) {
  for (let second = first + 1; second < HOLDEM_DECK.length; second += 1) {
    const cards = Object.freeze([HOLDEM_DECK[first]!, HOLDEM_DECK[second]!]) as readonly [string, string];
    combos.push(
      deepFreeze({
        schemaVersion: HOLDEM_COMBO_SCHEMA_VERSION,
        id: comboIdForCanonicalCards(cards),
        cards,
        handClass: preflopHandClassForCards(cards),
      }),
    );
  }
}

export const HOLDEM_COMBOS: readonly HoldemCombo[] = Object.freeze(combos);

const COMBO_BY_ID = new Map<string, HoldemCombo>(HOLDEM_COMBOS.map((combo) => [combo.id, combo]));
const comboMutableByClass = new Map<string, HoldemCombo[]>(
  PREFLOP_HAND_CLASSES.map((handClass) => [handClass, []]),
);
for (const combo of HOLDEM_COMBOS) {
  comboMutableByClass.get(combo.handClass)!.push(combo);
}
const COMBO_BY_HAND_CLASS = new Map<string, readonly HoldemCombo[]>(
  PREFLOP_HAND_CLASSES.map((handClass) => [handClass, Object.freeze(comboMutableByClass.get(handClass)!)]),
);

export function isHoldemComboId(value: unknown): value is string {
  return typeof value === 'string' && COMBO_BY_ID.has(value);
}

export function assertHoldemComboId(value: unknown, label = 'comboId'): string {
  if (!isHoldemComboId(value)) throw new RangeError(`${label} is not a canonical Holdem combo ID`);
  return value;
}

export function getHoldemComboById(comboId: string): HoldemCombo {
  assertHoldemComboId(comboId);
  return COMBO_BY_ID.get(comboId)!;
}

export function getHoldemComboForCards(cards: readonly string[]): HoldemCombo {
  const ordered = canonicalCards(cards);
  return COMBO_BY_ID.get(comboIdForCanonicalCards(ordered))!;
}

export function holdemComboIdForCards(cards: readonly string[]): string {
  return getHoldemComboForCards(cards).id;
}

export function getHoldemCombosForHandClass(handClass: string): readonly HoldemCombo[] {
  if (!isPreflopHandClass(handClass)) {
    throw new RangeError(`Unsupported preflop hand class: ${handClass}`);
  }
  return COMBO_BY_HAND_CLASS.get(handClass)!;
}
