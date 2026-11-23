import type { PokerState } from '../../engine-api';
import type { SavedHandPayload } from './types';

/**
 * Strips bulky append-only accounting ledger entries from persisted `saved_hand.*`
 * snapshots while preserving all replay, review, and validation invariants.
 */
export function compactSavedHandPayload(payload: SavedHandPayload): SavedHandPayload {
  const ps = payload.pokerState;
  const compactPokerState: PokerState = {
    ...ps,
    ledger: [],
    deadCards: Array.isArray(ps.deadCards) ? [...ps.deadCards] : [],
    board: Array.isArray(ps.board) ? [...ps.board] : [],
    players: Array.isArray(ps.players) ? ps.players.map((p) => ({ ...p })) : [],
    actionHistory: Array.isArray(ps.actionHistory) ? ps.actionHistory.map((a) => ({ ...a })) : [],
  };
  return {
    ...payload,
    heroCards: [payload.heroCards[0], payload.heroCards[1]],
    recordedActions: payload.recordedActions.map((a) => ({ ...a })),
    heroNotes: payload.heroNotes.map((n) => ({ ...n })),
    pokerState: compactPokerState,
  };
}

/**
 * Normalizes a persisted `saved_hand.*` payload on read (backwards-compatible with
 * both legacy full payloads and compacted payloads).
 */
export function expandSavedHandPayload(payload: SavedHandPayload): SavedHandPayload {
  if (Array.isArray(payload.pokerState.ledger)) {
    return payload;
  }
  return {
    ...payload,
    pokerState: {
      ...payload.pokerState,
      ledger: [],
    },
  };
}
