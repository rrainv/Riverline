import { computed, signal } from '@preact/signals';

export interface VillainProfile {
  readonly id: string;
  readonly name: string;
  readonly rangeText: string;
  readonly builtIn: boolean;
}

export const VILLAIN_PROFILES_STORAGE_KEY = 'riverline:villain-profiles-v1';

export const BUILT_IN_VILLAIN_PROFILES: readonly VillainProfile[] = [
  { id: 'builtin-nit', name: 'Nit 12%', rangeText: 'top 12%', builtIn: true },
  { id: 'builtin-tag', name: 'TAG 22%', rangeText: 'top 22%', builtIn: true },
  { id: 'builtin-lag', name: 'LAG 34%', rangeText: 'top 34%', builtIn: true },
  {
    id: 'builtin-3bp',
    name: '3-bet Polar',
    rangeText: 'QQ+, AKs, AKo, A5s-A2s, K9s, Q9s',
    builtIn: true,
  },
];

function readCustomProfiles(): readonly VillainProfile[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(VILLAIN_PROFILES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is { id: string; name: string; rangeText: string } =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          typeof item.name === 'string' &&
          typeof item.rangeText === 'string' &&
          item.name.trim().length > 0 &&
          item.rangeText.trim().length > 0,
      )
      .map((item) => ({
        id: item.id,
        name: item.name.trim().slice(0, 24),
        rangeText: item.rangeText.trim(),
        builtIn: false,
      }));
  } catch {
    return [];
  }
}

function writeCustomProfiles(profiles: readonly VillainProfile[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      VILLAIN_PROFILES_STORAGE_KEY,
      JSON.stringify(profiles.map((p) => ({ id: p.id, name: p.name, rangeText: p.rangeText }))),
    );
  } catch {
    // Ignore storage quota errors
  }
}

export const customVillainProfilesSignal = signal<readonly VillainProfile[]>(readCustomProfiles());

export const allVillainProfilesSignal = computed<readonly VillainProfile[]>(() => [
  ...BUILT_IN_VILLAIN_PROFILES,
  ...customVillainProfilesSignal.value,
]);

export function saveVillainProfile(name: string, rangeText: string): VillainProfile | null {
  const cleanName = name.trim().slice(0, 24);
  const cleanRange = rangeText.trim();
  if (!cleanName || !cleanRange) return null;

  const existing = customVillainProfilesSignal.value;
  const matchIdx = existing.findIndex(
    (p) => p.name.toLowerCase() === cleanName.toLowerCase(),
  );
  const entry: VillainProfile = {
    id: matchIdx >= 0 ? existing[matchIdx]!.id : `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    rangeText: cleanRange,
    builtIn: false,
  };
  const next =
    matchIdx >= 0
      ? existing.map((p, idx) => (idx === matchIdx ? entry : p))
      : [...existing, entry];
  customVillainProfilesSignal.value = next;
  writeCustomProfiles(next);
  return entry;
}

export function deleteVillainProfile(id: string): void {
  const next = customVillainProfilesSignal.value.filter((p) => p.id !== id);
  customVillainProfilesSignal.value = next;
  writeCustomProfiles(next);
}

export function reloadVillainProfiles(): void {
  customVillainProfilesSignal.value = readCustomProfiles();
}
