export type LimpLabAction = 'iso_raise' | 'overlimp' | 'fold';

export type LimpLabRationaleKey =
  | 'value_iso'
  | 'thin_iso_ip'
  | 'overlimp_odds'
  | 'fold_dominated'
  | 'bb_check_or_iso';

export interface LimpLabSpot {
  readonly id: string;
  readonly limpersCount: 1 | 2 | 3;
  readonly heroPosition: 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';
  readonly heroCards: readonly [string, string];
  readonly stackBb: 50 | 100;
  readonly recommendedAction: LimpLabAction;
  readonly recommendedSizeBb: number | null;
  readonly rationaleKey: LimpLabRationaleKey;
}

export function recommendedIsoSizeBb(limpersCount: number, inPosition: boolean): number {
  return 3 + limpersCount + (inPosition ? 0 : 1);
}

export const LIMP_LAB_SPOTS: readonly LimpLabSpot[] = [
  {
    id: 'limp-1-btn-aqo',
    limpersCount: 1,
    heroPosition: 'BTN',
    heroCards: ['As', 'Qd'],
    stackBb: 100,
    recommendedAction: 'iso_raise',
    recommendedSizeBb: recommendedIsoSizeBb(1, true),
    rationaleKey: 'value_iso',
  },
  {
    id: 'limp-1-co-kjs',
    limpersCount: 1,
    heroPosition: 'CO',
    heroCards: ['Ks', 'Js'],
    stackBb: 100,
    recommendedAction: 'iso_raise',
    recommendedSizeBb: recommendedIsoSizeBb(1, true),
    rationaleKey: 'thin_iso_ip',
  },
  {
    id: 'limp-1-sb-ato',
    limpersCount: 1,
    heroPosition: 'SB',
    heroCards: ['Ah', 'Tc'],
    stackBb: 100,
    recommendedAction: 'iso_raise',
    recommendedSizeBb: recommendedIsoSizeBb(1, false),
    rationaleKey: 'value_iso',
  },
  {
    id: 'limp-1-btn-k9o',
    limpersCount: 1,
    heroPosition: 'BTN',
    heroCards: ['Kd', '9c'],
    stackBb: 50,
    recommendedAction: 'fold',
    recommendedSizeBb: null,
    rationaleKey: 'fold_dominated',
  },
  {
    id: 'limp-2-btn-66',
    limpersCount: 2,
    heroPosition: 'BTN',
    heroCards: ['6s', '6h'],
    stackBb: 100,
    recommendedAction: 'overlimp',
    recommendedSizeBb: null,
    rationaleKey: 'overlimp_odds',
  },
  {
    id: 'limp-2-co-ajs',
    limpersCount: 2,
    heroPosition: 'CO',
    heroCards: ['Ad', 'Jd'],
    stackBb: 100,
    recommendedAction: 'iso_raise',
    recommendedSizeBb: recommendedIsoSizeBb(2, true),
    rationaleKey: 'value_iso',
  },
  {
    id: 'limp-2-sb-75s',
    limpersCount: 2,
    heroPosition: 'SB',
    heroCards: ['7h', '5h'],
    stackBb: 100,
    recommendedAction: 'overlimp',
    recommendedSizeBb: null,
    rationaleKey: 'overlimp_odds',
  },
  {
    id: 'limp-2-hj-qjo',
    limpersCount: 2,
    heroPosition: 'HJ',
    heroCards: ['Qc', 'Jd'],
    stackBb: 50,
    recommendedAction: 'fold',
    recommendedSizeBb: null,
    rationaleKey: 'fold_dominated',
  },
  {
    id: 'limp-3-btn-98s',
    limpersCount: 3,
    heroPosition: 'BTN',
    heroCards: ['9d', '8d'],
    stackBb: 100,
    recommendedAction: 'overlimp',
    recommendedSizeBb: null,
    rationaleKey: 'overlimp_odds',
  },
  {
    id: 'limp-3-co-qq',
    limpersCount: 3,
    heroPosition: 'CO',
    heroCards: ['Qh', 'Qs'],
    stackBb: 100,
    recommendedAction: 'iso_raise',
    recommendedSizeBb: recommendedIsoSizeBb(3, true),
    rationaleKey: 'value_iso',
  },
  {
    id: 'limp-3-bb-kqo',
    limpersCount: 3,
    heroPosition: 'BB',
    heroCards: ['Kc', 'Qd'],
    stackBb: 100,
    recommendedAction: 'overlimp',
    recommendedSizeBb: null,
    rationaleKey: 'bb_check_or_iso',
  },
  {
    id: 'limp-3-sb-k8o',
    limpersCount: 3,
    heroPosition: 'SB',
    heroCards: ['Ks', '8d'],
    stackBb: 50,
    recommendedAction: 'fold',
    recommendedSizeBb: null,
    rationaleKey: 'fold_dominated',
  },
];
