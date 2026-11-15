import { describe, expect, it } from 'vitest';
import { createMemoryStudyBackend, createStudyRepository } from '../storage';
import { createTrainingStore, DUEL_TOTAL_HANDS } from './index';

describe('src/domain/training store', () => {
  it('runs Quick drill with plan hidden until confirmed, writes strategy evidence, and persists training sessions', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createTrainingStore({ repository: repo, instantTimers: true });

    await store.hydrate();
    await store.openQuickDrill({ target: 'preflop_rfi', focusPosition: 'BTN', focusFamilyId: 'suited_aces' });

    const ex = store.drillExerciseSignal.value;
    expect(ex).not.toBeNull();
    expect(store.drillGradeSignal.value).toBeNull();

    // Confirm an answer
    store.selectDrillTicket('raise');
    store.selectDrillSize('s0');
    await store.confirmDrillAnswer();

    const grade = store.drillGradeSignal.value;
    expect(grade).not.toBeNull();
    expect(grade?.grade).toBeNull();
    expect(grade?.isMathMistake).toBe(false);
    expect(store.thisWeekStatsSignal.value.spotsCount).toBe(1);

    // Strategy evidence was persisted into shared StudyRepository
    const savedEvidence = await repo.listStrategyEvidence();
    expect(savedEvidence).toHaveLength(1);
    expect(savedEvidence[0]?.source).toBe('drill');

    await store.finishDrillSession();
    const sessions = await repo.listTrainingSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.mode).toBe('quick_drill');
  });

  it('plays a full 10-hand Heads-up duel vs Astra, computes SizeLadder duelCallFacts, equity vs any, and saves hands for /review', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createTrainingStore({ repository: repo, instantTimers: true });

    await store.startHeadsUpDuel(707);
    expect(store.duelStateSignal.value?.handNumber).toBe(1);

    for (let hand = 1; hand <= DUEL_TOTAL_HANDS; hand += 1) {
      let guard = 0;
      while (
        store.duelStateSignal.value &&
        !store.duelStateSignal.value.pokerState.terminal.isTerminal &&
        guard < 25
      ) {
        const live = store.duelStateSignal.value;
        if (live.pokerState.actingPlayerId === 'hero') {
          if (live.legalSpec?.check.available) {
            store.selectDuelTicket('check');
          } else if (live.legalSpec?.call.available) {
            store.selectDuelTicket('call');
          } else {
            store.selectDuelTicket('fold');
          }
          await store.confirmDuelAction();
        }
        guard += 1;
      }

      expect(store.duelStateSignal.value?.pokerState.terminal.isTerminal).toBe(true);
      if (hand < DUEL_TOTAL_HANDS) {
        await store.dealNextDuelHand();
      }
    }

    const finished = store.duelStateSignal.value!;
    expect(finished.finishedMatch).toBe(true);
    expect(finished.completedHands).toHaveLength(DUEL_TOTAL_HANDS);

    // Compute exact equity vs any two cards for final hand
    await store.computeDuelHandEquity();
    expect(store.duelStateSignal.value?.handEquity).not.toBeNull();

    // Save duel hands cleanly into StudyRepository so /review can list them
    const savedCount = await store.saveDuelHandsToReview();
    expect(savedCount).toBe(DUEL_TOTAL_HANDS);
    const savedHands = await repo.listSavedHands();
    expect(savedHands).toHaveLength(DUEL_TOTAL_HANDS);
    expect(savedHands[0]?.payload.seatCount).toBe(2);

    // Presets work cleanly too
    await store.applyPreset('duel_flop_ladder');
    expect(store.duelStateSignal.value?.sizePresets.length).toBe(5);
    expect(store.duelStateSignal.value?.sizePresets[1]?.costLineValues.potIfCalledBb).toBeGreaterThan(0);

    store.dispose();
  });
});
