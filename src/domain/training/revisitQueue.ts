import type { TrainingDrillExercise } from '../../engine-api';
import { REVISIT_STORAGE_KEY } from '../shellState';

export { REVISIT_STORAGE_KEY };
const DAY_MS = 24 * 60 * 60 * 1000;
const INTERVAL_DAYS: readonly number[] = [0, 1, 3, 7];

export interface RevisitQueueItem {
  readonly exercise: TrainingDrillExercise;
  readonly box: 0 | 1 | 2 | 3;
  readonly dueAtMs: number;
  readonly attempts: number;
}

export function loadRevisitQueue(): readonly RevisitQueueItem[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(REVISIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is RevisitQueueItem =>
        Boolean(item) &&
        typeof item === 'object' &&
        Boolean((item as RevisitQueueItem).exercise?.exerciseId) &&
        typeof (item as RevisitQueueItem).dueAtMs === 'number',
    );
  } catch {
    return [];
  }
}

export function saveRevisitQueue(items: readonly RevisitQueueItem[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(REVISIT_STORAGE_KEY, JSON.stringify(items.slice(-30)));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearRevisitQueue(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(REVISIT_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function getDueRevisitItems(
  items: readonly RevisitQueueItem[],
  nowMs = Date.now(),
): readonly RevisitQueueItem[] {
  return items.filter((item) => item.dueAtMs <= nowMs);
}

export function recordRevisitOutcome(
  items: readonly RevisitQueueItem[],
  exercise: TrainingDrillExercise,
  aligned: boolean,
  nowMs = Date.now(),
): readonly RevisitQueueItem[] {
  const existingIdx = items.findIndex((i) => i.exercise.exerciseId === exercise.exerciseId);
  if (aligned) {
    if (existingIdx < 0) return items;
    const existing = items[existingIdx]!;
    const nextBox = existing.box + 1;
    if (nextBox >= INTERVAL_DAYS.length) {
      // Graduated out of revisit queue
      return items.filter((_, idx) => idx !== existingIdx);
    }
    const updated: RevisitQueueItem = {
      exercise: existing.exercise,
      box: nextBox as 0 | 1 | 2 | 3,
      dueAtMs: nowMs + INTERVAL_DAYS[nextBox]! * DAY_MS,
      attempts: existing.attempts + 1,
    };
    return items.map((item, idx) => (idx === existingIdx ? updated : item));
  }

  // Missed: reset to box 0 (due immediately)
  const fresh: RevisitQueueItem = {
    exercise,
    box: 0,
    dueAtMs: nowMs,
    attempts: existingIdx >= 0 ? items[existingIdx]!.attempts + 1 : 1,
  };
  if (existingIdx >= 0) {
    return items.map((item, idx) => (idx === existingIdx ? fresh : item));
  }
  return [...items, fresh].slice(-30);
}
