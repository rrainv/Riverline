import { describe, expect, it } from 'vitest';
import { computeStudyMomentum } from './studyMomentum';

describe('computeStudyMomentum', () => {
  it('computes XP, level curve, rank tier, and daily goal progress across study sources', () => {
    const now = new Date('2026-11-23T15:00:00').getTime();
    const todayIso = new Date('2026-11-23T10:00:00').toISOString();
    const yesterdayIso = new Date('2026-11-22T18:00:00').toISOString();
    const twoDaysAgoIso = new Date('2026-11-21T12:00:00').toISOString();

    const summary = computeStudyMomentum({
      trainingSessions: [
        {
          sessionId: 'tr-1',
          mode: 'quick_drill',
          completedAt: todayIso,
          spotsCount: 8,
          planAlignedCount: 6,
          baselineAlignedCount: 6,
        },
        {
          sessionId: 'tr-2',
          mode: 'heads_up_duel',
          completedAt: yesterdayIso,
          spotsCount: 10,
          planAlignedCount: 0,
          baselineAlignedCount: 0,
        },
      ],
      savedHands: [
        {
          objectId: 'h-1',
          createdAt: twoDaysAgoIso,
          updatedAt: twoDaysAgoIso,
          archived: false,
          factTitle: 'BTN AhKh',
          tags: ['study'],
          payload: {
            handNote: 'Good spot',
            heroNotes: [],
          } as never,
        },
      ],
      savedMatchups: [
        { objectId: 'm-1', createdAt: todayIso, factTitle: 'AA vs KK', payload: {} as never },
      ],
      learnProgress: {
        understoodById: { pot_odds: true, equity: true },
        trainerAttempts: [
          { mode: 'equity_guess', spotId: 'eq-1', firstTryCorrect: true, answeredAt: todayIso },
        ],
      },
      dailyGoal: 10,
      nowMs: now,
    });

    // XP: (8*10 + 6*5) + (10*15) + (25+10) + 15 + (2*40) + (10+5) = 110 + 150 + 35 + 15 + 80 + 15 = 405
    expect(summary.totalXp).toBe(405);
    expect(summary.level).toBe(3); // 1 + floor(sqrt(4.05)) = 3
    expect(summary.xpIntoLevel).toBe(5);
    expect(summary.xpForNextLevel).toBe(500);
    expect(summary.rankTier).toBe(2);
    expect(summary.streakDays).toBe(3);
    expect(summary.todayUnits).toBe(9); // 8 drill spots + 1 learn attempt
    expect(summary.todayGoalMet).toBe(false);
    expect(summary.todayGoalPct).toBe(90);
    expect(summary.learnUnderstoodCount).toBe(2);
  });

  it('preserves streak when yesterday had activity and today has none yet, and resets on gap', () => {
    const now = new Date('2026-11-23T15:00:00').getTime();
    const yesterdayIso = new Date('2026-11-22T18:00:00').toISOString();
    const threeDaysAgoIso = new Date('2026-11-20T18:00:00').toISOString();

    const preserved = computeStudyMomentum({
      trainingSessions: [
        {
          sessionId: 'tr-y',
          mode: 'quick_drill',
          completedAt: yesterdayIso,
          spotsCount: 5,
          planAlignedCount: 4,
          baselineAlignedCount: 4,
        },
      ],
      savedHands: [],
      savedMatchups: [],
      learnProgress: { understoodById: {}, trainerAttempts: [] },
      dailyGoal: 5,
      nowMs: now,
    });
    expect(preserved.streakDays).toBe(1);

    const broken = computeStudyMomentum({
      trainingSessions: [
        {
          sessionId: 'tr-old',
          mode: 'quick_drill',
          completedAt: threeDaysAgoIso,
          spotsCount: 5,
          planAlignedCount: 4,
          baselineAlignedCount: 4,
        },
      ],
      savedHands: [],
      savedMatchups: [],
      learnProgress: { understoodById: {}, trainerAttempts: [] },
      dailyGoal: 5,
      nowMs: now,
    });
    expect(broken.streakDays).toBe(0);
  });
});
