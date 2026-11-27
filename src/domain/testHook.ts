import {
  appearanceSignal,
  getDirectionForLocale,
  initAppearance,
  isLocaleId,
  isMotionMode,
  isPaceId,
  isTeacherTypingSpeed,
  isThemeId,
  updateAppearance,
  type AppearancePreferences,
  type LocaleId,
  type MotionMode,
  type PaceId,
  type TeacherTypingSpeed,
  type ThemeId,
} from './appearance';
import type { EquityPresetId } from './equity/types';
import type { RecorderPresetId } from './hand/types';
import { resetLazyStoreCache } from './lazyStores';
import type { HomePresetId } from './home/types';
import type { LearnPresetId } from './learn/types';
import type { ReviewPresetId } from './review/types';
import type { StrategyViewId } from './strategy/strategyStore';
import type { TrainingPresetId } from './training/types';
import type { NightsPresetId } from './nights/types';
import {
  activeRouteSignal,
  focusModeSignal,
  isKitSectionId,
  isRouteId,
  isSettingsSectionId,
  kitSectionSignal,
  paletteOpenSignal,
  railCollapsedSignal,
  resolveRouteFromLocation,
  settingsSectionSignal,
  type KitSectionId,
  type RouteId,
  type SettingsSectionId,
} from './shellState';

const EQUITY_PRESET_IDS: ReadonlySet<EquityPresetId> = new Set<EquityPresetId>([
  'flop',
  'turn_chosen',
  'players_3',
  'players_4',
  'players_10',
  'range_row',
  'error',
]);

function isEquityPresetId(value: unknown): value is EquityPresetId {
  return typeof value === 'string' && EQUITY_PRESET_IDS.has(value as EquityPresetId);
}

const RECORDER_PRESET_IDS: ReadonlySet<RecorderPresetId> = new Set<RecorderPresetId>([
  'raise',
  'flop_grid',
  'typed_error',
  'done',
]);

function isRecorderPresetId(value: unknown): value is RecorderPresetId {
  return typeof value === 'string' && RECORDER_PRESET_IDS.has(value as RecorderPresetId);
}

const REVIEW_PRESET_IDS: ReadonlySet<ReviewPresetId> = new Set<ReviewPresetId>([
  'hand',
  'counterfactual',
  'saved',
]);

function isReviewPresetId(value: unknown): value is ReviewPresetId {
  return typeof value === 'string' && REVIEW_PRESET_IDS.has(value as ReviewPresetId);
}

const TRAINING_PRESET_IDS: ReadonlySet<TrainingPresetId> = new Set<TrainingPresetId>([
  'hub',
  'drill_question',
  'drill_answered',
  'duel_preflop',
  'duel_thinking',
  'duel_flop_ladder',
  'duel_result',
]);

function isTrainingPresetId(value: unknown): value is TrainingPresetId {
  return typeof value === 'string' && TRAINING_PRESET_IDS.has(value as TrainingPresetId);
}

const NIGHTS_PRESET_IDS: ReadonlySet<NightsPresetId> = new Set<NightsPresetId>([
  'empty',
  'ledger',
  'sheet',
  'hands',
  'settle_blocked',
  'settle_ready',
  'morning_after',
]);

function isNightsPresetId(value: unknown): value is NightsPresetId {
  return typeof value === 'string' && NIGHTS_PRESET_IDS.has(value as NightsPresetId);
}

const HOME_PRESET_IDS: ReadonlySet<HomePresetId> = new Set<HomePresetId>([
  'returning',
  'first_visit',
  'night_after',
]);

function isHomePresetId(value: unknown): value is HomePresetId {
  return typeof value === 'string' && HOME_PRESET_IDS.has(value as HomePresetId);
}

const LEARN_PRESET_IDS: ReadonlySet<LearnPresetId> = new Set<LearnPresetId>([
  'concept',
  'trainer',
  'outs',
  'glossary',
  'weaknesses',
]);

function isLearnPresetId(value: unknown): value is LearnPresetId {
  return typeof value === 'string' && LEARN_PRESET_IDS.has(value as LearnPresetId);
}

export interface RiverlineTestState {
  room: RouteId;
  theme: ThemeId;
  lang: LocaleId;
  pace: PaceId;
  motion: MotionMode;
  railCollapsed: boolean;
  focusMode: boolean;
  paletteOpen: boolean;
  dir: 'ltr' | 'rtl';
  kitSection?: KitSectionId;
  settingsSection?: SettingsSectionId;
  homePreset?: HomePresetId;
  equityPreset?: EquityPresetId;
  recorderPreset?: RecorderPresetId;
  reviewPreset?: ReviewPresetId;
  strategyPreset?: StrategyViewId;
  trainingPreset?: TrainingPresetId;
  nightsPreset?: NightsPresetId;
  learnPreset?: LearnPresetId;
}

export interface RiverlineTestStateInput {
  room?: RouteId;
  theme?: ThemeId;
  lang?: LocaleId;
  pace?: PaceId;
  motion?: MotionMode | 'normal';
  railCollapsed?: boolean;
  focusMode?: boolean;
  paletteOpen?: boolean;
  kitSection?: KitSectionId;
  settingsSection?: SettingsSectionId;
  homePreset?: HomePresetId;
  equityPreset?: EquityPresetId;
  recorderPreset?: RecorderPresetId;
  reviewPreset?: ReviewPresetId;
  strategyPreset?: StrategyViewId;
  trainingPreset?: TrainingPresetId;
  nightsPreset?: NightsPresetId;
  learnPreset?: LearnPresetId;
  showLamp?: boolean;
  teacherTypingSpeed?: TeacherTypingSpeed;
}

export interface RiverlineTestHook {
  setState: (patch: RiverlineTestStateInput) => RiverlineTestState;
  getState: () => RiverlineTestState;
  reset: () => RiverlineTestState;
}

declare global {
  interface Window {
    __riverlineTest?: RiverlineTestHook;
  }
}

let activeHomePreset: HomePresetId | undefined;
let activeEquityPreset: EquityPresetId | undefined;
let activeRecorderPreset: RecorderPresetId | undefined;
let activeReviewPreset: ReviewPresetId | undefined;
let activeTrainingPreset: TrainingPresetId | undefined;
let activeNightsPreset: NightsPresetId | undefined;
let activeLearnPreset: LearnPresetId | undefined;

function parseBooleanFlag(value: string | null): boolean | undefined {
  if (value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;
  return undefined;
}

function normalizeMotionInput(value: unknown): MotionMode | undefined {
  if (value === 'normal') return 'system';
  return isMotionMode(value) ? value : undefined;
}

export function applyQueryOverrides(search: string, pathname = '/'): void {
  const params = new URLSearchParams(search);
  activeRouteSignal.value = resolveRouteFromLocation(pathname, search);

  const appearancePatch: Partial<AppearancePreferences> = {};
  const theme = params.get('theme');
  if (isThemeId(theme)) appearancePatch.theme = theme;

  const lang = params.get('lang');
  if (isLocaleId(lang)) appearancePatch.lang = lang;

  const pace = params.get('pace');
  if (isPaceId(pace)) appearancePatch.pace = pace;

  const motion = normalizeMotionInput(params.get('motion'));
  if (motion) appearancePatch.motion = motion;

  const showLamp = parseBooleanFlag(params.get('showLamp'));
  if (showLamp !== undefined) appearancePatch.showLamp = showLamp;

  const typing = params.get('typing');
  if (isTeacherTypingSpeed(typing)) appearancePatch.teacherTypingSpeed = typing;

  if (Object.keys(appearancePatch).length > 0) {
    updateAppearance(appearancePatch, { persist: false });
  }

  const rail = params.get('rail');
  if (rail === 'collapsed' || rail === '1' || rail === 'true') {
    railCollapsedSignal.value = true;
  } else if (rail === 'expanded' || rail === '0' || rail === 'false') {
    railCollapsedSignal.value = false;
  }

  const focus = parseBooleanFlag(params.get('focus'));
  if (focus !== undefined) {
    focusModeSignal.value = focus;
  }

  const palette = parseBooleanFlag(params.get('palette'));
  if (palette !== undefined) {
    paletteOpenSignal.value = palette;
  }

  const kitSection = params.get('kitSection');
  if (isKitSectionId(kitSection)) {
    kitSectionSignal.value = kitSection;
  }

  const settingsSection = params.get('settingsSection');
  if (isSettingsSectionId(settingsSection)) {
    settingsSectionSignal.value = settingsSection;
  }

  const homePreset = params.get('homePreset');
  if (isHomePresetId(homePreset)) {
    activeHomePreset = homePreset;
    void import('./home').then((m) => m.getSharedHomeStore().applyPreset(homePreset));
  }

  const equityPreset = params.get('equityPreset');
  if (isEquityPresetId(equityPreset)) {
    activeEquityPreset = equityPreset;
    void import('./equity').then((m) => m.getSharedEquityStore().applyPreset(equityPreset));
  }

  const recorderPreset = params.get('recorderPreset');
  if (isRecorderPresetId(recorderPreset)) {
    activeRecorderPreset = recorderPreset;
    void import('./hand').then((m) => m.getSharedHandRecorderStore().applyPreset(recorderPreset));
  }

  const reviewPreset = params.get('reviewPreset');
  if (isReviewPresetId(reviewPreset)) {
    activeReviewPreset = reviewPreset;
    void import('./review').then((m) => m.getSharedReviewStore().applyPreset(reviewPreset));
  }

  const trainingPreset = params.get('trainingPreset');
  if (isTrainingPresetId(trainingPreset)) {
    activeTrainingPreset = trainingPreset;
    void import('./training').then((m) => m.getSharedTrainingStore().applyPreset(trainingPreset));
  }

  const nightsPreset = params.get('nightsPreset');
  if (isNightsPresetId(nightsPreset)) {
    activeNightsPreset = nightsPreset;
    void import('./nights').then((m) => m.getSharedNightsStore().applyPreset(nightsPreset));
  }

  const learnPreset = params.get('learnPreset');
  if (isLearnPresetId(learnPreset)) {
    activeLearnPreset = learnPreset;
    void import('./learn').then((m) => m.getSharedLearnStore().applyPreset(learnPreset));
  }
}

export function getTestState(): RiverlineTestState {
  const appearance = appearanceSignal.value;
  return {
    room: activeRouteSignal.value,
    theme: appearance.theme,
    lang: appearance.lang,
    pace: appearance.pace,
    motion: appearance.motion,
    railCollapsed: railCollapsedSignal.value,
    focusMode: focusModeSignal.value,
    paletteOpen: paletteOpenSignal.value,
    dir: getDirectionForLocale(appearance.lang),
    ...(activeHomePreset !== undefined ? { homePreset: activeHomePreset } : {}),
    ...(activeEquityPreset !== undefined ? { equityPreset: activeEquityPreset } : {}),
    ...(activeRecorderPreset !== undefined ? { recorderPreset: activeRecorderPreset } : {}),
    ...(activeReviewPreset !== undefined ? { reviewPreset: activeReviewPreset } : {}),
    ...(activeTrainingPreset !== undefined ? { trainingPreset: activeTrainingPreset } : {}),
    ...(activeNightsPreset !== undefined ? { nightsPreset: activeNightsPreset } : {}),
    ...(activeLearnPreset !== undefined ? { learnPreset: activeLearnPreset } : {}),
  };
}

export function setTestState(patch: RiverlineTestStateInput): RiverlineTestState {
  if (patch.room !== undefined && isRouteId(patch.room)) {
    activeRouteSignal.value = patch.room;
  }

  const appearancePatch: Partial<AppearancePreferences> = {};
  if (patch.theme !== undefined && isThemeId(patch.theme)) {
    appearancePatch.theme = patch.theme;
  }
  if (patch.lang !== undefined && isLocaleId(patch.lang)) {
    appearancePatch.lang = patch.lang;
  }
  if (patch.pace !== undefined && isPaceId(patch.pace)) {
    appearancePatch.pace = patch.pace;
  }
  const normalizedMotion = normalizeMotionInput(patch.motion);
  if (normalizedMotion !== undefined) {
    appearancePatch.motion = normalizedMotion;
  }
  if (typeof patch.showLamp === 'boolean') {
    appearancePatch.showLamp = patch.showLamp;
  }
  if (isTeacherTypingSpeed(patch.teacherTypingSpeed)) {
    appearancePatch.teacherTypingSpeed = patch.teacherTypingSpeed;
  }
  if (Object.keys(appearancePatch).length > 0) {
    updateAppearance(appearancePatch, { persist: false });
  }

  if (typeof patch.railCollapsed === 'boolean') {
    railCollapsedSignal.value = patch.railCollapsed;
  }
  if (typeof patch.focusMode === 'boolean') {
    focusModeSignal.value = patch.focusMode;
  }
  if (typeof patch.paletteOpen === 'boolean') {
    paletteOpenSignal.value = patch.paletteOpen;
  }
  if (patch.kitSection !== undefined && isKitSectionId(patch.kitSection)) {
    kitSectionSignal.value = patch.kitSection;
  }
  if (patch.settingsSection !== undefined && isSettingsSectionId(patch.settingsSection)) {
    settingsSectionSignal.value = patch.settingsSection;
  }
  if (patch.homePreset !== undefined && isHomePresetId(patch.homePreset)) {
    const preset = patch.homePreset;
    activeHomePreset = preset;
    void import('./home').then((m) => m.getSharedHomeStore().applyPreset(preset));
  }
  if (patch.equityPreset !== undefined && isEquityPresetId(patch.equityPreset)) {
    const preset = patch.equityPreset;
    activeEquityPreset = preset;
    void import('./equity').then((m) => m.getSharedEquityStore().applyPreset(preset));
  }
  if (patch.recorderPreset !== undefined && isRecorderPresetId(patch.recorderPreset)) {
    const preset = patch.recorderPreset;
    activeRecorderPreset = preset;
    void import('./hand').then((m) => m.getSharedHandRecorderStore().applyPreset(preset));
  }
  if (patch.reviewPreset !== undefined && isReviewPresetId(patch.reviewPreset)) {
    const preset = patch.reviewPreset;
    activeReviewPreset = preset;
    void import('./review').then((m) => m.getSharedReviewStore().applyPreset(preset));
  }
  if (
    patch.strategyPreset === 'spotMap' ||
    patch.strategyPreset === 'builder' ||
    patch.strategyPreset === 'leakMap'
  ) {
    const view = patch.strategyPreset;
    void import('./strategy').then((m) => m.getSharedStrategyStore().setActiveView(view));
  }
  if (patch.trainingPreset !== undefined && isTrainingPresetId(patch.trainingPreset)) {
    const preset = patch.trainingPreset;
    activeTrainingPreset = preset;
    void import('./training').then((m) => m.getSharedTrainingStore().applyPreset(preset));
  }
  if (patch.nightsPreset !== undefined && isNightsPresetId(patch.nightsPreset)) {
    const preset = patch.nightsPreset;
    activeNightsPreset = preset;
    void import('./nights').then((m) => m.getSharedNightsStore().applyPreset(preset));
  }
  if (patch.learnPreset !== undefined && isLearnPresetId(patch.learnPreset)) {
    const preset = patch.learnPreset;
    activeLearnPreset = preset;
    void import('./learn').then((m) => m.getSharedLearnStore().applyPreset(preset));
  }

  return getTestState();
}

export function installTestHook(): RiverlineTestHook {
  const hook: RiverlineTestHook = {
    setState: setTestState,
    getState: getTestState,
    reset: () => {
      initAppearance();
      activeRouteSignal.value = 'home';
      railCollapsedSignal.value = false;
      focusModeSignal.value = false;
      paletteOpenSignal.value = false;
      kitSectionSignal.value = 'panel';
      settingsSectionSignal.value = 'appearance';
      const hadPresets =
        activeHomePreset !== undefined ||
        activeEquityPreset !== undefined ||
        activeRecorderPreset !== undefined ||
        activeReviewPreset !== undefined ||
        activeTrainingPreset !== undefined ||
        activeNightsPreset !== undefined ||
        activeLearnPreset !== undefined;
      activeHomePreset = undefined;
      activeEquityPreset = undefined;
      activeRecorderPreset = undefined;
      activeReviewPreset = undefined;
      activeTrainingPreset = undefined;
      activeNightsPreset = undefined;
      activeLearnPreset = undefined;
      resetLazyStoreCache();
      if (hadPresets) {
        void Promise.all([
          import('./home').then((m) => m.resetSharedHomeStore()),
          import('./equity').then((m) => m.resetSharedEquityStore()),
          import('./hand').then((m) => m.resetSharedHandRecorderStore()),
          import('./review').then((m) => m.resetSharedReviewStore()),
          import('./training').then((m) => m.resetSharedTrainingStore()),
          import('./nights').then((m) => m.resetSharedNightsStore()),
          import('./learn').then((m) => m.resetSharedLearnStore()),
        ]);
      }
      return getTestState();
    },
  };
  if (typeof window !== 'undefined') {
    window.__riverlineTest = hook;
  }
  return hook;
}
