import { describe, expect, it } from 'vitest';
import {
  createEngineClient,
  createStrategyContext,
  HOME_GAME_CURRENCY_PRESETS,
  strategyContextKey,
} from '../../engine-api';
import {
  createMemoryStudyBackend,
  createStudyRepository,
  type StudyStorageBackend,
} from '../storage';
import {
  buildSavedHandPayloadFromCompiled,
  compileShorthandTokensToState,
  createInitialDealtHandState,
  TABLE_PRESETS,
} from '../hand';
import { tokenizeActionShorthandLine } from '../shorthand';
import {
  computeWeeklyStudySummary,
  createHomeStore,
  HOME_EVIDENCE_WATCH_THRESHOLD,
} from './index';

const FIXED_NOW = Date.parse('2026-11-16T19:30:00.000Z');
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function makeSampleHandPayload(
  engine: ReturnType<typeof createEngineClient>,
  options: {
    readonly handId: string;
    readonly shorthand: string;
    readonly savedKind: 'completed_hand' | 'mid_hand_spot';
    readonly tags?: readonly ('review_later' | 'unsure' | 'study')[];
  },
) {
  const preset = TABLE_PRESETS.six_max_100bb;
  const base = createInitialDealtHandState(engine, {
    handId: options.handId,
    seatCount: preset.defaultSeatCount,
    startingStackBb: preset.startingStackBb,
    heroSeatIndex: 3,
    heroCards: ['Ah', 'Kh'],
  });
  const compiled = compileShorthandTokensToState(
    engine,
    base,
    tokenizeActionShorthandLine(options.shorthand),
  );
  if (!compiled.ok) throw new Error(compiled.message);
  const payload = buildSavedHandPayloadFromCompiled({
    handId: options.handId,
    tablePreset: 'six_max_100bb',
    unitLabel: preset.unitLabel,
    seatCount: preset.defaultSeatCount,
    startingStackBb: preset.startingStackBb,
    heroSeatIndex: 3,
    heroCards: ['Ah', 'Kh'],
    shorthandLine: options.shorthand,
    compiled,
  });
  return {
    ...payload,
    savedKind: options.savedKind,
    tags: options.tags,
  };
}

describe('HomeStore & continuity aggregation', () => {
  it('starts in honest first_visit state when riverline-study-v1 is empty', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createHomeStore({
      engine: createEngineClient({ mode: 'inline' }),
      repository: repo,
      nowFn: () => FIXED_NOW,
    });

    await store.hydrate();

    expect(store.visitStateSignal.value).toBe('first_visit');
    expect(store.nextStepsSignal.value).toEqual([]);
    expect(store.topLeakSignal.value).toBeNull();
    expect(store.nightCardSignal.value).toBeNull();
    expect(store.weeklySummarySignal.value.hasAnyActivity).toBe(false);
    expect(store.weeklySummarySignal.value.days).toHaveLength(7);
  });

  it('never treats zero-sample unknown cells as leaks and marks <20 samples as watching', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const coCtx = strategyContextKey(
      createStrategyContext({
        tableSize: 6,
        stackDepthBb: 100,
        decisionFamily: 'preflop_rfi',
        position: 'CO',
      }),
    );
    await repo.recordStrategyEvidence([
      {
        evidenceId: 'ev-co-1',
        occurredAt: new Date(FIXED_NOW).toISOString(),
        contextKey: coCtx,
        handClass: 'AA',
        source: 'drill',
        action: 'raise',
      },
      {
        evidenceId: 'ev-co-2',
        occurredAt: new Date(FIXED_NOW).toISOString(),
        contextKey: coCtx,
        handClass: 'KK',
        source: 'drill',
        action: 'raise',
      },
    ]);

    const store = createHomeStore({
      engine: createEngineClient({ mode: 'inline' }),
      repository: repo,
      nowFn: () => FIXED_NOW,
    });
    await store.hydrate();

    const leak = store.topLeakSignal.value;
    expect(leak).not.toBeNull();
    // Must pick CO (which has evidence), never UTG/HJ/BTN/SB (which have 0 evidence).
    expect(leak?.position).toBe('CO');
    expect(leak?.sampleHands).toBe(2);
    expect(leak?.sampleHands).toBeLessThan(HOME_EVIDENCE_WATCH_THRESHOLD);
    expect(leak?.isWatching).toBe(true);
    expect(leak?.tier).toBe('estimated');
  });

  it('clears watching flag once a position reaches 20 recorded evidence samples', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const utgCtx = strategyContextKey(
      createStrategyContext({
        tableSize: 6,
        stackDepthBb: 100,
        decisionFamily: 'preflop_rfi',
        position: 'UTG',
      }),
    );
    const hands = [
      'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77',
      'AKs', 'AQs', 'AJs', 'ATs', 'KQs', 'KJs', 'QJs',
      'AKo', 'AQo', 'AJo', 'KQo', 'QJo',
    ];
    await repo.recordStrategyEvidence(
      hands.map((handClass, idx) => ({
        evidenceId: `utg-ev-${idx}`,
        occurredAt: new Date(FIXED_NOW).toISOString(),
        contextKey: utgCtx,
        handClass,
        source: 'calibration' as const,
        action: 'raise' as const,
      })),
    );

    const store = createHomeStore({
      engine: createEngineClient({ mode: 'inline' }),
      repository: repo,
      nowFn: () => FIXED_NOW,
    });
    await store.hydrate();

    expect(store.topLeakSignal.value?.position).toBe('UTG');
    expect(store.topLeakSignal.value?.sampleHands).toBe(20);
    expect(store.topLeakSignal.value?.isWatching).toBe(false);
  });

  it('prioritizes at most 3 next steps with only step 1 primary and builds morning-after night card', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());

    const handRecord = await repo.saveHand(
      makeSampleHandPayload(engine, {
        handId: 'h-friday',
        shorthand: 'btn r2.5 sb f bb c / Qh 7c 2h',
        savedKind: 'completed_hand',
        tags: ['review_later'],
      }),
    );

    await repo.recordTrainingSession({
      sessionId: 'ts-1',
      mode: 'quick_drill',
      completedAt: new Date(FIXED_NOW - ONE_DAY_MS).toISOString(),
      spotsCount: 10,
      planAlignedCount: 8,
      baselineAlignedCount: 9,
    });

    const night = await repo.createNightSession({
      sessionId: 'n-fri',
      title: "Friday at Dan's",
      currency: HOME_GAME_CURRENCY_PRESETS.ils,
      participants: [
        { playerId: 'p1', displayName: 'Eli', seatNumber: 1, status: 'active' },
        { playerId: 'p2', displayName: 'Dan', seatNumber: 2, status: 'active' },
      ],
    });
    await repo.appendNightTransaction({
      sessionId: night.session.sessionId,
      playerId: 'p1',
      type: 'buy_in',
      amountMinor: 10_000,
    });
    await repo.appendNightTransaction({
      sessionId: night.session.sessionId,
      playerId: 'p2',
      type: 'buy_in',
      amountMinor: 10_000,
    });
    await repo.appendNightTransaction({
      sessionId: night.session.sessionId,
      playerId: 'p1',
      type: 'cash_out',
      amountMinor: 14_000,
    });
    await repo.appendNightTransaction({
      sessionId: night.session.sessionId,
      playerId: 'p2',
      type: 'cash_out',
      amountMinor: 6_000,
    });
    await repo.settleNightSession(night.session.sessionId);
    await repo.linkHandToNight({
      nightSessionId: night.session.sessionId,
      handObjectId: handRecord.objectId,
      shorthandSummary: 'btn r2.5 sb f bb c / Qh 7c 2h',
    });

    const store = createHomeStore({
      engine,
      repository: repo,
      nowFn: () => FIXED_NOW,
    });
    await store.hydrate();

    expect(store.visitStateSignal.value).toBe('returning');
    const steps = store.nextStepsSignal.value;
    expect(steps.length).toBeGreaterThanOrEqual(2);
    expect(steps.length).toBeLessThanOrEqual(3);
    expect(steps.filter((s) => s.primary)).toHaveLength(1);
    expect(steps[0]?.primary).toBe(true);
    expect(steps[0]?.kind).toBe('review_hand');

    const nightCard = store.nightCardSignal.value;
    expect(nightCard).not.toBeNull();
    expect(nightCard?.status).toBe('settled');
    expect(nightCard?.linkedHandsCount).toBe(1);
    expect(nightCard?.firstLinkedHandId).toBe(handRecord.objectId);
    expect(nightCard?.topNetPlayerName).toBe('Eli');
  });

  it('degrades gracefully when one repository query fails', async () => {
    const baseRepo = createStudyRepository(createMemoryStudyBackend());
    const failingRepo = {
      ...baseRepo,
      async listNightSessions() {
        throw new Error('IndexedDB read blocked');
      },
    };
    await baseRepo.recordTrainingSession({
      sessionId: 'ts-ok',
      mode: 'quick_drill',
      completedAt: new Date(FIXED_NOW).toISOString(),
      spotsCount: 5,
      planAlignedCount: 4,
      baselineAlignedCount: 4,
    });

    const store = createHomeStore({
      engine: createEngineClient({ mode: 'inline' }),
      repository: failingRepo,
      nowFn: () => FIXED_NOW,
    });
    await store.hydrate();

    expect(store.sectionErrorsSignal.value.nights).toBe(true);
    expect(store.sectionErrorsSignal.value.training).toBe(false);
    expect(store.weeklySummarySignal.value.spotsCount).toBe(5);
    expect(store.nightCardSignal.value).toBeNull();
  });

  it('computes 7-day rolling weekly summary and handles presets', () => {
    const summary = computeWeeklyStudySummary({
      trainingSessions: [
        {
          sessionId: 'a',
          mode: 'quick_drill',
          completedAt: new Date(FIXED_NOW - 2 * ONE_DAY_MS).toISOString(),
          spotsCount: 10,
          planAlignedCount: 7,
          baselineAlignedCount: 8,
        },
        {
          sessionId: 'old',
          mode: 'quick_drill',
          completedAt: new Date(FIXED_NOW - 12 * ONE_DAY_MS).toISOString(),
          spotsCount: 50,
          planAlignedCount: 40,
          baselineAlignedCount: 40,
        },
      ],
      savedHands: [],
      nowMs: FIXED_NOW,
    });

    expect(summary.sessionsCount).toBe(1);
    expect(summary.spotsCount).toBe(10);
    expect(summary.days).toHaveLength(7);
    expect(summary.days.filter((d) => d.heightPct > 0)).toHaveLength(1);

    const store = createHomeStore({ nowFn: () => FIXED_NOW });
    store.applyPreset('returning');
    expect(store.visitStateSignal.value).toBe('returning');
    expect(store.nextStepsSignal.value).toHaveLength(3);
    expect(store.nightCardSignal.value?.title).toBe("Friday at Dan's");

    store.applyPreset('first_visit');
    expect(store.visitStateSignal.value).toBe('first_visit');
    expect(store.nextStepsSignal.value).toHaveLength(0);

    store.applyPreset('night_after');
    expect(store.nightCardSignal.value?.status).toBe('settled');
  });

  it('keeps storage backend type clean', () => {
    const backend: StudyStorageBackend = createMemoryStudyBackend();
    expect(typeof backend.readAllEvents).toBe('function');
  });
});
