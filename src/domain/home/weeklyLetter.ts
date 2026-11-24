import type { NightSessionRecord, TrainingSessionPayload } from '../storage';
import type { StudyMomentumSummary } from './studyMomentum';
import type { HomeTopLeakSummary, WeeklyStudySummary } from './types';

export type WeeklyLetterFocusKind = 'leak' | 'watching_leak' | 'night' | 'steady';

export interface WeeklyStudyLetter {
  readonly activeDaysCount: number;
  readonly totalSpots: number;
  readonly handsRecorded: number;
  readonly orbitAndDuelSessions: number;
  readonly orbitAndDuelNetBb: number;
  readonly recentNightTitle: string | null;
  readonly headlineFocusKind: WeeklyLetterFocusKind;
  readonly streakDays: number;
}

export function computeWeeklyStudyLetter(input: {
  readonly weekly: WeeklyStudySummary;
  readonly momentum: StudyMomentumSummary;
  readonly topLeak: HomeTopLeakSummary | null;
  readonly nights: readonly NightSessionRecord[];
  readonly trainingSessions: readonly TrainingSessionPayload[];
}): WeeklyStudyLetter {
  const activeDaysCount = input.weekly.days.filter((d) => d.totalUnits > 0).length;
  const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;

  let orbitAndDuelSessions = 0;
  let orbitAndDuelNetBb = 0;
  for (const s of input.trainingSessions) {
    const ms = Date.parse(s.completedAt);
    if (Number.isFinite(ms) && ms < sevenDaysAgoMs) continue;
    if (s.mode === 'heads_up_duel' || s.mode === 'six_max_orbit') {
      orbitAndDuelSessions += 1;
      orbitAndDuelNetBb += s.netBb ?? 0;
    }
  }
  orbitAndDuelNetBb = Math.round(orbitAndDuelNetBb * 10) / 10;

  const recentNightTitle = input.nights[0]?.session.title ?? null;

  let headlineFocusKind: WeeklyLetterFocusKind = 'steady';
  if (input.topLeak && !input.topLeak.isWatching) {
    headlineFocusKind = 'leak';
  } else if (input.topLeak && input.topLeak.isWatching) {
    headlineFocusKind = 'watching_leak';
  } else if (recentNightTitle) {
    headlineFocusKind = 'night';
  }

  return {
    activeDaysCount,
    totalSpots: input.weekly.spotsCount,
    handsRecorded: input.weekly.handsRecordedCount,
    orbitAndDuelSessions,
    orbitAndDuelNetBb,
    recentNightTitle,
    headlineFocusKind,
    streakDays: input.momentum.streakDays,
  };
}
