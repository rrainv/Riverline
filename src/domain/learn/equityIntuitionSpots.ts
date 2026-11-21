export interface EquityIntuitionSpot {
  readonly id: string;
  readonly heroCards: readonly [string, string];
  readonly villainCards: readonly [string, string];
  readonly board: readonly string[];
  readonly exactEquityPct: number;
  readonly trials: number;
  readonly correctBucketIndex: 0 | 1 | 2 | 3;
}

export const EQUITY_INTUITION_BUCKETS: readonly {
  readonly index: 0 | 1 | 2 | 3;
  readonly label: string;
}[] = [
  { index: 0, label: '< 20%' },
  { index: 1, label: '20% - 35%' },
  { index: 2, label: '35% - 50%' },
  { index: 3, label: '50%+' },
];

export function bucketForEquity(pct: number): 0 | 1 | 2 | 3 {
  if (pct < 20) return 0;
  if (pct < 35) return 1;
  if (pct < 50) return 2;
  return 3;
}

export const EQUITY_INTUITION_SPOTS: readonly EquityIntuitionSpot[] = [
  {
    id: 'overcards_vs_pair',
    heroCards: ['As', 'Kd'],
    villainCards: ['8h', '8c'],
    board: ['Qc', '7d', '2s'],
    exactEquityPct: 25.6,
    trials: 990,
    correctBucketIndex: 1,
  },
  {
    id: 'combo_draw_vs_tptk',
    heroCards: ['Jh', 'Th'],
    villainCards: ['As', 'Kc'],
    board: ['Kh', '9h', '2c'],
    exactEquityPct: 48.3,
    trials: 990,
    correctBucketIndex: 2,
  },
  {
    id: 'nut_fd_overcard_vs_top_pair',
    heroCards: ['Ah', '5h'],
    villainCards: ['Ks', 'Qc'],
    board: ['Kh', '8h', '3d'],
    exactEquityPct: 45.9,
    trials: 990,
    correctBucketIndex: 2,
  },
  {
    id: 'tptk_vs_oesd',
    heroCards: ['As', 'Qs'],
    villainCards: ['Jd', 'Td'],
    board: ['Qh', '9c', '3s'],
    exactEquityPct: 67.6,
    trials: 990,
    correctBucketIndex: 3,
  },
  {
    id: 'dominated_pair_turn',
    heroCards: ['Kc', 'Jc'],
    villainCards: ['As', 'Kd'],
    board: ['Kh', '7s', '4d', '2c'],
    exactEquityPct: 6.8,
    trials: 44,
    correctBucketIndex: 0,
  },
];
