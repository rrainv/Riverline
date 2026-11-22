import { describe, expect, it } from 'vitest';
import { computeHomeHabitSummary } from './habitCoach';
import type { SavedHandRecord, TrainingSessionPayload } from '../storage';

function makeHand(id: string, tags: SavedHandRecord['tags'], archived = false): SavedHandRecord {
  return {
    objectId: id,
    createdAt: '2026-11-21T12:00:00.000Z',
    updatedAt: '2026-11-21T12:00:00.000Z',
    archived,
    factTitle: 'BTN · AsKd',
    tags,
    payload: {} as SavedHandRecord['payload'],
  };
}

describe('computeHomeHabitSummary', () => {
  it('returns null when no tagged hands or duel sessions exist', () => {
    expect(computeHomeHabitSummary([makeHand('h1', [])], [])).toBeNull();
  });

  it('aggregates non-archived hand tags and duel counts with Watching threshold < 5', () => {
    const hands = [
      makeHand('h1', ['review_later']),
      makeHand('h2', ['review_later']),
      makeHand('h3', ['study']),
      makeHand('h4', ['review_later'], true),
    ];
    const duels: TrainingSessionPayload[] = [
      {
        sessionId: 'd1',
        mode: 'heads_up_duel',
        completedAt: '2026-11-21T12:00:00.000Z',
        spotsCount: 10,
        planAlignedCount: 0,
        baselineAlignedCount: 0,
      },
    ];
    const summary = computeHomeHabitSummary(hands, duels);
    expect(summary).toEqual({
      topTag: 'review_later',
      topTagCount: 2,
      taggedHandsTotal: 3,
      isWatching: true,
      duelSessionsCount: 1,
    });
  });
});
