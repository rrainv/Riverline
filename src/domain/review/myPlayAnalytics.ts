import type { SavedHandRecord } from '../storage';
import { STARTER_FRIDAY_OBJECT_ID, STARTER_SPOT_OBJECT_ID } from './reviewHelpers';

export interface MyPlayPositionRow {
  readonly position: string;
  readonly handsCount: number;
  readonly vpipCount: number;
  readonly vpipPct: number;
  readonly pfrCount: number;
  readonly pfrPct: number;
  readonly threeBetCount: number;
  readonly threeBetPct: number;
  readonly showdownCount: number;
  readonly netBb: number;
  readonly isWatching: boolean;
}

export interface MyPlayReport {
  readonly totalHands: number;
  readonly overallVpipPct: number;
  readonly overallPfrPct: number;
  readonly overallThreeBetPct: number;
  readonly totalNetBb: number;
  readonly isWatching: boolean;
  readonly rows: readonly MyPlayPositionRow[];
}

const POSITION_ORDER = ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;

function pct(num: number, den: number): number {
  if (den <= 0) return 0;
  return Math.round((num / den) * 1000) / 10;
}

function roundTenth(val: number): number {
  return Math.round(val * 10) / 10;
}

export function computeMyPlayReport(records: readonly SavedHandRecord[]): MyPlayReport {
  const realHands = records.filter(
    (r) =>
      !r.archived &&
      r.objectId !== STARTER_FRIDAY_OBJECT_ID &&
      r.objectId !== STARTER_SPOT_OBJECT_ID,
  );

  const byPos = new Map<
    string,
    {
      handsCount: number;
      vpipCount: number;
      pfrCount: number;
      threeBetCount: number;
      showdownCount: number;
      netBb: number;
    }
  >();

  let totalVpip = 0;
  let totalPfr = 0;
  let totalThreeBet = 0;
  let totalNetBb = 0;

  for (const rec of realHands) {
    const pos = rec.payload.heroPositionLabel.toUpperCase();
    const bucket = byPos.get(pos) ?? {
      handsCount: 0,
      vpipCount: 0,
      pfrCount: 0,
      threeBetCount: 0,
      showdownCount: 0,
      netBb: 0,
    };
    bucket.handsCount += 1;

    const state = rec.payload.pokerState;
    const heroId = rec.payload.heroPlayerId;
    const preflopActions = state.actionHistory.filter((a) => a.street === 'preflop');

    let raisesSeenBeforeHero = 0;
    let heroVpip = false;
    let heroPfr = false;
    let heroThreeBet = false;

    for (const act of preflopActions) {
      const type = act.submittedAction.type;
      const isAgg = type === 'raise' || type === 'bet' || type === 'all_in';
      if (act.playerId === heroId) {
        if (type === 'call' || isAgg) {
          heroVpip = true;
        }
        if (isAgg) {
          heroPfr = true;
          if (raisesSeenBeforeHero >= 1) {
            heroThreeBet = true;
          }
        }
      }
      if (isAgg) {
        raisesSeenBeforeHero += 1;
      }
    }

    if (heroVpip) {
      bucket.vpipCount += 1;
      totalVpip += 1;
    }
    if (heroPfr) {
      bucket.pfrCount += 1;
      totalPfr += 1;
    }
    if (heroThreeBet) {
      bucket.threeBetCount += 1;
      totalThreeBet += 1;
    }
    if (state.terminal.reason === 'showdown') {
      bucket.showdownCount += 1;
    }
    if (state.terminal.isTerminal) {
      const heroPlayer = state.players.find((p) => p.playerId === heroId);
      if (heroPlayer) {
        const startBb = heroPlayer.startingStackMilliBb / 1000;
        const endBb = heroPlayer.currentStackMilliBb / 1000;
        const delta = endBb - startBb;
        bucket.netBb += delta;
        totalNetBb += delta;
      }
    }

    byPos.set(pos, bucket);
  }

  const orderedKeys = [
    ...POSITION_ORDER.filter((p) => byPos.has(p)),
    ...[...byPos.keys()].filter((p) => !(POSITION_ORDER as readonly string[]).includes(p)).sort(),
  ];

  const rows: MyPlayPositionRow[] = orderedKeys.map((position) => {
    const b = byPos.get(position)!;
    return {
      position,
      handsCount: b.handsCount,
      vpipCount: b.vpipCount,
      vpipPct: pct(b.vpipCount, b.handsCount),
      pfrCount: b.pfrCount,
      pfrPct: pct(b.pfrCount, b.handsCount),
      threeBetCount: b.threeBetCount,
      threeBetPct: pct(b.threeBetCount, b.handsCount),
      showdownCount: b.showdownCount,
      netBb: roundTenth(b.netBb),
      isWatching: b.handsCount < 20,
    };
  });

  const totalHands = realHands.length;
  return {
    totalHands,
    overallVpipPct: pct(totalVpip, totalHands),
    overallPfrPct: pct(totalPfr, totalHands),
    overallThreeBetPct: pct(totalThreeBet, totalHands),
    totalNetBb: roundTenth(totalNetBb),
    isWatching: totalHands < 20,
    rows,
  };
}
