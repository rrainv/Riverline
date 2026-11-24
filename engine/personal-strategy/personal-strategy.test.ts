import { describe, expect, it } from 'vitest';
import {
  compareStrategyWithBaseline,
  createStrategyContext,
  deriveFamilyCutoffFromProjection,
  getEstimatedBaselineCutoff,
  getStrategyFamily,
  interpolateFamilyCutoff,
  isSpotMapCellPossible,
  playersBehindForPosition,
  projectStrategyLeakMap,
  projectStrategyMatrix,
  projectStrategySpotMap,
  querySpotBaselineRegistry,
  strategyContextKey,
  type StrategyEvidenceEntry,
} from './index';

describe('personal-strategy clean-room engine', () => {
  it('enforces structural spot-map impossibilities for 6-max and 8-max', () => {
    expect(isSpotMapCellPossible(6, 'first_in', 'BB')).toBe(false);
    expect(isSpotMapCellPossible(6, 'first_in', 'UTG')).toBe(true);
    expect(isSpotMapCellPossible(6, 'facing_early_open', 'UTG')).toBe(false);
    expect(isSpotMapCellPossible(6, 'facing_late_open', 'UTG')).toBe(false);
    expect(isSpotMapCellPossible(6, 'facing_late_open', 'CO')).toBe(false);
    expect(isSpotMapCellPossible(6, 'facing_late_open', 'BTN')).toBe(true);
    expect(isSpotMapCellPossible(8, 'facing_late_open', 'LJ')).toBe(false);
    expect(isSpotMapCellPossible(8, 'facing_late_open', 'SB')).toBe(true);
    expect(playersBehindForPosition(6, 'UTG')).toBe(5);
    expect(playersBehindForPosition(8, 'UTG')).toBe(7);
    expect(playersBehindForPosition(8, 'BB')).toBe(0);
  });

  it('keeps unasked hand classes unknown and never treats unknown as fold', () => {
    const ctx = createStrategyContext({
      tableSize: 6,
      stackDepthBb: 100,
      decisionFamily: 'preflop_rfi',
      position: 'UTG',
    });
    const projection = projectStrategyMatrix(ctx, []);
    expect(projection.totalCombos).toBe(1326);
    expect(projection.knownCombos).toBe(0);
    expect(projection.unknownCombos).toBe(1326);
    expect(projection.openCombos).toBe(0);
    expect(projection.setHandCount).toBe(0);
    expect(projection.cells.every((c) => c.status === 'unknown' && c.dominantAction === null)).toBe(true);
  });

  it('isolates contexts by stack depth and table size', () => {
    const ctx50_8 = createStrategyContext({
      tableSize: 8,
      stackDepthBb: 50,
      decisionFamily: 'preflop_rfi',
      position: 'CO',
    });
    const ctx100_6 = createStrategyContext({
      tableSize: 6,
      stackDepthBb: 100,
      decisionFamily: 'preflop_rfi',
      position: 'CO',
    });
    const evidence: StrategyEvidenceEntry[] = [
      {
        evidenceId: 'e1',
        occurredAt: '2026-11-15T10:00:00Z',
        contextKey: strategyContextKey(ctx50_8),
        handClass: 'AA',
        source: 'calibration',
        action: 'raise',
      },
    ];
    expect(projectStrategyMatrix(ctx50_8, evidence).openCombos).toBe(6);
    expect(projectStrategyMatrix(ctx100_6, evidence).openCombos).toBe(0);
  });

  it('detects conflicts between direct plan and drill answers without auto-overwriting, and resolves via conflict_resolution', () => {
    const ctx = createStrategyContext({
      tableSize: 6,
      stackDepthBb: 100,
      decisionFamily: 'preflop_rfi',
      position: 'CO',
    });
    const key = strategyContextKey(ctx);
    const evidence: StrategyEvidenceEntry[] = [
      {
        evidenceId: 'e1',
        occurredAt: '2026-11-15T10:00:00Z',
        contextKey: key,
        handClass: 'KTo',
        source: 'calibration',
        action: 'raise',
      },
      {
        evidenceId: 'd1',
        occurredAt: '2026-11-15T10:01:00Z',
        contextKey: key,
        handClass: 'KTo',
        source: 'drill',
        action: 'fold',
      },
      {
        evidenceId: 'd2',
        occurredAt: '2026-11-15T10:02:00Z',
        contextKey: key,
        handClass: 'KTo',
        source: 'drill',
        action: 'fold',
      },
      {
        evidenceId: 'd3',
        occurredAt: '2026-11-15T10:03:00Z',
        contextKey: key,
        handClass: 'KTo',
        source: 'drill',
        action: 'fold',
      },
    ];

    const proj = projectStrategyMatrix(ctx, evidence);
    const kto = proj.cells.find((c) => c.handClass === 'KTo')!;
    expect(kto.status).toBe('conflicting');
    expect(kto.hasConflict).toBe(true);
    expect(kto.dominantAction).toBe('raise');
    expect(proj.conflictHands).toEqual(['KTo']);

    const resolved = projectStrategyMatrix(ctx, [
      ...evidence,
      {
        evidenceId: 'r1',
        occurredAt: '2026-11-15T10:05:00Z',
        contextKey: key,
        handClass: 'KTo',
        source: 'conflict_resolution',
        action: 'raise',
      },
    ]);
    const ktoResolved = resolved.cells.find((c) => c.handClass === 'KTo')!;
    expect(ktoResolved.status).toBe('direct');
    expect(ktoResolved.hasConflict).toBe(false);
    expect(ktoResolved.dominantAction).toBe('raise');
  });

  it('returns Estimated baseline for 6-max 100bb RFI and Unavailable for 30-60bb home game', () => {
    const ctx100 = createStrategyContext({
      tableSize: 6,
      stackDepthBb: 100,
      decisionFamily: 'preflop_rfi',
      position: 'UTG',
    });
    const ctx50 = createStrategyContext({
      tableSize: 6,
      stackDepthBb: 50,
      decisionFamily: 'preflop_rfi',
      position: 'UTG',
    });

    const key100 = strategyContextKey(ctx100);
    const evidence: StrategyEvidenceEntry[] = ['KQs', 'KJs', 'KTs', 'K9s', 'K8s'].map((hc, i) => ({
      evidenceId: `k-${i}`,
      occurredAt: '2026-11-15T10:00:00Z',
      contextKey: key100,
      handClass: hc,
      source: 'calibration',
      action: 'raise',
    }));

    const proj100 = projectStrategyMatrix(ctx100, evidence);
    expect(deriveFamilyCutoffFromProjection(proj100, 'suited_kings')).toBe(4);
    const cmp100 = compareStrategyWithBaseline(proj100, 'suited_kings');
    expect(cmp100.tier).toBe('estimated');
    expect(cmp100.available).toBe(true);
    expect(cmp100.baselineCutoffHand).toBe('KTs');
    expect(cmp100.deltaHands).toBe(2);
    expect(cmp100.deltaCombos).toBe(8);

    const proj50 = projectStrategyMatrix(ctx50, []);
    const cmp50 = compareStrategyWithBaseline(proj50, 'suited_kings');
    expect(cmp50.tier).toBe('unavailable');
    expect(cmp50.available).toBe(false);
    expect(cmp50.baselineCutoffHand).toBeNull();

    const spotMap = projectStrategySpotMap(6, 100, evidence);
    expect(spotMap.totalValidSpotsCount).toBe(18);
    expect(spotMap.recommendedSpot?.position).toBe('UTG');

    const leakMap100 = projectStrategyLeakMap(6, 100, evidence);
    expect(leakMap100.tier).toBe('estimated');
    const utgSuitedKings = leakMap100.rows
      .find((r) => r.familyId === 'suited_kings')!
      .cells.find((c) => c.position === 'UTG')!;
    expect(utgSuitedKings.deltaPoints).not.toBeNull();
    const utgPairsUnset = leakMap100.rows
      .find((r) => r.familyId === 'pairs')!
      .cells.find((c) => c.position === 'UTG')!;
    expect(utgPairsUnset.deltaPoints).toBeNull();
    const utgFooter = leakMap100.columnFooters.find((f) => f.position === 'UTG')!;
    expect(utgFooter.openCombos).toBe(20);
    expect(utgFooter.sampleHands).toBe(5);

    const leakMap50 = projectStrategyLeakMap(8, 50, []);
    expect(leakMap50.tier).toBe('unavailable');
  });

  it('matches commented target hand classes on 6-max 100bb estimated baseline cutoffs', () => {
    const cases: Array<{ position: string; familyId: 'pairs' | 'suited_kings' | 'suited_queens_jacks'; expectedHand: string }> = [
      { position: 'UTG', familyId: 'suited_kings', expectedHand: 'KTs' },
      { position: 'BTN', familyId: 'suited_queens_jacks', expectedHand: 'Q3s' },
      { position: 'SB', familyId: 'suited_kings', expectedHand: 'K5s' },
      { position: 'SB', familyId: 'suited_queens_jacks', expectedHand: 'Q6s' },
    ];
    for (const c of cases) {
      const ctx = createStrategyContext({
        tableSize: 6,
        stackDepthBb: 100,
        decisionFamily: 'preflop_rfi',
        position: c.position,
      });
      const cutoff = getEstimatedBaselineCutoff(ctx, c.familyId);
      expect(cutoff).not.toBeNull();
      const hand = getStrategyFamily(c.familyId).hands[cutoff!]?.handClass;
      expect(hand).toBe(c.expectedHand);
    }
  });

  it('queries multi-spot registry with bracketed stack interpolation and refuses extrapolation', () => {
    expect(interpolateFamilyCutoff(40, 6, 60, 8, 50)).toBe(7);
    expect(interpolateFamilyCutoff(30, 5, 100, 8, 50)).toBeNull(); // > 40 bb span
    expect(interpolateFamilyCutoff(40, 6, 60, 8, 25)).toBeNull(); // extrapolation refused

    const rfi50 = querySpotBaselineRegistry(
      createStrategyContext({
        tableSize: 6,
        stackDepthBb: 50,
        decisionFamily: 'preflop_rfi',
        position: 'UTG',
      }),
    );
    expect(rfi50.available).toBe(true);
    expect(rfi50.derivation).toBe('interpolated');
    expect(rfi50.tier).toBe('estimated');
    expect(rfi50.row?.frequencies.AA?.raise).toBe(1);

    const facingOpen = querySpotBaselineRegistry(
      createStrategyContext({
        tableSize: 6,
        stackDepthBb: 100,
        decisionFamily: 'preflop_facing_open',
        position: 'BTN',
        openerPosition: 'CO',
      }),
    );
    expect(facingOpen.available).toBe(true);
    expect(facingOpen.derivation).toBe('authored');
  });
});
