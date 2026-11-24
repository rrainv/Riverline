import { signal } from '@preact/signals';

export type PostflopRuleTextureId = 'dry' | 'wet' | 'paired' | 'monotone';

export type PostflopRuleLineId =
  | 'flop_cbet_ip'
  | 'flop_vs_cbet_oop'
  | 'turn_barrel'
  | 'river_bluff_catch';

export type PostflopSizePreset = '33%' | '50%' | '75%' | '125%';

export interface PostflopRuleEntry {
  readonly texture: PostflopRuleTextureId;
  readonly lineId: PostflopRuleLineId;
  readonly targetFreqPct: number;
  readonly sizeLabel: PostflopSizePreset;
  readonly note: string;
}

export const POSTFLOP_PLAYBOOK_STORAGE_KEY = 'riverline.postflop-playbook.v1';

export const POSTFLOP_RULE_TEXTURES: readonly PostflopRuleTextureId[] = [
  'dry',
  'wet',
  'paired',
  'monotone',
];

export const POSTFLOP_RULE_LINES: readonly PostflopRuleLineId[] = [
  'flop_cbet_ip',
  'flop_vs_cbet_oop',
  'turn_barrel',
  'river_bluff_catch',
];

function ruleKey(texture: PostflopRuleTextureId, lineId: PostflopRuleLineId): string {
  return `${texture}:${lineId}`;
}

function buildDefaultPlaybook(): Record<string, PostflopRuleEntry> {
  const defaults: Record<string, PostflopRuleEntry> = {};
  const presets: Record<PostflopRuleTextureId, Record<PostflopRuleLineId, { pct: number; size: PostflopSizePreset }>> = {
    dry: {
      flop_cbet_ip: { pct: 70, size: '33%' },
      flop_vs_cbet_oop: { pct: 60, size: '33%' },
      turn_barrel: { pct: 55, size: '75%' },
      river_bluff_catch: { pct: 50, size: '75%' },
    },
    wet: {
      flop_cbet_ip: { pct: 45, size: '75%' },
      flop_vs_cbet_oop: { pct: 55, size: '75%' },
      turn_barrel: { pct: 60, size: '75%' },
      river_bluff_catch: { pct: 45, size: '125%' },
    },
    paired: {
      flop_cbet_ip: { pct: 75, size: '33%' },
      flop_vs_cbet_oop: { pct: 65, size: '33%' },
      turn_barrel: { pct: 50, size: '50%' },
      river_bluff_catch: { pct: 50, size: '75%' },
    },
    monotone: {
      flop_cbet_ip: { pct: 35, size: '33%' },
      flop_vs_cbet_oop: { pct: 50, size: '50%' },
      turn_barrel: { pct: 45, size: '75%' },
      river_bluff_catch: { pct: 40, size: '75%' },
    },
  };

  for (const texture of POSTFLOP_RULE_TEXTURES) {
    for (const lineId of POSTFLOP_RULE_LINES) {
      const p = presets[texture][lineId];
      defaults[ruleKey(texture, lineId)] = {
        texture,
        lineId,
        targetFreqPct: p.pct,
        sizeLabel: p.size,
        note: '',
      };
    }
  }
  return defaults;
}

function readPlaybook(): Record<string, PostflopRuleEntry> {
  const base = buildDefaultPlaybook();
  if (typeof window === 'undefined' || !window.localStorage) return base;
  try {
    const raw = window.localStorage.getItem(POSTFLOP_PLAYBOOK_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Record<string, Partial<PostflopRuleEntry>>;
    if (!parsed || typeof parsed !== 'object') return base;
    for (const [k, v] of Object.entries(parsed)) {
      if (!base[k] || !v) continue;
      base[k] = {
        ...base[k]!,
        targetFreqPct:
          typeof v.targetFreqPct === 'number'
            ? Math.max(0, Math.min(100, Math.round(v.targetFreqPct)))
            : base[k]!.targetFreqPct,
        sizeLabel:
          v.sizeLabel === '33%' || v.sizeLabel === '50%' || v.sizeLabel === '75%' || v.sizeLabel === '125%'
            ? v.sizeLabel
            : base[k]!.sizeLabel,
        note: typeof v.note === 'string' ? v.note.slice(0, 120) : base[k]!.note,
      };
    }
  } catch {
    // Ignore storage errors
  }
  return base;
}

function writePlaybook(map: Record<string, PostflopRuleEntry>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(POSTFLOP_PLAYBOOK_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore quota errors
  }
}

export const postflopPlaybookSignal = signal<Record<string, PostflopRuleEntry>>(readPlaybook());

export function getPostflopRule(
  texture: PostflopRuleTextureId,
  lineId: PostflopRuleLineId,
): PostflopRuleEntry {
  return postflopPlaybookSignal.value[ruleKey(texture, lineId)]!;
}

export function updatePostflopRule(
  texture: PostflopRuleTextureId,
  lineId: PostflopRuleLineId,
  patch: Partial<Pick<PostflopRuleEntry, 'targetFreqPct' | 'sizeLabel' | 'note'>>,
): void {
  const key = ruleKey(texture, lineId);
  const current = postflopPlaybookSignal.value[key]!;
  const next = {
    ...postflopPlaybookSignal.value,
    [key]: {
      ...current,
      ...patch,
      targetFreqPct:
        patch.targetFreqPct !== undefined
          ? Math.max(0, Math.min(100, Math.round(patch.targetFreqPct)))
          : current.targetFreqPct,
    },
  };
  postflopPlaybookSignal.value = next;
  writePlaybook(next);
}

export function resetPostflopPlaybook(): void {
  const next = buildDefaultPlaybook();
  postflopPlaybookSignal.value = next;
  writePlaybook(next);
}

export function exportPostflopPlaybook(): Record<string, PostflopRuleEntry> {
  return { ...postflopPlaybookSignal.value };
}

export function importPostflopPlaybook(
  incoming: Record<string, Partial<PostflopRuleEntry>>,
): void {
  if (!incoming || typeof incoming !== 'object') return;
  const base = buildDefaultPlaybook();
  for (const [k, v] of Object.entries(incoming)) {
    if (!base[k] || !v) continue;
    base[k] = {
      ...base[k]!,
      targetFreqPct:
        typeof v.targetFreqPct === 'number'
          ? Math.max(0, Math.min(100, Math.round(v.targetFreqPct)))
          : base[k]!.targetFreqPct,
      sizeLabel:
        v.sizeLabel === '33%' || v.sizeLabel === '50%' || v.sizeLabel === '75%' || v.sizeLabel === '125%'
          ? v.sizeLabel
          : base[k]!.sizeLabel,
      note: typeof v.note === 'string' ? v.note.slice(0, 120) : base[k]!.note,
    };
  }
  postflopPlaybookSignal.value = base;
  writePlaybook(base);
}

export function clearPostflopPlaybook(): void {
  const next = buildDefaultPlaybook();
  postflopPlaybookSignal.value = next;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(POSTFLOP_PLAYBOOK_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
}
