import { assertCardArray } from '../cards';
import { evaluateSevenScore } from '../evaluator';
import { HOLDEM_COMBOS, HOLDEM_DECK } from '../holdem-combos';
import { computeRiverBestResponse, type RiverBestResponseResult } from './best-response';
import {
  DEFAULT_DCFR_PARAMS,
  type DcfrParams,
  type RiverBetMenu,
  type RiverSubgameSpec,
  type SolverActionKind,
} from './types';

export interface RiverTreeAction {
  readonly label: string;
  readonly kind: SolverActionKind;
  readonly amountBb: number | null;
  readonly nextNodeId: number;
}

export type RiverTreeNode =
  | {
      readonly id: number;
      readonly terminal: true;
      readonly reason: 'fold' | 'showdown';
      readonly folder: 0 | 1 | null;
      readonly invest0: number;
      readonly invest1: number;
    }
  | {
      readonly id: number;
      readonly terminal: false;
      readonly player: 0 | 1;
      readonly invest0: number;
      readonly invest1: number;
      readonly actions: readonly RiverTreeAction[];
    };

export interface RiverComboContext {
  readonly count: number;
  readonly card0: Int32Array;
  readonly card1: Int32Array;
  readonly combo1326Idx: Int32Array;
  readonly combo1326ToLiveIdx: Int32Array;
  readonly scores: Float64Array;
  readonly oopPrior: Float64Array;
  readonly ipPrior: Float64Array;
  readonly handClasses: readonly string[];
  readonly comboIds: readonly string[];
  readonly comboCards: readonly (readonly [string, string])[];
  readonly bucketStarts: Int32Array;
  readonly bucketEnds: Int32Array;
  readonly normalizationZ: number;
}

export interface TerminalScratch {
  readonly cardSum: Float64Array;
  readonly byLiveIdx: Float64Array;
  readonly lowerCard: Float64Array;
  readonly bucketCard: Float64Array;
  readonly bucketByLiveIdx: Float64Array;
}

export function createTerminalScratch(comboCount: number): TerminalScratch {
  return {
    cardSum: new Float64Array(52),
    byLiveIdx: new Float64Array(comboCount),
    lowerCard: new Float64Array(52),
    bucketCard: new Float64Array(52),
    bucketByLiveIdx: new Float64Array(comboCount),
  };
}

export interface RiverSolveInternal {
  readonly spec: RiverSubgameSpec;
  readonly combos: RiverComboContext;
  readonly nodes: readonly RiverTreeNode[];
  readonly avgStrategyByNode: ReadonlyMap<number, Float64Array>;
  readonly oopEvBb: number;
  readonly ipEvBb: number;
}

export interface RiverSolverSession {
  stepIterations(count: number): void;
  getIteration(): number;
  getInternalState(): RiverSolveInternal;
  computeExploitability(): RiverBestResponseResult;
}

const DECK_INDEX = new Map<string, number>(HOLDEM_DECK.map((c, idx) => [c, idx]));
const COMBO_1326_INDEX = new Map<string, number>(HOLDEM_COMBOS.map((c, idx) => [c.id, idx]));

/** Snap solver bet/raise amounts to 0.5 bb increments (Tweak #3). */
export function snapHalfBb(v: number): number {
  return Math.max(0.5, Math.round(v * 2) / 2);
}

export function buildRiverComboContext(spec: RiverSubgameSpec): RiverComboContext {
  assertCardArray(spec.board, 'riverSubgame.board');
  if (spec.board.length !== 5 || new Set(spec.board).size !== 5) {
    throw new RangeError('River subgame requires 5 unique board cards');
  }
  const deadCards = spec.deadCards ?? [];
  if (deadCards.length > 0) {
    assertCardArray(deadCards, 'riverSubgame.deadCards');
  }
  const blockedSet = new Set<string>([...spec.board, ...deadCards]);

  const liveEntries: {
    c0: number;
    c1: number;
    idx1326: number;
    score: number;
    oopW: number;
    ipW: number;
    handClass: string;
    comboId: string;
    cards: readonly [string, string];
  }[] = [];

  for (let i = 0; i < HOLDEM_COMBOS.length; i += 1) {
    const combo = HOLDEM_COMBOS[i]!;
    if (blockedSet.has(combo.cards[0]) || blockedSet.has(combo.cards[1])) continue;
    const oopW = spec.oopRangeByCombo[combo.id] ?? 0;
    const ipW = spec.ipRangeByCombo[combo.id] ?? 0;
    if (oopW <= 0 && ipW <= 0) continue;
    const score = evaluateSevenScore([...combo.cards, ...spec.board]);
    liveEntries.push({
      c0: DECK_INDEX.get(combo.cards[0])!,
      c1: DECK_INDEX.get(combo.cards[1])!,
      idx1326: COMBO_1326_INDEX.get(combo.id)!,
      score,
      oopW: Math.max(0, oopW),
      ipW: Math.max(0, ipW),
      handClass: combo.handClass,
      comboId: combo.id,
      cards: combo.cards,
    });
  }

  liveEntries.sort((a, b) => a.score - b.score);
  const count = liveEntries.length;
  const card0 = new Int32Array(count);
  const card1 = new Int32Array(count);
  const combo1326Idx = new Int32Array(count);
  const combo1326ToLiveIdx = new Int32Array(1326).fill(-1);
  const scores = new Float64Array(count);
  const oopPrior = new Float64Array(count);
  const ipPrior = new Float64Array(count);
  const handClasses: string[] = [];
  const comboIds: string[] = [];
  const comboCards: (readonly [string, string])[] = [];

  for (let i = 0; i < count; i += 1) {
    const e = liveEntries[i]!;
    card0[i] = e.c0;
    card1[i] = e.c1;
    combo1326Idx[i] = e.idx1326;
    combo1326ToLiveIdx[e.idx1326] = i;
    scores[i] = e.score;
    oopPrior[i] = e.oopW;
    ipPrior[i] = e.ipW;
    handClasses.push(e.handClass);
    comboIds.push(e.comboId);
    comboCards.push(e.cards);
  }

  const starts: number[] = [];
  const ends: number[] = [];
  let cursor = 0;
  while (cursor < count) {
    let end = cursor + 1;
    while (end < count && scores[end] === scores[cursor]) end += 1;
    starts.push(cursor);
    ends.push(end);
    cursor = end;
  }

  let z = 0;
  for (let i = 0; i < count; i += 1) {
    if (oopPrior[i]! <= 0) continue;
    const a0 = card0[i]!;
    const a1 = card1[i]!;
    for (let j = 0; j < count; j += 1) {
      if (ipPrior[j]! <= 0) continue;
      const b0 = card0[j]!;
      const b1 = card1[j]!;
      if (a0 === b0 || a0 === b1 || a1 === b0 || a1 === b1) continue;
      z += oopPrior[i]! * ipPrior[j]!;
    }
  }
  if (z <= 0) {
    throw new RangeError('River subgame has zero disjoint OOP vs IP weight');
  }

  return {
    count,
    card0,
    card1,
    combo1326Idx,
    combo1326ToLiveIdx,
    scores,
    oopPrior,
    ipPrior,
    handClasses,
    comboIds,
    comboCards,
    bucketStarts: Int32Array.from(starts),
    bucketEnds: Int32Array.from(ends),
    normalizationZ: z,
  };
}

export function buildRiverTree(
  potBb: number,
  effectiveStackBb: number,
  betMenu: RiverBetMenu,
): RiverTreeNode[] {
  const nodes: RiverTreeNode[] = [];

  function makeTerminal(
    reason: 'fold' | 'showdown',
    folder: 0 | 1 | null,
    invest0: number,
    invest1: number,
  ): number {
    const id = nodes.length;
    nodes.push({ id, terminal: true, reason, folder, invest0, invest1 });
    return id;
  }

  function buildNode(
    player: 0 | 1,
    invest0: number,
    invest1: number,
    raisesUsed: number,
  ): number {
    const id = nodes.length;
    nodes.push({
      id,
      terminal: false,
      player,
      invest0,
      invest1,
      actions: [],
    });

    const actions: RiverTreeAction[] = [];
    const ownInvest = player === 0 ? invest0 : invest1;
    const remaining = Math.max(0, Math.round((effectiveStackBb - ownInvest) * 100) / 100);

    if (Math.abs(invest0 - invest1) < 1e-6) {
      const checkNext =
        player === 0
          ? buildNode(1, invest0, invest1, 0)
          : makeTerminal('showdown', null, invest0, invest1);
      actions.push({ label: 'Check', kind: 'check', amountBb: null, nextNodeId: checkNext });

      if (remaining > 0.05) {
        const potNow = potBb + invest0 + invest1;
        const targets = new Map<number, { kind: SolverActionKind; label: string }>();
        for (const pct of betMenu.betPcts) {
          const snapped = Math.min(remaining, snapHalfBb(potNow * pct));
          const isAllIn = snapped >= remaining - 0.05;
          const betAmt = isAllIn ? remaining : snapped;
          if (!targets.has(betAmt)) {
            targets.set(betAmt, {
              kind: isAllIn ? 'all_in' : 'bet',
              label: isAllIn ? `All-in ${betAmt}` : `Bet ${Math.round(pct * 100)}%`,
            });
          }
        }
        if (betMenu.includeAllIn && !targets.has(remaining)) {
          targets.set(remaining, { kind: 'all_in', label: `All-in ${remaining}` });
        }
        const sortedBets = [...targets.entries()].sort((a, b) => a[0] - b[0]);
        for (const [betAmt, meta] of sortedBets) {
          const next0 = player === 0 ? invest0 + betAmt : invest0;
          const next1 = player === 1 ? invest1 + betAmt : invest1;
          actions.push({
            label: meta.label,
            kind: meta.kind,
            amountBb: betAmt,
            nextNodeId: buildNode(player === 0 ? 1 : 0, next0, next1, 0),
          });
        }
      }
    } else {
      const maxCommit = Math.max(invest0, invest1);
      const diff = Math.round((maxCommit - ownInvest) * 100) / 100;
      const foldNext = makeTerminal('fold', player, invest0, invest1);
      actions.push({ label: 'Fold', kind: 'fold', amountBb: null, nextNodeId: foldNext });

      const callNext = makeTerminal('showdown', null, maxCommit, maxCommit);
      actions.push({ label: 'Call', kind: 'call', amountBb: diff, nextNodeId: callNext });

      if (raisesUsed < betMenu.raiseCap && remaining > diff + 0.05) {
        const potAfterCall = potBb + maxCommit * 2;
        const targets = new Map<number, { kind: SolverActionKind; label: string }>();
        for (const pct of betMenu.raisePcts) {
          const raiseBy = Math.max(diff, snapHalfBb(potAfterCall * pct));
          const snappedTo = snapHalfBb(maxCommit + raiseBy);
          const toCommit = Math.min(effectiveStackBb, snappedTo);
          if (toCommit <= maxCommit + 0.05) continue;
          const isAllIn = toCommit >= effectiveStackBb - 0.05;
          const finalCommit = isAllIn ? effectiveStackBb : toCommit;
          if (!targets.has(finalCommit)) {
            targets.set(finalCommit, {
              kind: isAllIn ? 'all_in' : 'raise',
              label: isAllIn ? `All-in ${finalCommit}` : `Raise ${finalCommit}`,
            });
          }
        }
        if (
          betMenu.includeAllIn &&
          effectiveStackBb > maxCommit + 0.05 &&
          !targets.has(effectiveStackBb)
        ) {
          targets.set(effectiveStackBb, { kind: 'all_in', label: `All-in ${effectiveStackBb}` });
        }
        const sortedRaises = [...targets.entries()].sort((a, b) => a[0] - b[0]);
        for (const [toCommit, meta] of sortedRaises) {
          const next0 = player === 0 ? toCommit : invest0;
          const next1 = player === 1 ? toCommit : invest1;
          actions.push({
            label: meta.label,
            kind: meta.kind,
            amountBb: toCommit,
            nextNodeId: buildNode(player === 0 ? 1 : 0, next0, next1, raisesUsed + 1),
          });
        }
      }
    }

    nodes[id] = {
      id,
      terminal: false,
      player,
      invest0,
      invest1,
      actions,
    };
    return id;
  }

  buildNode(0, 0, 0, 0);
  return nodes;
}

export function evalTerminalCfv(
  node: Extract<RiverTreeNode, { terminal: true }>,
  potBb: number,
  traverser: 0 | 1,
  combos: RiverComboContext,
  oppWeightedReach: Float64Array,
  outCfv: Float64Array,
  scratch?: TerminalScratch,
): void {
  const { count, card0, card1, bucketStarts, bucketEnds } = combos;
  const sc = scratch ?? createTerminalScratch(count);
  const { cardSum, byLiveIdx, lowerCard, bucketCard, bucketByLiveIdx } = sc;

  cardSum.fill(0);
  let totalX = 0;

  for (let j = 0; j < count; j += 1) {
    const x = oppWeightedReach[j]!;
    byLiveIdx[j] = x;
    if (x === 0) continue;
    totalX += x;
    const c0 = card0[j]!;
    const c1 = card1[j]!;
    cardSum[c0] = cardSum[c0]! + x;
    cardSum[c1] = cardSum[c1]! + x;
  }

  if (node.reason === 'fold') {
    const payoff =
      node.folder === 0
        ? traverser === 0
          ? -node.invest0
          : potBb + node.invest0
        : traverser === 0
          ? potBb + node.invest1
          : -node.invest1;
    for (let i = 0; i < count; i += 1) {
      const validOpp = totalX - cardSum[card0[i]!]! - cardSum[card1[i]!]! + byLiveIdx[i]!;
      outCfv[i] = payoff * validOpp;
    }
    return;
  }

  const commit = node.invest0;
  const winPayoff = potBb + commit;
  const tiePayoff = potBb / 2;
  const losePayoff = -commit;

  lowerCard.fill(0);
  let lowerTotal = 0;

  for (let b = 0; b < bucketStarts.length; b += 1) {
    const start = bucketStarts[b]!;
    const end = bucketEnds[b]!;
    let bucketTotal = 0;
    bucketCard.fill(0);

    for (let j = start; j < end; j += 1) {
      const x = oppWeightedReach[j]!;
      bucketByLiveIdx[j] = x;
      if (x === 0) continue;
      bucketTotal += x;
      const c0 = card0[j]!;
      const c1 = card1[j]!;
      bucketCard[c0] = bucketCard[c0]! + x;
      bucketCard[c1] = bucketCard[c1]! + x;
    }

    for (let i = start; i < end; i += 1) {
      const c0 = card0[i]!;
      const c1 = card1[i]!;
      const validOpp = totalX - cardSum[c0]! - cardSum[c1]! + byLiveIdx[i]!;
      const winReach = lowerTotal - lowerCard[c0]! - lowerCard[c1]!;
      const tieReach = bucketTotal - bucketCard[c0]! - bucketCard[c1]! + bucketByLiveIdx[i]!;
      const loseReach = validOpp - winReach - tieReach;
      outCfv[i] = winReach * winPayoff + tieReach * tiePayoff + loseReach * losePayoff;
    }

    if (bucketTotal !== 0) {
      lowerTotal += bucketTotal;
      for (let c = 0; c < 52; c += 1) {
        lowerCard[c] = lowerCard[c]! + bucketCard[c]!;
      }
    }
  }
}

export function createRiverSolverSession(
  spec: RiverSubgameSpec,
  params: DcfrParams = DEFAULT_DCFR_PARAMS,
): RiverSolverSession {
  const combos = buildRiverComboContext(spec);
  const R = combos.count;
  const nodes = buildRiverTree(spec.potBb, spec.effectiveStackBb, spec.betMenu);
  const terminalScratch = createTerminalScratch(R);

  const regretsByNode = new Map<number, Float64Array>();
  const cumStratByNode = new Map<number, Float64Array>();
  const sigmaByNode = new Map<number, Float64Array>();
  const actionCfvsByNode = new Map<number, readonly Float64Array[]>();
  const nextReachByNode = new Map<number, Float64Array>();
  const oppChildCfvByNode = new Map<number, Float64Array>();

  for (const node of nodes) {
    if (!node.terminal) {
      const numActions = node.actions.length;
      const len = numActions * R;
      regretsByNode.set(node.id, new Float64Array(len));
      cumStratByNode.set(node.id, new Float64Array(len));
      sigmaByNode.set(node.id, new Float64Array(len));
      actionCfvsByNode.set(
        node.id,
        Array.from({ length: numActions }, () => new Float64Array(R)),
      );
      nextReachByNode.set(node.id, new Float64Array(R));
      oppChildCfvByNode.set(node.id, new Float64Array(R));
    }
  }

  function currentStrategy(reg: Float64Array, numActions: number, outSigma: Float64Array): void {
    const uniform = 1 / numActions;
    for (let i = 0; i < R; i += 1) {
      let posSum = 0;
      for (let a = 0; a < numActions; a += 1) {
        const v = reg[a * R + i]!;
        if (v > 0) posSum += v;
      }
      if (posSum <= 0) {
        for (let a = 0; a < numActions; a += 1) outSigma[a * R + i] = uniform;
      } else {
        for (let a = 0; a < numActions; a += 1) {
          const v = reg[a * R + i]!;
          outSigma[a * R + i] = v > 0 ? v / posSum : 0;
        }
      }
    }
  }

  function traverse(
    nodeId: number,
    traverser: 0 | 1,
    ownReach: Float64Array,
    oppWeightedReach: Float64Array,
    posDisc: number,
    negDisc: number,
    stratWeight: number,
    outCfv: Float64Array,
  ): void {
    const node = nodes[nodeId]!;
    if (node.terminal) {
      evalTerminalCfv(
        node,
        spec.potBb,
        traverser,
        combos,
        oppWeightedReach,
        outCfv,
        terminalScratch,
      );
      return;
    }

    const numActions = node.actions.length;
    const reg = regretsByNode.get(nodeId)!;
    const cum = cumStratByNode.get(nodeId)!;
    const sigma = sigmaByNode.get(nodeId)!;
    currentStrategy(reg, numActions, sigma);

    if (node.player === traverser) {
      const actionCfvs = actionCfvsByNode.get(nodeId)!;
      const nextOwn = nextReachByNode.get(nodeId)!;
      outCfv.fill(0);
      for (let a = 0; a < numActions; a += 1) {
        for (let i = 0; i < R; i += 1) {
          const s = sigma[a * R + i]!;
          nextOwn[i] = ownReach[i]! * s;
          cum[a * R + i] = cum[a * R + i]! + stratWeight * ownReach[i]! * s;
        }
        const childCfv = actionCfvs[a]!;
        traverse(
          node.actions[a]!.nextNodeId,
          traverser,
          nextOwn,
          oppWeightedReach,
          posDisc,
          negDisc,
          stratWeight,
          childCfv,
        );
        for (let i = 0; i < R; i += 1) {
          outCfv[i] = outCfv[i]! + sigma[a * R + i]! * childCfv[i]!;
        }
      }

      for (let a = 0; a < numActions; a += 1) {
        const childCfv = actionCfvs[a]!;
        const base = a * R;
        for (let i = 0; i < R; i += 1) {
          const prev = reg[base + i]!;
          const discounted = prev >= 0 ? prev * posDisc : prev * negDisc;
          reg[base + i] = discounted + (childCfv[i]! - outCfv[i]!);
        }
      }
    } else {
      outCfv.fill(0);
      const childCfv = oppChildCfvByNode.get(nodeId)!;
      const nextOpp = nextReachByNode.get(nodeId)!;
      for (let a = 0; a < numActions; a += 1) {
        for (let j = 0; j < R; j += 1) {
          nextOpp[j] = oppWeightedReach[j]! * sigma[a * R + j]!;
        }
        traverse(
          node.actions[a]!.nextNodeId,
          traverser,
          ownReach,
          nextOpp,
          posDisc,
          negDisc,
          stratWeight,
          childCfv,
        );
        for (let i = 0; i < R; i += 1) {
          outCfv[i] = outCfv[i]! + childCfv[i]!;
        }
      }
    }
  }

  const rootOnes = new Float64Array(R).fill(1);
  const cfvScratch = new Float64Array(R);
  let iteration = 0;

  function stepIterations(count: number): void {
    for (let k = 0; k < count; k += 1) {
      iteration += 1;
      const t = iteration;
      const posDisc =
        t === 1 ? 1 : Math.pow(t - 1, params.alpha) / (Math.pow(t - 1, params.alpha) + 1);
      const negDisc =
        t === 1
          ? 1
          : params.beta === 0
            ? 0.5
            : Math.pow(t - 1, params.beta) / (Math.pow(t - 1, params.beta) + 1);
      const stratWeight = Math.pow(t / (t + 1), params.gamma);

      // Alternating DCFR updates: OOP first, then IP using updated OOP regrets
      traverse(0, 0, rootOnes, combos.ipPrior, posDisc, negDisc, stratWeight, cfvScratch);
      traverse(0, 1, rootOnes, combos.oopPrior, posDisc, negDisc, stratWeight, cfvScratch);
    }
  }

  function getInternalState(): RiverSolveInternal {
    const avgStrategyByNode = new Map<number, Float64Array>();
    for (const node of nodes) {
      if (node.terminal) continue;
      const numActions = node.actions.length;
      const cum = cumStratByNode.get(node.id)!;
      const avg = new Float64Array(numActions * R);
      const uniform = 1 / numActions;
      for (let i = 0; i < R; i += 1) {
        let sum = 0;
        for (let a = 0; a < numActions; a += 1) sum += cum[a * R + i]!;
        for (let a = 0; a < numActions; a += 1) {
          avg[a * R + i] = sum <= 0 ? uniform : cum[a * R + i]! / sum;
        }
      }
      avgStrategyByNode.set(node.id, avg);
    }

    function evalAvgStrategy(
      nodeId: number,
      traverser: 0 | 1,
      oppWeightedReach: Float64Array,
      outCfv: Float64Array,
    ): void {
      const node = nodes[nodeId]!;
      if (node.terminal) {
        evalTerminalCfv(
          node,
          spec.potBb,
          traverser,
          combos,
          oppWeightedReach,
          outCfv,
          terminalScratch,
        );
        return;
      }
      const avg = avgStrategyByNode.get(nodeId)!;
      const numActions = node.actions.length;
      outCfv.fill(0);
      const childCfv = new Float64Array(R);
      if (node.player === traverser) {
        for (let a = 0; a < numActions; a += 1) {
          evalAvgStrategy(node.actions[a]!.nextNodeId, traverser, oppWeightedReach, childCfv);
          for (let i = 0; i < R; i += 1) {
            outCfv[i] = outCfv[i]! + avg[a * R + i]! * childCfv[i]!;
          }
        }
      } else {
        for (let a = 0; a < numActions; a += 1) {
          const nextOpp = new Float64Array(R);
          for (let j = 0; j < R; j += 1) {
            nextOpp[j] = oppWeightedReach[j]! * avg[a * R + j]!;
          }
          evalAvgStrategy(node.actions[a]!.nextNodeId, traverser, nextOpp, childCfv);
          for (let i = 0; i < R; i += 1) {
            outCfv[i] = outCfv[i]! + childCfv[i]!;
          }
        }
      }
    }

    const oopCfv = new Float64Array(R);
    const ipCfv = new Float64Array(R);
    evalAvgStrategy(0, 0, combos.ipPrior, oopCfv);
    evalAvgStrategy(0, 1, combos.oopPrior, ipCfv);

    let oopTotal = 0;
    let ipTotal = 0;
    for (let i = 0; i < R; i += 1) {
      oopTotal += combos.oopPrior[i]! * oopCfv[i]!;
      ipTotal += combos.ipPrior[i]! * ipCfv[i]!;
    }

    return {
      spec,
      combos,
      nodes,
      avgStrategyByNode,
      oopEvBb: oopTotal / combos.normalizationZ,
      ipEvBb: ipTotal / combos.normalizationZ,
    };
  }

  return {
    stepIterations,
    getIteration: () => iteration,
    getInternalState,
    computeExploitability: () => computeRiverBestResponse(getInternalState()),
  };
}

export function solveRiverSubgame(
  spec: RiverSubgameSpec,
  params: DcfrParams = DEFAULT_DCFR_PARAMS,
): RiverSolveInternal {
  const session = createRiverSolverSession(spec, params);
  session.stepIterations(params.iterations);
  return session.getInternalState();
}

export function expandHandClassesToComboMap(handClasses: readonly string[]): Record<string, number> {
  const want = new Set(handClasses);
  const out: Record<string, number> = {};
  for (const combo of HOLDEM_COMBOS) {
    if (want.has(combo.handClass)) {
      out[combo.id] = 1;
    }
  }
  return out;
}
