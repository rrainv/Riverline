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
      return getTestState();
    },
  };
  if (typeof window !== 'undefined') {
    window.__riverlineTest = hook;
  }
  return hook;
}
