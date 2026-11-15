import { cloneData } from './freeze';
import { validateGameRulesSnapshot, type GameRulesSnapshot } from './game-rules';
import type { MutablePokerState, PokerState } from './schema';

const NORMALIZED_RULES_SNAPSHOTS = new WeakSet<object>();

export function normalizePokerStateRulesSnapshot(snapshot: unknown): GameRulesSnapshot {
  if (snapshot && typeof snapshot === 'object' && NORMALIZED_RULES_SNAPSHOTS.has(snapshot)) {
    return snapshot as GameRulesSnapshot;
  }
  const normalized = validateGameRulesSnapshot(snapshot);
  NORMALIZED_RULES_SNAPSHOTS.add(normalized);
  return normalized;
}

/** Produces a mutable deep clone of PokerState preserving normalized rulesSnapshot identity. */
export function clonePokerState(state: PokerState): MutablePokerState {
  const normalizedRulesSnapshot =
    state && Object.hasOwn(state, 'rulesSnapshot')
      ? normalizePokerStateRulesSnapshot(state.rulesSnapshot)
      : null;
  const cloned = cloneData(state) as unknown as MutablePokerState;
  if (normalizedRulesSnapshot !== null) {
    cloned.rulesSnapshot = normalizedRulesSnapshot as unknown as GameRulesSnapshot;
  }
  return cloned;
}
