export const CARD_RANKS = '23456789TJQKA' as const;
export const CARD_SUITS = 'shdc' as const;

const CARD_PATTERN = /^[2-9TJQKA][shdc]$/;

export interface CardGroup {
  readonly label?: string;
  readonly cards: readonly string[];
}

export function isCard(value: unknown): value is string {
  return typeof value === 'string' && CARD_PATTERN.test(value);
}

export function assertCard(value: unknown, label = 'card'): string {
  if (!isCard(value)) {
    throw new TypeError(
      `${label} must use strict two-character rank/suit casing, for example As or 7d`,
    );
  }
  return value;
}

export function assertCardArray(cards: unknown, label = 'cards'): readonly string[] {
  if (!Array.isArray(cards)) throw new TypeError(`${label} must be an array`);
  cards.forEach((card, index) => assertCard(card, `${label}[${index}]`));
  return cards as readonly string[];
}

export function assertUniqueKnownCards(cardGroups: readonly CardGroup[]): Set<string> {
  if (!Array.isArray(cardGroups)) throw new TypeError('cardGroups must be an array');

  const seen = new Set<string>();
  for (const group of cardGroups) {
    const label = group && group.label ? String(group.label) : 'cards';
    const cards = group && group.cards;
    assertCardArray(cards, label);
    for (const card of cards) {
      if (seen.has(card)) throw new RangeError(`Duplicate known card: ${card}`);
      seen.add(card);
    }
  }
  return seen;
}
