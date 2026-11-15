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
import { getSharedEquityStore, resetSharedEquityStore, type EquityPresetId } from './equity';
import {
  getSharedHandRecorderStore,
  resetSharedHandRecorderStore,
  type RecorderPresetId,
} from './hand';
import {
  getSharedReviewStore,
  resetSharedReviewStore,
  type ReviewPresetId,
} from './review';
import { getSharedStrategyStore, type StrategyViewId } from './strategy';
import {
  activeRouteSignal,
  focusModeSignal,
  isKitSectionId,
  isRouteId,
  kitSectionSignal,
  paletteOpenSignal,
  railCollapsedSignal,
  resolveRouteFromLocation,
  type KitSectionId,
  type RouteId,
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
  equityPreset?: EquityPresetId;
  recorderPreset?: RecorderPresetId;
  reviewPreset?: ReviewPresetId;
  strategyPreset?: StrategyViewId;
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
  equityPreset?: EquityPresetId;
  recorderPreset?: RecorderPresetId;
  reviewPreset?: ReviewPresetId;
  strategyPreset?: StrategyViewId;
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

let activeEquityPreset: EquityPresetId | undefined;
let activeRecorderPreset: RecorderPresetId | undefined;
let activeReviewPreset: ReviewPresetId | undefined;

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

  const equityPreset = params.get('equityPreset');
  if (isEquityPresetId(equityPreset)) {
    activeEquityPreset = equityPreset;
    getSharedEquityStore().applyPreset(equityPreset);
  }

  const recorderPreset = params.get('recorderPreset');
  if (isRecorderPresetId(recorderPreset)) {
    activeRecorderPreset = recorderPreset;
    getSharedHandRecorderStore().applyPreset(recorderPreset);
  }

  const reviewPreset = params.get('reviewPreset');
  if (isReviewPresetId(reviewPreset)) {
    activeReviewPreset = reviewPreset;
    getSharedReviewStore().applyPreset(reviewPreset);
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
    ...(activeEquityPreset !== undefined ? { equityPreset: activeEquityPreset } : {}),
    ...(activeRecorderPreset !== undefined ? { recorderPreset: activeRecorderPreset } : {}),
    ...(activeReviewPreset !== undefined ? { reviewPreset: activeReviewPreset } : {}),
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
  if (patch.equityPreset !== undefined && isEquityPresetId(patch.equityPreset)) {
    activeEquityPreset = patch.equityPreset;
    getSharedEquityStore().applyPreset(patch.equityPreset);
  }
  if (patch.recorderPreset !== undefined && isRecorderPresetId(patch.recorderPreset)) {
    activeRecorderPreset = patch.recorderPreset;
    getSharedHandRecorderStore().applyPreset(patch.recorderPreset);
  }
  if (patch.reviewPreset !== undefined && isReviewPresetId(patch.reviewPreset)) {
    activeReviewPreset = patch.reviewPreset;
    getSharedReviewStore().applyPreset(patch.reviewPreset);
  }
  if (
    patch.strategyPreset === 'spotMap' ||
    patch.strategyPreset === 'builder' ||
    patch.strategyPreset === 'leakMap'
  ) {
    getSharedStrategyStore().setActiveView(patch.strategyPreset);
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
      activeEquityPreset = undefined;
      activeRecorderPreset = undefined;
      activeReviewPreset = undefined;
      resetSharedEquityStore();
      resetSharedHandRecorderStore();
      resetSharedReviewStore();
      return getTestState();
    },
  };
  if (typeof window !== 'undefined') {
    window.__riverlineTest = hook;
  }
  return hook;
}
