import { computed, signal } from '@preact/signals';

export const APPEARANCE_STORAGE_KEY = 'riverline.appearance.v1';

export const THEME_IDS = [
  'midnight',
  'felt',
  'slate',
  'dusk',
  'contrast',
  'daylight',
  'paper',
] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const PACE_IDS = ['calm', 'normal', 'fast'] as const;
export type PaceId = (typeof PACE_IDS)[number];

export const MOTION_MODES = ['system', 'reduced'] as const;
export type MotionMode = (typeof MOTION_MODES)[number];

export const LOCALE_IDS = ['en', 'ru', 'he'] as const;
export type LocaleId = (typeof LOCALE_IDS)[number];

export const TEACHER_TYPING_SPEEDS = ['slow', 'normal', 'fast', 'instant'] as const;
export type TeacherTypingSpeed = (typeof TEACHER_TYPING_SPEEDS)[number];

export interface AppearancePreferences {
  theme: ThemeId;
  pace: PaceId;
  motion: MotionMode;
  lang: LocaleId;
  showLamp: boolean;
  teacherTypingSpeed: TeacherTypingSpeed;
}

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  theme: 'midnight',
  pace: 'normal',
  motion: 'system',
  lang: 'en',
  showLamp: true,
  teacherTypingSpeed: 'normal',
};

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}

export function isPaceId(value: unknown): value is PaceId {
  return typeof value === 'string' && (PACE_IDS as readonly string[]).includes(value);
}

export function isMotionMode(value: unknown): value is MotionMode {
  return typeof value === 'string' && (MOTION_MODES as readonly string[]).includes(value);
}

export function isLocaleId(value: unknown): value is LocaleId {
  return typeof value === 'string' && (LOCALE_IDS as readonly string[]).includes(value);
}

export function isTeacherTypingSpeed(value: unknown): value is TeacherTypingSpeed {
  return (
    typeof value === 'string' &&
    (TEACHER_TYPING_SPEEDS as readonly string[]).includes(value)
  );
}

export function normalizeAppearance(raw: unknown): AppearancePreferences {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_APPEARANCE };
  }
  const obj = raw as Record<string, unknown>;
  return {
    theme: isThemeId(obj.theme) ? obj.theme : DEFAULT_APPEARANCE.theme,
    pace: isPaceId(obj.pace) ? obj.pace : DEFAULT_APPEARANCE.pace,
    motion: isMotionMode(obj.motion) ? obj.motion : DEFAULT_APPEARANCE.motion,
    lang: isLocaleId(obj.lang) ? obj.lang : DEFAULT_APPEARANCE.lang,
    showLamp: typeof obj.showLamp === 'boolean' ? obj.showLamp : DEFAULT_APPEARANCE.showLamp,
    teacherTypingSpeed: isTeacherTypingSpeed(obj.teacherTypingSpeed)
      ? obj.teacherTypingSpeed
      : DEFAULT_APPEARANCE.teacherTypingSpeed,
  };
}

export function readPersistedAppearance(): AppearancePreferences {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_APPEARANCE };
  }
  try {
    const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APPEARANCE };
    return normalizeAppearance(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function writePersistedAppearance(prefs: AppearancePreferences): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota / private-browsing failures silently.
  }
}

export function getDirectionForLocale(lang: LocaleId): 'ltr' | 'rtl' {
  return lang === 'he' ? 'rtl' : 'ltr';
}

export function syncDocumentAppearance(prefs: AppearancePreferences): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = prefs.theme;
  root.dataset.pace = prefs.pace;
  if (prefs.motion === 'reduced') {
    root.dataset.motion = 'reduced';
  } else {
    delete root.dataset.motion;
  }
  root.lang = prefs.lang;
  root.dir = getDirectionForLocale(prefs.lang);
}

export const appearanceSignal = signal<AppearancePreferences>({ ...DEFAULT_APPEARANCE });
export const langSignal = computed(() => appearanceSignal.value.lang);

export function updateAppearance(
  patch: Partial<AppearancePreferences>,
  options: { persist?: boolean } = {},
): AppearancePreferences {
  const next = normalizeAppearance({ ...appearanceSignal.value, ...patch });
  appearanceSignal.value = next;
  syncDocumentAppearance(next);
  if (options.persist !== false) {
    writePersistedAppearance(next);
  }
  return next;
}

export function initAppearance(): AppearancePreferences {
  const persisted = readPersistedAppearance();
  appearanceSignal.value = persisted;
  syncDocumentAppearance(persisted);
  return persisted;
}
