import type { RiverSolveInternal } from './river-subgame';

export interface RiverBestResponseResult {
  readonly oopEvBb: number;
  readonly ipEvBb: number;
  readonly oopBestResponseEvBb: number;
  readonly ipBestResponseEvBb: number;
  readonly exploitabilityBb: number;
  readonly exploitabilityPctPot: number;
}

/**
 * Independent O(R^2) explicit-pairwise best-response verifier.
 * Shares zero inclusion-exclusion terminal logic with river-subgame.ts.
 */
export function computeRiverBestResponse(solve: RiverSolveInternal): RiverBestResponseResult {
  const { spec, combos, nodes, avgStrategyByNode } = solve;
  const R = combos.count;
  const { card0, card1, scores, oopPrior, ipPrior, normalizationZ } = combos;

  function evalPairwiseTerminal(
    nodeId: number,
    traverser: 0 | 1,
    oppReach: Float64Array,
  ): Float64Array {
    const node = nodes[nodeId]!;
    if (!node.terminal) throw new Error('Expected terminal node');
    const cfv = new Float64Array(R);

    if (node.reason === 'fold') {
      const payoff =
        node.folder === 0
          ? traverser === 0
            ? -node.invest0
            : spec.potBb + node.invest0
          : traverser === 0
            ? spec.potBb + node.invest1
            : -node.invest1;
      for (let i = 0; i < R; i += 1) {
        const a0 = card0[i]!;
        const a1 = card1[i]!;
        let sumOpp = 0;
        for (let j = 0; j < R; j += 1) {
          const w = oppReach[j]!;
          if (w === 0) continue;
          const b0 = card0[j]!;
          const b1 = card1[j]!;
          if (a0 === b0 || a0 === b1 || a1 === b0 || a1 === b1) continue;
          sumOpp += w;
        }
        cfv[i] = payoff * sumOpp;
      }
      return cfv;
    }

    const commit = node.invest0;
    const winPayoff = spec.potBb + commit;
    const tiePayoff = spec.potBb / 2;
    const losePayoff = -commit;

    for (let i = 0; i < R; i += 1) {
      const a0 = card0[i]!;
      const a1 = card1[i]!;
      const myScore = scores[i]!;
      let acc = 0;
      for (let j = 0; j < R; j += 1) {
        const w = oppReach[j]!;
        if (w === 0) continue;
        const b0 = card0[j]!;
        const b1 = card1[j]!;
        if (a0 === b0 || a0 === b1 || a1 === b0 || a1 === b1) continue;
        const oppScore = scores[j]!;
        if (myScore > oppScore) acc += w * winPayoff;
        else if (myScore < oppScore) acc += w * losePayoff;
        else acc += w * tiePayoff;
      }
      cfv[i] = acc;
    }
    return cfv;
  }

  function bestResponseCfv(nodeId: number, brPlayer: 0 | 1, oppReach: Float64Array): Float64Array {
    const node = nodes[nodeId]!;
    if (node.terminal) {
      return evalPairwiseTerminal(nodeId, brPlayer, oppReach);
    }

    const numActions = node.actions.length;
    if (node.player === brPlayer) {
      const best = new Float64Array(R);
      best.fill(Number.NEGATIVE_INFINITY);
      for (let a = 0; a < numActions; a += 1) {
        const child = bestResponseCfv(node.actions[a]!.nextNodeId, brPlayer, oppReach);
        for (let i = 0; i < R; i += 1) {
          if (child[i]! > best[i]!) best[i] = child[i]!;
        }
      }
      return best;
    }

    const avg = avgStrategyByNode.get(nodeId)!;
    const out = new Float64Array(R);
    for (let a = 0; a < numActions; a += 1) {
      const nextOpp = new Float64Array(R);
      for (let j = 0; j < R; j += 1) {
        nextOpp[j] = oppReach[j]! * avg[a * R + j]!;
      }
      const child = bestResponseCfv(node.actions[a]!.nextNodeId, brPlayer, nextOpp);
      for (let i = 0; i < R; i += 1) {
        out[i] = out[i]! + child[i]!;
      }
    }
    return out;
  }

  const oopBrCfv = bestResponseCfv(0, 0, ipPrior);
  const ipBrCfv = bestResponseCfv(0, 1, oopPrior);

  let oopBrSum = 0;
  let ipBrSum = 0;
  for (let i = 0; i < R; i += 1) {
    oopBrSum += oopPrior[i]! * oopBrCfv[i]!;
    ipBrSum += ipPrior[i]! * ipBrCfv[i]!;
  }

  const oopBestResponseEvBb = oopBrSum / normalizationZ;
  const ipBestResponseEvBb = ipBrSum / normalizationZ;
  const exploitabilityBb = Math.max(0, (oopBestResponseEvBb + ipBestResponseEvBb - spec.potBb) / 2);
  const exploitabilityPctPot = (exploitabilityBb / spec.potBb) * 100;

  return {
    oopEvBb: solve.oopEvBb,
    ipEvBb: solve.ipEvBb,
    oopBestResponseEvBb,
    ipBestResponseEvBb,
    exploitabilityBb,
    exploitabilityPctPot,
  };
}
