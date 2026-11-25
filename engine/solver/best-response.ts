import type { RiverComboContext, RiverSolveInternal, RiverTreeNode } from './river-subgame';

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

    const totalPot = spec.potBb + node.invest0 + node.invest1;
    const rakePct = spec.rakePct ?? 0;
    const rakeCapBb = spec.rakeCapBb ?? 0;
    const rakeBb =
      rakePct > 0 && (node.reason === 'showdown' || node.invest0 > 0 || node.invest1 > 0)
        ? Math.min(totalPot * rakePct, rakeCapBb > 0 ? rakeCapBb : totalPot)
        : 0;

    if (node.reason === 'fold') {
      const payoff =
        node.folder === 0
          ? traverser === 0
            ? -node.invest0
            : spec.potBb + node.invest0 - rakeBb
          : traverser === 0
            ? spec.potBb + node.invest1 - rakeBb
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
    const winPayoff = spec.potBb + commit - rakeBb;
    const tiePayoff = (spec.potBb - rakeBb) / 2;
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
  const exploitabilityBb = Math.max(
    0,
    (oopBestResponseEvBb - solve.oopEvBb + (ipBestResponseEvBb - solve.ipEvBb)) / 2,
  );
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

export interface TurnBestResponseBranchInput {
  readonly weight: number;
  readonly ctx: RiverComboContext;
  readonly riverToTurnIdx: Int32Array;
  readonly riverNodes: readonly RiverTreeNode[];
  readonly riverAvg: ReadonlyMap<number, Float64Array>;
}

export interface TurnBestResponseInput {
  readonly potBb: number;
  readonly rakePct: number;
  readonly rakeCapBb: number;
  readonly turnCount: number;
  readonly oopPrior: Float64Array;
  readonly ipPrior: Float64Array;
  readonly normalizationZ: number;
  readonly oopEvBb: number;
  readonly ipEvBb: number;
  readonly turnNodes: readonly RiverTreeNode[];
  readonly turnAvg: ReadonlyMap<number, Float64Array>;
  readonly baseRivers: readonly {
    readonly weight: number;
    readonly ctx: RiverComboContext;
    readonly riverToTurnIdx: Int32Array;
  }[];
  readonly branchesByLeaf: ReadonlyMap<number, readonly TurnBestResponseBranchInput[]>;
}

function evalPairwiseTerminalOnCtx(
  node: Extract<RiverTreeNode, { terminal: true }>,
  potBb: number,
  rakePct: number,
  rakeCapBb: number,
  traverser: 0 | 1,
  ctx: RiverComboContext,
  oppReach: Float64Array,
  outCfv: Float64Array,
): void {
  const rc = ctx.count;
  const { card0, card1, scores } = ctx;
  const totalPot = potBb + node.invest0 + node.invest1;
  const rakeBb =
    rakePct > 0 && (node.reason === 'showdown' || node.invest0 > 0 || node.invest1 > 0)
      ? Math.min(totalPot * rakePct, rakeCapBb > 0 ? rakeCapBb : totalPot)
      : 0;

  if (node.reason === 'fold') {
    const payoff =
      node.folder === 0
        ? traverser === 0
          ? -node.invest0
          : potBb + node.invest0 - rakeBb
        : traverser === 0
          ? potBb + node.invest1 - rakeBb
          : -node.invest1;
    for (let i = 0; i < rc; i += 1) {
      const a0 = card0[i]!;
      const a1 = card1[i]!;
      let sumOpp = 0;
      for (let j = 0; j < rc; j += 1) {
        const w = oppReach[j]!;
        if (w === 0) continue;
        const b0 = card0[j]!;
        const b1 = card1[j]!;
        if (a0 === b0 || a0 === b1 || a1 === b0 || a1 === b1) continue;
        sumOpp += w;
      }
      outCfv[i] = payoff * sumOpp;
    }
    return;
  }

  const commit = node.invest0;
  const winPayoff = potBb + commit - rakeBb;
  const tiePayoff = (potBb - rakeBb) / 2;
  const losePayoff = -commit;

  for (let i = 0; i < rc; i += 1) {
    const a0 = card0[i]!;
    const a1 = card1[i]!;
    const myScore = scores[i]!;
    let acc = 0;
    for (let j = 0; j < rc; j += 1) {
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
    outCfv[i] = acc;
  }
}

/**
 * Independent 2-street O(R^2) pairwise best-response verifier for Turn->River solves.
 * Shares zero inclusion-exclusion terminal logic with river-subgame.ts or turn-subgame.ts.
 */
export function computeTurnBestResponsePairwise(input: TurnBestResponseInput): RiverBestResponseResult {
  const {
    potBb,
    rakePct,
    rakeCapBb,
    turnCount: R,
    oopPrior,
    ipPrior,
    normalizationZ,
    oopEvBb,
    ipEvBb,
    turnNodes,
    turnAvg,
    baseRivers,
    branchesByLeaf,
  } = input;

  let totalWeight = 0;
  for (const rb of baseRivers) totalWeight += rb.weight;
  const invTotalWeight = totalWeight > 0 ? 1 / totalWeight : 1;

  const riverOppScratch = new Float64Array(R);
  const riverCfvScratch = new Float64Array(R);

  function evalRiverBr(
    rb: TurnBestResponseBranchInput,
    nodeId: number,
    turnCommit: number,
    brPlayer: 0 | 1,
    oppReach: Float64Array,
    outCfv: Float64Array,
  ): void {
    const node = rb.riverNodes[nodeId]!;
    const rc = rb.ctx.count;
    if (node.terminal) {
      evalPairwiseTerminalOnCtx(
        {
          ...node,
          invest0: turnCommit + node.invest0,
          invest1: turnCommit + node.invest1,
        },
        potBb,
        rakePct,
        rakeCapBb,
        brPlayer,
        rb.ctx,
        oppReach,
        outCfv,
      );
      return;
    }
    const nAct = node.actions.length;
    const childCfv = new Float64Array(rc);
    if (node.player === brPlayer) {
      outCfv.fill(Number.NEGATIVE_INFINITY);
      for (let a = 0; a < nAct; a += 1) {
        evalRiverBr(rb, node.actions[a]!.nextNodeId, turnCommit, brPlayer, oppReach, childCfv);
        for (let i = 0; i < rc; i += 1) {
          if (childCfv[i]! > outCfv[i]!) outCfv[i] = childCfv[i]!;
        }
      }
    } else {
      const avg = rb.riverAvg.get(nodeId)!;
      outCfv.fill(0);
      for (let a = 0; a < nAct; a += 1) {
        const nextOpp = new Float64Array(rc);
        for (let j = 0; j < rc; j += 1) nextOpp[j] = oppReach[j]! * avg[a * rc + j]!;
        evalRiverBr(rb, node.actions[a]!.nextNodeId, turnCommit, brPlayer, nextOpp, childCfv);
        for (let i = 0; i < rc; i += 1) outCfv[i] = outCfv[i]! + childCfv[i]!;
      }
    }
  }

  function evalTurnBr(
    nodeId: number,
    brPlayer: 0 | 1,
    oppReach: Float64Array,
    outCfv: Float64Array,
  ): void {
    const node = turnNodes[nodeId]!;
    if (node.terminal) {
      outCfv.fill(0);
      if (node.reason === 'fold') {
        for (const rb of baseRivers) {
          const rc = rb.ctx.count;
          for (let j = 0; j < rc; j += 1) riverOppScratch[j] = oppReach[rb.riverToTurnIdx[j]!]!;
          evalPairwiseTerminalOnCtx(
            node,
            potBb,
            rakePct,
            rakeCapBb,
            brPlayer,
            rb.ctx,
            riverOppScratch.subarray(0, rc),
            riverCfvScratch.subarray(0, rc),
          );
          for (let j = 0; j < rc; j += 1) {
            const ti = rb.riverToTurnIdx[j]!;
            outCfv[ti] = outCfv[ti]! + rb.weight * riverCfvScratch[j]!;
          }
        }
        for (let i = 0; i < R; i += 1) outCfv[i] = outCfv[i]! * invTotalWeight;
        return;
      }
      const branches = branchesByLeaf.get(node.id)!;
      const turnCommit = node.invest0;
      for (const rb of branches) {
        const rc = rb.ctx.count;
        for (let j = 0; j < rc; j += 1) riverOppScratch[j] = oppReach[rb.riverToTurnIdx[j]!]!;
        evalRiverBr(rb, 0, turnCommit, brPlayer, riverOppScratch.subarray(0, rc), riverCfvScratch.subarray(0, rc));
        for (let j = 0; j < rc; j += 1) {
          const ti = rb.riverToTurnIdx[j]!;
          outCfv[ti] = outCfv[ti]! + rb.weight * riverCfvScratch[j]!;
        }
      }
      for (let i = 0; i < R; i += 1) outCfv[i] = outCfv[i]! * invTotalWeight;
      return;
    }

    const nAct = node.actions.length;
    const childCfv = new Float64Array(R);
    if (node.player === brPlayer) {
      outCfv.fill(Number.NEGATIVE_INFINITY);
      for (let a = 0; a < nAct; a += 1) {
        evalTurnBr(node.actions[a]!.nextNodeId, brPlayer, oppReach, childCfv);
        for (let i = 0; i < R; i += 1) {
          if (childCfv[i]! > outCfv[i]!) outCfv[i] = childCfv[i]!;
        }
      }
    } else {
      const avg = turnAvg.get(nodeId)!;
      outCfv.fill(0);
      for (let a = 0; a < nAct; a += 1) {
        const nextOpp = new Float64Array(R);
        for (let j = 0; j < R; j += 1) nextOpp[j] = oppReach[j]! * avg[a * R + j]!;
        evalTurnBr(node.actions[a]!.nextNodeId, brPlayer, nextOpp, childCfv);
        for (let i = 0; i < R; i += 1) outCfv[i] = outCfv[i]! + childCfv[i]!;
      }
    }
  }

  const oopBrCfv = new Float64Array(R);
  const ipBrCfv = new Float64Array(R);
  evalTurnBr(0, 0, ipPrior, oopBrCfv);
  evalTurnBr(0, 1, oopPrior, ipBrCfv);

  let oopBrSum = 0;
  let ipBrSum = 0;
  for (let i = 0; i < R; i += 1) {
    oopBrSum += oopPrior[i]! * oopBrCfv[i]!;
    ipBrSum += ipPrior[i]! * ipBrCfv[i]!;
  }

  const oopBestResponseEvBb = oopBrSum / normalizationZ;
  const ipBestResponseEvBb = ipBrSum / normalizationZ;
  const exploitabilityBb = Math.max(
    0,
    (oopBestResponseEvBb - oopEvBb + (ipBestResponseEvBb - ipEvBb)) / 2,
  );
  const exploitabilityPctPot = (exploitabilityBb / potBb) * 100;

  return {
    oopEvBb,
    ipEvBb,
    oopBestResponseEvBb,
    ipBestResponseEvBb,
    exploitabilityBb,
    exploitabilityPctPot,
  };
}
