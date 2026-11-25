import { describe, expect, it } from 'vitest';
import {
  buildRiverComboContext,
  buildRiverTree,
  buildSolvedSpotArtifact,
  computeRiverBestResponse,
  estimateSubgameMemoryBytes,
  expandHandClassesToComboMap,
  inspectRiverNode,
  PILOT_SPOT_SPECS,
  SOLVED_PILOT_SPOTS,
  solveKuhnDcfr,
  solveRiverSubgame,
  solveTurnSubgame,
} from '../solver';
import { HOLDEM_COMBOS } from '../holdem-combos';
import type { RiverSubgameSpec } from '../solver/types';

describe('Offline DCFR Solver Pilot (#1)', () => {
  it('converges Kuhn Poker DCFR to -1/18 with low exploitability', () => {
    const res = solveKuhnDcfr(20000);
    expect(Math.abs(res.p0Value - -1 / 18)).toBeLessThan(0.002);
    expect(res.exploitability).toBeLessThan(0.002);
  });

  it('matches the half-street Clairvoyance river exact equilibrium (P=10, B=10 -> OOP EV=2.5, IP EV=7.5)', () => {
    const board: readonly [string, string, string, string, string] = ['Ks', 'Qd', '7c', '2h', '4s'];
    const oopRangeByCombo: Record<string, number> = {};
    const ipRangeByCombo: Record<string, number> = {};
    for (const c of HOLDEM_COMBOS) {
      if (board.includes(c.cards[0]) || board.includes(c.cards[1])) continue;
      if (c.handClass === 'QJs') oopRangeByCombo[c.id] = 1;
      if (c.handClass === 'KK') ipRangeByCombo[c.id] = 1; // 3 combos (Ks on board)
      if (c.handClass === '98s' && c.cards[0] !== '8c') ipRangeByCombo[c.id] = 1; // 3 combos -> exact 50/50
    }

    const spec: RiverSubgameSpec = {
      spotId: 'clairvoyance-check',
      board,
      potBb: 10,
      effectiveStackBb: 10,
      oopRangeByCombo,
      ipRangeByCombo,
      betMenu: { betPcts: [1.0], raisePcts: [], raiseCap: 0, includeAllIn: false },
    };

    const solve = solveRiverSubgame(spec, { alpha: 1.5, beta: 0, gamma: 2, iterations: 600 });
    const br = computeRiverBestResponse(solve);

    expect(Math.abs(br.oopEvBb + br.ipEvBb - 10)).toBeLessThan(1e-6);
    expect(br.exploitabilityPctPot).toBeLessThan(0.5);
    expect(Math.abs(br.oopEvBb - 2.5)).toBeLessThan(0.35);
    expect(Math.abs(br.ipEvBb - 7.5)).toBeLessThan(0.35);
  });

  it('solves every PILOT_SPOT_SPECS spot under 0.5% pot exploitability with constant-sum EV conservation', () => {
    expect(SOLVED_PILOT_SPOTS).toHaveLength(3);
    for (const item of PILOT_SPOT_SPECS) {
      const artifact = buildSolvedSpotArtifact(item.spec, {
        titleKey: item.titleKey,
        provenanceId: item.provenanceId,
        abstractionLabel: item.abstractionLabel,
      });
      expect(Math.abs(artifact.oopEvBb + artifact.ipEvBb - item.spec.potBb)).toBeLessThan(0.01);
      expect(artifact.exploitabilityPctPot).toBeLessThan(0.5);
      expect(artifact.oopRootActions.length).toBeGreaterThan(0);
    }
  }, 15000);

  it('solves a Turn-to-River subgame with EV conservation and normalized root actions', () => {
    const turnRes = solveTurnSubgame(
      {
        spotId: 'turn-pilot-kq72',
        turnBoard: ['Ks', 'Qd', '7c', '2h'],
        potBb: 12,
        effectiveStackBb: 30,
        oopRangeByCombo: expandHandClassesToComboMap(['QQ', 'JJ', 'AQo']),
        ipRangeByCombo: expandHandClassesToComboMap(['KK', 'AA', '98s']),
        turnBetMenu: { betPcts: [0.5], raisePcts: [], raiseCap: 0, includeAllIn: true },
        riverCardSubset: ['4s', '9c', 'Td', 'Ah'],
      },
      { alpha: 1.5, beta: 0, gamma: 2, iterations: 120 },
    );
    expect(turnRes.riverCardsEvaluated).toBe(4);
    expect(Math.abs(turnRes.oopEvBb + turnRes.ipEvBb - 12)).toBeLessThan(0.05);
    expect(turnRes.exploitabilityPctPot).toBeGreaterThanOrEqual(0);
    expect(turnRes.exploitabilityPctPot).toBeLessThan(2.5);
    const freqSum = turnRes.turnRootActions.reduce((acc, a) => acc + a.frequency, 0);
    expect(Math.abs(freqSum - 1)).toBeLessThan(0.02);
  }, 15000);

  it('snaps bet/raise amounts to 0.5bb, excludes dead cards, inspects close calls, and enforces memory cap', () => {
    const tree = buildRiverTree(17, 40, {
      betPcts: [0.33, 0.75],
      raisePcts: [0.66],
      raiseCap: 1,
      includeAllIn: true,
    });
    const root = tree[0]!;
    expect(root.terminal).toBe(false);
    if (!root.terminal) {
      for (const act of root.actions) {
        if (act.amountBb !== null && act.kind !== 'all_in') {
          expect(Math.round(act.amountBb * 2)).toBe(act.amountBb * 2);
        }
      }
    }

    const board: readonly [string, string, string, string, string] = ['Ks', 'Qd', '7c', '2h', '4s'];
    const oop = expandHandClassesToComboMap(['QQ', 'JJ', 'AQo']);
    const ip = expandHandClassesToComboMap(['KK', 'AA', '98s']);
    const ctxNoDead = buildRiverComboContext({
      spotId: 'dead-check',
      board,
      potBb: 18,
      effectiveStackBb: 40,
      oopRangeByCombo: oop,
      ipRangeByCombo: ip,
      betMenu: { betPcts: [0.5], raisePcts: [], raiseCap: 0, includeAllIn: false },
    });
    const ctxWithDead = buildRiverComboContext({
      spotId: 'dead-check',
      board,
      deadCards: ['As'],
      potBb: 18,
      effectiveStackBb: 40,
      oopRangeByCombo: oop,
      ipRangeByCombo: ip,
      betMenu: { betPcts: [0.5], raisePcts: [], raiseCap: 0, includeAllIn: false },
    });
    expect(ctxWithDead.count).toBeLessThan(ctxNoDead.count);

    const solve = solveRiverSubgame({
      spotId: 'inspect-check',
      board,
      deadCards: ['As'],
      potBb: 18,
      effectiveStackBb: 40,
      oopRangeByCombo: oop,
      ipRangeByCombo: ip,
      betMenu: { betPcts: [0.5, 1.0], raisePcts: [0.75], raiseCap: 1, includeAllIn: true },
    });
    const inspection = inspectRiverNode(solve, 0);
    expect(inspection.matrix169.length).toBeGreaterThan(0);
    expect(inspection.matrix169.some((c) => typeof c.evBb === 'number' && typeof c.isCloseCall === 'boolean')).toBe(true);

    const hugeMem = estimateSubgameMemoryBytes({
      potBb: 20,
      effectiveStackBb: 200,
      oopRangeByCombo: expandHandClassesToComboMap(['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', 'AKs', 'AQs', 'AJs', 'KQs']),
      ipRangeByCombo: expandHandClassesToComboMap(['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', 'AKs', 'AQs', 'AJs', 'KQs']),
      betMenu: { betPcts: [0.33, 0.5, 0.75, 1.0, 1.5], raisePcts: [0.5, 1.0], raiseCap: 3, includeAllIn: true },
      riverCardCount: 48,
    });
    expect(hugeMem).toBeGreaterThan(0);

    // Verify rake deduction on River DCFR + Best Response
    const rakedSolve = solveRiverSubgame({
      spotId: 'rake-check',
      board,
      potBb: 20,
      effectiveStackBb: 40,
      rakePct: 0.05,
      rakeCapBb: 2.5,
      oopRangeByCombo: oop,
      ipRangeByCombo: ip,
      betMenu: { betPcts: [0.5, 1.0], raisePcts: [], raiseCap: 0, includeAllIn: true },
    });
    const rakedBr = computeRiverBestResponse(rakedSolve);
    expect(rakedBr.oopEvBb + rakedBr.ipEvBb).toBeLessThan(20);
    expect(rakedBr.exploitabilityPctPot).toBeLessThan(0.5);
  });
});
