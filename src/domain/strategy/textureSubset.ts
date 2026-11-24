import type { HoldemWeightedRange } from '../../engine-api';
import { computePostflopRangeBreakdown } from '../equity/rangeBreakdown';

export interface CanonicalFlopSpec {
  readonly id: string;
  readonly cards: readonly [string, string, string];
  readonly textureTag:
    | 'ace_high_dry'
    | 'king_high_two_tone'
    | 'queen_high_rainbow'
    | 'monotone_broadway'
    | 'paired_high'
    | 'paired_low'
    | 'connected_mid'
    | 'low_connected'
    | 'two_tone_mid'
    | 'dry_jack_high'
    | 'wheel_low'
    | 'broadway_wet';
}

export const CANONICAL_12_FLOPS: readonly CanonicalFlopSpec[] = [
  { id: 'A72r', cards: ['As', '7d', '2c'], textureTag: 'ace_high_dry' },
  { id: 'K83tt', cards: ['Kh', '8h', '3c'], textureTag: 'king_high_two_tone' },
  { id: 'Q72r', cards: ['Qd', '7s', '2h'], textureTag: 'queen_high_rainbow' },
  { id: 'KJTm', cards: ['Ks', 'Js', 'Ts'], textureTag: 'monotone_broadway' },
  { id: 'KK4r', cards: ['Kh', 'Kd', '4c'], textureTag: 'paired_high' },
  { id: '662tt', cards: ['6s', '6c', '2s'], textureTag: 'paired_low' },
  { id: 'T97tt', cards: ['Th', '9h', '7d'], textureTag: 'connected_mid' },
  { id: '764tt', cards: ['7c', '6c', '4d'], textureTag: 'low_connected' },
  { id: 'J85tt', cards: ['Jd', '8d', '5s'], textureTag: 'two_tone_mid' },
  { id: 'J42r', cards: ['Js', '4d', '2c'], textureTag: 'dry_jack_high' },
  { id: '542r', cards: ['5h', '4d', '2s'], textureTag: 'wheel_low' },
  { id: 'QJTtt', cards: ['Qc', 'Jc', 'Td'], textureTag: 'broadway_wet' },
];

export type TexturePresetId = 'btn_open' | 'co_open' | 'utg_open' | 'bb_defend';

export const TEXTURE_SUBSET_PRESETS: Readonly<Record<TexturePresetId, string>> = {
  btn_open: '22+, A2s+, K5s+, Q7s+, J8s+, T8s+, 97s+, 87s, 76s, 65s, 54s, A9o+, KTo+, QTo+, JTo',
  co_open: '22+, A2s+, K8s+, Q9s+, J9s+, T8s+, 98s, 87s, 76s, ATo+, KJo+, QJo',
  utg_open: '66+, ATs+, KJs+, QJs, JTs, AQo+, KQo',
  bb_defend: '22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 96s+, 86s+, 75s+, 64s+, 54s, A7o+, K9o+, Q9o+, J9o+, T9o',
};

export interface TextureSubsetRow {
  readonly flop: CanonicalFlopSpec;
  readonly setsPlusPct: number;
  readonly twoPairPlusPct: number;
  readonly topPairPlusPct: number;
  readonly drawsPct: number;
  readonly continuePct: number;
  readonly airPct: number;
}

function roundTenth(val: number): number {
  return Math.round(val * 10) / 10;
}

export function computeTextureSubsetReport(
  range: HoldemWeightedRange,
): readonly TextureSubsetRow[] {
  return CANONICAL_12_FLOPS.map((flop) => {
    const bd = computePostflopRangeBreakdown(range, flop.cards);
    if (!bd) {
      return {
        flop,
        setsPlusPct: 0,
        twoPairPlusPct: 0,
        topPairPlusPct: 0,
        drawsPct: 0,
        continuePct: 0,
        airPct: 100,
      };
    }

    const share = (id: string) =>
      bd.buckets.find((b) => b.id === id)?.sharePct ?? 0;

    const setsPlus = share('sets_plus');
    const twoPair = share('two_pair');
    const topOver = share('top_overpair');
    const midWeak = share('mid_weak_pair');
    const comboDraw = share('combo_draw');
    const fsDraw = share('flush_straight_draw');
    const air = share('air');

    const setsPlusPct = roundTenth(setsPlus);
    const twoPairPlusPct = roundTenth(setsPlus + twoPair);
    const topPairPlusPct = roundTenth(twoPairPlusPct + topOver);
    const drawsPct = roundTenth(comboDraw + fsDraw);
    const continuePct = roundTenth(topPairPlusPct + midWeak + drawsPct);

    return {
      flop,
      setsPlusPct,
      twoPairPlusPct,
      topPairPlusPct,
      drawsPct,
      continuePct,
      airPct: roundTenth(air),
    };
  });
}
