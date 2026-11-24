import { computed, signal } from '@preact/signals';

export interface VillainProfile {
  readonly id: string;
  readonly name: string;
  readonly rangeText: string;
  readonly builtIn: boolean;
  readonly tendencyNote?: string;
  readonly nightPlayerName?: string;
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
      .map((item) => {
        const meta = item as unknown as { tendencyNote?: unknown; nightPlayerName?: unknown };
        return {
          id: item.id,
          name: item.name.trim().slice(0, 24),
          rangeText: item.rangeText.trim(),
          builtIn: false,
          ...(typeof meta.tendencyNote === 'string' && meta.tendencyNote.trim().length > 0
            ? { tendencyNote: meta.tendencyNote.trim().slice(0, 120) }
            : {}),
          ...(typeof meta.nightPlayerName === 'string' && meta.nightPlayerName.trim().length > 0
            ? { nightPlayerName: meta.nightPlayerName.trim().slice(0, 32) }
            : {}),
        };
      });
  } catch {
    return [];
  }
}

function writeCustomProfiles(profiles: readonly VillainProfile[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      VILLAIN_PROFILES_STORAGE_KEY,
      JSON.stringify(
        profiles.map((p) => ({
          id: p.id,
          name: p.name,
          rangeText: p.rangeText,
          ...(p.tendencyNote ? { tendencyNote: p.tendencyNote } : {}),
          ...(p.nightPlayerName ? { nightPlayerName: p.nightPlayerName } : {}),
        })),
      ),
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

export function saveVillainProfile(
  name: string,
  rangeText: string,
  meta?: { readonly tendencyNote?: string; readonly nightPlayerName?: string },
): VillainProfile | null {
  const cleanName = name.trim().slice(0, 24);
  const cleanRange = rangeText.trim();
  if (!cleanName || !cleanRange) return null;

  const existing = customVillainProfilesSignal.value;
  const matchIdx = existing.findIndex(
    (p) => p.name.toLowerCase() === cleanName.toLowerCase(),
  );
  const cleanNote = meta?.tendencyNote?.trim().slice(0, 120);
  const cleanNight = meta?.nightPlayerName?.trim().slice(0, 32);
  const entry: VillainProfile = {
    id: matchIdx >= 0 ? existing[matchIdx]!.id : `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    rangeText: cleanRange,
    builtIn: false,
    ...(cleanNote ? { tendencyNote: cleanNote } : {}),
    ...(cleanNight ? { nightPlayerName: cleanNight } : {}),
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

export function exportCustomVillainProfiles(): readonly {
  readonly id: string;
  readonly name: string;
  readonly rangeText: string;
}[] {
  return customVillainProfilesSignal.value.map((p) => ({
    id: p.id,
    name: p.name,
    rangeText: p.rangeText,
  }));
}

export function importCustomVillainProfiles(
  incoming: readonly { readonly id: string; readonly name: string; readonly rangeText: string }[],
): void {
  if (!Array.isArray(incoming) || incoming.length === 0) return;
  const merged = [...customVillainProfilesSignal.value];
  for (const raw of incoming) {
    if (!raw || typeof raw.name !== 'string' || typeof raw.rangeText !== 'string') continue;
    const cleanName = raw.name.trim().slice(0, 24);
    const cleanRange = raw.rangeText.trim();
    if (!cleanName || !cleanRange) continue;
    const existingIdx = merged.findIndex((p) => p.name.toLowerCase() === cleanName.toLowerCase());
    const entry: VillainProfile = {
      id:
        typeof raw.id === 'string' && raw.id.trim().length > 0
          ? raw.id.trim()
          : `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      rangeText: cleanRange,
      builtIn: false,
    };
    if (existingIdx >= 0) {
      merged[existingIdx] = entry;
    } else {
      merged.push(entry);
    }
  }
  customVillainProfilesSignal.value = merged;
  writeCustomProfiles(merged);
}

export function clearCustomVillainProfiles(): void {
  customVillainProfilesSignal.value = [];
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(VILLAIN_PROFILES_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
}
