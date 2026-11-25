import { signal } from '@preact/signals';
import type { PreflopPoolStyle } from '../../engine-api';

export const GAME_SETTINGS_STORAGE_KEY = 'riverline.game-settings.v1';

export type GameCurrencyUnit = 'bb' | '₪' | '$' | '€';
export type GameAnteMode = 'none' | 'bb_ante' | 'per_seat';

export interface CentralGameSettings {
  readonly profileId: string;
  readonly name: string;
  readonly tableSize: number;
  readonly smallBlind: number;
  readonly bigBlind: number;
  readonly currencyUnit: GameCurrencyUnit;
  readonly anteMode: GameAnteMode;
  readonly anteBb: number;
  readonly defaultStackBb: number;
  readonly rakePct: number;
  readonly rakeCapBb: number;
  readonly poolStyle: PreflopPoolStyle;
}

export const GAME_SETTINGS_PRESETS: readonly CentralGameSettings[] = Object.freeze([
  {
    profileId: 'online_6max',
    name: '6-Max Cash (5% / 2.5bb)',
    tableSize: 6,
    smallBlind: 0.5,
    bigBlind: 1,
    currencyUnit: 'bb',
    anteMode: 'none',
    anteBb: 0,
    defaultStackBb: 100,
    rakePct: 5,
    rakeCapBb: 2.5,
    poolStyle: 'standard',
  },
  {
    profileId: 'home_game_8max',
    name: 'Home Game 8-Max (0% rake)',
    tableSize: 8,
    smallBlind: 0.5,
    bigBlind: 1,
    currencyUnit: '₪',
    anteMode: 'none',
    anteBb: 0,
    defaultStackBb: 50,
    rakePct: 0,
    rakeCapBb: 0,
    poolStyle: 'loose_calling',
  },
  {
    profileId: 'full_ring_9max',
    name: 'Full Ring 9-Max (5% / 3bb)',
    tableSize: 9,
    smallBlind: 0.5,
    bigBlind: 1,
    currencyUnit: 'bb',
    anteMode: 'none',
    anteBb: 0,
    defaultStackBb: 100,
    rakePct: 5,
    rakeCapBb: 3,
    poolStyle: 'standard',
  },
  {
    profileId: 'hu_100bb',
    name: 'Heads-Up 100bb (0% rake)',
    tableSize: 2,
    smallBlind: 0.5,
    bigBlind: 1,
    currencyUnit: 'bb',
    anteMode: 'none',
    anteBb: 0,
    defaultStackBb: 100,
    rakePct: 0,
    rakeCapBb: 0,
    poolStyle: 'standard',
  },
  {
    profileId: 'tourney_30bb',
    name: 'Tourney 30bb (BB ante)',
    tableSize: 9,
    smallBlind: 0.5,
    bigBlind: 1,
    currencyUnit: 'bb',
    anteMode: 'bb_ante',
    anteBb: 1,
    defaultStackBb: 30,
    rakePct: 0,
    rakeCapBb: 0,
    poolStyle: 'standard',
  },
]);

export const DEFAULT_GAME_SETTINGS: CentralGameSettings = GAME_SETTINGS_PRESETS[0]!;

function clampNumber(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}

export function normalizeGameSettings(raw: unknown): CentralGameSettings {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const unit: GameCurrencyUnit =
    obj.currencyUnit === 'bb' || obj.currencyUnit === '₪' || obj.currencyUnit === '$' || obj.currencyUnit === '€'
      ? obj.currencyUnit
      : DEFAULT_GAME_SETTINGS.currencyUnit;
  const anteMode: GameAnteMode =
    obj.anteMode === 'none' || obj.anteMode === 'bb_ante' || obj.anteMode === 'per_seat'
      ? obj.anteMode
      : DEFAULT_GAME_SETTINGS.anteMode;
  const poolStyle: PreflopPoolStyle =
    obj.poolStyle === 'standard' || obj.poolStyle === 'loose_calling' || obj.poolStyle === 'tight_passive'
      ? obj.poolStyle
      : DEFAULT_GAME_SETTINGS.poolStyle;

  return {
    profileId: typeof obj.profileId === 'string' && obj.profileId.trim() ? obj.profileId.trim() : 'custom',
    name: typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim().slice(0, 48) : 'Custom game',
    tableSize: Math.round(clampNumber(obj.tableSize, 2, 10, DEFAULT_GAME_SETTINGS.tableSize)),
    smallBlind: clampNumber(obj.smallBlind, 0.1, 1000, DEFAULT_GAME_SETTINGS.smallBlind),
    bigBlind: clampNumber(obj.bigBlind, 0.2, 2000, DEFAULT_GAME_SETTINGS.bigBlind),
    currencyUnit: unit,
    anteMode,
    anteBb: anteMode === 'none' ? 0 : clampNumber(obj.anteBb, 0, 5, 1),
    defaultStackBb: clampNumber(obj.defaultStackBb, 10, 300, DEFAULT_GAME_SETTINGS.defaultStackBb),
    rakePct: clampNumber(obj.rakePct, 0, 15, DEFAULT_GAME_SETTINGS.rakePct),
    rakeCapBb: clampNumber(obj.rakeCapBb, 0, 20, DEFAULT_GAME_SETTINGS.rakeCapBb),
    poolStyle,
  };
}

interface PersistedGameSettingsPayload {
  readonly active: CentralGameSettings;
  readonly customProfiles: readonly CentralGameSettings[];
}

function readPersisted(): PersistedGameSettingsPayload {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { active: DEFAULT_GAME_SETTINGS, customProfiles: [] };
  }
  try {
    const raw = window.localStorage.getItem(GAME_SETTINGS_STORAGE_KEY);
    if (!raw) return { active: DEFAULT_GAME_SETTINGS, customProfiles: [] };
    const parsed = JSON.parse(raw) as Partial<PersistedGameSettingsPayload>;
    const active = normalizeGameSettings(parsed.active);
    const customProfiles = Array.isArray(parsed.customProfiles)
      ? parsed.customProfiles.map((p) => normalizeGameSettings(p))
      : [];
    return { active, customProfiles };
  } catch {
    return { active: DEFAULT_GAME_SETTINGS, customProfiles: [] };
  }
}

function writePersisted(payload: PersistedGameSettingsPayload): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(GAME_SETTINGS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage quota errors
  }
}

const initial = readPersisted();
export const activeGameSettingsSignal = signal<CentralGameSettings>(initial.active);
export const savedGameProfilesSignal = signal<readonly CentralGameSettings[]>(initial.customProfiles);

function persistCurrent(): void {
  writePersisted({
    active: activeGameSettingsSignal.value,
    customProfiles: savedGameProfilesSignal.value,
  });
}

export function updateGameSettings(patch: Partial<CentralGameSettings>): CentralGameSettings {
  const next = normalizeGameSettings({
    ...activeGameSettingsSignal.value,
    ...patch,
    profileId: patch.profileId ?? 'custom',
  });
  activeGameSettingsSignal.value = next;
  persistCurrent();
  return next;
}

export function applyGamePreset(presetId: string): CentralGameSettings {
  const found =
    GAME_SETTINGS_PRESETS.find((p) => p.profileId === presetId) ??
    savedGameProfilesSignal.value.find((p) => p.profileId === presetId) ??
    DEFAULT_GAME_SETTINGS;
  activeGameSettingsSignal.value = found;
  persistCurrent();
  return found;
}

export function saveCustomGameProfile(name: string): CentralGameSettings {
  const trimmed = name.trim().slice(0, 48) || `Custom ${savedGameProfilesSignal.value.length + 1}`;
  const profile: CentralGameSettings = {
    ...activeGameSettingsSignal.value,
    profileId: `custom:${Date.now()}`,
    name: trimmed,
  };
  savedGameProfilesSignal.value = [profile, ...savedGameProfilesSignal.value];
  activeGameSettingsSignal.value = profile;
  persistCurrent();
  return profile;
}

export function deleteCustomGameProfile(profileId: string): void {
  savedGameProfilesSignal.value = savedGameProfilesSignal.value.filter((p) => p.profileId !== profileId);
  persistCurrent();
}

export function resetGameSettings(): void {
  activeGameSettingsSignal.value = DEFAULT_GAME_SETTINGS;
  persistCurrent();
}
