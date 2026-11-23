import type {
  LearnConceptExample,
  LearnConceptId,
  LearnTrainerGrade,
  LearnTrainerMode,
  LearnTrainerRound,
  LearnWeaknessSpec,
} from '../../engine-api';
import type { ReadonlySignal } from '@preact/signals';

export type LearnSectionId = 'path' | 'glossary' | 'weaknesses';

export type LearnPresetId = 'concept' | 'trainer' | 'outs' | 'glossary' | 'weaknesses';

export type LearnConceptStatus = 'understood' | 'in_progress' | 'ready' | 'later';

export type LearnGlossaryCategory = 'all' | 'actions' | 'table' | 'strategy' | 'product';

export interface LearnGlossaryEntry {
  readonly id: string;
  readonly category: Exclude<LearnGlossaryCategory, 'all'>;
  readonly en: string;
  readonly ru: string;
  readonly he: string;
  readonly isLatinAbbr?: boolean;
}

export interface LearnTrainerRecordSummary {
  readonly potOddsCorrect: number;
  readonly potOddsTotal: number;
  readonly outsCorrect: number;
  readonly outsTotal: number;
  readonly equityGuessCorrect: number;
  readonly equityGuessTotal: number;
}

export interface LearnStore {
  readonly activeSectionSignal: ReadonlySignal<LearnSectionId>;
  readonly selectedConceptIdSignal: ReadonlySignal<LearnConceptId>;
  readonly understoodMapSignal: ReadonlySignal<Readonly<Partial<Record<LearnConceptId, boolean>>>>;
  readonly conceptExampleSignal: ReadonlySignal<LearnConceptExample | null>;
  readonly trainerModeSignal: ReadonlySignal<LearnTrainerMode>;
  readonly trainerSpotIndexSignal: ReadonlySignal<number>;
  readonly trainerRoundSignal: ReadonlySignal<LearnTrainerRound>;
  readonly trainerChosenOptionSignal: ReadonlySignal<number | null>;
  readonly trainerGradeSignal: ReadonlySignal<LearnTrainerGrade | null>;
  readonly trainerRoundResultsSignal: ReadonlySignal<readonly (boolean | null)[]>;
  readonly trainerRecordSummarySignal: ReadonlySignal<LearnTrainerRecordSummary>;
  readonly glossaryQuerySignal: ReadonlySignal<string>;
  readonly glossaryCategorySignal: ReadonlySignal<LearnGlossaryCategory>;
  readonly filteredGlossarySignal: ReadonlySignal<readonly LearnGlossaryEntry[]>;
  readonly weaknessesSignal: ReadonlySignal<readonly LearnWeaknessSpec[]>;
  readonly loadingSignal: ReadonlySignal<boolean>;

  hydrate(): Promise<void>;
  setActiveSection(section: LearnSectionId): void;
  selectConcept(conceptId: LearnConceptId): void;
  toggleConceptUnderstood(conceptId: LearnConceptId): Promise<void>;
  getConceptStatus(conceptId: LearnConceptId, index: number): LearnConceptStatus;
  getSuggestedNextConcept(): LearnConceptId;
  setTrainerMode(mode: LearnTrainerMode): void;
  pickTrainerOption(optionIndex: number): Promise<void>;
  recordEquityIntuitionAttempt(spotId: string, firstTryCorrect: boolean): Promise<void>;
  nextTrainerSpot(): void;
  setGlossaryQuery(query: string): void;
  setGlossaryCategory(category: LearnGlossaryCategory): void;
  applyPreset(preset: LearnPresetId): void;
}
