import { describe, expect, it } from 'vitest';
import { computeWeeklyStudyLetter } from './weeklyLetter';

describe('Weekly Study Letter (#6)', () => {
  it('summarizes 7-day study activity, orbit/duel net bb, and leak focus gating', () => {
    const nowIso = new Date().toISOString();
    const letter = computeWeeklyStudyLetter({
      weekly: {
        sessionsCount: 3,
        spotsCount: 24,
        handsRecordedCount: 6,
        netDuelBb: 12.5,
        hasAnyActivity: true,
        days: [
          { dateKey: '2026-11-20', dateMs: 1, spotsCount: 10, handsCount: 2, totalUnits: 12, heightPct: 50 },
          { dateKey: '2026-11-21', dateMs: 2, spotsCount: 0, handsCount: 0, totalUnits: 0, heightPct: 0 },
          { dateKey: '2026-11-22', dateMs: 3, spotsCount: 14, handsCount: 4, totalUnits: 18, heightPct: 100 },
        ],
      },
      momentum: {
        totalXp: 420,
        level: 3,
        xpIntoLevel: 20,
        xpForNextLevel: 200,
        levelProgressPct: 10,
        rankTier: 3,
        streakDays: 3,
        todayUnits: 18,
        dailyGoal: 10,
        todayGoalPct: 100,
        todayGoalMet: true,
        learnUnderstoodCount: 2,
        learnTotalCount: 9,
      },
      topLeak: {
        key: 'UTG:pairs',
        position: 'UTG',
        familyId: 'pairs',
        deltaPoints: -14,
        sampleHands: 12,
        isWatching: true,
        tier: 'estimated',
      },
      nights: [],
      trainingSessions: [
        {
          sessionId: 'orb-1',
          mode: 'six_max_orbit',
          completedAt: nowIso,
          spotsCount: 6,
          planAlignedCount: 0,
          baselineAlignedCount: 0,
          netBb: 8.5,
        },
      ],
    });

    expect(letter.activeDaysCount).toBe(2);
    expect(letter.totalSpots).toBe(24);
    expect(letter.handsRecorded).toBe(6);
    expect(letter.orbitAndDuelSessions).toBe(1);
    expect(letter.orbitAndDuelNetBb).toBe(8.5);
    expect(letter.headlineFocusKind).toBe('watching_leak');
    expect(letter.streakDays).toBe(3);
  });
});
