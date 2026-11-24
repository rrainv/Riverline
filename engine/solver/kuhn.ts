/**
 * Clean-room Kuhn Poker DCFR (alpha=1.5, beta=0, gamma=2) from Brown & Sandholm (2019).
 * Used exclusively to verify DCFR convergence against the exact -1/18 game value.
 */

export interface KuhnSolveResult {
  readonly p0Value: number;
  readonly p1Value: number;
  readonly exploitability: number;
  readonly strategyByInfoSet: Readonly<Record<string, readonly [number, number]>>;
}

const KUHN_INFOSETS = [
  '0:', '1:', '2:', // P0 root: [pass, bet]
  '0:p', '1:p', '2:p', // P1 facing check: [pass, bet]
  '0:b', '1:b', '2:b', // P1 facing bet: [fold, call]
  '0:pb', '1:pb', '2:pb', // P0 facing check-bet: [fold, call]
] as const;

type KuhnInfoSet = (typeof KUHN_INFOSETS)[number];

function regretMatch2(r0: number, r1: number): [number, number] {
  const p0 = r0 > 0 ? r0 : 0;
  const p1 = r1 > 0 ? r1 : 0;
  const sum = p0 + p1;
  if (sum <= 0) return [0.5, 0.5];
  return [p0 / sum, p1 / sum];
}

function terminalUtilityP0(history: string, c0: number, c1: number): number {
  if (history === 'pp') return c0 > c1 ? 1 : -1;
  if (history === 'pbp') return -1;
  if (history === 'bp') return 1;
  if (history === 'bb' || history === 'pbb') return c0 > c1 ? 2 : -2;
  throw new Error(`Invalid Kuhn terminal history: ${history}`);
}

export function solveKuhnDcfr(iterations = 1500): KuhnSolveResult {
  const regrets: Record<string, [number, number]> = {};
  const cumStrat: Record<string, [number, number]> = {};
  for (const key of KUHN_INFOSETS) {
    regrets[key] = [0, 0];
    cumStrat[key] = [0, 0];
  }

  function cfr(
    history: string,
    c0: number,
    c1: number,
    p0Reach: number,
    p1Reach: number,
    t: number,
    posDisc: number,
    negDisc: number,
    stratWeight: number,
  ): number {
    if (
      history === 'pp' ||
      history === 'pbp' ||
      history === 'bp' ||
      history === 'bb' ||
      history === 'pbb'
    ) {
      return terminalUtilityP0(history, c0, c1);
    }

    const player = history.length % 2;
    const card = player === 0 ? c0 : c1;
    const infoSet = `${card}:${history}` as KuhnInfoSet;
    const r = regrets[infoSet]!;
    const [s0, s1] = regretMatch2(r[0], r[1]);

    const nextHist0 = history + (history === '' || history === 'p' ? 'p' : 'p');
    const nextHist1 = history + 'b';
    const act0 = history === '' || history === 'p' ? 'p' : 'p';
    const act1 = 'b';
    void act0;
    void act1;

    const u0 =
      player === 0
        ? cfr(nextHist0, c0, c1, p0Reach * s0, p1Reach, t, posDisc, negDisc, stratWeight)
        : cfr(nextHist0, c0, c1, p0Reach, p1Reach * s0, t, posDisc, negDisc, stratWeight);
    const u1 =
      player === 0
        ? cfr(nextHist1, c0, c1, p0Reach * s1, p1Reach, t, posDisc, negDisc, stratWeight)
        : cfr(nextHist1, c0, c1, p0Reach, p1Reach * s1, t, posDisc, negDisc, stratWeight);

    const nodeUtil = s0 * u0 + s1 * u1;
    const oppReach = player === 0 ? p1Reach : p0Reach;
    const ownReach = player === 0 ? p0Reach : p1Reach;
    const sign = player === 0 ? 1 : -1;

    const reg0 = sign * (u0 - nodeUtil) * oppReach;
    const reg1 = sign * (u1 - nodeUtil) * oppReach;

    r[0] = (r[0] >= 0 ? r[0] * posDisc : r[0] * negDisc) + reg0;
    r[1] = (r[1] >= 0 ? r[1] * posDisc : r[1] * negDisc) + reg1;

    const cs = cumStrat[infoSet]!;
    cs[0] += stratWeight * ownReach * s0;
    cs[1] += stratWeight * ownReach * s1;

    return nodeUtil;
  }

  for (let t = 1; t <= iterations; t += 1) {
    const posDisc = t === 1 ? 1 : Math.pow(t - 1, 1.5) / (Math.pow(t - 1, 1.5) + 1);
    const negDisc = t === 1 ? 1 : 0.5;
    const stratWeight = Math.pow(t / (t + 1), 2);
    for (let c0 = 0; c0 < 3; c0 += 1) {
      for (let c1 = 0; c1 < 3; c1 += 1) {
        if (c0 === c1) continue;
        cfr('', c0, c1, 1 / 6, 1 / 6, t, posDisc, negDisc, stratWeight);
      }
    }
  }

  const strategyByInfoSet: Record<string, [number, number]> = {};
  for (const key of KUHN_INFOSETS) {
    const [a0, a1] = cumStrat[key]!;
    const sum = a0 + a1;
    strategyByInfoSet[key] = sum > 0 ? [a0 / sum, a1 / sum] : [0.5, 0.5];
  }

  const p0Value = evaluateKuhnStrategyValue(strategyByInfoSet);
  const exploitability = computeKuhnExploitability(strategyByInfoSet);
  return {
    p0Value,
    p1Value: -p0Value,
    exploitability,
    strategyByInfoSet,
  };
}

function evaluateKuhnStrategyValue(
  strat: Readonly<Record<string, readonly [number, number]>>,
): number {
  function evalNode(history: string, c0: number, c1: number): number {
    if (
      history === 'pp' ||
      history === 'pbp' ||
      history === 'bp' ||
      history === 'bb' ||
      history === 'pbb'
    ) {
      return terminalUtilityP0(history, c0, c1);
    }
    const player = history.length % 2;
    const card = player === 0 ? c0 : c1;
    const [s0, s1] = strat[`${card}:${history}`]!;
    return s0 * evalNode(`${history}p`, c0, c1) + s1 * evalNode(`${history}b`, c0, c1);
  }

  let total = 0;
  for (let c0 = 0; c0 < 3; c0 += 1) {
    for (let c1 = 0; c1 < 3; c1 += 1) {
      if (c0 === c1) continue;
      total += evalNode('', c0, c1) / 6;
    }
  }
  return total;
}

export function computeKuhnExploitability(
  strat: Readonly<Record<string, readonly [number, number]>>,
): number {
  function brP0(c0: number): number {
    let evP = 0;
    let evB = 0;
    let evPB_fold = 0;
    let evPB_call = 0;
    for (let c1 = 0; c1 < 3; c1 += 1) {
      if (c0 === c1) continue;
      const [p1_pp, p1_pb] = strat[`${c1}:p`]!;
      evP += 0.5 * p1_pp * terminalUtilityP0('pp', c0, c1);
      evPB_fold += 0.5 * p1_pb * terminalUtilityP0('pbp', c0, c1);
      evPB_call += 0.5 * p1_pb * terminalUtilityP0('pbb', c0, c1);

      const [p1_bf, p1_bc] = strat[`${c1}:b`]!;
      evB +=
        0.5 *
        (p1_bf * terminalUtilityP0('bp', c0, c1) + p1_bc * terminalUtilityP0('bb', c0, c1));
    }
    return Math.max(evP + Math.max(evPB_fold, evPB_call), evB);
  }

  function brP1(c1: number): number {
    let evP_check = 0;
    let evP_bet = 0;
    let evB_fold = 0;
    let evB_call = 0;
    for (let c0 = 0; c0 < 3; c0 += 1) {
      if (c0 === c1) continue;
      const [p0_p, p0_b] = strat[`${c0}:`]!;
      const [p0_pf, p0_pc] = strat[`${c0}:pb`]!;
      evP_check += 0.5 * p0_p * -terminalUtilityP0('pp', c0, c1);
      evP_bet +=
        0.5 *
        p0_p *
        (p0_pf * -terminalUtilityP0('pbp', c0, c1) + p0_pc * -terminalUtilityP0('pbb', c0, c1));
      evB_fold += 0.5 * p0_b * -terminalUtilityP0('bp', c0, c1);
      evB_call += 0.5 * p0_b * -terminalUtilityP0('bb', c0, c1);
    }
    return Math.max(evP_check, evP_bet) + Math.max(evB_fold, evB_call);
  }

  let br0 = 0;
  let br1 = 0;
  for (let c = 0; c < 3; c += 1) {
    br0 += brP0(c) / 3;
    br1 += brP1(c) / 3;
  }
  return Math.max(0, (br0 + br1) / 2);
}
