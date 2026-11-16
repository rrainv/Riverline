import { computed, signal } from '@preact/signals';
import {
  createEngineClient,
  LEARN_CONCEPT_IDS,
  LEARN_OUTS_SPOTS,
  LEARN_POT_ODDS_SPOTS,
  type EngineClient,
  type LearnConceptExample,
  type LearnConceptId,
  type LearnTrainerGrade,
  type LearnTrainerMode,
  type LearnTrainerOption,
  type LearnTrainerRound,
  type LearnWeaknessSpec,
} from '../../engine-api';
import {
  getDefaultStudyRepository,
  type LearnTrainerRecordedPayload,
  type StudyRepository,
} from '../storage';
import { LEARN_GLOSSARY_ENTRIES } from './glossary';
import type {
  LearnConceptStatus,
  LearnGlossaryCategory,
  LearnGlossaryEntry,
  LearnPresetId,
  LearnSectionId,
  LearnStore,
  LearnTrainerRecordSummary,
} from './types';

function emptyResultsForMode(mode: LearnTrainerMode): (boolean | null)[] {
  const len = mode === 'pot_odds' ? LEARN_POT_ODDS_SPOTS.length : LEARN_OUTS_SPOTS.length;
  return Array.from({ length: len }, () => null);
}

export interface CreateLearnStoreOptions {
  readonly engineClient?: EngineClient;
  readonly repository?: StudyRepository;
}

export function createLearnStore(options: CreateLearnStoreOptions = {}): LearnStore {
  const engine = options.engineClient ?? createEngineClient({ mode: 'inline' });
  const repository = options.repository ?? getDefaultStudyRepository();

  const activeSectionSignal = signal<LearnSectionId>('path');
  const selectedConceptIdSignal = signal<LearnConceptId>('pot_odds');
  const understoodMapSignal = signal<Readonly<Partial<Record<LearnConceptId, boolean>>>>({});
  const trainerModeSignal = signal<LearnTrainerMode>('pot_odds');
  const trainerSpotIndexSignal = signal<number>(0);
  const trainerChosenOptionSignal = signal<number | null>(null);
  const trainerGradeSignal = signal<LearnTrainerGrade | null>(null);
  const trainerRoundResultsByModeSignal = signal<Record<LearnTrainerMode, (boolean | null)[]>>({
    pot_odds: emptyResultsForMode('pot_odds'),
    outs: emptyResultsForMode('outs'),
  });
  const trainerAttemptsSignal = signal<readonly LearnTrainerRecordedPayload[]>([]);
  const glossaryQuerySignal = signal<string>('');
  const glossaryCategorySignal = signal<LearnGlossaryCategory>('all');
  const loadingSignal = signal<boolean>(false);

  const conceptExampleSignal = computed<LearnConceptExample | null>(() => {
    const res = engine.sync.buildLearnConceptExample(selectedConceptIdSignal.value);
    return res.ok ? res.data : null;
  });

  const trainerRoundSignal = computed<LearnTrainerRound>(() => {
    const res = engine.sync.getLearnTrainerRound(
      trainerModeSignal.value,
      trainerSpotIndexSignal.value,
    );
    if (res.ok) return res.data;
    throw new Error(res.error.message);
  });

  const trainerRoundResultsSignal = computed<readonly (boolean | null)[]>(
    () => trainerRoundResultsByModeSignal.value[trainerModeSignal.value],
  );

  const trainerRecordSummarySignal = computed<LearnTrainerRecordSummary>(() => {
    const attempts = trainerAttemptsSignal.value;
    let potOddsCorrect = 0;
    let potOddsTotal = 0;
    let outsCorrect = 0;
    let outsTotal = 0;
    for (const a of attempts) {
      if (a.mode === 'pot_odds') {
        potOddsTotal += 1;
        if (a.firstTryCorrect) potOddsCorrect += 1;
      } else {
        outsTotal += 1;
        if (a.firstTryCorrect) outsCorrect += 1;
      }
    }
    return { potOddsCorrect, potOddsTotal, outsCorrect, outsTotal };
  });

  const filteredGlossarySignal = computed<readonly LearnGlossaryEntry[]>(() => {
    const q = glossaryQuerySignal.value.trim().toLowerCase();
    const cat = glossaryCategorySignal.value;
    return LEARN_GLOSSARY_ENTRIES.filter((entry) => {
      if (cat !== 'all' && entry.category !== cat) return false;
      if (!q) return true;
      return (
        entry.en.toLowerCase().includes(q) ||
        entry.ru.toLowerCase().includes(q) ||
        entry.he.toLowerCase().includes(q)
      );
    });
  });

  const weaknessesSignal = computed<readonly LearnWeaknessSpec[]>(() => {
    const res = engine.sync.getLearnWeaknesses();
    return res.ok ? res.data : [];
  });

  async function hydrate(): Promise<void> {
    loadingSignal.value = true;
    try {
      const progress = await repository.getLearnProgress();
      understoodMapSignal.value = progress.understoodById;
      trainerAttemptsSignal.value = progress.trainerAttempts;
    } finally {
      loadingSignal.value = false;
    }
  }

  function setActiveSection(section: LearnSectionId): void {
    activeSectionSignal.value = section;
  }

  function selectConcept(conceptId: LearnConceptId): void {
    selectedConceptIdSignal.value = conceptId;
    if (conceptId === 'pot_odds') {
      if (trainerModeSignal.value !== 'pot_odds') {
        setTrainerMode('pot_odds');
      }
    } else if (conceptId === 'equity') {
      if (trainerModeSignal.value !== 'outs') {
        setTrainerMode('outs');
      }
    }
  }

  async function toggleConceptUnderstood(conceptId: LearnConceptId): Promise<void> {
    const current = Boolean(understoodMapSignal.value[conceptId]);
    const next = !current;
    understoodMapSignal.value = { ...understoodMapSignal.value, [conceptId]: next };
    await repository.recordLearnConcept(conceptId, next);
  }

  function getConceptStatus(conceptId: LearnConceptId, index: number): LearnConceptStatus {
    if (understoodMapSignal.value[conceptId]) return 'understood';
    if (selectedConceptIdSignal.value === conceptId) return 'in_progress';
    return index < 7 ? 'ready' : 'later';
  }

  function getSuggestedNextConcept(): LearnConceptId {
    const current = selectedConceptIdSignal.value;
    const understood = understoodMapSignal.value;
    const candidate = LEARN_CONCEPT_IDS.find((id) => id !== current && !understood[id]);
    return candidate ?? LEARN_CONCEPT_IDS[0];
  }

  function setTrainerMode(mode: LearnTrainerMode): void {
    if (trainerModeSignal.value === mode) return;
    trainerModeSignal.value = mode;
    trainerSpotIndexSignal.value = 0;
    trainerChosenOptionSignal.value = null;
    trainerGradeSignal.value = null;
  }

  async function pickTrainerOption(optionIndex: number): Promise<void> {
    if (trainerGradeSignal.value !== null) return;
    const mode = trainerModeSignal.value;
    const spotIndex = trainerSpotIndexSignal.value;
    const res = engine.sync.gradeLearnTrainerAnswer(mode, spotIndex, optionIndex);
    if (!res.ok) return;

    const grade = res.data;
    trainerChosenOptionSignal.value = optionIndex;
    trainerGradeSignal.value = grade;

    const nextModeResults = [...trainerRoundResultsByModeSignal.value[mode]];
    nextModeResults[grade.spotIndex] = grade.isCorrect;
    trainerRoundResultsByModeSignal.value = {
      ...trainerRoundResultsByModeSignal.value,
      [mode]: nextModeResults,
    };

    const record: LearnTrainerRecordedPayload = {
      mode,
      spotId: grade.spotId,
      firstTryCorrect: grade.isCorrect,
      answeredAt: new Date().toISOString(),
    };
    trainerAttemptsSignal.value = [...trainerAttemptsSignal.value, record];
    await repository.recordLearnTrainerAttempt({
      mode,
      spotId: grade.spotId,
      firstTryCorrect: grade.isCorrect,
    });
  }

  function nextTrainerSpot(): void {
    const mode = trainerModeSignal.value;
    const total = mode === 'pot_odds' ? LEARN_POT_ODDS_SPOTS.length : LEARN_OUTS_SPOTS.length;
    const nextIdx = trainerSpotIndexSignal.value + 1;
    if (nextIdx >= total) {
      trainerSpotIndexSignal.value = 0;
      trainerRoundResultsByModeSignal.value = {
        ...trainerRoundResultsByModeSignal.value,
        [mode]: emptyResultsForMode(mode),
      };
    } else {
      trainerSpotIndexSignal.value = nextIdx;
    }
    trainerChosenOptionSignal.value = null;
    trainerGradeSignal.value = null;
  }

  function setGlossaryQuery(query: string): void {
    glossaryQuerySignal.value = query;
  }

  function setGlossaryCategory(category: LearnGlossaryCategory): void {
    glossaryCategorySignal.value = category;
  }

  function applyPreset(preset: LearnPresetId): void {
    if (preset === 'concept') {
      activeSectionSignal.value = 'path';
      selectedConceptIdSignal.value = 'multiway';
      understoodMapSignal.value = { pot_odds: true, equity: true };
      trainerModeSignal.value = 'pot_odds';
      trainerSpotIndexSignal.value = 0;
      trainerChosenOptionSignal.value = null;
      trainerGradeSignal.value = null;
      glossaryQuerySignal.value = '';
      glossaryCategorySignal.value = 'all';
      return;
    }
    if (preset === 'trainer') {
      activeSectionSignal.value = 'path';
      selectedConceptIdSignal.value = 'pot_odds';
      understoodMapSignal.value = { ranges: true };
      trainerModeSignal.value = 'pot_odds';
      trainerSpotIndexSignal.value = 0;
      const round = engine.sync.getLearnTrainerRound('pot_odds', 0);
      if (round.ok) {
        const correctIdx = round.data.options.findIndex((o: LearnTrainerOption) => o.isCorrect);
        const graded = engine.sync.gradeLearnTrainerAnswer('pot_odds', 0, correctIdx);
        trainerChosenOptionSignal.value = correctIdx;
        trainerGradeSignal.value = graded.ok ? graded.data : null;
        const arr = emptyResultsForMode('pot_odds');
        arr[0] = true;
        trainerRoundResultsByModeSignal.value = {
          ...trainerRoundResultsByModeSignal.value,
          pot_odds: arr,
        };
        trainerAttemptsSignal.value = [
          {
            mode: 'pot_odds',
            spotId: round.data.spotId,
            firstTryCorrect: true,
            answeredAt: '2026-11-16T12:00:00.000Z',
          },
        ];
      }
      return;
    }
    if (preset === 'outs') {
      activeSectionSignal.value = 'path';
      selectedConceptIdSignal.value = 'equity';
      trainerModeSignal.value = 'outs';
      trainerSpotIndexSignal.value = 3; // Combo draw JhTh on 9h8c2h (15 unique outs)
      trainerChosenOptionSignal.value = null;
      trainerGradeSignal.value = null;
      return;
    }
    if (preset === 'glossary') {
      activeSectionSignal.value = 'glossary';
      glossaryQuerySignal.value = '';
      glossaryCategorySignal.value = 'all';
      return;
    }
    activeSectionSignal.value = 'weaknesses';
  }

  return {
    activeSectionSignal,
    selectedConceptIdSignal,
    understoodMapSignal,
    conceptExampleSignal,
    trainerModeSignal,
    trainerSpotIndexSignal,
    trainerRoundSignal,
    trainerChosenOptionSignal,
    trainerGradeSignal,
    trainerRoundResultsSignal,
    trainerRecordSummarySignal,
    glossaryQuerySignal,
    glossaryCategorySignal,
    filteredGlossarySignal,
    weaknessesSignal,
    loadingSignal,
    hydrate,
    setActiveSection,
    selectConcept,
    toggleConceptUnderstood,
    getConceptStatus,
    getSuggestedNextConcept,
    setTrainerMode,
    pickTrainerOption,
    nextTrainerSpot,
    setGlossaryQuery,
    setGlossaryCategory,
    applyPreset,
  };
}

let sharedLearnStore: LearnStore | null = null;

export function getSharedLearnStore(): LearnStore {
  if (!sharedLearnStore) {
    sharedLearnStore = createLearnStore();
  }
  return sharedLearnStore;
}

export function resetSharedLearnStore(): void {
  sharedLearnStore = null;
}
