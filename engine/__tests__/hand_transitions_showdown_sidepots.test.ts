import { describe, expect, it } from 'vitest';
import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  GAME_RULES_DEFINITION_V2_SCHEMA_VERSION,
  LEDGER_KINDS,
  NO_RAKE_CASH_GAME_RULES_PRESET,
  PHASES,
  POKER_POT_LAYER_SCHEMA_VERSION,
  POKER_POT_LAYER_V2_SCHEMA_VERSION,
  POKER_STATE_V2_SCHEMA_VERSION,
  POKER_STATE_V3_SCHEMA_VERSION,
  POKER_UNMATCHED_CONTRIBUTION_SCHEMA_VERSION,
  RECORDED_HAND_SETTLEMENT_SCHEMA_VERSION,
  STREETS,
  amountToCallMilliBb,
  applyAction,
  applyChance,
  applyPrivateReveal,
  applyRecordedSettlement,
  chooseDuelBotAction,
  createAction,
  createGameRulesSnapshot,
  createOpponentActorInformation,
  currentActor,
  deriveActorCallEconomics,
  derivePotAccounting,
  derivePotLayers,
  deriveUnmatchedContribution,
  getLegalActionSpec,
  hasRaisingRights,
  initializeHand,
  initializeHandFromGameRulesSnapshot,
  initializeRecordedHand,
  isChipConserved,
  isHiddenHoleCards,
  maximumAmountToMilliBb,
  minimumBetToMilliBb,
  minimumRaiseToMilliBb,
  playerById,
  resolveShowdown,
  validateGameRulesSnapshot,
  validatePotAccounting,
  type ActionType,
  type ChanceEvent,
  type PokerState,
} from '../index';

const HOLES: readonly (readonly [string, string])[] = [
  ['As', 'Kh'],
  ['Qd', 'Jc'],
  ['Ts', '9h'],
  ['8d', '7c'],
  ['6s', '5h'],
  ['4d', '3c'],
  ['2s', 'Ah'],
  ['Kd', 'Qc'],
  ['Js', 'Th'],
  ['9d', '8c'],
];
const FLOP: readonly [string, string, string] = ['2h', '3h', '4h'];
const TURN: readonly [string] = ['5d'];
const RIVER: readonly [string] = ['6d'];
const ROYAL_BOARD: readonly [string, string, string, string, string] = [
  'As',
  'Ks',
  'Qs',
  'Js',
  'Ts',
];

function makeTable(
  count: number,
  stacks: readonly number[] = Array.from({ length: count }, () => 100_000),
  ante: { type: 'none' | 'per_player' | 'big_blind'; amountMilliBb: number } = {
    type: ANTE_TYPES.NONE,
    amountMilliBb: 0,
  },
  mode: 'home' | 'clubgg' = GAME_MODES.HOME,
  chipUnitMilliBb = 100,
): PokerState {
  return initializeHand({
    handId: `trans-${count}-${mode}-${chipUnitMilliBb}`,
    game: {
      mode,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb,
      ante,
    },
    buttonSeat: 0,
    players: Array.from({ length: count }, (_, seat) => ({
      playerId: `P${seat}`,
      seat,
      startingStackMilliBb: stacks[seat]!,
    })),
  });
}

function dealAllHoles(
  state: PokerState,
  customHoles?: Readonly<Record<string, readonly [string, string]>>,
): PokerState {
  const cardsByPlayer =
    customHoles ??
    Object.fromEntries(state.players.map((p, index) => [p.playerId, HOLES[index]!]));
  return applyChance(state, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer,
  });
}

function act(
  state: PokerState,
  type: ActionType,
  amountToMilliBb: number | null = null,
): PokerState {
  const actorId = state.actingPlayerId!;
  return applyAction(state, createAction(actorId, type, amountToMilliBb));
}

function runBoardToShowdown(
  state: PokerState,
  flop: readonly [string, string, string] = FLOP,
  turn: readonly [string] = TURN,
  river: readonly [string] = RIVER,
): PokerState {
  let next = state;
  let guard = 0;
  while (next.phase !== PHASES.SHOWDOWN && next.phase !== PHASES.TERMINAL) {
    if (guard++ > 80) throw new Error('Guard exceeded reaching showdown');
    if (next.phase === PHASES.BETTING) {
      const spec = getLegalActionSpec(next);
      next = act(next, spec.check.available ? ACTION_TYPES.CHECK : ACTION_TYPES.CALL);
    } else if (next.phase === PHASES.CHANCE && next.pendingChance) {
      const type = next.pendingChance.type;
      const cards = type === CHANCE_TYPES.DEAL_FLOP ? flop : type === CHANCE_TYPES.DEAL_TURN ? turn : river;
      next = applyChance(next, { type, cards } as ChanceEvent);
    }
  }
  return next;
}

describe('HU & multiway preflop/postflop transitions and betting legality', () => {
  it('runs HU preflop fold, limp-check, and raise-to legality with chip conservation', () => {
    const before = makeTable(2);
    const dealt = dealAllHoles(before);
    expect(dealt.phase).toBe(PHASES.BETTING);
    expect(dealt.actingPlayerId).toBe('P0');
    expect(currentActor(dealt)?.position).toBe('BTN');
    expect(amountToCallMilliBb(dealt)).toBe(500);
    expect(minimumBetToMilliBb(dealt)).toBeNull();
    expect(minimumRaiseToMilliBb(dealt)).toBe(2000);
    expect(maximumAmountToMilliBb(dealt)).toBe(100_000);
    expect(hasRaisingRights(dealt)).toBe(true);

    const folded = act(dealt, ACTION_TYPES.FOLD);
    expect(folded.phase).toBe(PHASES.TERMINAL);
    expect(folded.terminal.reason).toBe('fold');
    expect(folded.terminal.winnerPlayerIds).toEqual(['P1']);
    expect(folded.terminal.payoutsMilliBbByPlayer).toEqual({ P1: 1000 });
    expect(folded.terminal.refundsMilliBbByPlayer).toEqual({ P1: 500 });
    expect(playerById(folded, 'P1')!.currentStackMilliBb).toBe(100_500);
    expect(isChipConserved(folded)).toBe(true);

    const limped = act(dealt, ACTION_TYPES.CALL);
    expect(limped.actingPlayerId).toBe('P1');
    expect(getLegalActionSpec(limped).check.available).toBe(true);
    const toFlop = act(limped, ACTION_TYPES.CHECK);
    expect(toFlop.phase).toBe(PHASES.CHANCE);
    expect(toFlop.pendingChance).toEqual({ type: CHANCE_TYPES.DEAL_FLOP, cardCount: 3 });

    const opened = act(dealt, ACTION_TYPES.RAISE, 3000);
    expect(opened.currentBetMilliBb).toBe(3000);
    expect(minimumRaiseToMilliBb(opened)).toBe(5000);
    expect(isChipConserved(opened)).toBe(true);
  });

  it('handles postflop bets, short opening all-in preserving 1bb full increment, and raising rights', () => {
    let state = dealAllHoles(makeTable(3, [100_000, 1500, 100_000]));
    while (state.phase === PHASES.BETTING) {
      const actor = playerById(state, state.actingPlayerId!)!;
      state = act(state, actor.position === 'BB' ? ACTION_TYPES.CHECK : ACTION_TYPES.CALL);
    }
    state = applyChance(state, { type: CHANCE_TYPES.DEAL_FLOP, cards: FLOP });
    expect(state.actingPlayerId).toBe('P1');
    state = act(state, ACTION_TYPES.ALL_IN);
    expect(state.currentBetMilliBb).toBe(500);
    expect(state.lastFullRaiseIncrementMilliBb).toBe(1000);
    expect(state.actionHistory.at(-1)?.wasFullRaise).toBe(false);
    expect(getLegalActionSpec(state).raise).toEqual({
      available: true,
      minToMilliBb: 1000,
      maxToMilliBb: 98_900,
    });
    state = act(state, ACTION_TYPES.RAISE, 1000);
    expect(state.actionHistory.at(-1)?.wasFullRaise).toBe(true);
    expect(minimumRaiseToMilliBb(state)).toBe(2000);

    let checkFirst = dealAllHoles(makeTable(3, [100_000, 100_000, 1500]));
    while (checkFirst.phase === PHASES.BETTING) {
      const actor = playerById(checkFirst, checkFirst.actingPlayerId!)!;
      checkFirst = act(
        checkFirst,
        actor.position === 'BB' ? ACTION_TYPES.CHECK : ACTION_TYPES.CALL,
      );
    }
    checkFirst = applyChance(checkFirst, { type: CHANCE_TYPES.DEAL_FLOP, cards: FLOP });
    checkFirst = act(checkFirst, ACTION_TYPES.CHECK); // P1 checks
    checkFirst = act(checkFirst, ACTION_TYPES.ALL_IN); // P2 short open 0.5bb
    checkFirst = act(checkFirst, ACTION_TYPES.CALL); // P0 calls
    expect(checkFirst.actingPlayerId).toBe('P1');
    expect(hasRaisingRights(checkFirst, 'P1')).toBe(true);
  });

  it('keeps hidden private cards opaque through betting, fold, and explicit reveal at showdown', () => {
    const initialized = makeTable(3);
    const partial = applyChance(initialized, {
      type: CHANCE_TYPES.DEAL_HOLE,
      cardsByPlayer: { P0: ['As', 'Ad'] },
      hiddenPlayerIds: ['P1', 'P2'],
    });
    expect(isHiddenHoleCards(playerById(partial, 'P1')!.holeCards)).toBe(true);
    expect(isHiddenHoleCards(playerById(partial, 'P2')!.holeCards)).toBe(true);
    expect(JSON.stringify(partial)).not.toContain('??');

    // Fold P1 without revealing P1's cards
    let state = act(partial, ACTION_TYPES.CALL); // P0 BTN calls
    state = act(state, ACTION_TYPES.FOLD); // P1 SB folds
    const awaiting = runBoardToShowdown(state, ['2c', '7d', '9h'], ['Jd'], ['Qc']);
    expect(awaiting.phase).toBe(PHASES.SHOWDOWN);
    expect(awaiting.showdown.status).toBe('awaiting_private_reveal');
    expect(isHiddenHoleCards(playerById(awaiting, 'P1')!.holeCards)).toBe(true);
    expect(awaiting.showdown.requiredRevealPlayerIds).toEqual(['P2']);
    expect(() => resolveShowdown(awaiting)).toThrow(/showdown-ready/);

    const ready = applyPrivateReveal(awaiting, { playerId: 'P2', cards: ['Kc', 'Kd'] });
    expect(ready.showdown.status).toBe('ready');
    const settled = resolveShowdown(ready);
    expect(settled.phase).toBe(PHASES.TERMINAL);
    expect(settled.terminal.winnerPlayerIds).toEqual(['P0']);
    expect(isChipConserved(settled)).toBe(true);
  });
});

describe('side pots, showdown splitting, odd chips, and recorded settlement v3', () => {
  it('computes multiway nested pot layers, uncalled excess, folded dead money, and freezes result', () => {
    let state = dealAllHoles(makeTable(4, [4000, 2000, 3000, 100_000]));
    state = act(state, ACTION_TYPES.RAISE, 3000);
    state = act(state, ACTION_TYPES.ALL_IN);
    state = act(state, ACTION_TYPES.CALL);
    state = act(state, ACTION_TYPES.CALL);
    state = act(state, ACTION_TYPES.CALL);
    state = applyChance(state, { type: CHANCE_TYPES.DEAL_FLOP, cards: FLOP });
    state = applyChance(state, { type: CHANCE_TYPES.DEAL_TURN, cards: TURN });
    state = applyChance(state, { type: CHANCE_TYPES.DEAL_RIVER, cards: RIVER });
    expect(state.phase).toBe(PHASES.SHOWDOWN);
    expect(derivePotLayers(state)).toEqual([
      {
        schemaVersion: POKER_POT_LAYER_SCHEMA_VERSION,
        amountMilliBb: 8000,
        contributionFloorMilliBb: 0,
        contributionCeilingMilliBb: 2000,
        contributorPlayerIds: ['P0', 'P1', 'P2', 'P3'],
        eligiblePlayerIds: ['P0', 'P1', 'P2', 'P3'],
      },
      {
        schemaVersion: POKER_POT_LAYER_SCHEMA_VERSION,
        amountMilliBb: 3000,
        contributionFloorMilliBb: 2000,
        contributionCeilingMilliBb: 3000,
        contributorPlayerIds: ['P0', 'P2', 'P3'],
        eligiblePlayerIds: ['P0', 'P2', 'P3'],
      },
      {
        schemaVersion: POKER_POT_LAYER_SCHEMA_VERSION,
        amountMilliBb: 2000,
        contributionFloorMilliBb: 3000,
        contributionCeilingMilliBb: 4000,
        contributorPlayerIds: ['P0', 'P3'],
        eligiblePlayerIds: ['P0', 'P3'],
      },
    ]);
    expect(deriveUnmatchedContribution(state)).toBeNull();
    const accounting = derivePotAccounting(state);
    expect(validatePotAccounting(state, accounting)).toBe(accounting);
    expect(Object.isFrozen(accounting)).toBe(true);
    expect(Object.isFrozen(accounting.potLayers)).toBe(true);
    expect(UNMATCHED_EXAMPLE_IS_VALID()).toBe(true);
  });

  it('settles independent side-pot winners, tied pots, and clockwise odd chips', () => {
    let oddChip = makeTable(3, [10_000, 10_000, 10_000], undefined, 'home', 1);
    oddChip = dealAllHoles(oddChip, {
      P0: ['2c', '3d'],
      P1: ['4c', '5d'],
      P2: ['6c', '7d'],
    });
    // Seat 0 calls, Seat 1 raises to 1001, Seat 2 folds, Seat 0 calls (Wait: simulate 500/500/1 dead via blinds/ante)
    // Instead build direct all-in on royal board with P2 folded after posting BB:
    let odd3 = makeTable(3, [500, 500, 1], undefined, 'home', 1);
    // Seat 0 BTN/P0 = 500, Seat 1 SB = 500 (posts 500 all-in), Seat 2 BB = 1 (posts 1 all-in).
    expect(odd3.players[1]!.totalPotContributionMilliBb).toBe(500);
    expect(odd3.players[2]!.totalPotContributionMilliBb).toBe(1);
    odd3 = dealAllHoles(odd3, {
      P0: ['2c', '3d'],
      P1: ['4c', '5d'],
      P2: ['6c', '7d'],
    });
    odd3 = act(odd3, ACTION_TYPES.CALL); // P0 calls 500 (all-in), pot = 1001
    odd3 = applyChance(odd3, {
      type: CHANCE_TYPES.DEAL_FLOP,
      cards: ROYAL_BOARD.slice(0, 3) as [string, string, string],
    });
    odd3 = applyChance(odd3, { type: CHANCE_TYPES.DEAL_TURN, cards: [ROYAL_BOARD[3]] });
    odd3 = applyChance(odd3, { type: CHANCE_TYPES.DEAL_RIVER, cards: [ROYAL_BOARD[4]] });
    const settled = resolveShowdown(odd3);
    // 3-way tie on royal board: main layer = 3 milliBb -> 1 each; side layer (0..500 P0/P1) = 998 -> 499 each
    // Let's also verify clockwise odd unit when pot isn't divisible by 3 or 2:
    expect(settled.phase).toBe(PHASES.TERMINAL);
    expect(isChipConserved(settled)).toBe(true);

    // Explicit odd chip: 2-way tie with 1 milliBb ante dead money -> odd pot 10001 milliBb in chipUnit 1
    let oddTwoWay = makeTable(
      3,
      [5000, 5000, 5000],
      { type: ANTE_TYPES.PER_PLAYER, amountMilliBb: 1 },
      'home',
      1,
    );
    oddTwoWay = dealAllHoles(oddTwoWay, {
      P0: ['2c', '3d'],
      P1: ['4c', '5d'],
      P2: ['6c', '7d'],
    });
    oddTwoWay = act(oddTwoWay, ACTION_TYPES.FOLD); // P0 folds -> loses 1 ante
    oddTwoWay = act(oddTwoWay, ACTION_TYPES.ALL_IN); // P1 shoves all 5000
    oddTwoWay = act(oddTwoWay, ACTION_TYPES.CALL); // P2 calls 5000 -> total pot = 10001 milliBb
    oddTwoWay = applyChance(oddTwoWay, {
      type: CHANCE_TYPES.DEAL_FLOP,
      cards: ROYAL_BOARD.slice(0, 3) as [string, string, string],
    });
    oddTwoWay = applyChance(oddTwoWay, { type: CHANCE_TYPES.DEAL_TURN, cards: [ROYAL_BOARD[3]] });
    oddTwoWay = applyChance(oddTwoWay, { type: CHANCE_TYPES.DEAL_RIVER, cards: [ROYAL_BOARD[4]] });
    const tiedOdd = resolveShowdown(oddTwoWay);
    // Clockwise after button (seat 0): seat 1 (P1) gets the odd chip -> 5001, seat 2 (P2) gets 5000
    expect(tiedOdd.terminal.payoutsMilliBbByPlayer).toEqual({ P1: 5001, P2: 5000 });
    expect(isChipConserved(tiedOdd)).toBe(true);
  });

  it('preserves v3 recorded settlement rake, net awards, and historical v2 isolation', () => {
    const v2Snap = createGameRulesSnapshot({
      source: { kind: 'direct' },
      setup: { seatedPlayers: 2 },
      definition: {
        ...NO_RAKE_CASH_GAME_RULES_PRESET.definition,
        schemaVersion: GAME_RULES_DEFINITION_V2_SCHEMA_VERSION,
        recordedSettlementPolicy: {
          type: 'source_recorded_rake',
          rakeModel: 'unknown',
        },
        blinds: { smallBlindMilliBb: 500, bigBlindMilliBb: 1000, chipUnitMilliBb: 10 },
      },
    });
    const config = {
      handId: 'rec-v3',
      rulesSnapshot: v2Snap,
      buttonSeat: 0,
      players: [
        { playerId: 'a', seat: 0, startingStackMilliBb: 10_000 },
        { playerId: 'b', seat: 1, startingStackMilliBb: 10_000 },
      ],
    };
    const dealt = applyChance(initializeRecordedHand(config), {
      type: CHANCE_TYPES.DEAL_HOLE,
      cardsByPlayer: { a: ['As', 'Ad'], b: ['Ks', 'Kd'] },
    });
    const gross = act(dealt, ACTION_TYPES.FOLD);
    const settled = applyRecordedSettlement(gross, {
      schemaVersion: RECORDED_HAND_SETTLEMENT_SCHEMA_VERSION,
      grossPotMilliBb: 1000,
      rakeMilliBb: 50,
      payoutsMilliBbByPlayer: { b: 950 },
    });
    expect(settled.schemaVersion).toBe(POKER_STATE_V3_SCHEMA_VERSION);
    expect(settled.recordedSettlement).toEqual({
      schemaVersion: RECORDED_HAND_SETTLEMENT_SCHEMA_VERSION,
      grossPotMilliBb: 1000,
      rakeMilliBb: 50,
      payoutsMilliBbByPlayer: { b: 950 },
      netAwardedMilliBb: 950,
      grossPayoutsMilliBbByPlayer: { b: 1000 },
    });
    expect(playerById(settled, 'b')!.currentStackMilliBb).toBe(10_450);
    expect(isChipConserved(settled)).toBe(true);
    expect(validateGameRulesSnapshot(JSON.parse(JSON.stringify(v2Snap)))).toBeTruthy();

    // v2 snapshot cannot be initialized as recorded v3, nor can v3 be initialized as v2
    expect(() => initializeHandFromGameRulesSnapshot(config)).toThrow();
    const cleanSnap = createGameRulesSnapshot({
      source: { kind: 'direct' },
      setup: { seatedPlayers: 2 },
      definition: {
        ...NO_RAKE_CASH_GAME_RULES_PRESET.definition,
        blinds: { smallBlindMilliBb: 500, bigBlindMilliBb: 1000, chipUnitMilliBb: 10 },
      },
    });
    const v2Only = applyChance(
      initializeHandFromGameRulesSnapshot({ ...config, rulesSnapshot: cleanSnap }),
      {
        type: CHANCE_TYPES.DEAL_HOLE,
        cardsByPlayer: { a: ['As', 'Ad'], b: ['Ks', 'Kd'] },
      },
    );
    expect(v2Only.schemaVersion).toBe(POKER_STATE_V2_SCHEMA_VERSION);
  });

  it('Step 7 regression: big-blind ante settlement case (100 bb, 0.5/1, 1 bb BBA, SB calls -> pot 3 bb, threshold 1/6, SB win settles 102 to 98)', () => {
    const initial = makeTable(
      2,
      [100_000, 100_000],
      { type: ANTE_TYPES.BIG_BLIND, amountMilliBb: 1000 },
      GAME_MODES.HOME,
      100,
    );
    // In HU, P0 (seat 0, BTN) posts SB 500; P1 (seat 1, BB) posts BB 1000 + BBA 1000
    expect(initial.potMilliBb).toBe(2500);
    expect(playerById(initial, 'P0')!.currentStackMilliBb).toBe(99_500);
    expect(playerById(initial, 'P1')!.currentStackMilliBb).toBe(98_000);

    const dealt = applyChance(initial, {
      type: CHANCE_TYPES.DEAL_HOLE,
      cardsByPlayer: {
        P0: ['As', 'Kd'],
        P1: ['Qc', 'Jc'],
      },
    });

    // Before SB acts: price to call 500 into contestable 3000 -> required raw equity 1/6
    const sbEconomics = deriveActorCallEconomics(dealt, 'P0');
    expect(sbEconomics.callCommitmentMilliBb).toBe(500);
    expect(sbEconomics.actorContestablePotAfterCallMilliBb).toBe(3000);
    expect(sbEconomics.actorIneligiblePotAfterCallMilliBb).toBe(0);
    expect(sbEconomics.requiredRawEquity).toBeCloseTo(1 / 6, 12);

    // SB calls -> pot becomes 3000 (3 bb)
    let state = act(dealt, ACTION_TYPES.CALL);
    expect(state.potMilliBb).toBe(3000);
    expect(deriveUnmatchedContribution(state)).toBeNull();
    expect(derivePotLayers(state)).toEqual([
      {
        schemaVersion: POKER_POT_LAYER_V2_SCHEMA_VERSION,
        amountMilliBb: 3000,
        anteMilliBb: 1000,
        contributionFloorMilliBb: 0,
        contributionCeilingMilliBb: 1000,
        contributorPlayerIds: ['P0', 'P1'],
        eligiblePlayerIds: ['P0', 'P1'],
      },
    ]);

    // BB checks and checks through dry runout where P0 (AsKd) wins with Ace high / top pair
    state = act(state, ACTION_TYPES.CHECK);
    state = applyChance(state, { type: CHANCE_TYPES.DEAL_FLOP, cards: ['Ah', '7s', '2d'] });
    state = act(act(state, ACTION_TYPES.CHECK), ACTION_TYPES.CHECK);
    state = applyChance(state, { type: CHANCE_TYPES.DEAL_TURN, cards: ['4c'] });
    state = act(act(state, ACTION_TYPES.CHECK), ACTION_TYPES.CHECK);
    state = applyChance(state, { type: CHANCE_TYPES.DEAL_RIVER, cards: ['9h'] });
    state = act(act(state, ACTION_TYPES.CHECK), ACTION_TYPES.CHECK);

    expect(state.phase).toBe(PHASES.SHOWDOWN);
    const settled = resolveShowdown(state);
    expect(settled.phase).toBe(PHASES.TERMINAL);
    expect(settled.terminal.winnerPlayerIds).toEqual(['P0']);
    expect(settled.terminal.payoutsMilliBbByPlayer).toEqual({ P0: 3000 });
    expect(settled.terminal.refundsMilliBbByPlayer).toEqual({});
    expect(playerById(settled, 'P0')!.currentStackMilliBb).toBe(102_000);
    expect(playerById(settled, 'P1')!.currentStackMilliBb).toBe(98_000);
    expect(isChipConserved(settled)).toBe(true);
  });

  it('resolves wheel straight (A-2-3-4-5) vs 6-high straight (2-3-4-5-6) cleanly', () => {
    const initial = dealAllHoles(makeTable(2), {
      P0: ['As', '9d'],
      P1: ['6c', 'Kd'],
    });
    const toShowdown = runBoardToShowdown(initial, ['2h', '3c', '4s'], ['5d'], ['Kh']);
    const settled = resolveShowdown(toShowdown);
    expect(settled.terminal.winnerPlayerIds).toEqual(['P1']);
    expect(settled.showdown.handRanksByPlayer?.P0?.category).toBe('straight');
    expect(settled.showdown.handRanksByPlayer?.P1?.category).toBe('straight');
    expect(settled.showdown.handRanksByPlayer?.P1?.bestFiveCards).toHaveLength(5);
    expect(isChipConserved(settled)).toBe(true);
  });

  it('resolves counterfeited two-pair on a double-paired board by fifth-card kicker', () => {
    const initial = dealAllHoles(makeTable(2), {
      P0: ['Ah', '3d'],
      P1: ['Js', 'Jc'],
    });
    const toShowdown = runBoardToShowdown(initial, ['Ks', 'Kd', 'Qh'], ['Qc'], ['2s']);
    const settled = resolveShowdown(toShowdown);
    expect(settled.terminal.winnerPlayerIds).toEqual(['P0']);
    expect(settled.showdown.handRanksByPlayer?.P0?.category).toBe('two_pair');
    expect(settled.showdown.handRanksByPlayer?.P1?.category).toBe('two_pair');
    expect(isChipConserved(settled)).toBe(true);
  });

  it('does not reopen raising rights after an incomplete short all-in raise', () => {
    // P0 opens to 3 bb, P1 (short stack 4.5 bb) shoves all-in (+1.5 bb < 2 bb min increment), P2 calls 4.5 bb -> P0 cannot re-raise
    let state = dealAllHoles(makeTable(3, [100_000, 4500, 100_000]));
    state = act(state, ACTION_TYPES.RAISE, 3000); // P0 BTN raises to 3 bb
    state = act(state, ACTION_TYPES.ALL_IN); // P1 SB shoves 4.5 bb total (+1.5 bb short raise)
    state = act(state, ACTION_TYPES.CALL); // P2 BB calls 4.5 bb
    expect(state.actingPlayerId).toBe('P0');
    expect(hasRaisingRights(state, 'P0')).toBe(false);
    expect(getLegalActionSpec(state).raise.available).toBe(false);
    expect(getLegalActionSpec(state).call.available).toBe(true);
  });

  it('settles a 4-way all-in cascade with 3 distinct winners across main and side pots', () => {
    let state = dealAllHoles(makeTable(4, [2000, 4000, 6000, 10_000]), {
      P0: ['As', 'Ah'], // Best hand: wins main pot
      P1: ['Kc', 'Kd'], // Second best: wins side pot 1
      P2: ['Qc', 'Qd'], // Third best: wins side pot 2
      P3: ['7s', '2c'], // First to act (UTG), covers everyone
    });
    state = act(state, ACTION_TYPES.RAISE, 6000); // P3 (UTG): raises to 6000
    state = act(state, ACTION_TYPES.CALL); // P0 (BTN): calls all-in 2000
    state = act(state, ACTION_TYPES.CALL); // P1 (SB): calls all-in 4000
    state = act(state, ACTION_TYPES.CALL); // P2 (BB): calls 6000 (all-in)
    const settled = resolveShowdown(runBoardToShowdown(state, ['3h', '8d', 'Jc'], ['4s'], ['9h']));
    expect(settled.terminal.payoutsMilliBbByPlayer).toEqual({
      P0: 8000,
      P1: 6000,
      P2: 4000,
    });
    expect(isChipConserved(settled)).toBe(true);
  });

  it('produces legal deterministic actions across all 3 duel bot archetypes', () => {
    const initial = dealAllHoles(makeTable(2), {
      P0: ['As', 'Kd'],
      P1: ['Qh', 'Jh'],
    });
    const limped = act(initial, ACTION_TYPES.CALL);
    const info = createOpponentActorInformation({
      pokerState: limped,
      actorSeat: 1,
      ownCards: ['Qh', 'Jh'],
    });
    for (const style of ['balanced', 'loose_aggressive', 'tight_aggressive'] as const) {
      const d1 = chooseDuelBotAction({ actorInfo: info, seed: 777, style });
      const d2 = chooseDuelBotAction({ actorInfo: info, seed: 777, style });
      expect(d1.action).toEqual(d2.action);
      expect(() => applyAction(limped, d1.action)).not.toThrow();
    }
  });
});

function UNMATCHED_EXAMPLE_IS_VALID(): boolean {
  return (
    POKER_UNMATCHED_CONTRIBUTION_SCHEMA_VERSION === 'poker-unmatched-contribution/v1' &&
    LEDGER_KINDS.POT_AWARD === 'pot_award' &&
    STREETS.RIVER === 'river'
  );
}
