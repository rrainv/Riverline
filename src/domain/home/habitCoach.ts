import type { SavedHandRecord, SavedObjectTagId, TrainingSessionPayload } from '../storage';

export interface HomeHabitSummary {
  readonly topTag: SavedObjectTagId | null;
  readonly topTagCount: number;
  readonly taggedHandsTotal: number;
  readonly isWatching: boolean;
  readonly duelSessionsCount: number;
}

export function computeHomeHabitSummary(
  hands: readonly SavedHandRecord[],
  trainingSessions: readonly TrainingSessionPayload[],
): HomeHabitSummary | null {
  const counts = new Map<SavedObjectTagId, number>();
  let taggedHandsTotal = 0;

  for (const hand of hands) {
    if (hand.archived) continue;
    const tags = hand.tags ?? [];
    if (tags.length === 0) continue;
    taggedHandsTotal += 1;
    for (const tag of tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  let topTag: SavedObjectTagId | null = null;
  let topTagCount = 0;
  for (const [tag, count] of counts.entries()) {
    if (count > topTagCount) {
      topTag = tag;
      topTagCount = count;
    }
  }

  const duelSessionsCount = trainingSessions.filter(
    (s) => s.mode === 'heads_up_duel',
  ).length;

  if (topTag === null && duelSessionsCount === 0) {
    return null;
  }

  return {
    topTag,
    topTagCount,
    taggedHandsTotal,
    isWatching: topTagCount > 0 && topTagCount < 20,
    duelSessionsCount,
  };
}
