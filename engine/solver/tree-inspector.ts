import { createTerminalScratch, evalTerminalCfv, type RiverSolveInternal } from './river-subgame';
import type {
  SolvedActionOption,
  SolvedComboDetail,
  SolvedMatrixCell,
  SolvedNodeInspection,
} from './types';

function findPathToNode(
  solve: RiverSolveInternal,
  targetNodeId: number,
): readonly { nodeId: number; actionIndex: number }[] {
  const path: { nodeId: number; actionIndex: number }[] = [];
  function dfs(curId: number): boolean {
    if (curId === targetNodeId) return true;
    const node = solve.nodes[curId];
    if (!node || node.terminal) return false;
    for (let a = 0; a < node.actions.length; a += 1) {
      path.push({ nodeId: curId, actionIndex: a });
      if (dfs(node.actions[a]!.nextNodeId)) return true;
      path.pop();
    }
    return false;
  }
  dfs(0);
  return path;
}

/**
 * Inspects any decision node in a solved River subgame:
 * - Action frequencies for the acting player
 * - 13x13 hand-class matrix with EV & close-call flags (Tweak #6)
 * - Per-combo suit-blocker frequencies & EVs
 */
export function inspectRiverNode(
  solve: RiverSolveInternal,
  nodeId: number,
): SolvedNodeInspection {
  const node = solve.nodes[nodeId];
  if (!node || node.terminal) {
    throw new RangeError(`Cannot inspect non-decision node ${nodeId}`);
  }

  const { combos, nodes, avgStrategyByNode, spec } = solve;
  const R = combos.count;
  const actor = node.player;
  const ownPrior = actor === 0 ? combos.oopPrior : combos.ipPrior;
  const oppPrior = actor === 0 ? combos.ipPrior : combos.oopPrior;

  // Compute reach of opponent up to `nodeId`
  const oppReach = new Float64Array(oppPrior);
  const path = findPathToNode(solve, nodeId);
  for (const step of path) {
    const pNode = nodes[step.nodeId]!;
    if (!pNode.terminal && pNode.player !== actor) {
      const pAvg = avgStrategyByNode.get(step.nodeId)!;
      const base = step.actionIndex * R;
      for (let j = 0; j < R; j += 1) {
        oppReach[j] = oppReach[j]! * pAvg[base + j]!;
      }
    }
  }

  const termScratch = createTerminalScratch(R);
  function evalSubtreeCfv(
    subId: number,
    subOppReach: Float64Array,
    outCfv: Float64Array,
  ): void {
    const sNode = nodes[subId]!;
    if (sNode.terminal) {
      evalTerminalCfv(sNode, spec.potBb, actor, combos, subOppReach, outCfv, termScratch);
      return;
    }
    const sAvg = avgStrategyByNode.get(subId)!;
    const nAct = sNode.actions.length;
    outCfv.fill(0);
    const childCfv = new Float64Array(R);
    if (sNode.player === actor) {
      for (let a = 0; a < nAct; a += 1) {
        evalSubtreeCfv(sNode.actions[a]!.nextNodeId, subOppReach, childCfv);
        for (let i = 0; i < R; i += 1) {
          outCfv[i] = outCfv[i]! + sAvg[a * R + i]! * childCfv[i]!;
        }
      }
    } else {
      for (let a = 0; a < nAct; a += 1) {
        const nextOpp = new Float64Array(R);
        for (let j = 0; j < R; j += 1) {
          nextOpp[j] = subOppReach[j]! * sAvg[a * R + j]!;
        }
        evalSubtreeCfv(sNode.actions[a]!.nextNodeId, nextOpp, childCfv);
        for (let i = 0; i < R; i += 1) {
          outCfv[i] = outCfv[i]! + childCfv[i]!;
        }
      }
    }
  }

  const numActions = node.actions.length;
  const nodeAvg = avgStrategyByNode.get(nodeId)!;
  const actionCfvs: Float64Array[] = [];
  for (let a = 0; a < numActions; a += 1) {
    const cfv = new Float64Array(R);
    evalSubtreeCfv(node.actions[a]!.nextNodeId, oppReach, cfv);
    actionCfvs.push(cfv);
  }

  // Opponent total disjoint weight per combo `i` at this node for per-combo EV normalization
  const validOppByCombo = new Float64Array(R);
  let totalOpp = 0;
  const oppCardSum = new Float64Array(52);
  for (let j = 0; j < R; j += 1) {
    const w = oppReach[j]!;
    if (w === 0) continue;
    totalOpp += w;
    oppCardSum[combos.card0[j]!] = oppCardSum[combos.card0[j]!]! + w;
    oppCardSum[combos.card1[j]!] = oppCardSum[combos.card1[j]!]! + w;
  }
  for (let i = 0; i < R; i += 1) {
    validOppByCombo[i] = Math.max(
      1e-9,
      totalOpp - oppCardSum[combos.card0[i]!]! - oppCardSum[combos.card1[i]!]! + oppReach[i]!,
    );
  }

  let ownWeightSum = 0;
  for (let i = 0; i < R; i += 1) ownWeightSum += ownPrior[i]!;

  const actions: SolvedActionOption[] = node.actions.map((act, aIdx) => {
    let acc = 0;
    for (let i = 0; i < R; i += 1) {
      acc += ownPrior[i]! * nodeAvg[aIdx * R + i]!;
    }
    const targetNode = nodes[act.nextNodeId]!;
    return {
      actionIndex: aIdx,
      label: act.label,
      kind: act.kind,
      amountBb: act.amountBb,
      nextNodeId: act.nextNodeId,
      isTerminal: targetNode.terminal,
      frequency: ownWeightSum > 0 ? Math.round((acc / ownWeightSum) * 1000) / 1000 : 0,
    };
  });

  const closeEvThreshold = Math.max(0.25, spec.potBb * 0.02);
  const combosByHandClass: Record<string, SolvedComboDetail[]> = {};
  const classAgg = new Map<
    string,
    {
      combos: number;
      weightSum: number;
      evWeightedSum: number;
      evGapSum: number;
      actionWeightedSum: Record<string, number>;
      anyCloseCall: boolean;
    }
  >();

  for (let i = 0; i < R; i += 1) {
    const w = ownPrior[i]!;
    if (w <= 0) continue;
    const hc = combos.handClasses[i]!;
    const actionFreqs: Record<string, number> = {};
    const actionEvs: number[] = [];
    let comboEv = 0;
    let mixedCount = 0;

    for (let a = 0; a < numActions; a += 1) {
      const label = node.actions[a]!.label;
      const freq = Math.round(nodeAvg[a * R + i]! * 1000) / 1000;
      actionFreqs[label] = freq;
      if (freq >= 0.2) mixedCount += 1;
      const aEv = actionCfvs[a]![i]! / validOppByCombo[i]!;
      actionEvs.push(aEv);
      comboEv += nodeAvg[a * R + i]! * aEv;
    }

    const sortedEvs = [...actionEvs].sort((x, y) => y - x);
    const evGapBb =
      sortedEvs.length >= 2 ? Math.round((sortedEvs[0]! - sortedEvs[1]!) * 100) / 100 : 0;
    const isCloseCall = mixedCount >= 2 || (sortedEvs.length >= 2 && evGapBb <= closeEvThreshold);

    const detail: SolvedComboDetail = {
      comboId: combos.comboIds[i]!,
      cards: combos.comboCards[i]!,
      handClass: hc,
      weight: w,
      actionFrequencies: actionFreqs,
      evBb: Math.round(comboEv * 100) / 100,
      evGapBb,
      isCloseCall,
    };
    if (!combosByHandClass[hc]) combosByHandClass[hc] = [];
    combosByHandClass[hc]!.push(detail);

    const agg = classAgg.get(hc) ?? {
      combos: 0,
      weightSum: 0,
      evWeightedSum: 0,
      evGapSum: 0,
      actionWeightedSum: {},
      anyCloseCall: false,
    };
    agg.combos += 1;
    agg.weightSum += w;
    agg.evWeightedSum += w * comboEv;
    agg.evGapSum += w * evGapBb;
    if (isCloseCall) agg.anyCloseCall = true;
    for (let a = 0; a < numActions; a += 1) {
      const label = node.actions[a]!.label;
      agg.actionWeightedSum[label] = (agg.actionWeightedSum[label] ?? 0) + w * nodeAvg[a * R + i]!;
    }
    classAgg.set(hc, agg);
  }

  const matrix169: SolvedMatrixCell[] = [];
  for (const [handClass, agg] of classAgg.entries()) {
    const freqs: Record<string, number> = {};
    let dominantActionLabel = actions[0]?.label ?? 'Check';
    let bestFreq = -1;
    let mixedCount = 0;
    for (const act of actions) {
      const f = agg.weightSum > 0 ? Math.round(((agg.actionWeightedSum[act.label] ?? 0) / agg.weightSum) * 1000) / 1000 : 0;
      freqs[act.label] = f;
      if (f >= 0.2) mixedCount += 1;
      if (f > bestFreq) {
        bestFreq = f;
        dominantActionLabel = act.label;
      }
    }
    const evGapBb = agg.weightSum > 0 ? Math.round((agg.evGapSum / agg.weightSum) * 100) / 100 : 0;
    matrix169.push({
      handClass,
      combos: agg.combos,
      actionFrequencies: freqs,
      dominantActionLabel,
      evBb: agg.weightSum > 0 ? Math.round((agg.evWeightedSum / agg.weightSum) * 100) / 100 : 0,
      evGapBb,
      isCloseCall: agg.anyCloseCall || mixedCount >= 2 || (actions.length >= 2 && evGapBb <= closeEvThreshold),
    });
  }

  return {
    nodeId,
    player: actor,
    invest0: node.invest0,
    invest1: node.invest1,
    potBb: Math.round((spec.potBb + node.invest0 + node.invest1) * 10) / 10,
    actions,
    matrix169,
    combosByHandClass,
  };
}
