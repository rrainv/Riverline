import { assertCardArray } from '../cards';
import { encodeCard, evaluateSevenCodesUnchecked } from '../evaluator';
import { HOLDEM_COMBOS, HOLDEM_DECK } from '../holdem-combos';
import type { TurnBestResponseBranchInput, TurnBestResponseInput } from './best-response';
import { selectTurnRiverBranches, type RiverSamplingMode } from './river-compression';
import {
  buildRiverTree,
  createTerminalScratch,
  evalTerminalCfv,
  type RiverComboContext,
  type RiverTreeNode,
  type TerminalScratch,
} from './river-subgame';
import { buildSolvedNodeInspection } from './tree-inspector';
import {
  DEFAULT_DCFR_PARAMS,
  type DcfrParams,
  type RiverBetMenu,
  type RiverSubgameSpec,
  type SolvedNodeInspection,
  type SolvedRootActionSummary,
} from './types';

export interface TurnSubgameSpec {
  readonly spotId: string;
  readonly turnBoard: readonly [string, string, string, string];
  readonly deadCards?: readonly string[];
  readonly potBb: number;
  readonly effectiveStackBb: number;
  readonly rakePct?: number;
  readonly rakeCapBb?: number;
  readonly oopRangeByCombo: Readonly<Record<string, number>>;
  readonly ipRangeByCombo: Readonly<Record<string, number>>;
  readonly turnBetMenu: RiverBetMenu;
  readonly riverBetMenu?: RiverBetMenu;
  readonly riverCardSubset?: readonly string[];
  readonly useAllRivers?: boolean;
  readonly riverSamplingMode?: RiverSamplingMode;
  readonly fastRiverTargetCount?: number;
}

export interface TurnRiverRunoutImpact {
  readonly riverCard: string;
  readonly weight: number;
  readonly oopEvBb: number;
  readonly ipEvBb: number;
  readonly oopDeltaBb: number;
}

export interface TurnSolveResult {
  readonly spotId: string;
  readonly oopEvBb: number;
  readonly ipEvBb: number;
  readonly exploitabilityBb: number;
  readonly exploitabilityPctPot: number;
  readonly riverCardsEvaluated: number;
  readonly rawRiverCount: number;
  readonly compressedRiverCount: number;
  readonly samplingMode: RiverSamplingMode | 'custom_subset';
  readonly iterations: number;
  readonly turnRootActions: readonly SolvedRootActionSummary[];
  readonly riverRunouts?: readonly TurnRiverRunoutImpact[];
}

export interface TurnSolverSession {
  stepIterations(count: number): void;
  getIteration(): number;
  getSummary(): TurnSolveResult;
  getRiverRunouts(): readonly TurnRiverRunoutImpact[];
  inspectNode(nodeId: number): SolvedNodeInspection;
  getBestResponseInput(): TurnBestResponseInput;
}

export const MAX_SOLVER_MEMORY_BYTES = 256 * 1024 * 1024;

export function estimateSubgameMemoryBytes(
  spec: Pick<RiverSubgameSpec, 'potBb' | 'effectiveStackBb' | 'oopRangeByCombo' | 'ipRangeByCombo' | 'betMenu'> & {
    readonly riverCardCount?: number;
  },
): number {
  const uniqueCombos = new Set<string>();
  for (const [k, w] of Object.entries(spec.oopRangeByCombo)) {
    if (w > 0) uniqueCombos.add(k);
  }
  for (const [k, w] of Object.entries(spec.ipRangeByCombo)) {
    if (w > 0) uniqueCombos.add(k);
  }
  const approxR = Math.max(1, Math.min(1081, uniqueCombos.size));
  const nodes = buildRiverTree(spec.potBb, spec.effectiveStackBb, spec.betMenu);
  let totalActions = 0;
  for (const n of nodes) {
    if (!n.terminal) totalActions += n.actions.length;
  }
  const rivers = Math.max(1, spec.riverCardCount ?? 1);
  const bytesPerEntry = rivers > 1 ? 4 : 8; // Turn->River river branches use Float32Array
  // 4 typed arrays per node-action (regrets, cumStrat, sigma, scratch)
  return totalActions * approxR * 4 * bytesPerEntry * rivers;
}

const DECK_INDEX = new Map<string, number>(HOLDEM_DECK.map((c, idx) => [c, idx]));
const COMBO_1326_INDEX = new Map<string, number>(HOLDEM_COMBOS.map((c, idx) => [c.id, idx]));

interface PreparedRiverBranch {
  readonly riverCardCode: number;
  readonly weight: number;
  readonly ctx: RiverComboContext;
  readonly riverToTurnIdx: Int32Array;
  readonly scratch: TerminalScratch;
  readonly riverNodes: readonly RiverTreeNode[];
  readonly regretsByNode: ReadonlyMap<number, Float32Array>;
  readonly cumStratByNode: ReadonlyMap<number, Float32Array>;
  readonly sigmaByNode: ReadonlyMap<number, Float32Array>;
  readonly actionCfvsByNode: ReadonlyMap<number, readonly Float32Array[]>;
  readonly nextReachByNode: ReadonlyMap<number, Float32Array>;
  readonly oppChildCfvByNode: ReadonlyMap<number, Float32Array>;
}

export function createTurnSolverSession(
  spec: TurnSubgameSpec,
  params: DcfrParams = { ...DEFAULT_DCFR_PARAMS, iterations: 80 },
): TurnSolverSession {
  assertCardArray(spec.turnBoard, 'turnSubgame.turnBoard');
  if (spec.turnBoard.length !== 4 || new Set(spec.turnBoard).size !== 4) {
    throw new RangeError('Turn subgame requires 4 unique board cards');
  }
  const deadCards = spec.deadCards ?? [];
  if (deadCards.length > 0) {
    assertCardArray(deadCards, 'turnSubgame.deadCards');
  }
  const blockedSet = new Set<string>([...spec.turnBoard, ...deadCards]);

  const rawRemainingCount = HOLDEM_DECK.filter((c) => !blockedSet.has(c)).length;
  const resolvedMode: RiverSamplingMode | 'custom_subset' = spec.riverCardSubset
    ? 'custom_subset'
    : spec.riverSamplingMode ?? (spec.useAllRivers ? 'exact_isomorphic' : 'stratified_fast');

  const weightedRiverCards = spec.riverCardSubset
    ? spec.riverCardSubset
        .filter((c) => !blockedSet.has(c))
        .map((card) => ({ card, weight: 1, representedCards: [card] as readonly string[] }))
    : selectTurnRiverBranches(
        spec.turnBoard,
        deadCards,
        spec.oopRangeByCombo,
        spec.ipRangeByCombo,
        resolvedMode === 'custom_subset' ? 'stratified_fast' : resolvedMode,
        spec.fastRiverTargetCount ?? 16,
      ).branches;

  if (weightedRiverCards.length === 0) {
    throw new RangeError('Turn subgame has no valid river cards');
  }

  const estimatedBytes = estimateSubgameMemoryBytes({
    potBb: spec.potBb,
    effectiveStackBb: spec.effectiveStackBb,
    oopRangeByCombo: spec.oopRangeByCombo,
    ipRangeByCombo: spec.ipRangeByCombo,
    betMenu: spec.turnBetMenu,
    riverCardCount: weightedRiverCards.length,
  });
  if (estimatedBytes > MAX_SOLVER_MEMORY_BYTES) {
    throw new RangeError(`over_memory: modelled footprint ${estimatedBytes} bytes exceeds cap`);
  }

  const turnEntries: {
    c0: number;
    c1: number;
    evalC0: number;
    evalC1: number;
    idx1326: number;
    oopW: number;
    ipW: number;
    cards: readonly [string, string];
    handClass: string;
    comboId: string;
  }[] = [];

  for (const combo of HOLDEM_COMBOS) {
    if (blockedSet.has(combo.cards[0]) || blockedSet.has(combo.cards[1])) continue;
    const oopW = spec.oopRangeByCombo[combo.id] ?? 0;
    const ipW = spec.ipRangeByCombo[combo.id] ?? 0;
    if (oopW <= 0 && ipW <= 0) continue;
    turnEntries.push({
      c0: DECK_INDEX.get(combo.cards[0])!,
      c1: DECK_INDEX.get(combo.cards[1])!,
      evalC0: encodeCard(combo.cards[0]),
      evalC1: encodeCard(combo.cards[1]),
      idx1326: COMBO_1326_INDEX.get(combo.id)!,
      oopW: Math.max(0, oopW),
      ipW: Math.max(0, ipW),
      cards: combo.cards,
      handClass: combo.handClass,
      comboId: combo.id,
    });
  }

  const R = turnEntries.length;
  if (R === 0) throw new RangeError('Turn subgame has no live combos');

  const card0 = new Int32Array(R);
  const card1 = new Int32Array(R);
  const combo1326Idx = new Int32Array(R);
  const oopPrior = new Float64Array(R);
  const ipPrior = new Float64Array(R);

  for (let i = 0; i < R; i += 1) {
    const e = turnEntries[i]!;
    card0[i] = e.c0;
    card1[i] = e.c1;
    combo1326Idx[i] = e.idx1326;
    oopPrior[i] = e.oopW;
    ipPrior[i] = e.ipW;
  }

  const turnNodes = buildRiverTree(spec.potBb, spec.effectiveStackBb, spec.turnBetMenu);
  const riverMenu = spec.riverBetMenu ?? spec.turnBetMenu;

  // Build river subtrees per turn non-fold leaf (showdown node where commit < effectiveStack)
  const riverBranchesByLeaf = new Map<number, PreparedRiverBranch[]>();
  const leafShowdowns = turnNodes.filter(
    (n): n is Extract<RiverTreeNode, { terminal: true }> => n.terminal && n.reason === 'showdown',
  );

  const riverBoardsBase: {
    rCard: string;
    rCode: number;
    weight: number;
    boardZ: number;
    ctx: RiverComboContext;
    riverToTurnIdx: Int32Array;
  }[] = [];

  const b0 = encodeCard(spec.turnBoard[0]);
  const b1 = encodeCard(spec.turnBoard[1]);
  const b2 = encodeCard(spec.turnBoard[2]);
  const b3 = encodeCard(spec.turnBoard[3]);

  for (const wCard of weightedRiverCards) {
    const rCard = wCard.card;
    const rCode = DECK_INDEX.get(rCard)!;
    const rEvalCode = encodeCard(rCard);
    const scored: { turnIdx: number; score: number }[] = [];
    for (let i = 0; i < R; i += 1) {
      if (card0[i] === rCode || card1[i] === rCode) continue;
      const e = turnEntries[i]!;
      scored.push({
        turnIdx: i,
        score: evaluateSevenCodesUnchecked(e.evalC0, e.evalC1, b0, b1, b2, b3, rEvalCode),
      });
    }
    scored.sort((a, b) => a.score - b.score);
    const rCount = scored.length;
    const rCard0 = new Int32Array(rCount);
    const rCard1 = new Int32Array(rCount);
    const rIdx1326 = new Int32Array(rCount);
    const rToLive = new Int32Array(1326).fill(-1);
    const rScores = new Float64Array(rCount);
    const rOop = new Float64Array(rCount);
    const rIp = new Float64Array(rCount);
    const rClasses: string[] = [];
    const rIds: string[] = [];
    const rCards: (readonly [string, string])[] = [];
    const riverToTurnIdx = new Int32Array(rCount);

    for (let j = 0; j < rCount; j += 1) {
      const ti = scored[j]!.turnIdx;
      riverToTurnIdx[j] = ti;
      rCard0[j] = card0[ti]!;
      rCard1[j] = card1[ti]!;
      rIdx1326[j] = combo1326Idx[ti]!;
      rToLive[combo1326Idx[ti]!] = j;
      rScores[j] = scored[j]!.score;
      rOop[j] = oopPrior[ti]!;
      rIp[j] = ipPrior[ti]!;
      rClasses.push(turnEntries[ti]!.handClass);
      rIds.push(turnEntries[ti]!.comboId);
      rCards.push(turnEntries[ti]!.cards);
    }

    const starts: number[] = [];
    const ends: number[] = [];
    let cur = 0;
    while (cur < rCount) {
      let end = cur + 1;
      while (end < rCount && rScores[end] === rScores[cur]) end += 1;
      starts.push(cur);
      ends.push(end);
      cur = end;
    }

    riverBoardsBase.push({
      rCard,
      rCode,
      weight: wCard.weight,
      boardZ: 1,
      ctx: {
        count: rCount,
        card0: rCard0,
        card1: rCard1,
        combo1326Idx: rIdx1326,
        combo1326ToLiveIdx: rToLive,
        scores: rScores,
        oopPrior: rOop,
        ipPrior: rIp,
        handClasses: rClasses,
        comboIds: rIds,
        comboCards: rCards,
        bucketStarts: Int32Array.from(starts),
        bucketEnds: Int32Array.from(ends),
        normalizationZ: 1,
      },
      riverToTurnIdx,
    });
  }

  for (const leaf of leafShowdowns) {
    const commit = leaf.invest0;
    const remStack = Math.max(0, Math.round((spec.effectiveStackBb - commit) * 100) / 100);
    const potAtRiver = spec.potBb + commit * 2;
    const branches: PreparedRiverBranch[] = riverBoardsBase.map((rb) => {
      const rNodes =
        remStack > 0.05
          ? buildRiverTree(potAtRiver, remStack, riverMenu)
          : [{ id: 0, terminal: true, reason: 'showdown', folder: null, invest0: 0, invest1: 0 } as const];
      const rc = rb.ctx.count;
      const regretsByNode = new Map<number, Float32Array>();
      const cumStratByNode = new Map<number, Float32Array>();
      const sigmaByNode = new Map<number, Float32Array>();
      const actionCfvsByNode = new Map<number, readonly Float32Array[]>();
      const nextReachByNode = new Map<number, Float32Array>();
      const oppChildCfvByNode = new Map<number, Float32Array>();
      for (const rn of rNodes) {
        if (!rn.terminal) {
          const len = rn.actions.length * rc;
          regretsByNode.set(rn.id, new Float32Array(len));
          cumStratByNode.set(rn.id, new Float32Array(len));
          sigmaByNode.set(rn.id, new Float32Array(len));
          actionCfvsByNode.set(
            rn.id,
            Array.from({ length: rn.actions.length }, () => new Float32Array(rc)),
          );
          nextReachByNode.set(rn.id, new Float32Array(rc));
          oppChildCfvByNode.set(rn.id, new Float32Array(rc));
        }
      }
      return {
        riverCardCode: rb.rCode,
        weight: rb.weight,
        ctx: rb.ctx,
        riverToTurnIdx: rb.riverToTurnIdx,
        scratch: createTerminalScratch(rc),
        riverNodes: rNodes,
        regretsByNode,
        cumStratByNode,
        sigmaByNode,
        actionCfvsByNode,
        nextReachByNode,
        oppChildCfvByNode,
      };
    });
    riverBranchesByLeaf.set(leaf.id, branches);
  }

  let totalRiverWeight = 0;
  let zSum = 0;
  for (const rb of riverBoardsBase) {
    totalRiverWeight += rb.weight;
    const rc = rb.ctx.count;
    const { card0: rc0, card1: rc1, oopPrior: rOop, ipPrior: rIp } = rb.ctx;
    let boardZ = 0;
    for (let i = 0; i < rc; i += 1) {
      if (rOop[i]! <= 0) continue;
      for (let j = 0; j < rc; j += 1) {
        if (rIp[j]! <= 0) continue;
        if (rc0[i] === rc0[j] || rc0[i] === rc1[j] || rc1[i] === rc0[j] || rc1[i] === rc1[j]) continue;
        boardZ += rOop[i]! * rIp[j]!;
      }
    }
    rb.boardZ = boardZ;
    zSum += rb.weight * boardZ;
  }
  const invTotalWeight = totalRiverWeight > 0 ? 1 / totalRiverWeight : 1;
  const z = zSum * invTotalWeight;
  if (z <= 0) throw new RangeError('Turn subgame has zero disjoint OOP vs IP weight');

  const regretsByNode = new Map<number, Float64Array>();
  const cumStratByNode = new Map<number, Float64Array>();
  const sigmaByNode = new Map<number, Float64Array>();
  const actionCfvsByNode = new Map<number, readonly Float64Array[]>();
  const nextReachByNode = new Map<number, Float64Array>();
  const oppChildCfvByNode = new Map<number, Float64Array>();

  for (const node of turnNodes) {
    if (!node.terminal) {
      const len = node.actions.length * R;
      regretsByNode.set(node.id, new Float64Array(len));
      cumStratByNode.set(node.id, new Float64Array(len));
      sigmaByNode.set(node.id, new Float64Array(len));
      actionCfvsByNode.set(
        node.id,
        Array.from({ length: node.actions.length }, () => new Float64Array(R)),
      );
      nextReachByNode.set(node.id, new Float64Array(R));
      oppChildCfvByNode.set(node.id, new Float64Array(R));
    }
  }

  const riverOwnScratch = new Float64Array(R);
  const riverOppScratch = new Float64Array(R);
  const riverCfvScratch = new Float64Array(R);
  const evalChildScratchByNode = turnNodes.map(() => new Float64Array(R));
  const evalOppScratchByNode = turnNodes.map(() => new Float64Array(R));

  function currentStrategy(
    reg: Float64Array | Float32Array,
    numActions: number,
    comboCount: number,
    outSigma: Float64Array | Float32Array,
  ): void {
    const uniform = 1 / numActions;
    for (let i = 0; i < comboCount; i += 1) {
      let posSum = 0;
      for (let a = 0; a < numActions; a += 1) {
        const v = reg[a * comboCount + i]!;
        if (v > 0) posSum += v;
      }
      if (posSum <= 0) {
        for (let a = 0; a < numActions; a += 1) outSigma[a * comboCount + i] = uniform;
      } else {
        for (let a = 0; a < numActions; a += 1) {
          const v = reg[a * comboCount + i]!;
          outSigma[a * comboCount + i] = v > 0 ? v / posSum : 0;
        }
      }
    }
  }

  function traverseRiverBranch(
    rb: PreparedRiverBranch,
    nodeId: number,
    turnCommit: number,
    traverser: 0 | 1,
    ownReach: Float64Array | Float32Array,
    oppWeightedReach: Float64Array | Float32Array,
    posDisc: number,
    negDisc: number,
    stratWeight: number,
    outCfv: Float64Array | Float32Array,
  ): void {
    const node = rb.riverNodes[nodeId]!;
    const rc = rb.ctx.count;
    if (node.terminal) {
      evalTerminalCfv(
        {
          ...node,
          invest0: turnCommit + node.invest0,
          invest1: turnCommit + node.invest1,
        },
        spec.potBb,
        traverser,
        rb.ctx,
        oppWeightedReach,
        outCfv,
        rb.scratch,
        spec.rakePct ?? 0,
        spec.rakeCapBb ?? 0,
      );
      return;
    }

    const numActions = node.actions.length;
    const reg = rb.regretsByNode.get(nodeId)!;
    const cum = rb.cumStratByNode.get(nodeId)!;
    const sigma = rb.sigmaByNode.get(nodeId)!;
    currentStrategy(reg, numActions, rc, sigma);

    if (node.player === traverser) {
      const actionCfvs = rb.actionCfvsByNode.get(nodeId)!;
      const nextOwn = rb.nextReachByNode.get(nodeId)!;
      outCfv.fill(0);
      for (let a = 0; a < numActions; a += 1) {
        for (let i = 0; i < rc; i += 1) {
          const s = sigma[a * rc + i]!;
          nextOwn[i] = ownReach[i]! * s;
          cum[a * rc + i] = cum[a * rc + i]! + stratWeight * ownReach[i]! * s;
        }
        const childCfv = actionCfvs[a]!;
        traverseRiverBranch(
          rb,
          node.actions[a]!.nextNodeId,
          turnCommit,
          traverser,
          nextOwn,
          oppWeightedReach,
          posDisc,
          negDisc,
          stratWeight,
          childCfv,
        );
        for (let i = 0; i < rc; i += 1) {
          outCfv[i] = outCfv[i]! + sigma[a * rc + i]! * childCfv[i]!;
        }
      }
      for (let a = 0; a < numActions; a += 1) {
        const childCfv = actionCfvs[a]!;
        const base = a * rc;
        for (let i = 0; i < rc; i += 1) {
          const prev = reg[base + i]!;
          const discounted = prev >= 0 ? prev * posDisc : prev * negDisc;
          reg[base + i] = discounted + (childCfv[i]! - outCfv[i]!);
        }
      }
    } else {
      outCfv.fill(0);
      const childCfv = rb.oppChildCfvByNode.get(nodeId)!;
      const nextOpp = rb.nextReachByNode.get(nodeId)!;
      for (let a = 0; a < numActions; a += 1) {
        for (let j = 0; j < rc; j += 1) {
          nextOpp[j] = oppWeightedReach[j]! * sigma[a * rc + j]!;
        }
        traverseRiverBranch(
          rb,
          node.actions[a]!.nextNodeId,
          turnCommit,
          traverser,
          ownReach,
          nextOpp,
          posDisc,
          negDisc,
          stratWeight,
          childCfv,
        );
        for (let i = 0; i < rc; i += 1) {
          outCfv[i] = outCfv[i]! + childCfv[i]!;
        }
      }
    }
  }

  function traverseTurn(
    nodeId: number,
    traverser: 0 | 1,
    ownReach: Float64Array,
    oppWeightedReach: Float64Array,
    posDisc: number,
    negDisc: number,
    stratWeight: number,
    outCfv: Float64Array,
  ): void {
    const node = turnNodes[nodeId]!;
    if (node.terminal) {
      outCfv.fill(0);
      if (node.reason === 'fold') {
        for (const rb of riverBoardsBase) {
          const rc = rb.ctx.count;
          for (let j = 0; j < rc; j += 1) {
            riverOppScratch[j] = oppWeightedReach[rb.riverToTurnIdx[j]!]!;
          }
          evalTerminalCfv(
            node,
            spec.potBb,
            traverser,
            rb.ctx,
            riverOppScratch.subarray(0, rc),
            riverCfvScratch.subarray(0, rc),
            undefined,
            spec.rakePct ?? 0,
            spec.rakeCapBb ?? 0,
          );
          for (let j = 0; j < rc; j += 1) {
            const ti = rb.riverToTurnIdx[j]!;
            outCfv[ti] = outCfv[ti]! + rb.weight * riverCfvScratch[j]!;
          }
        }
        for (let i = 0; i < R; i += 1) outCfv[i] = outCfv[i]! * invTotalWeight;
        return;
      }

      const branches = riverBranchesByLeaf.get(node.id)!;
      const turnCommit = node.invest0;
      for (const rb of branches) {
        const rc = rb.ctx.count;
        for (let j = 0; j < rc; j += 1) {
          const ti = rb.riverToTurnIdx[j]!;
          riverOwnScratch[j] = ownReach[ti]!;
          riverOppScratch[j] = oppWeightedReach[ti]!;
        }
        traverseRiverBranch(
          rb,
          0,
          turnCommit,
          traverser,
          riverOwnScratch.subarray(0, rc),
          riverOppScratch.subarray(0, rc),
          posDisc,
          negDisc,
          stratWeight,
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

    const numActions = node.actions.length;
    const reg = regretsByNode.get(nodeId)!;
    const cum = cumStratByNode.get(nodeId)!;
    const sigma = sigmaByNode.get(nodeId)!;
    currentStrategy(reg, numActions, R, sigma);

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
        traverseTurn(
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
        traverseTurn(
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

  const ones = new Float64Array(R).fill(1);
  const scratch = new Float64Array(R);
  let iteration = 0;

  function stepIterations(count: number): void {
    for (let k = 0; k < count; k += 1) {
      iteration += 1;
      const t = iteration;
      const posDisc =
        t === 1 ? 1 : Math.pow(t - 1, params.alpha) / (Math.pow(t - 1, params.alpha) + 1);
      const negDisc = t === 1 ? 1 : 0.5;
      const stratWeight = Math.pow(t / (t + 1), params.gamma);
      traverseTurn(0, 0, ones, ipPrior, posDisc, negDisc, stratWeight, scratch);
      traverseTurn(0, 1, ones, oopPrior, posDisc, negDisc, stratWeight, scratch);
    }
  }

  function extractAvgMap(
    nodesList: readonly RiverTreeNode[],
    cumMap: ReadonlyMap<number, Float64Array | Float32Array>,
    comboCount: number,
  ): Map<number, Float64Array> {
    const avgMap = new Map<number, Float64Array>();
    for (const node of nodesList) {
      if (node.terminal) continue;
      const numActions = node.actions.length;
      const cum = cumMap.get(node.id)!;
      const avg = new Float64Array(numActions * comboCount);
      const uniform = 1 / numActions;
      for (let i = 0; i < comboCount; i += 1) {
        let sum = 0;
        for (let a = 0; a < numActions; a += 1) sum += cum[a * comboCount + i]!;
        for (let a = 0; a < numActions; a += 1) {
          avg[a * comboCount + i] = sum <= 0 ? uniform : cum[a * comboCount + i]! / sum;
        }
      }
      avgMap.set(node.id, avg);
    }
    return avgMap;
  }

  function evalAvgRiverBranch(
    rb: PreparedRiverBranch,
    riverAvg: ReadonlyMap<number, Float64Array>,
    nodeId: number,
    turnCommit: number,
    traverser: 0 | 1,
    oppReach: Float64Array,
    outCfv: Float64Array,
  ): void {
    const node = rb.riverNodes[nodeId]!;
    const rc = rb.ctx.count;
    if (node.terminal) {
      evalTerminalCfv(
        {
          ...node,
          invest0: turnCommit + node.invest0,
          invest1: turnCommit + node.invest1,
        },
        spec.potBb,
        traverser,
        rb.ctx,
        oppReach,
        outCfv,
        rb.scratch,
        spec.rakePct ?? 0,
        spec.rakeCapBb ?? 0,
      );
      return;
    }
    const avg = riverAvg.get(nodeId)!;
    const numActions = node.actions.length;
    outCfv.fill(0);
    const childCfv = new Float64Array(rc);
    if (node.player === traverser) {
      for (let a = 0; a < numActions; a += 1) {
        evalAvgRiverBranch(rb, riverAvg, node.actions[a]!.nextNodeId, turnCommit, traverser, oppReach, childCfv);
        for (let i = 0; i < rc; i += 1) outCfv[i] = outCfv[i]! + avg[a * rc + i]! * childCfv[i]!;
      }
    } else {
      for (let a = 0; a < numActions; a += 1) {
        const nextOpp = new Float64Array(rc);
        for (let j = 0; j < rc; j += 1) nextOpp[j] = oppReach[j]! * avg[a * rc + j]!;
        evalAvgRiverBranch(rb, riverAvg, node.actions[a]!.nextNodeId, turnCommit, traverser, nextOpp, childCfv);
        for (let i = 0; i < rc; i += 1) outCfv[i] = outCfv[i]! + childCfv[i]!;
      }
    }
  }

  function extractAllAvgs() {
    const turnAvg = extractAvgMap(turnNodes, cumStratByNode, R);
    const riverAvgs = new Map<PreparedRiverBranch, Map<number, Float64Array>>();
    for (const branches of riverBranchesByLeaf.values()) {
      for (const rb of branches) {
        riverAvgs.set(rb, extractAvgMap(rb.riverNodes, rb.cumStratByNode, rb.ctx.count));
      }
    }
    return { turnAvg, riverAvgs };
  }

  function evalTurnAvgWith(
    turnAvg: ReadonlyMap<number, Float64Array>,
    riverAvgs: ReadonlyMap<PreparedRiverBranch, ReadonlyMap<number, Float64Array>>,
    nodeId: number,
    traverser: 0 | 1,
    oppReach: Float64Array,
    outCfv: Float64Array,
  ): void {
    const node = turnNodes[nodeId]!;
    if (node.terminal) {
      outCfv.fill(0);
      if (node.reason === 'fold') {
        for (const rb of riverBoardsBase) {
          const rc = rb.ctx.count;
          for (let j = 0; j < rc; j += 1) riverOppScratch[j] = oppReach[rb.riverToTurnIdx[j]!]!;
          evalTerminalCfv(
            node,
            spec.potBb,
            traverser,
            rb.ctx,
            riverOppScratch.subarray(0, rc),
            riverCfvScratch.subarray(0, rc),
            undefined,
            spec.rakePct ?? 0,
            spec.rakeCapBb ?? 0,
          );
          for (let j = 0; j < rc; j += 1) {
            const ti = rb.riverToTurnIdx[j]!;
            outCfv[ti] = outCfv[ti]! + rb.weight * riverCfvScratch[j]!;
          }
        }
        for (let i = 0; i < R; i += 1) outCfv[i] = outCfv[i]! * invTotalWeight;
        return;
      }
      const branches = riverBranchesByLeaf.get(node.id)!;
      const turnCommit = node.invest0;
      for (const rb of branches) {
        const rc = rb.ctx.count;
        for (let j = 0; j < rc; j += 1) riverOppScratch[j] = oppReach[rb.riverToTurnIdx[j]!]!;
        evalAvgRiverBranch(rb, riverAvgs.get(rb)!, 0, turnCommit, traverser, riverOppScratch.subarray(0, rc), riverCfvScratch.subarray(0, rc));
        for (let j = 0; j < rc; j += 1) {
          const ti = rb.riverToTurnIdx[j]!;
          outCfv[ti] = outCfv[ti]! + rb.weight * riverCfvScratch[j]!;
        }
      }
      for (let i = 0; i < R; i += 1) outCfv[i] = outCfv[i]! * invTotalWeight;
      return;
    }

    const avg = turnAvg.get(nodeId)!;
    const numActions = node.actions.length;
    outCfv.fill(0);
    const childCfv = evalChildScratchByNode[nodeId]!;
    if (node.player === traverser) {
      for (let a = 0; a < numActions; a += 1) {
        evalTurnAvgWith(turnAvg, riverAvgs, node.actions[a]!.nextNodeId, traverser, oppReach, childCfv);
        for (let i = 0; i < R; i += 1) outCfv[i] = outCfv[i]! + avg[a * R + i]! * childCfv[i]!;
      }
    } else {
      const nextOpp = evalOppScratchByNode[nodeId]!;
      for (let a = 0; a < numActions; a += 1) {
        for (let j = 0; j < R; j += 1) nextOpp[j] = oppReach[j]! * avg[a * R + j]!;
        evalTurnAvgWith(turnAvg, riverAvgs, node.actions[a]!.nextNodeId, traverser, nextOpp, childCfv);
        for (let i = 0; i < R; i += 1) outCfv[i] = outCfv[i]! + childCfv[i]!;
      }
    }
  }

  function getSummary(): TurnSolveResult {
    const { turnAvg, riverAvgs } = extractAllAvgs();
    const evalTurnAvg = (nodeId: number, traverser: 0 | 1, oppReach: Float64Array, outCfv: Float64Array) =>
      evalTurnAvgWith(turnAvg, riverAvgs, nodeId, traverser, oppReach, outCfv);

    const oopCfv = new Float64Array(R);
    const ipCfv = new Float64Array(R);
    evalTurnAvg(0, 0, ipPrior, oopCfv);
    evalTurnAvg(0, 1, oopPrior, ipCfv);

    let oopTotal = 0;
    let ipTotal = 0;
    for (let i = 0; i < R; i += 1) {
      oopTotal += oopPrior[i]! * oopCfv[i]!;
      ipTotal += ipPrior[i]! * ipCfv[i]!;
    }
    const oopEvBb = oopTotal / z;
    const ipEvBb = ipTotal / z;

    function evalBestRiverBranch(
      rb: PreparedRiverBranch,
      riverAvg: ReadonlyMap<number, Float64Array>,
      nodeId: number,
      turnCommit: number,
      brPlayer: 0 | 1,
      oppReach: Float64Array,
      outCfv: Float64Array,
    ): void {
      const node = rb.riverNodes[nodeId]!;
      const rc = rb.ctx.count;
      if (node.terminal) {
        evalTerminalCfv(
          {
            ...node,
            invest0: turnCommit + node.invest0,
            invest1: turnCommit + node.invest1,
          },
          spec.potBb,
          brPlayer,
          rb.ctx,
          oppReach,
          outCfv,
          rb.scratch,
          spec.rakePct ?? 0,
          spec.rakeCapBb ?? 0,
        );
        return;
      }
      const numActions = node.actions.length;
      const childCfv = new Float64Array(rc);
      if (node.player === brPlayer) {
        outCfv.fill(Number.NEGATIVE_INFINITY);
        for (let a = 0; a < numActions; a += 1) {
          evalBestRiverBranch(rb, riverAvg, node.actions[a]!.nextNodeId, turnCommit, brPlayer, oppReach, childCfv);
          for (let i = 0; i < rc; i += 1) {
            if (childCfv[i]! > outCfv[i]!) outCfv[i] = childCfv[i]!;
          }
        }
      } else {
        const avg = riverAvg.get(nodeId)!;
        outCfv.fill(0);
        for (let a = 0; a < numActions; a += 1) {
          const nextOpp = new Float64Array(rc);
          for (let j = 0; j < rc; j += 1) nextOpp[j] = oppReach[j]! * avg[a * rc + j]!;
          evalBestRiverBranch(rb, riverAvg, node.actions[a]!.nextNodeId, turnCommit, brPlayer, nextOpp, childCfv);
          for (let i = 0; i < rc; i += 1) outCfv[i] = outCfv[i]! + childCfv[i]!;
        }
      }
    }

    function evalTurnBestResponse(
      nodeId: number,
      brPlayer: 0 | 1,
      oppReach: Float64Array,
      outCfv: Float64Array,
    ): void {
      const node = turnNodes[nodeId]!;
      if (node.terminal) {
        outCfv.fill(0);
        if (node.reason === 'fold') {
          for (const rb of riverBoardsBase) {
            const rc = rb.ctx.count;
            for (let j = 0; j < rc; j += 1) riverOppScratch[j] = oppReach[rb.riverToTurnIdx[j]!]!;
            evalTerminalCfv(
              node,
              spec.potBb,
              brPlayer,
              rb.ctx,
              riverOppScratch.subarray(0, rc),
              riverCfvScratch.subarray(0, rc),
              undefined,
              spec.rakePct ?? 0,
              spec.rakeCapBb ?? 0,
            );
            for (let j = 0; j < rc; j += 1) {
              const ti = rb.riverToTurnIdx[j]!;
              outCfv[ti] = outCfv[ti]! + rb.weight * riverCfvScratch[j]!;
            }
          }
          for (let i = 0; i < R; i += 1) outCfv[i] = outCfv[i]! * invTotalWeight;
          return;
        }
        const branches = riverBranchesByLeaf.get(node.id)!;
        const turnCommit = node.invest0;
        for (const rb of branches) {
          const rc = rb.ctx.count;
          for (let j = 0; j < rc; j += 1) riverOppScratch[j] = oppReach[rb.riverToTurnIdx[j]!]!;
          evalBestRiverBranch(rb, riverAvgs.get(rb)!, 0, turnCommit, brPlayer, riverOppScratch.subarray(0, rc), riverCfvScratch.subarray(0, rc));
          for (let j = 0; j < rc; j += 1) {
            const ti = rb.riverToTurnIdx[j]!;
            outCfv[ti] = outCfv[ti]! + rb.weight * riverCfvScratch[j]!;
          }
        }
        for (let i = 0; i < R; i += 1) outCfv[i] = outCfv[i]! * invTotalWeight;
        return;
      }

      const numActions = node.actions.length;
      const childCfv = evalChildScratchByNode[nodeId]!;
      if (node.player === brPlayer) {
        outCfv.fill(Number.NEGATIVE_INFINITY);
        for (let a = 0; a < numActions; a += 1) {
          evalTurnBestResponse(node.actions[a]!.nextNodeId, brPlayer, oppReach, childCfv);
          for (let i = 0; i < R; i += 1) {
            if (childCfv[i]! > outCfv[i]!) outCfv[i] = childCfv[i]!;
          }
        }
      } else {
        const avg = turnAvg.get(nodeId)!;
        outCfv.fill(0);
        const nextOpp = evalOppScratchByNode[nodeId]!;
        for (let a = 0; a < numActions; a += 1) {
          for (let j = 0; j < R; j += 1) nextOpp[j] = oppReach[j]! * avg[a * R + j]!;
          evalTurnBestResponse(node.actions[a]!.nextNodeId, brPlayer, nextOpp, childCfv);
          for (let i = 0; i < R; i += 1) outCfv[i] = outCfv[i]! + childCfv[i]!;
        }
      }
    }

    const oopBrCfv = new Float64Array(R);
    const ipBrCfv = new Float64Array(R);
    evalTurnBestResponse(0, 0, ipPrior, oopBrCfv);
    evalTurnBestResponse(0, 1, oopPrior, ipBrCfv);
    let oopBrSum = 0;
    let ipBrSum = 0;
    for (let i = 0; i < R; i += 1) {
      oopBrSum += oopPrior[i]! * oopBrCfv[i]!;
      ipBrSum += ipPrior[i]! * ipBrCfv[i]!;
    }
    const oopBrEv = oopBrSum / z;
    const ipBrEv = ipBrSum / z;
    const exploitabilityBb = Math.max(0, (oopBrEv - oopEvBb + (ipBrEv - ipEvBb)) / 2);
    const exploitabilityPctPot = (exploitabilityBb / spec.potBb) * 100;

    const root = turnNodes[0]!;
    const rootAvg = turnAvg.get(0)!;
    let oopWeightSum = 0;
    for (let i = 0; i < R; i += 1) oopWeightSum += oopPrior[i]!;
    const turnRootActions: SolvedRootActionSummary[] = !root.terminal
      ? root.actions.map((act, aIdx) => {
          let acc = 0;
          for (let i = 0; i < R; i += 1) acc += oopPrior[i]! * rootAvg[aIdx * R + i]!;
          return {
            actionLabel: act.label,
            kind: act.kind,
            amountBb: act.amountBb,
            frequency: oopWeightSum > 0 ? Math.round((acc / oopWeightSum) * 1000) / 1000 : 0,
          };
        })
      : [];

    return {
      spotId: spec.spotId,
      oopEvBb: Math.round(oopEvBb * 1000) / 1000,
      ipEvBb: Math.round(ipEvBb * 1000) / 1000,
      exploitabilityBb: Math.round(exploitabilityBb * 10000) / 10000,
      exploitabilityPctPot: Math.round(exploitabilityPctPot * 1000) / 1000,
      riverCardsEvaluated: riverBoardsBase.length,
      rawRiverCount: rawRemainingCount,
      compressedRiverCount: riverBoardsBase.length,
      samplingMode: resolvedMode,
      iterations: iteration,
      turnRootActions,
    };
  }

  const turnHandClasses = turnEntries.map((e) => e.handClass);
  const turnComboIds = turnEntries.map((e) => e.comboId);
  const turnComboCards = turnEntries.map((e) => e.cards);

  function findTurnPath(targetNodeId: number): readonly { nodeId: number; actionIndex: number }[] {
    const path: { nodeId: number; actionIndex: number }[] = [];
    function dfs(curId: number): boolean {
      if (curId === targetNodeId) return true;
      const n = turnNodes[curId];
      if (!n || n.terminal) return false;
      for (let a = 0; a < n.actions.length; a += 1) {
        path.push({ nodeId: curId, actionIndex: a });
        if (dfs(n.actions[a]!.nextNodeId)) return true;
        path.pop();
      }
      return false;
    }
    dfs(0);
    return path;
  }

  function inspectNode(nodeId: number): SolvedNodeInspection {
    const node = turnNodes[nodeId];
    if (!node || node.terminal) {
      throw new RangeError(`Cannot inspect non-decision turn node ${nodeId}`);
    }
    const { turnAvg, riverAvgs } = extractAllAvgs();
    const actor = node.player;
    const ownPrior = actor === 0 ? oopPrior : ipPrior;
    const oppPrior = actor === 0 ? ipPrior : oopPrior;

    const oppReach = new Float64Array(oppPrior);
    const path = findTurnPath(nodeId);
    for (const step of path) {
      const pNode = turnNodes[step.nodeId]!;
      if (!pNode.terminal && pNode.player !== actor) {
        const pAvg = turnAvg.get(step.nodeId)!;
        const base = step.actionIndex * R;
        for (let j = 0; j < R; j += 1) oppReach[j] = oppReach[j]! * pAvg[base + j]!;
      }
    }

    const actionCfvs: Float64Array[] = [];
    for (let a = 0; a < node.actions.length; a += 1) {
      const cfv = new Float64Array(R);
      evalTurnAvgWith(turnAvg, riverAvgs, node.actions[a]!.nextNodeId, actor, oppReach, cfv);
      actionCfvs.push(cfv);
    }

    return buildSolvedNodeInspection({
      nodeId,
      node,
      nodes: turnNodes,
      potBb: spec.potBb,
      count: R,
      card0,
      card1,
      handClasses: turnHandClasses,
      comboIds: turnComboIds,
      comboCards: turnComboCards,
      ownPrior,
      oppReach,
      nodeAvg: turnAvg.get(nodeId)!,
      actionCfvs,
    });
  }

  function getBestResponseInput(): TurnBestResponseInput {
    const { turnAvg, riverAvgs } = extractAllAvgs();
    const oopCfv = new Float64Array(R);
    const ipCfv = new Float64Array(R);
    evalTurnAvgWith(turnAvg, riverAvgs, 0, 0, ipPrior, oopCfv);
    evalTurnAvgWith(turnAvg, riverAvgs, 0, 1, oopPrior, ipCfv);
    let oopTotal = 0;
    let ipTotal = 0;
    for (let i = 0; i < R; i += 1) {
      oopTotal += oopPrior[i]! * oopCfv[i]!;
      ipTotal += ipPrior[i]! * ipCfv[i]!;
    }
    const branchesByLeaf = new Map<number, readonly TurnBestResponseBranchInput[]>();
    for (const [leafId, branches] of riverBranchesByLeaf.entries()) {
      branchesByLeaf.set(
        leafId,
        branches.map((rb) => ({
          weight: rb.weight,
          ctx: rb.ctx,
          riverToTurnIdx: rb.riverToTurnIdx,
          riverNodes: rb.riverNodes,
          riverAvg: riverAvgs.get(rb)!,
        })),
      );
    }
    return {
      potBb: spec.potBb,
      rakePct: spec.rakePct ?? 0,
      rakeCapBb: spec.rakeCapBb ?? 0,
      turnCount: R,
      oopPrior,
      ipPrior,
      normalizationZ: z,
      oopEvBb: oopTotal / z,
      ipEvBb: ipTotal / z,
      turnNodes,
      turnAvg,
      baseRivers: riverBoardsBase.map((rb) => ({
        weight: rb.weight,
        ctx: rb.ctx,
        riverToTurnIdx: rb.riverToTurnIdx,
      })),
      branchesByLeaf,
    };
  }

  function getRiverRunouts(): readonly TurnRiverRunoutImpact[] {
    const { turnAvg, riverAvgs } = extractAllAvgs();

    function evalTurnSingleRiver(
      rbIdx: number,
      nodeId: number,
      traverser: 0 | 1,
      oppReach: Float64Array,
      outCfv: Float64Array,
    ): void {
      const node = turnNodes[nodeId]!;
      if (node.terminal) {
        outCfv.fill(0);
        if (node.reason === 'fold') {
          const rb = riverBoardsBase[rbIdx]!;
          const rc = rb.ctx.count;
          for (let j = 0; j < rc; j += 1) riverOppScratch[j] = oppReach[rb.riverToTurnIdx[j]!]!;
          evalTerminalCfv(
            node,
            spec.potBb,
            traverser,
            rb.ctx,
            riverOppScratch.subarray(0, rc),
            riverCfvScratch.subarray(0, rc),
            undefined,
            spec.rakePct ?? 0,
            spec.rakeCapBb ?? 0,
          );
          for (let j = 0; j < rc; j += 1) {
            outCfv[rb.riverToTurnIdx[j]!] = riverCfvScratch[j]!;
          }
          return;
        }
        const rb = riverBranchesByLeaf.get(node.id)![rbIdx]!;
        const rc = rb.ctx.count;
        for (let j = 0; j < rc; j += 1) riverOppScratch[j] = oppReach[rb.riverToTurnIdx[j]!]!;
        evalAvgRiverBranch(
          rb,
          riverAvgs.get(rb)!,
          0,
          node.invest0,
          traverser,
          riverOppScratch.subarray(0, rc),
          riverCfvScratch.subarray(0, rc),
        );
        for (let j = 0; j < rc; j += 1) {
          outCfv[rb.riverToTurnIdx[j]!] = riverCfvScratch[j]!;
        }
        return;
      }

      const avg = turnAvg.get(nodeId)!;
      const numActions = node.actions.length;
      outCfv.fill(0);
      const childCfv = evalChildScratchByNode[nodeId]!;
      if (node.player === traverser) {
        for (let a = 0; a < numActions; a += 1) {
          evalTurnSingleRiver(rbIdx, node.actions[a]!.nextNodeId, traverser, oppReach, childCfv);
          for (let i = 0; i < R; i += 1) outCfv[i] = outCfv[i]! + avg[a * R + i]! * childCfv[i]!;
        }
      } else {
        const nextOpp = evalOppScratchByNode[nodeId]!;
        for (let a = 0; a < numActions; a += 1) {
          for (let j = 0; j < R; j += 1) nextOpp[j] = oppReach[j]! * avg[a * R + j]!;
          evalTurnSingleRiver(rbIdx, node.actions[a]!.nextNodeId, traverser, nextOpp, childCfv);
          for (let i = 0; i < R; i += 1) outCfv[i] = outCfv[i]! + childCfv[i]!;
        }
      }
    }

    const overallOopCfv = new Float64Array(R);
    evalTurnAvgWith(turnAvg, riverAvgs, 0, 0, ipPrior, overallOopCfv);
    let overallSum = 0;
    for (let i = 0; i < R; i += 1) overallSum += oopPrior[i]! * overallOopCfv[i]!;
    const overallOopEv = overallSum / z;

    const oopCfv = new Float64Array(R);
    const ipCfv = new Float64Array(R);
    const impacts: TurnRiverRunoutImpact[] = [];

    for (let rbIdx = 0; rbIdx < riverBoardsBase.length; rbIdx += 1) {
      const rb = riverBoardsBase[rbIdx]!;
      evalTurnSingleRiver(rbIdx, 0, 0, ipPrior, oopCfv);
      evalTurnSingleRiver(rbIdx, 0, 1, oopPrior, ipCfv);
      let oopSum = 0;
      let ipSum = 0;
      for (let i = 0; i < R; i += 1) {
        oopSum += oopPrior[i]! * oopCfv[i]!;
        ipSum += ipPrior[i]! * ipCfv[i]!;
      }
      const bz = rb.boardZ > 0 ? rb.boardZ : z;
      const rOopEv = oopSum / bz;
      const rIpEv = ipSum / bz;
      impacts.push({
        riverCard: rb.rCard,
        weight: Math.round(rb.weight * 100) / 100,
        oopEvBb: Math.round(rOopEv * 100) / 100,
        ipEvBb: Math.round(rIpEv * 100) / 100,
        oopDeltaBb: Math.round((rOopEv - overallOopEv) * 100) / 100,
      });
    }

    impacts.sort((a, b) => Math.abs(b.oopDeltaBb) - Math.abs(a.oopDeltaBb));
    return impacts;
  }

  return {
    stepIterations,
    getIteration: () => iteration,
    getSummary,
    getRiverRunouts,
    inspectNode,
    getBestResponseInput,
  };
}

export function solveTurnSubgame(
  spec: TurnSubgameSpec,
  params: DcfrParams = { ...DEFAULT_DCFR_PARAMS, iterations: 80 },
): TurnSolveResult {
  const session = createTurnSolverSession(spec, params);
  session.stepIterations(params.iterations);
  return session.getSummary();
}
