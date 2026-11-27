import { calculateEquityExact, EQUITY_REQUEST_SCHEMA_VERSION } from '../../engine-api';

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

interface EquityIntuitionSpotSeed {
  readonly id: string;
  readonly heroCards: readonly [string, string];
  readonly villainCards: readonly [string, string];
  readonly board: readonly string[];
}

const EQUITY_INTUITION_SEEDS: readonly EquityIntuitionSpotSeed[] = [
  {
    id: 'overcards_vs_pair',
    heroCards: ['As', 'Kd'],
    villainCards: ['8h', '8c'],
    board: ['Qc', '7d', '2s'],
  },
  {
    id: 'combo_draw_vs_tptk',
    heroCards: ['Jh', 'Th'],
    villainCards: ['As', 'Kc'],
    board: ['Kh', '9h', '2c'],
  },
  {
    id: 'nut_fd_overcard_vs_top_pair',
    heroCards: ['Ah', '5h'],
    villainCards: ['Ks', 'Qc'],
    board: ['Kh', '8h', '3d'],
  },
  {
    id: 'tptk_vs_oesd',
    heroCards: ['As', 'Qs'],
    villainCards: ['Jd', 'Td'],
    board: ['Qh', '9c', '3s'],
  },
  {
    id: 'dominated_pair_turn',
    heroCards: ['Kc', 'Jc'],
    villainCards: ['As', 'Kd'],
    board: ['Kh', '7s', '4d', '2c'],
  },
];

function buildExactSpot(seed: EquityIntuitionSpotSeed): EquityIntuitionSpot {
  const res = calculateEquityExact({
    schemaVersion: EQUITY_REQUEST_SCHEMA_VERSION,
    board: [...seed.board],
    deadCards: [],
    method: 'exact',
    players: [
      { id: 'hero', cards: [...seed.heroCards] },
      { id: 'villain', cards: [...seed.villainCards] },
    ],
  });
  if (!('players' in res)) {
    throw new Error('Failed to compute exact equity intuition spot');
  }
  const hero = res.players.find((p) => p.id === 'hero');
  const exactEquityPct = hero ? Math.round(hero.equity * 1000) / 10 : 0;
  return {
    ...seed,
    exactEquityPct,
    trials: res.trials,
    correctBucketIndex: bucketForEquity(exactEquityPct),
  };
}

export const EQUITY_INTUITION_SPOTS: readonly EquityIntuitionSpot[] =
  EQUITY_INTUITION_SEEDS.map(buildExactSpot);
