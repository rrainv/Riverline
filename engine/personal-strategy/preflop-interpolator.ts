import { deepFreeze } from '../freeze';
import { PREFLOP_HAND_CLASSES } from '../hand-class';
import { positionsForTableSize } from './context';
import {
  buildPreflopAnchorRow,
  PREFLOP_ANCHOR_STACKS,
  type PreflopAnchorStackBb,
  type PreflopHandActionMix,
  type PreflopPoolStyle,
  type PreflopSpotClass,
} from './preflop-pack';
import { lookupPushFoldRow } from './pushfold-table';

export interface MultidimensionalPreflopQuery {
  readonly tableSize: number;
  readonly stackDepthBb: number;
  readonly spotClass: PreflopSpotClass;
  readonly position: string;
  readonly openerPosition?: string | null;
  readonly openSizeBb?: number | null;
  readonly threeBetSizeBb?: number | null;
  readonly limpersCount?: number;
  readonly poolStyle?: PreflopPoolStyle;
}

export interface MultidimensionalPreflopResult {
  readonly available: boolean;
  readonly tier: 'estimated';
  readonly qualifier: string;
  readonly derivation: 'authored' | 'interpolated' | 'mapped' | 'clamped' | 'push_fold';
  readonly playersBehind: number;
  readonly poolStyle: PreflopPoolStyle;
  readonly frequencies: Readonly<Record<string, PreflopHandActionMix>>;
  readonly closeCallHandClasses: readonly string[];
}

const TEN_MAX_POSITIONS = ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;
const NINE_MAX_POSITIONS = ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;

export function resolvePlayersBehindForTable(tableSizeRaw: number, position: string): {
  readonly playersBehind: number;
  readonly mappedTableSize: boolean;
} {
  const tableSize = Math.max(2, Math.min(10, Math.round(tableSizeRaw)));
  if (tableSize === 2) {
    return {
      playersBehind: position === 'BTN' || position === 'SB' ? 1 : 0,
      mappedTableSize: false,
    };
  }
  if (tableSize === 6 || tableSize === 8) {
    const seats = positionsForTableSize(tableSize);
    const idx = seats.indexOf(position);
    const behind = idx >= 0 ? seats.length - 1 - idx : 3;
    return { playersBehind: behind, mappedTableSize: tableSize === 8 };
  }
  if (tableSize === 9) {
    const idx = NINE_MAX_POSITIONS.indexOf(position as (typeof NINE_MAX_POSITIONS)[number]);
    const behind = idx >= 0 ? 8 - idx : 4;
    return { playersBehind: behind, mappedTableSize: false };
  }
  const idx = TEN_MAX_POSITIONS.indexOf(position as (typeof TEN_MAX_POSITIONS)[number]);
  const behind = idx >= 0 ? 9 - idx : 4;
  return { playersBehind: behind, mappedTableSize: true };
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

export function queryMultidimensionalPreflop(
  query: MultidimensionalPreflopQuery,
): MultidimensionalPreflopResult {
  const poolStyle: PreflopPoolStyle = query.poolStyle ?? 'standard';
  const { playersBehind, mappedTableSize } = resolvePlayersBehindForTable(
    query.tableSize,
    query.position,
  );
  const openerBehind = query.openerPosition
    ? resolvePlayersBehindForTable(query.tableSize, query.openerPosition).playersBehind
    : Math.min(9, playersBehind + 2);

  // Short-stack Push/Fold regime (<= 15 bb)
  if (query.stackDepthBb <= 15) {
    const pf = lookupPushFoldRow(query.stackDepthBb);
    const isBb = query.position === 'BB';
    const freqMap = isBb ? pf.bbCallFreqByClass : pf.sbJamFreqByClass;
    const freqs: Record<string, PreflopHandActionMix> = {};
    const closeCalls: string[] = [];
    for (let i = 0; i < PREFLOP_HAND_CLASSES.length; i += 1) {
      const hc = PREFLOP_HAND_CLASSES[i]!;
      const p = Math.max(0, Math.min(1, freqMap[hc] ?? 0));
      const mix = isBb
        ? normalizeMix(0, p, 1 - p)
        : normalizeMix(p, 0, 1 - p);
      freqs[hc] = mix;
      if (p >= 0.15 && p <= 0.85) closeCalls.push(hc);
    }
    const qualifier =
      Math.round(query.tableSize) === 2
        ? `Exact HU Nash 169x169 (${pf.stackBb} bb, expl ${pf.exploitabilityBb.toFixed(4)} bb)`
        : `Estimated · HU push/fold reference (${pf.stackBb} bb)`;
    return deepFreeze({
      available: true,
      tier: 'estimated',
      qualifier,
      derivation: 'push_fold',
      playersBehind,
      poolStyle,
      frequencies: freqs,
      closeCallHandClasses: closeCalls,
    });
  }

  // Bracket stack depth on [30, 60, 100, 200]
  const clampedStack = Math.max(30, Math.min(200, query.stackDepthBb));
  const isClamped = query.stackDepthBb < 30 || query.stackDepthBb > 200;
  let lowAnchor: PreflopAnchorStackBb = 30;
  let highAnchor: PreflopAnchorStackBb = 30;
  for (let i = 0; i < PREFLOP_ANCHOR_STACKS.length - 1; i += 1) {
    const a = PREFLOP_ANCHOR_STACKS[i]!;
    const b = PREFLOP_ANCHOR_STACKS[i + 1]!;
    if (clampedStack >= a && clampedStack <= b) {
      lowAnchor = a;
      highAnchor = b;
      break;
    }
  }

  const exactAnchor = PREFLOP_ANCHOR_STACKS.includes(clampedStack as PreflopAnchorStackBb);
  const lowRow = buildPreflopAnchorRow({
    playersBehind,
    stackBb: lowAnchor,
    spotClass: query.spotClass,
    openerPlayersBehind: openerBehind,
    limpersCount: query.limpersCount,
  });
  const highRow =
    lowAnchor === highAnchor
      ? lowRow
      : buildPreflopAnchorRow({
          playersBehind,
          stackBb: highAnchor,
          spotClass: query.spotClass,
          openerPlayersBehind: openerBehind,
          limpersCount: query.limpersCount,
        });

  const tStack =
    lowAnchor === highAnchor
      ? 0
      : (Math.log(clampedStack) - Math.log(lowAnchor)) /
        (Math.log(highAnchor) - Math.log(lowAnchor));

  // Pot-odds / MDF sizing shift relative to 2.5 bb open anchor
  const openSize = query.openSizeBb ?? 2.5;
  const mdfAnchor = 1.5 / (1.5 + 2.5);
  const mdfTarget = 1.5 / (1.5 + Math.max(1.5, openSize));
  const sizingShift =
    query.spotClass === 'preflop_facing_open' || query.spotClass === 'preflop_bb_option'
      ? mdfTarget - mdfAnchor
      : 0;

  // Future-ready pool-style adjustment hook (Tweak #2)
  const poolFoldShift =
    poolStyle === 'loose_calling' ? -0.05 : poolStyle === 'tight_passive' ? 0.05 : 0;

  const frequencies: Record<string, PreflopHandActionMix> = {};
  const closeCallHandClasses: string[] = [];

  for (const hc of PREFLOP_HAND_CLASSES) {
    const a = lowRow[hc]!;
    const b = highRow[hc]!;
    let raise = a.raise + tStack * (b.raise - a.raise);
    let call = a.call + tStack * (b.call - a.call);
    let fold = a.fold + tStack * (b.fold - a.fold);

    if (sizingShift !== 0 && fold > 0 && fold < 1) {
      call = Math.max(0, call + sizingShift * 0.8);
      fold = Math.max(0, fold - sizingShift * 0.8);
    }
    if (poolFoldShift !== 0 && fold > 0 && fold < 1) {
      call = Math.max(0, call - poolFoldShift);
      fold = Math.max(0, fold + poolFoldShift);
    }

    const mix = normalizeMix(raise, call, fold);
    frequencies[hc] = mix;
    if (Math.max(mix.raise, mix.call, mix.fold) < 0.7) {
      closeCallHandClasses.push(hc);
    }
  }

  const derivation: MultidimensionalPreflopResult['derivation'] = isClamped
    ? 'clamped'
    : !exactAnchor
      ? 'interpolated'
      : mappedTableSize
        ? 'mapped'
        : 'authored';

  const qualifier = isClamped
    ? `Estimated · clamped to ${clampedStack} bb anchor`
    : !exactAnchor
      ? `Estimated · interpolated ${lowAnchor}-${highAnchor} bb`
      : mappedTableSize
        ? `Estimated · mapped (${playersBehind} seats behind)`
        : 'Estimated · anchor reference';

  return deepFreeze({
    available: true,
    tier: 'estimated',
    qualifier,
    derivation,
    playersBehind,
    poolStyle,
    frequencies,
    closeCallHandClasses,
  });
}
