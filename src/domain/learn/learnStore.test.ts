import { describe, expect, it } from 'vitest';
import { createEngineClient } from '../../engine-api';
import { createMemoryStudyBackend, createStudyRepository } from '../storage';
import { createLearnStore } from './learnStore';

describe('createLearnStore', () => {
  it('persists understood concepts and honest first-try trainer records', async () => {
    const backend = createMemoryStudyBackend();
    const repository = createStudyRepository(backend);
    const engineClient = createEngineClient({ mode: 'inline' });
    const store = createLearnStore({ engineClient, repository });

    await store.hydrate();
    expect(store.understoodMapSignal.value).toEqual({});

    await store.toggleConceptUnderstood('pot_odds');
    expect(store.understoodMapSignal.value.pot_odds).toBe(true);

    const round = store.trainerRoundSignal.value;
    const wrongIdx = round.options.findIndex((o) => !o.isCorrect);
    await store.pickTrainerOption(wrongIdx);
    expect(store.trainerGradeSignal.value?.isCorrect).toBe(false);
    expect(store.trainerRecordSummarySignal.value).toEqual({
      potOddsCorrect: 0,
      potOddsTotal: 1,
      outsCorrect: 0,
      outsTotal: 0,
      equityGuessCorrect: 0,
      equityGuessTotal: 0,
    });

    // Clicking another option on the already-graded spot does not inflate or overwrite first-try record
    const rightIdx = round.options.findIndex((o) => o.isCorrect);
    await store.pickTrainerOption(rightIdx);
    expect(store.trainerRecordSummarySignal.value.potOddsTotal).toBe(1);

    store.nextTrainerSpot();
    const round2 = store.trainerRoundSignal.value;
    const rightIdx2 = round2.options.findIndex((o) => o.isCorrect);
    await store.pickTrainerOption(rightIdx2);
    expect(store.trainerRecordSummarySignal.value.potOddsCorrect).toBe(1);
    expect(store.trainerRecordSummarySignal.value.potOddsTotal).toBe(2);

    // Re-hydrating a fresh store restores persisted progress from the event log
    const reloaded = createLearnStore({ engineClient, repository });
    await reloaded.hydrate();
    expect(reloaded.understoodMapSignal.value.pot_odds).toBe(true);
    expect(reloaded.trainerRecordSummarySignal.value.potOddsCorrect).toBe(1);
    expect(reloaded.trainerRecordSummarySignal.value.potOddsTotal).toBe(2);
  });

  it('filters glossary terms across EN, RU, and HE', () => {
    const store = createLearnStore({
      engineClient: createEngineClient({ mode: 'inline' }),
      repository: createStudyRepository(createMemoryStudyBackend()),
    });

    store.setGlossaryQuery('шансы');
    expect(store.filteredGlossarySignal.value.some((g) => g.id === 'pot_odds')).toBe(true);

    store.setGlossaryQuery('סיכויי');
    expect(store.filteredGlossarySignal.value.some((g) => g.id === 'pot_odds')).toBe(true);

    store.setGlossaryQuery('');
    store.setGlossaryCategory('actions');
    expect(store.filteredGlossarySignal.value.every((g) => g.category === 'actions')).toBe(true);
  });
});
