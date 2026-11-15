import { describe, expect, it } from 'vitest';
import { applyChance } from '../chance';
import { createGameRulesSnapshot } from '../game-rules';
import { HOLDEM_DECK } from '../holdem-combos';
import { initializeRecordedHand } from '../initialize-hand';
import { createOpponentActorInformation } from '../privacy-fences';
import { POKER_ACTION_SCHEMA_VERSION } from '../schema';
import { applyAction } from '../transitions';
import { chooseDuelBotAction, generateTrainingDrill, gradeTrainingAnswer } from './index';

describe('engine/training drill generation, grading, and privacy-fenced duel bot', () => {
  it('generates deterministic preflop drills with exact call economics and honest baseline tiers', () => {
    const a = generateTrainingDrill({ seed: 101, target: 'preflop_facing_open', tableSize: 6, stackDepthBb: 100 });
    const b = generateTrainingDrill({ seed: 101, target: 'preflop_facing_open', tableSize: 6, stackDepthBb: 100 });

    expect(a.exerciseId).toBe(b.exerciseId);
    expect(a.heroCards).toEqual(b.heroCards);
    expect(a.pokerState.actingPlayerId).toBe('hero');
    expect(a.baselineTier).toBe('estimated');
    expect(a.baselineMix.reduce((sum, s) => sum + s.pct, 0)).toBe(100);
    expect(a.requiredEquityPct).toBeGreaterThan(0);

    // 8-max / 50 bb outside 6-max 100 bb coverage must report baselineTier: 'unavailable'
    const home = generateTrainingDrill({ seed: 101, target: 'preflop_rfi', tableSize: 8, stackDepthBb: 50 });
    expect(home.baselineTier).toBe('unavailable');
    expect(home.baselineMix).toHaveLength(0);
    expect(home.heroPosition).toBeTruthy();
  });

  it('never marks Estimated heuristic disagreements as mistakes and places MixBar pointer left-to-right', () => {
    const drill = generateTrainingDrill({
      seed: 7,
      target: 'preflop_rfi',
      tableSize: 6,
      stackDepthBb: 100,
      focusPosition: 'UTG',
      focusFamilyId: 'pairs',
    });

    const foldGrade = gradeTrainingAnswer({
      exercise: drill,
      chosenActionType: 'fold',
      occurredAt: '2026-11-16T00:00:00.000Z',
    });
    expect(foldGrade.grade).toBeNull();
    expect(foldGrade.isMathMistake).toBe(false);
    expect(foldGrade.lampMood).not.toBe('stern' as string);
    expect(foldGrade.evidenceEntry.source).toBe('drill');

    const facing = generateTrainingDrill({
      seed: 12,
      target: 'preflop_facing_open',
      tableSize: 6,
      stackDepthBb: 100,
    });
    const smallRaise = gradeTrainingAnswer({
      exercise: facing,
      chosenActionType: 'raise',
      chosenAmountToBb: facing.raisePresetsBb[0] ?? 7,
      occurredAt: '2026-11-16T00:00:00.000Z',
    });
    const bigRaise = gradeTrainingAnswer({
      exercise: facing,
      chosenActionType: 'raise',
      chosenAmountToBb: facing.raisePresetsBb[facing.raisePresetsBb.length - 1] ?? 10,
      occurredAt: '2026-11-16T00:00:00.000Z',
    });
    expect(bigRaise.youPointerPct).toBeGreaterThanOrEqual(smallRaise.youPointerPct);
  });

  it('chooses legal duel bot actions strictly through OpponentActorInformation without seeing hero cards', () => {
    const rules = createGameRulesSnapshot({
      source: { kind: 'direct' },
      setup: { seatedPlayers: 2 },
      definition: {
        schemaVersion: 'game-rules-definition/v2',
        variant: 'no_limit_texas_holdem',
        format: 'cash',
        tableSize: { minimumSeated: 2, maximumSeated: 10 },
        blinds: { smallBlindMilliBb: 500, bigBlindMilliBb: 1000, chipUnitMilliBb: 100 },
        ante: { type: 'none', amountMilliBb: 0 },
        straddle: { type: 'none' },
        collectionPolicy: { type: 'none' },
        recordedSettlementPolicy: { type: 'source_recorded_rake', rakeModel: 'unknown' },
      },
    });
    let state = initializeRecordedHand({
      handId: 'duel-test-1',
      rulesSnapshot: rules,
      buttonSeat: 0,
      players: [
        { playerId: 'hero', seat: 0, startingStackMilliBb: 100_000 },
        { playerId: 'astra', seat: 1, startingStackMilliBb: 100_000 },
      ],
    });
    state = applyChance(state, {
      type: 'deal_hole',
      cardsByPlayer: { hero: [HOLDEM_DECK[0]!, HOLDEM_DECK[1]!], astra: ['Qs', 'Qc'] },
      hiddenPlayerIds: [],
    });
    // Hero raises to 2.5 bb preflop, now Astra acts
    state = applyAction(state, {
      schemaVersion: POKER_ACTION_SCHEMA_VERSION,
      playerId: 'hero',
      type: 'raise',
      amountToMilliBb: 2500,
    });

    const info = createOpponentActorInformation({
      pokerState: state,
      actorSeat: 1,
      ownCards: ['Qs', 'Qc'],
    });
    const botDecision = chooseDuelBotAction({ actorInfo: info, seed: 9 });
    expect(['call', 'raise', 'fold']).toContain(botDecision.action.type);

    // Ensure resulting action applies cleanly to canonical state
    const next = applyAction(state, botDecision.action);
    expect(next.actionHistory.length).toBe(2);
  });
});
