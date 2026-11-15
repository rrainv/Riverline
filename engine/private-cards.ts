import { deepFreeze } from './freeze';
import {
  HOLE_CARD_STATES,
  POKER_HIDDEN_HOLE_CARDS_SCHEMA_VERSION,
  type HiddenHoleCards,
  type PlayerHoleCards,
} from './schema';

const HIDDEN_HOLE_CARD_KEYS = Object.freeze(['schemaVersion', 'status', 'cardCount']);

/**
 * Structural observer-level marker representing two dealt cards whose identities are unknown.
 */
export function createHiddenHoleCards(): HiddenHoleCards {
  return deepFreeze({
    schemaVersion: POKER_HIDDEN_HOLE_CARDS_SCHEMA_VERSION,
    status: HOLE_CARD_STATES.HIDDEN,
    cardCount: 2 as const,
  });
}

export function isHiddenHoleCards(value: unknown): value is HiddenHoleCards {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    record.schemaVersion === POKER_HIDDEN_HOLE_CARDS_SCHEMA_VERSION &&
    record.status === HOLE_CARD_STATES.HIDDEN &&
    record.cardCount === 2 &&
    Object.keys(record).length === HIDDEN_HOLE_CARD_KEYS.length &&
    HIDDEN_HOLE_CARD_KEYS.every((key) => Object.hasOwn(record, key))
  );
}

export function validateHiddenHoleCards(value: unknown, label = 'holeCards'): HiddenHoleCards {
  if (!isHiddenHoleCards(value)) {
    throw new TypeError(`${label} must be a canonical dealt-but-hidden two-card marker`);
  }
  return value;
}

export function areHoleCardsDealt(holeCards: PlayerHoleCards): boolean {
  return Array.isArray(holeCards) || isHiddenHoleCards(holeCards);
}

export function areHoleCardsKnown(holeCards: PlayerHoleCards): holeCards is readonly string[] {
  return Array.isArray(holeCards);
}
