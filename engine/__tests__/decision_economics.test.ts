import { describe, expect, it } from 'vitest';
import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  LEDGER_KINDS,
  allInLuckFacts,
  applyAction,
  applyChance,
  createAction,
  deriveActionSizeFacts,
  deriveActorCallEconomics,
  derivePotAccounting,
  duelCallFacts,
  initializeHand,
  minimumDefenseFrequency,
  potOddsFacts,
  potOddsFromAfterCall,
  reviewCallEvFacts,
  stackToPotRatio,
  type ActionType,
  type PokerState,
} from '../index';

const HOLES: Readonly<Record<string, readonly [string, string]>> = {
  P0: ['As', 'Kh'],
  P1: ['Qd', 'Jc'],
  P2: ['Ts', '9h'],
  P3: ['8d', '7c'],
};

function dealtTable(stacksBb: readonly number[]): PokerState {
  const initial = initializeHand({
    handId: `econ-${stacksBb.join('-')}`,
    game: {
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: stacksBb.map((stackBb, seat) => ({
      playerId: `P${seat}`,
      seat,
      startingStackMilliBb: stackBb * 1000,
    })),
  });
  return applyChance(initial, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: Object.fromEntries(initial.players.map((p) => [p.playerId, HOLES[p.playerId]!])),
  });
}

function act(
  state: PokerState,
  type: ActionType,
  amountToMilliBb: number | null = null,
): PokerState {
  return applyAction(state, createAction(state.actingPlayerId!, type, amountToMilliBb));
}

describe('deriveActorCallEconomics and contestable pot arithmetic', () => {
  it('prices HU 100bb vs 10bb preflop shove at 45%, not 8.18%, and refunds unmatched excess on call', () => {
    const state = act(dealtTable([100, 10]), ACTION_TYPES.ALL_IN);
    const accounting = derivePotAccounting(state);
    expect(state.potMilliBb).toBe(101_000);
    expect(accounting.contestablePotMilliBb).toBe(2000);
    expect(accounting.unmatchedMilliBb).toBe(99_000);

    const before = JSON.stringify(state);
    const econ = deriveActorCallEconomics(state, 'P1');
    expect(JSON.stringify(state)).toBe(before);
    expect(Object.isFrozen(econ)).toBe(true);
    expect(econ.potAfterCallMilliBb).toBe(110_000);
    expect(econ.callCommitmentMilliBb).toBe(9000);
    expect(econ.actorContestablePotAfterCallMilliBb).toBe(20_000);
    expect(econ.actorIneligiblePotAfterCallMilliBb).toBe(90_000);
    expect(econ.requiredRawEquity).toBe(0.45);
    expect(econ.actorContestablePotAfterCallMilliBb + econ.actorIneligiblePotAfterCallMilliBb).toBe(
      state.potMilliBb + econ.callCommitmentMilliBb,
    );

    const called = act(state, ACTION_TYPES.CALL);
    expect(called.potMilliBb).toBe(20_000);
    expect(called.ledger.at(-1)?.kind).toBe(LEDGER_KINDS.UNCALLED_REFUND);
    expect(derivePotAccounting(called).unmatchedMilliBb).toBe(0);
  });

  it('prices HU unequal-stack postflop shove identically on contestable pot', () => {
    let state = dealtTable([100, 10]);
    state = act(state, ACTION_TYPES.CALL);
    state = act(state, ACTION_TYPES.CHECK);
    state = applyChance(state, { type: CHANCE_TYPES.DEAL_FLOP, cards: ['2h', '3h', '4h'] });
    state = act(state, ACTION_TYPES.CHECK);
    state = act(state, ACTION_TYPES.ALL_IN);

    const econ = deriveActorCallEconomics(state, 'P1');
    expect(econ.callCommitmentMilliBb).toBe(9000);
    expect(econ.actorContestablePotAfterCallMilliBb).toBe(20_000);
    expect(econ.requiredRawEquity).toBe(0.45);
  });

  it('prices multiway short actor and folded dead money strictly within eligible layers', () => {
    let mw = dealtTable([100, 50, 10]);
    mw = act(mw, ACTION_TYPES.ALL_IN);
    mw = act(mw, ACTION_TYPES.CALL);
    const shortEcon = deriveActorCallEconomics(mw, 'P2');
    expect(shortEcon.callCommitmentMilliBb).toBe(9000);
    expect(shortEcon.actorContestablePotAfterCallMilliBb).toBe(30_000);
    expect(shortEcon.actorIneligiblePotAfterCallMilliBb).toBe(130_000);
    expect(shortEcon.requiredRawEquity).toBe(0.3);

    let foldedDead = dealtTable([50, 10, 10, 100]);
    foldedDead = act(foldedDead, ACTION_TYPES.ALL_IN);
    foldedDead = act(foldedDead, ACTION_TYPES.CALL);
    foldedDead = act(foldedDead, ACTION_TYPES.FOLD);
    const deadEcon = deriveActorCallEconomics(foldedDead, 'P2');
    expect(deadEcon.callCommitmentMilliBb).toBe(9000);
    expect(deadEcon.actorContestablePotAfterCallMilliBb).toBe(30_500);
    expect(deadEcon.actorIneligiblePotAfterCallMilliBb).toBe(130_000);
    expect(deadEcon.requiredRawEquity).toBeCloseTo(9 / 30.5, 12);
    expect(
      deadEcon.actorContestablePotAfterCallMilliBb + deadEcon.actorIneligiblePotAfterCallMilliBb,
    ).toBe(foldedDead.potMilliBb + deadEcon.callCommitmentMilliBb);
  });

  it('computes symmetric 100bb shove and returns null requiredRawEquity when no call is needed', () => {
    const shove = act(dealtTable([100, 100]), ACTION_TYPES.ALL_IN);
    const econ = deriveActorCallEconomics(shove, 'P1');
    expect(econ.callCommitmentMilliBb).toBe(99_000);
    expect(econ.actorContestablePotAfterCallMilliBb).toBe(200_000);
    expect(econ.actorIneligiblePotAfterCallMilliBb).toBe(0);
    expect(econ.requiredRawEquity).toBe(0.495);

    const limped = act(dealtTable([100, 100]), ACTION_TYPES.CALL);
    const free = deriveActorCallEconomics(limped, 'P1');
    expect(free.callCommitmentMilliBb).toBe(0);
    expect(free.requiredRawEquity).toBeNull();
  });

  it('derives action size facts, SPR, and MDF deterministically (f2bc809)', () => {
    let state = dealtTable([100, 100]);
    state = act(state, ACTION_TYPES.CALL);
    state = act(state, ACTION_TYPES.CHECK);
    state = applyChance(state, { type: CHANCE_TYPES.DEAL_FLOP, cards: ['Ks', '8h', '4h'] });
    // Pot is 2000 milliBb (2bb); P1 checks, P0 bets 1500 milliBb (75% pot)
    state = act(state, ACTION_TYPES.CHECK);
    const sizeFacts = deriveActionSizeFacts(state, 'P0', 1500);
    expect(Object.isFrozen(sizeFacts)).toBe(true);
    expect(sizeFacts.potShare).toBeCloseTo(0.75, 12);
    expect(sizeFacts.sprAfterCalled).toBeCloseTo(97_500 / 5000, 12);
    expect(
      stackToPotRatio({
        actorContestablePotAfterCallBb: 8.75,
        callAmountBb: 3.75,
        opponentCount: 1,
        effectiveStackBb: 97.5,
      }),
    ).toBeCloseTo(19.5, 12);
    expect(
      minimumDefenseFrequency({
        actorContestablePotAfterCallBb: 8.75,
        callAmountBb: 3.75,
        opponentCount: 1,
      }),
    ).toBeCloseTo(5 / 8.75, 12);
  });
});

describe('economics facts helpers (pot odds, duel SPR, all-in luck, review EV)', () => {
  it('computes potOddsFacts, potOddsFromAfterCall, duelCallFacts, allInLuckFacts, and reviewCallEvFacts', () => {
    const odds = potOddsFacts(9, 27);
    expect(odds.requiredRawEquity).toBe(0.25);
    expect(odds.requiredPercent).toBe(25);
    expect(potOddsFromAfterCall(9, 36).requiredRawEquity).toBe(0.25);
    expect(() => potOddsFromAfterCall(10, 5)).toThrow(/exceed/);

    const duel = duelCallFacts(5, 3.75, 100);
    expect(duel.calledPotBb).toBe(12.5);
    expect(duel.effectiveStackBehindBb).toBe(96.25);
    expect(duel.spr).toBeCloseTo(96.25 / 12.5, 12);
    expect(duel.callerPotOddsFraction).toBeCloseTo(3.75 / 12.5, 12);

    const luck = allInLuckFacts({
      finalPotBb: 80,
      investedBb: 40,
      equityFraction: 903 / 990,
      wonPotBb: 80,
    });
    expect(luck.expectedShareBb).toBeCloseTo(80 * (903 / 990), 10);
    expect(luck.actualNetBb).toBe(40);
    expect(luck.runoutLuckBb).toBeCloseTo(40 - luck.expectedNetBb, 10);

    const review = reviewCallEvFacts({
      finalPotBb: 200,
      heroInvestedBeforeCallBb: 10,
      callAmountBb: 90,
      equityFraction: 253 / 990,
      displayedEquityPercent: 25.6,
      wonPotBb: 0,
    });
    expect(review.requiredCallEquity).toBe(0.45);
    expect(review.displayedExpectedShareBb).toBeCloseTo(51.2, 10);
    expect(review.handEvDisplayedBb).toBeCloseTo(-48.8, 10);
    expect(review.callVsFoldEvDisplayedBb).toBeCloseTo(-38.8, 10);
    expect(review.runoutLuckDisplayedBb).toBeCloseTo(-51.2, 10);
  });

  it('compares hero equity against required price with honest exact-only mistake threshold', async () => {
    const mod = await import('../economics-facts');
    const exactBehind = mod.compareCallEquityToRequired({
      heroEquityFraction: 0.256,
      requiredEquityFraction: 0.45,
      isCallAction: true,
      isExact: true,
    });
    expect(exactBehind.heroEquityPct).toBe(25.6);
    expect(exactBehind.requiredEquityPct).toBe(45);
    expect(exactBehind.deltaVsRequiredPct).toBe(-19.4);
    expect(exactBehind.behindRequiredPrice).toBe(true);

    const withinTolerance = mod.compareCallEquityToRequired({
      heroEquityFraction: 0.45,
      requiredEquityFraction: 0.45,
      isCallAction: true,
      isExact: true,
    });
    expect(withinTolerance.behindRequiredPrice).toBe(false);

    const sampledNotMistake = mod.compareCallEquityToRequired({
      heroEquityFraction: 0.2,
      requiredEquityFraction: 0.45,
      isCallAction: true,
      isExact: false,
    });
    expect(sampledNotMistake.behindRequiredPrice).toBe(false);

    const nonCallNotMistake = mod.compareCallEquityToRequired({
      heroEquityFraction: 0.2,
      requiredEquityFraction: 0.45,
      isCallAction: false,
      isExact: true,
    });
    expect(nonCallNotMistake.behindRequiredPrice).toBe(false);
  });
});
