import { signal } from '@preact/signals';
import type { EquityStore } from './equity';
import type { HandRecorderStore } from './hand';
import type { LearnStore } from './learn';
import type { NightsStore } from './nights';
import type { ReviewStore } from './review';
import type { StrategyStore } from './strategy';
import type { TrainingStore } from './training';

export const lazyStoreVersionSignal = signal<number>(0);

let cachedEquity: EquityStore | null = null;
let cachedHand: HandRecorderStore | null = null;
let cachedReview: ReviewStore | null = null;
let cachedStrategy: StrategyStore | null = null;
let cachedTraining: TrainingStore | null = null;
let cachedNights: NightsStore | null = null;
let cachedLearn: LearnStore | null = null;

function bump(): void {
  lazyStoreVersionSignal.value += 1;
}

export function peekEquityStore(): EquityStore | null {
  return cachedEquity;
}
export function peekHandStore(): HandRecorderStore | null {
  return cachedHand;
}
export function peekReviewStore(): ReviewStore | null {
  return cachedReview;
}
export function peekStrategyStore(): StrategyStore | null {
  return cachedStrategy;
}
export function peekTrainingStore(): TrainingStore | null {
  return cachedTraining;
}
export function peekNightsStore(): NightsStore | null {
  return cachedNights;
}
export function peekLearnStore(): LearnStore | null {
  return cachedLearn;
}

export async function loadEquityStore(): Promise<EquityStore> {
  if (!cachedEquity) {
    const mod = await import('./equity');
    cachedEquity = mod.getSharedEquityStore();
    bump();
  }
  return cachedEquity;
}

export async function loadHandStore(): Promise<HandRecorderStore> {
  if (!cachedHand) {
    const mod = await import('./hand');
    cachedHand = mod.getSharedHandRecorderStore();
    bump();
  }
  return cachedHand;
}

export async function loadReviewStore(): Promise<ReviewStore> {
  if (!cachedReview) {
    const mod = await import('./review');
    cachedReview = mod.getSharedReviewStore();
    bump();
  }
  return cachedReview;
}

export async function loadStrategyStore(): Promise<StrategyStore> {
  if (!cachedStrategy) {
    const mod = await import('./strategy');
    cachedStrategy = mod.getSharedStrategyStore();
    bump();
  }
  return cachedStrategy;
}

export async function loadTrainingStore(): Promise<TrainingStore> {
  if (!cachedTraining) {
    const mod = await import('./training');
    cachedTraining = mod.getSharedTrainingStore();
    bump();
  }
  return cachedTraining;
}

export async function loadNightsStore(): Promise<NightsStore> {
  if (!cachedNights) {
    const mod = await import('./nights');
    cachedNights = mod.getSharedNightsStore();
    bump();
  }
  return cachedNights;
}

export async function loadLearnStore(): Promise<LearnStore> {
  if (!cachedLearn) {
    const mod = await import('./learn');
    cachedLearn = mod.getSharedLearnStore();
    bump();
  }
  return cachedLearn;
}

export function resetLazyStoreCache(): void {
  cachedEquity = null;
  cachedHand = null;
  cachedReview = null;
  cachedStrategy = null;
  cachedTraining = null;
  cachedNights = null;
  cachedLearn = null;
  bump();
}
