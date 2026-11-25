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

export const CORNER_STYLES = ['sharp', 'soft', 'round'] as const;
export type CornerStyle = (typeof CORNER_STYLES)[number];

export const HEADING_WEIGHTS = ['500', '600', '700'] as const;
export type HeadingWeight = (typeof HEADING_WEIGHTS)[number];

export const HEAD_FONT_IDS = ['rubik', 'inter', 'georgia'] as const;
export type HeadFontId = (typeof HEAD_FONT_IDS)[number];

export const CARD_FACE_IDS = ['ivory', 'white', 'slate'] as const;
export type CardFaceId = (typeof CARD_FACE_IDS)[number];

export const CARD_BACK_IDS = ['theme', 'forest', 'lattice', 'brass'] as const;
export type CardBackId = (typeof CARD_BACK_IDS)[number];

export const ACCENT_PRESET_IDS = [
  'default',
  'brass',
  'sage',
  'sky',
  'coral',
  'violet',
  'teal',
] as const;
export type AccentPresetId = (typeof ACCENT_PRESET_IDS)[number];

export const TEACHER_VOICE_IDS = ['blunt', 'gentle'] as const;
export type TeacherVoiceId = (typeof TEACHER_VOICE_IDS)[number];

export const TEACHER_DEPTH_IDS = ['concise', 'standard', 'deep'] as const;
export type TeacherDepthId = (typeof TEACHER_DEPTH_IDS)[number];

export const DAILY_STUDY_GOALS = [5, 10, 15, 25] as const;
export type DailyStudyGoal = (typeof DAILY_STUDY_GOALS)[number];

export const SHORTCUT_ACTION_IDS = [
  'palette',
  'focus',
  'settings',
  'inlineEquity',
  'fold',
  'call',
  'raise',
  'allIn',
] as const;
export type ShortcutActionId = (typeof SHORTCUT_ACTION_IDS)[number];

export type ShortcutMap = Readonly<Record<ShortcutActionId, string>>;

export interface CustomThemeConfig {
  readonly enabled: boolean;
  readonly bg: string;
  readonly panel: string;
  readonly text: string;
  readonly accent: string;
}

export interface CustomThemeContrastReport {
  readonly textOnBg: number;
  readonly textOnPanel: number;
  readonly accentOnBg: number;
  readonly passes: boolean;
}

export interface AppearancePreferences {
  theme: ThemeId;
  pace: PaceId;
  motion: MotionMode;
  lang: LocaleId;
  showLamp: boolean;
  teacherTypingSpeed: TeacherTypingSpeed;
  minimalCards: boolean;
  cornerStyle: CornerStyle;
  headingWeight: HeadingWeight;
  headFont: HeadFontId;
  cardFace: CardFaceId;
  cardBack: CardBackId;
  fourColorDeck: boolean;
  accentPreset: AccentPresetId;
  customTheme: CustomThemeConfig;
  teacherVoice: TeacherVoiceId;
  teacherDepth: TeacherDepthId;
  soundEffects: boolean;
  confidenceLens: boolean;
  askBeforeVerdict: boolean;
  playerName: string;
  dailyStudyGoal: DailyStudyGoal;
  shortcuts: ShortcutMap;
}

export const DEFAULT_CUSTOM_THEME: CustomThemeConfig = {
  enabled: false,
  bg: '#07150f',
  panel: '#162820',
  text: '#f2f5f1',
  accent: '#e0bf6a',
};

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  palette: 'Ctrl+K',
  focus: 'Shift+F',
  settings: 'Ctrl+,',
  inlineEquity: 'E',
  fold: 'F',
  call: 'C',
  raise: 'R',
  allIn: 'A',
};

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  theme: 'midnight',
  pace: 'normal',
  motion: 'system',
  lang: 'en',
  showLamp: true,
  teacherTypingSpeed: 'normal',
  minimalCards: false,
  cornerStyle: 'soft',
  headingWeight: '600',
  headFont: 'rubik',
  cardFace: 'ivory',
  cardBack: 'theme',
  fourColorDeck: false,
  accentPreset: 'default',
  customTheme: { ...DEFAULT_CUSTOM_THEME },
  teacherVoice: 'blunt',
  teacherDepth: 'standard',
  soundEffects: false,
  confidenceLens: false,
  askBeforeVerdict: true,
  playerName: '',
  dailyStudyGoal: 10,
  shortcuts: { ...DEFAULT_SHORTCUTS },
};

const INK_DARK = '#07120d';
const INK_LIGHT = '#ffffff';
const HEX6_RE = /^#[0-9a-fA-F]{6}$/;
const HEX3_RE = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/;

export function normalizeHex(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (HEX6_RE.test(trimmed)) return trimmed.toLowerCase();
  const short = trimmed.match(HEX3_RE);
  if (short) {
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  }
  return fallback;
}

export function isValidHex(value: unknown): value is string {
  return typeof value === 'string' && (HEX6_RE.test(value.trim()) || HEX3_RE.test(value.trim()));
}

function parseHexRgb(hex: string): [number, number, number] | null {
  const norm = normalizeHex(hex, '');
  if (!norm) return null;
  return [
    Number.parseInt(norm.slice(1, 3), 16),
    Number.parseInt(norm.slice(3, 5), 16),
    Number.parseInt(norm.slice(5, 7), 16),
  ];
}

function linearizeChannel(channel255: number): number {
  const s = channel255 / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function computeContrastRatio(hexA: string, hexB: string): number {
  const rgbA = parseHexRgb(hexA);
  const rgbB = parseHexRgb(hexB);
  if (!rgbA || !rgbB) return 1;
  const lumA =
    0.2126 * linearizeChannel(rgbA[0]) +
    0.7152 * linearizeChannel(rgbA[1]) +
    0.0722 * linearizeChannel(rgbA[2]);
  const lumB =
    0.2126 * linearizeChannel(rgbB[0]) +
    0.7152 * linearizeChannel(rgbB[1]) +
    0.0722 * linearizeChannel(rgbB[2]);
  const hi = Math.max(lumA, lumB);
  const lo = Math.min(lumA, lumB);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

export function evaluateCustomThemeContrast(custom: CustomThemeConfig): CustomThemeContrastReport {
  const textOnBg = computeContrastRatio(custom.text, custom.bg);
  const textOnPanel = computeContrastRatio(custom.text, custom.panel);
  const accentOnBg = computeContrastRatio(custom.accent, custom.bg);
  return {
    textOnBg,
    textOnPanel,
    accentOnBg,
    passes: textOnBg >= 4.5 && textOnPanel >= 4.5,
  };
}

function pickInkForHex(bgHex: string): string {
  const darkContrast = computeContrastRatio(INK_DARK, bgHex);
  const lightContrast = computeContrastRatio(INK_LIGHT, bgHex);
  return darkContrast >= lightContrast ? INK_DARK : INK_LIGHT;
}

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

export function isCornerStyle(value: unknown): value is CornerStyle {
  return typeof value === 'string' && (CORNER_STYLES as readonly string[]).includes(value);
}

export function isHeadingWeight(value: unknown): value is HeadingWeight {
  return typeof value === 'string' && (HEADING_WEIGHTS as readonly string[]).includes(value);
}

export function isHeadFontId(value: unknown): value is HeadFontId {
  return typeof value === 'string' && (HEAD_FONT_IDS as readonly string[]).includes(value);
}

export function isCardFaceId(value: unknown): value is CardFaceId {
  return typeof value === 'string' && (CARD_FACE_IDS as readonly string[]).includes(value);
}

export function isCardBackId(value: unknown): value is CardBackId {
  return typeof value === 'string' && (CARD_BACK_IDS as readonly string[]).includes(value);
}

export function isAccentPresetId(value: unknown): value is AccentPresetId {
  return typeof value === 'string' && (ACCENT_PRESET_IDS as readonly string[]).includes(value);
}

export function isTeacherVoiceId(value: unknown): value is TeacherVoiceId {
  return typeof value === 'string' && (TEACHER_VOICE_IDS as readonly string[]).includes(value);
}

export function isTeacherDepthId(value: unknown): value is TeacherDepthId {
  return typeof value === 'string' && (TEACHER_DEPTH_IDS as readonly string[]).includes(value);
}

export function isDailyStudyGoal(value: unknown): value is DailyStudyGoal {
  return typeof value === 'number' && (DAILY_STUDY_GOALS as readonly number[]).includes(value);
}

export function normalizeCustomTheme(raw: unknown): CustomThemeConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CUSTOM_THEME };
  const obj = raw as Record<string, unknown>;
  return {
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : DEFAULT_CUSTOM_THEME.enabled,
    bg: normalizeHex(obj.bg, DEFAULT_CUSTOM_THEME.bg),
    panel: normalizeHex(obj.panel, DEFAULT_CUSTOM_THEME.panel),
    text: normalizeHex(obj.text, DEFAULT_CUSTOM_THEME.text),
    accent: normalizeHex(obj.accent, DEFAULT_CUSTOM_THEME.accent),
  };
}

export function normalizeShortcuts(raw: unknown): ShortcutMap {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SHORTCUTS };
  const obj = raw as Record<string, unknown>;
  const out: Record<ShortcutActionId, string> = { ...DEFAULT_SHORTCUTS };
  for (const id of SHORTCUT_ACTION_IDS) {
    const val = obj[id];
    if (typeof val === 'string' && val.trim().length > 0 && val.trim().length <= 24) {
      out[id] = val.trim();
    }
  }
  return out;
}

export function findShortcutClash(
  shortcuts: ShortcutMap,
  action: ShortcutActionId,
  candidate: string,
): ShortcutActionId | null {
  const target = candidate.trim().toLowerCase();
  if (!target) return null;
  for (const id of SHORTCUT_ACTION_IDS) {
    if (id === action) continue;
    if (shortcuts[id].trim().toLowerCase() === target) {
      return id;
    }
  }
  return null;
}

const IGNORED_BINDING_KEYS = new Set([
  'Control',
  'Shift',
  'Alt',
  'Meta',
  'Escape',
  'Tab',
  'Enter',
  'CapsLock',
  'Dead',
  ' ',
]);

export function formatShortcutFromEvent(event: KeyboardEvent): string | null {
  if (IGNORED_BINDING_KEYS.has(event.key)) return null;
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  const keyLabel = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  parts.push(keyLabel);
  return parts.join('+');
}

export function matchesShortcutEvent(event: KeyboardEvent, binding: string): boolean {
  const parts = binding
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return false;
  let needCtrl = false;
  let needAlt = false;
  let needShift = false;
  let keyToken = '';
  for (let i = 0; i < parts.length; i += 1) {
    const lower = parts[i]!.toLowerCase();
    if (i < parts.length - 1 && (lower === 'ctrl' || lower === 'cmd' || lower === 'meta')) {
      needCtrl = true;
    } else if (i < parts.length - 1 && lower === 'alt') {
      needAlt = true;
    } else if (i < parts.length - 1 && lower === 'shift') {
      needShift = true;
    } else {
      keyToken = lower;
    }
  }
  if (!keyToken) return false;
  if ((event.ctrlKey || event.metaKey) !== needCtrl) return false;
  if (event.altKey !== needAlt) return false;
  if (event.shiftKey !== needShift) return false;
  return event.key.toLowerCase() === keyToken;
}

export function normalizeAppearance(raw: unknown): AppearancePreferences {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_APPEARANCE,
      customTheme: { ...DEFAULT_CUSTOM_THEME },
      shortcuts: { ...DEFAULT_SHORTCUTS },
    };
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
    minimalCards:
      typeof obj.minimalCards === 'boolean' ? obj.minimalCards : DEFAULT_APPEARANCE.minimalCards,
    cornerStyle: isCornerStyle(obj.cornerStyle)
      ? obj.cornerStyle
      : DEFAULT_APPEARANCE.cornerStyle,
    headingWeight: isHeadingWeight(obj.headingWeight)
      ? obj.headingWeight
      : DEFAULT_APPEARANCE.headingWeight,
    headFont: isHeadFontId(obj.headFont) ? obj.headFont : DEFAULT_APPEARANCE.headFont,
    cardFace: isCardFaceId(obj.cardFace) ? obj.cardFace : DEFAULT_APPEARANCE.cardFace,
    cardBack: isCardBackId(obj.cardBack) ? obj.cardBack : DEFAULT_APPEARANCE.cardBack,
    fourColorDeck:
      typeof obj.fourColorDeck === 'boolean'
        ? obj.fourColorDeck
        : DEFAULT_APPEARANCE.fourColorDeck,
    accentPreset: isAccentPresetId(obj.accentPreset)
      ? obj.accentPreset
      : DEFAULT_APPEARANCE.accentPreset,
    customTheme: normalizeCustomTheme(obj.customTheme),
    teacherVoice: isTeacherVoiceId(obj.teacherVoice)
      ? obj.teacherVoice
      : DEFAULT_APPEARANCE.teacherVoice,
    teacherDepth: isTeacherDepthId(obj.teacherDepth)
      ? obj.teacherDepth
      : DEFAULT_APPEARANCE.teacherDepth,
    soundEffects:
      typeof obj.soundEffects === 'boolean'
        ? obj.soundEffects
        : DEFAULT_APPEARANCE.soundEffects,
    confidenceLens:
      typeof obj.confidenceLens === 'boolean'
        ? obj.confidenceLens
        : DEFAULT_APPEARANCE.confidenceLens,
    askBeforeVerdict:
      typeof obj.askBeforeVerdict === 'boolean'
        ? obj.askBeforeVerdict
        : DEFAULT_APPEARANCE.askBeforeVerdict,
    playerName:
      typeof obj.playerName === 'string'
        ? obj.playerName.trim().slice(0, 24)
        : DEFAULT_APPEARANCE.playerName,
    dailyStudyGoal: isDailyStudyGoal(obj.dailyStudyGoal)
      ? obj.dailyStudyGoal
      : DEFAULT_APPEARANCE.dailyStudyGoal,
    shortcuts: normalizeShortcuts(obj.shortcuts),
  };
}

export function readPersistedAppearance(): AppearancePreferences {
  if (typeof window === 'undefined' || !window.localStorage) {
    return normalizeAppearance(null);
  }
  try {
    const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return normalizeAppearance(null);
    return normalizeAppearance(JSON.parse(raw));
  } catch {
    return normalizeAppearance(null);
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

const CUSTOM_CSS_PROPS = [
  '--bg',
  '--root-bg',
  '--panel-bg',
  '--text',
  '--text2',
  '--text3',
  '--well',
  '--line',
  '--line2',
  '--hover',
  '--accent',
  '--accent-text',
  '--accent-ink',
] as const;

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
  if (prefs.minimalCards) {
    root.dataset.cards = 'minimal';
  } else {
    delete root.dataset.cards;
  }
  root.dataset.corners = prefs.cornerStyle;
  root.dataset.headWeight = prefs.headingWeight;
  root.dataset.headFont = prefs.headFont;
  root.dataset.cardFace = prefs.cardFace;
  if (prefs.cardBack !== 'theme') {
    root.dataset.cardBack = prefs.cardBack;
  } else {
    delete root.dataset.cardBack;
  }
  if (prefs.fourColorDeck) {
    root.dataset.deckColors = 'four';
  } else {
    delete root.dataset.deckColors;
  }
  if (prefs.accentPreset !== 'default') {
    root.dataset.accent = prefs.accentPreset;
  } else {
    delete root.dataset.accent;
  }
  if (prefs.confidenceLens) {
    root.dataset.confidenceLens = 'on';
  } else {
    delete root.dataset.confidenceLens;
  }
  root.lang = prefs.lang;
  root.dir = getDirectionForLocale(prefs.lang);

  if (prefs.customTheme.enabled) {
    const { bg, panel, text, accent } = prefs.customTheme;
    const ink = pickInkForHex(accent);
    const panelIsLight = pickInkForHex(panel) === '#0d1411';
    root.style.setProperty('--bg', bg);
    root.style.setProperty('--root-bg', bg);
    root.style.setProperty('--panel-bg', panel);
    root.style.setProperty('--text', text);
    root.style.setProperty('--text2', `color-mix(in srgb, ${text} ${panelIsLight ? 74 : 76}%, ${panel})`);
    root.style.setProperty('--text3', `color-mix(in srgb, ${text} ${panelIsLight ? 56 : 58}%, ${panel})`);
    root.style.setProperty('--well', `color-mix(in srgb, ${text} ${panelIsLight ? 5 : 7}%, ${panel})`);
    root.style.setProperty('--line', `color-mix(in srgb, ${text} ${panelIsLight ? 14 : 16}%, ${panel})`);
    root.style.setProperty('--line2', `color-mix(in srgb, ${text} ${panelIsLight ? 24 : 26}%, ${panel})`);
    root.style.setProperty('--hover', `color-mix(in srgb, ${text} ${panelIsLight ? 8 : 10}%, ${panel})`);
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-text', accent);
    root.style.setProperty('--accent-ink', ink);
  } else {
    for (const prop of CUSTOM_CSS_PROPS) {
      root.style.removeProperty(prop);
    }
  }
}

export const sessionPadVersionSignal = signal(0);

export function bumpSessionPadVersion(): void {
  sessionPadVersionSignal.value += 1;
}

export const appearanceSignal = signal<AppearancePreferences>(normalizeAppearance(null));
export const langSignal = computed(() => appearanceSignal.value.lang);
export const motionSignal = computed(() => appearanceSignal.value.motion);
export const minimalCardsSignal = computed(() => appearanceSignal.value.minimalCards);
export const cornerStyleSignal = computed(() => appearanceSignal.value.cornerStyle);
export const headingWeightSignal = computed(() => appearanceSignal.value.headingWeight);
export const cardFaceSignal = computed(() => appearanceSignal.value.cardFace);
export const cardBackSignal = computed(() => appearanceSignal.value.cardBack);
export const accentPresetSignal = computed(() => appearanceSignal.value.accentPreset);
export const customThemeSignal = computed(() => appearanceSignal.value.customTheme);
export const teacherVoiceSignal = computed(() => appearanceSignal.value.teacherVoice);
export const confidenceLensSignal = computed(() => appearanceSignal.value.confidenceLens);
export const askBeforeVerdictSignal = computed(() => appearanceSignal.value.askBeforeVerdict);
export const playerNameSignal = computed(() => appearanceSignal.value.playerName);
export const dailyStudyGoalSignal = computed(() => appearanceSignal.value.dailyStudyGoal);
export const shortcutsSignal = computed(() => appearanceSignal.value.shortcuts);

export function resetAppearanceVisualDefaults(): AppearancePreferences {
  return updateAppearance({
    theme: DEFAULT_APPEARANCE.theme,
    accentPreset: DEFAULT_APPEARANCE.accentPreset,
    customTheme: { ...DEFAULT_CUSTOM_THEME },
    cornerStyle: DEFAULT_APPEARANCE.cornerStyle,
    headingWeight: DEFAULT_APPEARANCE.headingWeight,
    headFont: DEFAULT_APPEARANCE.headFont,
    cardFace: DEFAULT_APPEARANCE.cardFace,
    cardBack: DEFAULT_APPEARANCE.cardBack,
    fourColorDeck: DEFAULT_APPEARANCE.fourColorDeck,
    minimalCards: DEFAULT_APPEARANCE.minimalCards,
  });
}

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
