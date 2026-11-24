import { deepFreeze } from '../freeze';
import { PREFLOP_HAND_CLASSES } from '../hand-class';

export type PreflopPoolStyle = 'standard' | 'loose_calling' | 'tight_passive';
export type PreflopAnchorStackBb = 30 | 60 | 100 | 200;
export type PreflopSpotClass =
  | 'preflop_rfi'
  | 'preflop_facing_open'
  | 'preflop_facing_3bet'
  | 'preflop_facing_4bet'
  | 'preflop_facing_limp'
  | 'preflop_bb_option';

export interface PreflopHandActionMix {
  readonly raise: number;
  readonly call: number;
  readonly fold: number;
}

export const PREFLOP_ANCHOR_STACKS: readonly PreflopAnchorStackBb[] = [30, 60, 100, 200];

const RANK_ORDER = '23456789TJQKA';

/**
 * Deterministic 169-class preflop strength metric (0..32) used to construct
 * smooth, monotone clean-room anchor tables with mixed borderline frequencies.
 */
export function preflopHandStrength(handClass: string): number {
  const r1 = RANK_ORDER.indexOf(handClass[0] ?? '2');
  const r2 = RANK_ORDER.indexOf(handClass[1] ?? '2');
  const hi = Math.max(r1, r2);
  const lo = Math.min(r1, r2);
  if (r1 === r2) return 14.5 + hi * 1.45;
  const suited = handClass.endsWith('s');
  const gap = hi - lo;
  const wheelBonus = hi === 12 && lo <= 3 ? 1.1 : 0;
  const connBonus = gap <= 2 && lo >= 4 ? 0.6 : 0;
  return hi + lo * 0.54 + (suited ? 3.15 : 0) + wheelBonus + connBonus - gap * 0.14;
}

const POLAR_BLUFF_HANDS = new Set(['A5s', 'A4s', 'A3s', 'K9s', 'Q9s', 'J9s', 'T8s', '76s', '65s']);

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function normalizeMix(raise: number, call: number, fold: number): PreflopHandActionMix {
  const r = Math.max(0, raise);
  const c = Math.max(0, call);
  const f = Math.max(0, fold);
  const sum = r + c + f;
  if (sum <= 0) return { raise: 0, call: 0, fold: 1 };
  const nr = Math.round((r / sum) * 1000) / 1000;
  const nc = Math.round((c / sum) * 1000) / 1000;
  const nf = Math.max(0, Math.round((1 - nr - nc) * 1000) / 1000);
  return { raise: nr, call: nc, fold: nf };
}

/**
 * Computes a clean-room 169-hand anchor distribution for a given
 * (playersBehind, stackBb, spotClass, openerPlayersBehind, inPosition).
 */
export function buildPreflopAnchorRow(params: {
  readonly playersBehind: number;
  readonly stackBb: PreflopAnchorStackBb;
  readonly spotClass: PreflopSpotClass;
  readonly openerPlayersBehind?: number;
  readonly inPosition?: boolean;
  readonly limpersCount?: number;
}): Readonly<Record<string, PreflopHandActionMix>> {
  const behind = Math.max(0, Math.min(9, Math.round(params.playersBehind)));
  const stackFactor =
    params.stackBb === 30 ? -0.9 : params.stackBb === 60 ? -0.35 : params.stackBb === 100 ? 0 : 0.45;

  const out: Record<string, PreflopHandActionMix> = {};

  for (const hc of PREFLOP_HAND_CLASSES) {
    const s = preflopHandStrength(hc);
    const isPolarBluff = POLAR_BLUFF_HANDS.has(hc);

    if (params.spotClass === 'preflop_rfi') {
      // Tighten monotonically with playersBehind (0=SB/BTN-like late, 9=10-max UTG)
      const threshold = 13.4 + behind * 0.92 - stackFactor * 0.35;
      const diff = s - threshold;
      const rawRaise = clamp01(0.5 + diff * 0.42);
      out[hc] = normalizeMix(rawRaise, 0, 1 - rawRaise);
    } else if (params.spotClass === 'preflop_facing_open' || params.spotClass === 'preflop_bb_option') {
      const openerBehind = Math.max(1, Math.min(9, params.openerPlayersBehind ?? Math.min(9, behind + 2)));
      const inPosBonus = params.inPosition !== false ? -0.75 : 0.4;
      const baseCallThresh =
        params.spotClass === 'preflop_bb_option' ? 12.2 + openerBehind * 0.45 : 15.0 + openerBehind * 0.55 + inPosBonus;
      const threeBetThresh = 19.8 + openerBehind * 0.42 - stackFactor * 0.25;

      if (s >= threeBetThresh) {
        const r = clamp01(0.55 + (s - threeBetThresh) * 0.25);
        out[hc] = normalizeMix(r, 1 - r, 0);
      } else if (isPolarBluff && s >= baseCallThresh - 1.5 && params.stackBb >= 60) {
        out[hc] = normalizeMix(0.32, 0.43, 0.25);
      } else if (s >= baseCallThresh - 1.2) {
        const cont = clamp01(0.5 + (s - baseCallThresh) * 0.4);
        const r = cont * 0.14;
        out[hc] = normalizeMix(r, cont - r, 1 - cont);
      } else {
        out[hc] = { raise: 0, call: 0, fold: 1 };
      }
    } else if (params.spotClass === 'preflop_facing_3bet') {
      const ipBonus = params.inPosition !== false ? -0.8 : 0.6;
      const callThresh = 17.8 + ipBonus - stackFactor * 0.3;
      const fourBetThresh = 22.8 - stackFactor * 0.25;
      if (s >= fourBetThresh) {
        const r = clamp01(0.6 + (s - fourBetThresh) * 0.22);
        out[hc] = normalizeMix(r, 1 - r, 0);
      } else if (isPolarBluff && params.stackBb >= 60) {
        out[hc] = normalizeMix(0.28, 0.32, 0.4);
      } else {
        const cont = clamp01(0.5 + (s - callThresh) * 0.38);
        out[hc] = normalizeMix(cont * 0.08, cont * 0.92, 1 - cont);
      }
    } else if (params.spotClass === 'preflop_facing_4bet') {
      const contThresh = 22.2 - stackFactor * 0.2;
      const jamThresh = 26.5;
      if (s >= jamThresh) {
        out[hc] = normalizeMix(0.75, 0.25, 0);
      } else {
        const cont = clamp01(0.5 + (s - contThresh) * 0.42);
        out[hc] = normalizeMix(cont * 0.2, cont * 0.8, 1 - cont);
      }
    } else {
      // preflop_facing_limp
      const limpers = Math.max(1, Math.min(4, params.limpersCount ?? 1));
      const isoThresh = 15.8 + (limpers - 1) * 0.7;
      const overlimpThresh = 13.4 + (limpers - 1) * 0.35;
      if (s >= isoThresh) {
        const r = clamp01(0.55 + (s - isoThresh) * 0.35);
        out[hc] = normalizeMix(r, (1 - r) * 0.7, (1 - r) * 0.3);
      } else if (s >= overlimpThresh) {
        const c = clamp01(0.45 + (s - overlimpThresh) * 0.35);
        out[hc] = normalizeMix(0.08, c, Math.max(0, 0.92 - c));
      } else {
        out[hc] = { raise: 0, call: 0, fold: 1 };
      }
    }
  }

  return deepFreeze(out);
}
