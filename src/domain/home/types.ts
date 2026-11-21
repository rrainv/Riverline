import type { ReadonlySignal, Signal } from '@preact/signals';
import type {
  EngineClient,
  FactTier,
  HomeGameMorningSummary,
  StrategyEvidenceEntry,
  StrategyFamilyId,
  StrategyLeakMapProjection,
  StrategySpotMapProjection,
  StrategySpotRowId,
} from '../../engine-api';
import type {
  NightSessionRecord,
  SavedHandRecord,
  SavedMatchupRecord,
  StudyRepository,
  TrainingSessionPayload,
} from '../storage';

export const HOME_EVIDENCE_WATCH_THRESHOLD = 20;

export type HomePresetId = 'returning' | 'first_visit' | 'night_after';

export type HomeGreetingBucket = 'morning' | 'afternoon' | 'evening';

export type HomeVisitState = 'first_visit' | 'returning';

export interface WeeklyActivityDay {
  readonly dateKey: string;
  readonly dateMs: number;
  readonly spotsCount: number;
  readonly handsCount: number;
  readonly totalUnits: number;
  readonly heightPct: number;
}

export interface WeeklyStudySummary {
  readonly sessionsCount: number;
  readonly spotsCount: number;
  readonly handsRecordedCount: number;
  readonly netDuelBb: number;
  readonly days: readonly WeeklyActivityDay[];
  readonly hasAnyActivity: boolean;
}

export interface HomeTopLeakSummary {
  readonly key: string;
  readonly position: string;
  readonly familyId: StrategyFamilyId;
  readonly deltaPoints: number;
  readonly sampleHands: number;
  readonly isWatching: boolean;
  readonly tier: FactTier;
}

export type HomeNextStepAction =
  | { readonly kind: 'continue_night'; readonly sessionId: string; readonly tab: 'ledger' | 'settle' }
  | { readonly kind: 'finish_spot'; readonly handObjectId: string }
  | { readonly kind: 'finish_plan'; readonly rowId: StrategySpotRowId; readonly position: string }
  | { readonly kind: 'review_hand'; readonly handObjectId: string }
  | {
      readonly kind: 'drill_leak';
      readonly position: string;
      readonly familyId: StrategyFamilyId;
      readonly deltaPoints: number;
    }
  | { readonly kind: 'quick_drill' }
  | { readonly kind: 'record_hand' }
  | { readonly kind: 'open_equity'; readonly matchupId?: string };

export interface HomeNextStepItem {
  readonly id: string;
  readonly rank: 1 | 2 | 3;
  readonly kind: HomeNextStepAction['kind'];
  readonly action: HomeNextStepAction;
  readonly primary: boolean;
  readonly titleText?: string;
  readonly position?: string;
  readonly familyId?: StrategyFamilyId;
  readonly deltaPoints?: number;
  readonly sampleCount?: number;
  readonly isWatching?: boolean;
  readonly playerCount?: number;
  readonly linkedCount?: number;
}

export interface HomeNightCardSummary {
  readonly sessionId: string;
  readonly title: string;
  readonly status: 'active' | 'settled';
  readonly playerCount: number;
  readonly linkedHandsCount: number;
  readonly firstLinkedHandId: string | null;
  readonly totalInDisplay: string;
  readonly topNetDisplay: string | null;
  readonly topNetPlayerName: string | null;
  readonly morningSummary: HomeGameMorningSummary;
}

export interface HomeOfferItem {
  readonly id: string;
  readonly kind: 'map_3bet' | 'duel_astra' | 'reopen_matchup' | 'explore_equity' | 'record_hand';
  readonly action: HomeNextStepAction;
  readonly matchupTitle?: string;
  readonly unansweredSpotsCount?: number;
  readonly duelSessionsCount?: number;
}

export interface HomeSectionErrors {
  readonly hands: boolean;
  readonly matchups: boolean;
  readonly evidence: boolean;
  readonly training: boolean;
  readonly nights: boolean;
}

export interface HomeStoreOptions {
  readonly engine?: EngineClient;
  readonly repository?: StudyRepository;
  readonly nowFn?: () => number;
}

export interface HomeStore {
  readonly engine: EngineClient;
  readonly repository: StudyRepository;

  readonly loadingSignal: Signal<boolean>;
  readonly isEphemeralPresetSignal: Signal<boolean>;
  readonly savedHandsSignal: Signal<readonly SavedHandRecord[]>;
  readonly savedMatchupsSignal: Signal<readonly SavedMatchupRecord[]>;
  readonly evidenceSignal: Signal<readonly StrategyEvidenceEntry[]>;
  readonly trainingSessionsSignal: Signal<readonly TrainingSessionPayload[]>;
  readonly nightsSignal: Signal<readonly NightSessionRecord[]>;
  readonly sectionErrorsSignal: Signal<HomeSectionErrors>;
  readonly selectedLeakCellKeySignal: Signal<string | null>;

  readonly greetingBucketSignal: ReadonlySignal<HomeGreetingBucket>;
  readonly visitStateSignal: ReadonlySignal<HomeVisitState>;
  readonly weeklySummarySignal: ReadonlySignal<WeeklyStudySummary>;
  readonly leakMapSignal: ReadonlySignal<StrategyLeakMapProjection>;
  readonly spotMapSignal: ReadonlySignal<StrategySpotMapProjection>;
  readonly topLeakSignal: ReadonlySignal<HomeTopLeakSummary | null>;
  readonly nextStepsSignal: ReadonlySignal<readonly HomeNextStepItem[]>;
  readonly nightCardSignal: ReadonlySignal<HomeNightCardSummary | null>;
  readonly offersSignal: ReadonlySignal<readonly HomeOfferItem[]>;

  hydrate: () => Promise<void>;
  applyPreset: (preset: HomePresetId) => void;
  selectLeakCell: (cellKey: string | null) => void;
  dispose: () => void;
}
