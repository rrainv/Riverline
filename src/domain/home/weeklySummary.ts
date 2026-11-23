import type { TrainingWeekStats } from '../training/types';
import type {
  LearnTrainerRecordedPayload,
  SavedHandRecord,
  TrainingSessionPayload,
} from '../storage';
import type { WeeklyActivityDay, WeeklyStudySummary } from './types';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function localDayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfLocalDayMs(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Shared 7-day rolling Training summary used by both Training Hub and Home.
 */
export function computeTrainingWeekStats(
  trainingSessions: readonly TrainingSessionPayload[],
  inFlightDrillSpots = 0,
  nowMs = Date.now(),
): TrainingWeekStats {
  const cutoff = nowMs - 7 * ONE_DAY_MS;
  const sessions = trainingSessions.filter((s) => {
    const t = Date.parse(s.completedAt);
    return Number.isNaN(t) || t >= cutoff;
  });
  return {
    sessionsCount: sessions.length,
    spotsCount: sessions.reduce((sum, s) => sum + s.spotsCount, 0) + inFlightDrillSpots,
    netDuelBb: roundTenth(sessions.reduce((sum, s) => sum + (s.netBb ?? 0), 0)),
  };
}

/**
 * Computes the 7-day continuity summary across training sessions and recorded hands.
 */
export function computeWeeklyStudySummary(input: {
  readonly trainingSessions: readonly TrainingSessionPayload[];
  readonly savedHands: readonly SavedHandRecord[];
  readonly learnAttempts?: readonly LearnTrainerRecordedPayload[];
  readonly nowMs?: number;
}): WeeklyStudySummary {
  const nowMs = input.nowMs ?? Date.now();
  const todayStart = startOfLocalDayMs(nowMs);
  const windowStart = todayStart - 6 * ONE_DAY_MS;

  const trainStats = computeTrainingWeekStats(input.trainingSessions, 0, nowMs);

  const dayBuckets = new Map<string, { spotsCount: number; handsCount: number; dateMs: number }>();
  const orderedKeys: string[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const dayMs = todayStart - i * ONE_DAY_MS;
    const key = localDayKey(dayMs);
    orderedKeys.push(key);
    dayBuckets.set(key, { spotsCount: 0, handsCount: 0, dateMs: dayMs });
  }

  for (const s of input.trainingSessions) {
    const parsed = Date.parse(s.completedAt);
    const ms = Number.isNaN(parsed) ? todayStart : parsed;
    if (ms < windowStart) continue;
    const bucket = dayBuckets.get(localDayKey(ms));
    if (bucket) {
      bucket.spotsCount += Math.max(1, s.spotsCount);
    }
  }

  let learnSpotsCount = 0;
  for (const a of input.learnAttempts ?? []) {
    const parsed = Date.parse(a.answeredAt);
    const ms = Number.isNaN(parsed) ? todayStart : parsed;
    if (ms >= nowMs - 7 * ONE_DAY_MS) {
      learnSpotsCount += 1;
    }
    if (ms < windowStart) continue;
    const bucket = dayBuckets.get(localDayKey(ms));
    if (bucket) {
      bucket.spotsCount += 1;
    }
  }

  let handsRecordedCount = 0;
  for (const h of input.savedHands) {
    if (h.archived) continue;
    const parsed = Date.parse(h.createdAt);
    if (Number.isNaN(parsed)) continue;
    if (parsed >= nowMs - 7 * ONE_DAY_MS) {
      handsRecordedCount += 1;
    }
    if (parsed < windowStart) continue;
    const bucket = dayBuckets.get(localDayKey(parsed));
    if (bucket) {
      bucket.handsCount += 1;
    }
  }

  const rawDays = orderedKeys.map((key) => {
    const b = dayBuckets.get(key)!;
    const totalUnits = b.spotsCount + b.handsCount * 3;
    return {
      dateKey: key,
      dateMs: b.dateMs,
      spotsCount: b.spotsCount,
      handsCount: b.handsCount,
      totalUnits,
    };
  });

  const maxUnits = Math.max(0, ...rawDays.map((d) => d.totalUnits));
  const days: WeeklyActivityDay[] = rawDays.map((d) => ({
    ...d,
    heightPct:
      d.totalUnits === 0 || maxUnits === 0
        ? 0
        : Math.max(18, Math.round((d.totalUnits / maxUnits) * 100)),
  }));

  return {
    sessionsCount: trainStats.sessionsCount,
    spotsCount: trainStats.spotsCount + learnSpotsCount,
    handsRecordedCount,
    netDuelBb: trainStats.netDuelBb,
    days,
    hasAnyActivity:
      trainStats.sessionsCount > 0 ||
      trainStats.spotsCount > 0 ||
      learnSpotsCount > 0 ||
      handsRecordedCount > 0,
  };
}
