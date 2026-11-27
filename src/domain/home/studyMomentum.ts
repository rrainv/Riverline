import { LEARN_CONCEPT_IDS } from '../../engine-api';
import type {
  LearnProgressSnapshot,
  SavedHandRecord,
  SavedMatchupRecord,
  TrainingSessionPayload,
} from '../storage';

export interface StudyMomentumSummary {
  readonly totalXp: number;
  readonly level: number;
  readonly rankTier: 1 | 2 | 3 | 4 | 5 | 6;
  readonly xpIntoLevel: number;
  readonly xpForNextLevel: number;
  readonly levelProgressPct: number;
  readonly activeDaysCount: number;
  readonly todayUnits: number;
  readonly dailyGoal: number;
  readonly todayGoalPct: number;
  readonly todayGoalMet: boolean;
  readonly learnUnderstoodCount: number;
  readonly learnTotalCount: number;
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

export function computeStudyMomentum(input: {
  readonly trainingSessions: readonly TrainingSessionPayload[];
  readonly savedHands: readonly SavedHandRecord[];
  readonly savedMatchups: readonly SavedMatchupRecord[];
  readonly learnProgress: LearnProgressSnapshot;
  readonly dailyGoal: number;
  readonly nowMs?: number;
}): StudyMomentumSummary {
  const nowMs = input.nowMs ?? Date.now();
  const dailyGoal = Math.max(1, input.dailyGoal);
  const unitsByDay = new Map<string, number>();

  const addDayUnits = (iso: string, units: number) => {
    const parsed = Date.parse(iso);
    if (Number.isNaN(parsed)) return;
    const key = localDayKey(parsed);
    unitsByDay.set(key, (unitsByDay.get(key) ?? 0) + units);
  };

  let totalXp = 0;
  const trainingXpByDay = new Map<string, number>();
  const DAILY_TRAINING_XP_CAP = 150;

  for (const s of input.trainingSessions) {
    const rawSessionXp =
      s.mode === 'heads_up_duel'
        ? Math.max(0, s.spotsCount) * 15
        : Math.max(0, s.spotsCount) * 10;
    const parsed = Date.parse(s.completedAt);
    const dayKey = Number.isNaN(parsed) ? s.sessionId : localDayKey(parsed);
    const dayUsed = trainingXpByDay.get(dayKey) ?? 0;
    const granted = Math.max(0, Math.min(rawSessionXp, DAILY_TRAINING_XP_CAP - dayUsed));
    trainingXpByDay.set(dayKey, dayUsed + granted);
    totalXp += granted;
    addDayUnits(s.completedAt, Math.max(1, s.spotsCount));
  }

  for (const h of input.savedHands) {
    if (h.archived) continue;
    const hasNotesOrTags =
      Boolean(h.payload.handNote && h.payload.handNote.trim().length > 0) ||
      h.payload.heroNotes.length > 0 ||
      h.tags.length > 0;
    totalXp += 25 + (hasNotesOrTags ? 10 : 0);
    addDayUnits(h.createdAt, 2);
  }

  // Deduplicate saved matchups by normalized title and cap matchup-save XP so re-saving cannot farm XP.
  const seenMatchups = new Set<string>();
  let matchupXpGranted = 0;
  const MATCHUP_XP_CAP = 150;
  for (const m of input.savedMatchups) {
    const normTitle = m.factTitle.trim().toLowerCase() || m.objectId;
    if (seenMatchups.has(normTitle)) continue;
    seenMatchups.add(normTitle);
    const add = Math.min(15, MATCHUP_XP_CAP - matchupXpGranted);
    if (add <= 0) break;
    matchupXpGranted += add;
    totalXp += add;
  }

  let learnUnderstoodCount = 0;
  for (const conceptId of LEARN_CONCEPT_IDS) {
    if (input.learnProgress.understoodById[conceptId]) {
      learnUnderstoodCount += 1;
      totalXp += 40;
    }
  }

  const seenTrainerSpots = new Set<string>();
  for (const attempt of input.learnProgress.trainerAttempts) {
    if (!seenTrainerSpots.has(attempt.spotId)) {
      seenTrainerSpots.add(attempt.spotId);
      totalXp += 10 + (attempt.firstTryCorrect ? 5 : 0);
    }
    addDayUnits(attempt.answeredAt, 1);
  }

  const level = 1 + Math.floor(Math.sqrt(totalXp / 100));
  const currentLevelFloor = (level - 1) * (level - 1) * 100;
  const nextLevelFloor = level * level * 100;
  const xpIntoLevel = totalXp - currentLevelFloor;
  const xpForNextLevel = Math.max(1, nextLevelFloor - currentLevelFloor);
  const levelProgressPct = Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100));

  const rankTier: 1 | 2 | 3 | 4 | 5 | 6 =
    level >= 15 ? 6 : level >= 10 ? 5 : level >= 6 ? 4 : level >= 4 ? 3 : level >= 2 ? 2 : 1;

  const todayStart = startOfLocalDayMs(nowMs);
  const todayKey = localDayKey(todayStart);
  const todayUnits = unitsByDay.get(todayKey) ?? 0;
  const todayGoalPct = Math.min(100, Math.round((todayUnits / dailyGoal) * 100));
  const todayGoalMet = todayUnits >= dailyGoal;
  const activeDaysCount = unitsByDay.size;

  return {
    totalXp,
    level,
    rankTier,
    xpIntoLevel,
    xpForNextLevel,
    levelProgressPct,
    activeDaysCount,
    todayUnits,
    dailyGoal,
    todayGoalPct,
    todayGoalMet,
    learnUnderstoodCount,
    learnTotalCount: LEARN_CONCEPT_IDS.length,
  };
}
