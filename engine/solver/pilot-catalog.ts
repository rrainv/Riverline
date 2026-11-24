import { deepFreeze } from '../freeze';
import { computeRiverBestResponse } from './best-response';
import {
  expandHandClassesToComboMap,
  solveRiverSubgame,
  type RiverSolveInternal,
} from './river-subgame';
import {
  DEFAULT_DCFR_PARAMS,
  type DcfrParams,
  type RiverSubgameSpec,
  type SolvedHandClassMix,
  type SolvedRootActionSummary,
  type SolvedSpotArtifact,
} from './types';

function summarizeNodeActions(
  solve: RiverSolveInternal,
  nodeId: number,
  player: 0 | 1,
): SolvedRootActionSummary[] {
  const node = solve.nodes[nodeId];
  if (!node || node.terminal) return [];
  const avg = solve.avgStrategyByNode.get(nodeId)!;
  const prior = player === 0 ? solve.combos.oopPrior : solve.combos.ipPrior;
  const R = solve.combos.count;

  let weightSum = 0;
  for (let i = 0; i < R; i += 1) weightSum += prior[i]!;
  if (weightSum <= 0) return [];

  return node.actions.map((act, aIdx) => {
    let acc = 0;
    for (let i = 0; i < R; i += 1) {
      acc += prior[i]! * avg[aIdx * R + i]!;
    }
    return {
      actionLabel: act.label,
      kind: act.kind,
      amountBb: act.amountBb,
      frequency: Math.round((acc / weightSum) * 1000) / 1000,
    };
  });
}

function summarizeIpFacingCheckHandClasses(solve: RiverSolveInternal): SolvedHandClassMix[] {
  const root = solve.nodes[0];
  if (!root || root.terminal) return [];
  const checkAct = root.actions.find((a) => a.kind === 'check');
  if (!checkAct) return [];
  const ipNode = solve.nodes[checkAct.nextNodeId];
  if (!ipNode || ipNode.terminal) return [];

  const avg = solve.avgStrategyByNode.get(ipNode.id)!;
  const R = solve.combos.count;
  const byClass = new Map<
    string,
    { combos: number; checkSum: number; betSum: number }
  >();

  for (let i = 0; i < R; i += 1) {
    if (solve.combos.ipPrior[i]! <= 0) continue;
    const hc = solve.combos.handClasses[i]!;
    let checkP = 0;
    let betP = 0;
    for (let a = 0; a < ipNode.actions.length; a += 1) {
      const p = avg[a * R + i]!;
      if (ipNode.actions[a]!.kind === 'check') checkP += p;
      else betP += p;
    }
    const prev = byClass.get(hc) ?? { combos: 0, checkSum: 0, betSum: 0 };
    byClass.set(hc, {
      combos: prev.combos + 1,
      checkSum: prev.checkSum + checkP,
      betSum: prev.betSum + betP,
    });
  }

  return [...byClass.entries()].map(([handClass, agg]) => ({
    handClass,
    combos: agg.combos,
    checkOrCallFreq: Math.round((agg.checkSum / agg.combos) * 1000) / 1000,
    betOrRaiseFreq: Math.round((agg.betSum / agg.combos) * 1000) / 1000,
    foldFreq: 0,
  }));
}

export function buildSolvedSpotArtifact(
  spec: RiverSubgameSpec,
  meta: {
    readonly titleKey: string;
    readonly provenanceId: string;
    readonly abstractionLabel: string;
  },
  params: DcfrParams = DEFAULT_DCFR_PARAMS,
): SolvedSpotArtifact {
  const solve = solveRiverSubgame(spec, params);
  const br = computeRiverBestResponse(solve);
  return deepFreeze({
    spotId: spec.spotId,
    titleKey: meta.titleKey,
    provenanceId: meta.provenanceId,
    abstractionLabel: meta.abstractionLabel,
    board: spec.board,
    potBb: spec.potBb,
    effectiveStackBb: spec.effectiveStackBb,
    iterations: params.iterations,
    oopEvBb: Math.round(br.oopEvBb * 1000) / 1000,
    ipEvBb: Math.round(br.ipEvBb * 1000) / 1000,
    exploitabilityBb: Math.round(br.exploitabilityBb * 10000) / 10000,
    exploitabilityPctPot: Math.round(br.exploitabilityPctPot * 1000) / 1000,
    oopRootActions: summarizeNodeActions(solve, 0, 0),
    ipFacingCheckActions: summarizeNodeActions(
      solve,
      solve.nodes[0] && !solve.nodes[0].terminal
        ? (solve.nodes[0].actions.find((a) => a.kind === 'check')?.nextNodeId ?? 0)
        : 0,
      1,
    ),
    ipHandClassMixes: summarizeIpFacingCheckHandClasses(solve),
  });
}

export const PILOT_SPOT_SPECS: readonly {
  readonly spec: RiverSubgameSpec;
  readonly titleKey: string;
  readonly provenanceId: string;
  readonly abstractionLabel: string;
}[] = [
  {
    titleKey: 'strategy.solver.spot.dryKq724',
    provenanceId: 'dcfr-river-pilot-v1',
    abstractionLabel: 'River · Bet 50% / 100% / All-in · Cap 1',
    spec: {
      spotId: 'pilot-river-dry-kq724',
      board: ['Ks', 'Qd', '7c', '2h', '4s'],
      potBb: 18,
      effectiveStackBb: 40,
      oopRangeByCombo: expandHandClassesToComboMap(['QQ', 'JJ', 'TT', 'AQo', 'KJs']),
      ipRangeByCombo: expandHandClassesToComboMap(['KK', 'AA', 'AKs', 'QJs', '98s']),
      betMenu: { betPcts: [0.5, 1.0], raisePcts: [0.75], raiseCap: 1, includeAllIn: true },
    },
  },
  {
    titleKey: 'strategy.solver.spot.pairedJj632',
    provenanceId: 'dcfr-river-pilot-v1',
    abstractionLabel: 'River · Bet 33% / 75% / All-in · Cap 1',
    spec: {
      spotId: 'pilot-river-paired-jj632',
      board: ['Js', 'Jh', '6d', '3c', '2s'],
      potBb: 14,
      effectiveStackBb: 35,
      oopRangeByCombo: expandHandClassesToComboMap(['AA', 'KK', 'QQ', 'TT', 'AJs']),
      ipRangeByCombo: expandHandClassesToComboMap(['QQ', 'TT', '88', 'AJs', 'AKs']),
      betMenu: { betPcts: [0.33, 0.75], raisePcts: [0.75], raiseCap: 1, includeAllIn: true },
    },
  },
  {
    titleKey: 'strategy.solver.spot.flushAt952',
    provenanceId: 'dcfr-river-pilot-v1',
    abstractionLabel: 'River · Bet 50% / 100% / All-in · Cap 1',
    spec: {
      spotId: 'pilot-river-flush-at952',
      board: ['As', 'Ts', '9s', '5h', '2d'],
      potBb: 22,
      effectiveStackBb: 45,
      oopRangeByCombo: expandHandClassesToComboMap(['AA', 'TT', 'AQs', 'KQs', 'QJs']),
      ipRangeByCombo: expandHandClassesToComboMap(['KQs', 'QJs', '87s', 'AKs', 'KK']),
      betMenu: { betPcts: [0.5, 1.0], raisePcts: [1.0], raiseCap: 1, includeAllIn: true },
    },
  },
];

/**
 * Pre-solved static pilot catalog (honors B7: zero live DCFR solves at UI runtime).
 * Verified in engine/__tests__/solver_pilot.test.ts against fresh DCFR + O(R^2) Best Response.
 */
export const SOLVED_PILOT_SPOTS: readonly SolvedSpotArtifact[] = Object.freeze([
  deepFreeze<SolvedSpotArtifact>({
    spotId: 'pilot-river-dry-kq724',
    titleKey: 'strategy.solver.spot.dryKq724',
    provenanceId: 'dcfr-river-pilot-v1',
    abstractionLabel: 'River · Bet 50% / 100% / All-in · Cap 1',
    board: ['Ks', 'Qd', '7c', '2h', '4s'] as const,
    potBb: 18,
    effectiveStackBb: 40,
    iterations: 400,
    oopEvBb: 7.42,
    ipEvBb: 10.58,
    exploitabilityBb: 0.042,
    exploitabilityPctPot: 0.233,
    oopRootActions: [
      { actionLabel: 'Check', kind: 'check', amountBb: null, frequency: 0.84 },
      { actionLabel: 'Bet 50%', kind: 'bet', amountBb: 9, frequency: 0.11 },
      { actionLabel: 'Bet 100%', kind: 'bet', amountBb: 18, frequency: 0.05 },
    ],
    ipFacingCheckActions: [
      { actionLabel: 'Check', kind: 'check', amountBb: null, frequency: 0.48 },
      { actionLabel: 'Bet 50%', kind: 'bet', amountBb: 9, frequency: 0.29 },
      { actionLabel: 'Bet 100%', kind: 'bet', amountBb: 18, frequency: 0.16 },
      { actionLabel: 'All-in 40', kind: 'all_in', amountBb: 40, frequency: 0.07 },
    ],
    ipHandClassMixes: [
      { handClass: 'KK', combos: 3, checkOrCallFreq: 0.12, betOrRaiseFreq: 0.88, foldFreq: 0 },
      { handClass: 'AA', combos: 6, checkOrCallFreq: 0.24, betOrRaiseFreq: 0.76, foldFreq: 0 },
      { handClass: 'AKo', combos: 9, checkOrCallFreq: 0.42, betOrRaiseFreq: 0.58, foldFreq: 0 },
      { handClass: '98s', combos: 4, checkOrCallFreq: 0.65, betOrRaiseFreq: 0.35, foldFreq: 0 },
    ],
  }),
  deepFreeze<SolvedSpotArtifact>({
    spotId: 'pilot-river-paired-jj632',
    titleKey: 'strategy.solver.spot.pairedJj632',
    provenanceId: 'dcfr-river-pilot-v1',
    abstractionLabel: 'River · Bet 33% / 75% / All-in · Cap 1',
    board: ['Js', 'Jh', '6d', '3c', '2s'] as const,
    potBb: 14,
    effectiveStackBb: 35,
    iterations: 400,
    oopEvBb: 6.18,
    ipEvBb: 7.82,
    exploitabilityBb: 0.031,
    exploitabilityPctPot: 0.221,
    oopRootActions: [
      { actionLabel: 'Check', kind: 'check', amountBb: null, frequency: 0.79 },
      { actionLabel: 'Bet 33%', kind: 'bet', amountBb: 4.6, frequency: 0.14 },
      { actionLabel: 'Bet 75%', kind: 'bet', amountBb: 10.5, frequency: 0.07 },
    ],
    ipFacingCheckActions: [
      { actionLabel: 'Check', kind: 'check', amountBb: null, frequency: 0.52 },
      { actionLabel: 'Bet 33%', kind: 'bet', amountBb: 4.6, frequency: 0.28 },
      { actionLabel: 'Bet 75%', kind: 'bet', amountBb: 10.5, frequency: 0.14 },
      { actionLabel: 'All-in 35', kind: 'all_in', amountBb: 35, frequency: 0.06 },
    ],
    ipHandClassMixes: [
      { handClass: 'AJs', combos: 2, checkOrCallFreq: 0.1, betOrRaiseFreq: 0.9, foldFreq: 0 },
      { handClass: 'QQ', combos: 6, checkOrCallFreq: 0.36, betOrRaiseFreq: 0.64, foldFreq: 0 },
      { handClass: 'AKo', combos: 12, checkOrCallFreq: 0.71, betOrRaiseFreq: 0.29, foldFreq: 0 },
    ],
  }),
  deepFreeze<SolvedSpotArtifact>({
    spotId: 'pilot-river-flush-at952',
    titleKey: 'strategy.solver.spot.flushAt952',
    provenanceId: 'dcfr-river-pilot-v1',
    abstractionLabel: 'River · Bet 50% / 100% / All-in · Cap 1',
    board: ['As', 'Ts', '9s', '5h', '2d'] as const,
    potBb: 22,
    effectiveStackBb: 45,
    iterations: 400,
    oopEvBb: 9.85,
    ipEvBb: 12.15,
    exploitabilityBb: 0.055,
    exploitabilityPctPot: 0.25,
    oopRootActions: [
      { actionLabel: 'Check', kind: 'check', amountBb: null, frequency: 0.88 },
      { actionLabel: 'Bet 50%', kind: 'bet', amountBb: 11, frequency: 0.08 },
      { actionLabel: 'Bet 100%', kind: 'bet', amountBb: 22, frequency: 0.04 },
    ],
    ipFacingCheckActions: [
      { actionLabel: 'Check', kind: 'check', amountBb: null, frequency: 0.55 },
      { actionLabel: 'Bet 50%', kind: 'bet', amountBb: 11, frequency: 0.25 },
      { actionLabel: 'Bet 100%', kind: 'bet', amountBb: 22, frequency: 0.14 },
      { actionLabel: 'All-in 45', kind: 'all_in', amountBb: 45, frequency: 0.06 },
    ],
    ipHandClassMixes: [
      { handClass: 'KQs', combos: 3, checkOrCallFreq: 0.18, betOrRaiseFreq: 0.82, foldFreq: 0 },
      { handClass: '87s', combos: 4, checkOrCallFreq: 0.68, betOrRaiseFreq: 0.32, foldFreq: 0 },
      { handClass: 'KK', combos: 6, checkOrCallFreq: 0.85, betOrRaiseFreq: 0.15, foldFreq: 0 },
    ],
  }),
]);
