import { describe, expect, it } from 'vitest';
import {
  ANTE_TYPES,
  BUILT_IN_GAME_RULES_PRESETS,
  CARD_RANKS,
  CARD_SUITS,
  CHANCE_TYPES,
  CLUBGG_FORCED_CONTRIBUTION_MILLI_BB,
  FIXED_PER_SEATED_PLAYER_LEGACY_GAME_RULES_PRESET,
  GAME_MODES,
  GAME_RULES_COLLECTION_BASES,
  GAME_RULES_COLLECTION_DESTINATIONS,
  GAME_RULES_COLLECTION_ROUNDING,
  GAME_RULES_COLLECTION_SHORTFALL_POLICIES,
  GAME_RULES_COLLECTION_TIMINGS,
  GAME_RULES_COLLECTION_TYPES,
  GAME_RULES_DEFINITION_V2_SCHEMA_VERSION,
  GAME_RULES_FORMATS,
  GAME_RULES_SNAPSHOT_SCHEMA_VERSION,
  GAME_RULES_SNAPSHOT_SOURCE_KINDS,
  HOLDEM_DECK,
  NO_RAKE_CASH_GAME_RULES_PRESET,
  POKER_STATE_SCHEMA_VERSION,
  POKER_STATE_V2_SCHEMA_VERSION,
  POSITIONS_BY_TABLE_SIZE,
  PREFLOP_HAND_CLASSES,
  assertCard,
  assertMilliBbAlignment,
  bbToMilliBb,
  blindAssignments,
  createGameRulesDefinition,
  createGameRulesSnapshot,
  createGameRulesSnapshotFromLegacyGameConfiguration,
  createHiddenHoleCards,
  deriveSeatAssignments,
  getGameRulesSemanticFingerprint,
  initializeHand,
  initializeHandFromGameRulesSnapshot,
  isCard,
  isChipConserved,
  isHiddenHoleCards,
  isPlayerAllIn,
  ledgerTotals,
  milliBbToBb,
  playersClockwiseAfterSeat,
  preflopHandClassForCards,
  totalHandContributionMilliBb,
  validateGameRulesDefinition,
  validateGameRulesPresetSet,
  validateGameRulesSnapshot,
  validateInitializedPokerState,
  validatePokerState,
  type DeepMutable,
  type InitializeLegacyHandConfig,
  type PokerAnteSpec,
  type PokerState,
} from '../index';

function makePlayers(count: number, stackFn: (seat: number) => number = () => 100_000) {
  return Array.from({ length: count }, (_, seat) => ({
    playerId: `P${seat}`,
    seat,
    startingStackMilliBb: stackFn(seat),
  }));
}

function legacyConfig(options: {
  count?: number;
  mode?: 'home' | 'clubgg';
  ante?: PokerAnteSpec;
  buttonSeat?: number;
  chipUnitMilliBb?: number;
  stack?: number | ((seat: number) => number);
  playerSeeds?: { playerId: string; seat: number; startingStackMilliBb: number }[];
} = {}): InitializeLegacyHandConfig {
  const count = options.count ?? 2;
  const stackFn =
    typeof options.stack === 'function'
      ? options.stack
      : () => (typeof options.stack === 'number' ? options.stack : 100_000);
  return {
    handId: `init-test-${count}-${options.mode ?? 'home'}`,
    game: {
      mode: options.mode ?? GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: options.chipUnitMilliBb ?? 100,
      ante: options.ante ?? { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: options.buttonSeat ?? 0,
    players: options.playerSeeds ?? makePlayers(count, stackFn),
  };
}

describe('cards, amounts, and hand classes', () => {
  it('validates canonical 52-card deck and rejects malformed cards', () => {
    expect(CARD_RANKS).toHaveLength(13);
    expect(CARD_SUITS).toHaveLength(4);
    expect(HOLDEM_DECK).toHaveLength(52);
    expect(new Set(HOLDEM_DECK).size).toBe(52);
    expect(HOLDEM_DECK.every(isCard)).toBe(true);
    expect(isCard('As')).toBe(true);
    expect(isCard('Th')).toBe(true);
    expect(isCard('as')).toBe(false);
    expect(isCard('AS')).toBe(false);
    expect(assertCard('As')).toBe('As');
    expect(() => assertCard('as')).toThrow(/strict two-character/i);
  });

  it('converts between bb and integer milliBb deterministically', () => {
    expect(bbToMilliBb(1)).toBe(1000);
    expect(bbToMilliBb(2.5)).toBe(2500);
    expect(bbToMilliBb(0.5)).toBe(500);
    expect(milliBbToBb(2500)).toBe(2.5);
    expect(milliBbToBb(125)).toBe(0.125);
    expect(() => bbToMilliBb(-1)).toThrow();
    expect(() => bbToMilliBb(0.0004)).toThrow();
    expect(assertMilliBbAlignment(2500, 100, 'test')).toBe(2500);
    expect(() => assertMilliBbAlignment(2550, 100, 'test')).toThrow(/align/i);
  });

  it('maps any unordered pair to canonical 169 preflop hand classes', () => {
    expect(PREFLOP_HAND_CLASSES).toHaveLength(169);
    expect(preflopHandClassForCards(['As', 'Ad'])).toBe('AA');
    expect(preflopHandClassForCards(['Kh', 'Ah'])).toBe('AKs');
    expect(preflopHandClassForCards(['Qd', 'Ac'])).toBe('AQo');
    expect(preflopHandClassForCards(['7c', '2s'])).toBe('72o');
  });

  it('represents unknown private hole cards structurally without sentinel card strings', () => {
    const hidden = createHiddenHoleCards();
    expect(isHiddenHoleCards(hidden)).toBe(true);
    expect(isHiddenHoleCards(['As', 'Kd'])).toBe(false);
    expect(Object.isFrozen(hidden)).toBe(true);
    expect(JSON.stringify(hidden)).not.toContain('??');
  });
});

describe('positions and clockwise seat geometry', () => {
  it('assigns canonical table positions for 2 through 10 players and wraps clockwise', () => {
    for (let count = 2; count <= 10; count += 1) {
      const names = POSITIONS_BY_TABLE_SIZE[count]!;
      expect(names).toHaveLength(count);
      expect(new Set(names).size).toBe(count);
    }
    expect(POSITIONS_BY_TABLE_SIZE[2]).toEqual(['BTN', 'BB']);
    expect(POSITIONS_BY_TABLE_SIZE[6]).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']);

    const players = makePlayers(6);
    const derived = deriveSeatAssignments(players, 4);
    const btn = derived.find((seat) => seat.position === 'BTN');
    const sb = derived.find((seat) => seat.position === 'SB');
    const bb = derived.find((seat) => seat.position === 'BB');
    expect(btn?.seat).toBe(4);
    expect(sb?.seat).toBe(5);
    expect(bb?.seat).toBe(0);

    const clockwise = playersClockwiseAfterSeat(players, 4);
    expect(clockwise.map((p) => p.seat)).toEqual([5, 0, 1, 2, 3]);
  });
});

describe('hand initialization, ClubGG deductions, and antes', () => {
  it('initializes HU and multiway ClubGG forced contributions outside the contestable pot', () => {
    for (const count of [7, 9, 10]) {
      const state = initializeHand(legacyConfig({ count, mode: 'clubgg' }));
      expect(state.schemaVersion).toBe(POKER_STATE_SCHEMA_VERSION);
      expect(state.deductionTotalMilliBb).toBe(count * CLUBGG_FORCED_CONTRIBUTION_MILLI_BB);
      expect(state.potMilliBb).toBe(1500);
      expect(
        state.ledger
          .filter((entry) => entry.kind === 'clubgg_forced_contribution')
          .every((entry) => entry.movement === 'stack_to_deduction'),
      ).toBe(true);
      expect(ledgerTotals(state)).toEqual({
        potMilliBb: 1500,
        deductionMilliBb: count * 100,
      });
      expect(isChipConserved(state)).toBe(true);
    }
  });

  it('never reapplies ClubGG deductions across repeated selector calls', () => {
    const state = initializeHand(legacyConfig({ count: 9, mode: 'clubgg' }));
    const before = JSON.stringify(state);
    for (let i = 0; i < 10; i += 1) {
      ledgerTotals(state);
      blindAssignments(state);
      state.players.forEach((player) => totalHandContributionMilliBb(player));
    }
    expect(JSON.stringify(state)).toBe(before);
    expect(state.deductionTotalMilliBb).toBe(900);
  });

  it('posts per-player antes into pot without inflating street contributions or price to call', () => {
    const state = initializeHand(
      legacyConfig({
        count: 3,
        ante: { type: ANTE_TYPES.PER_PLAYER, amountMilliBb: 100 },
      }),
    );
    const byPos = Object.fromEntries(state.players.map((p) => [p.position, p]));
    expect(state.potMilliBb).toBe(1800);
    expect(byPos.BTN?.totalPotContributionMilliBb).toBe(100);
    expect(byPos.BTN?.streetContributionMilliBb).toBe(0);
    expect(byPos.SB?.totalPotContributionMilliBb).toBe(600);
    expect(byPos.SB?.streetContributionMilliBb).toBe(500);
    expect(byPos.BB?.totalPotContributionMilliBb).toBe(1100);
    expect(byPos.BB?.streetContributionMilliBb).toBe(1000);
    expect(state.currentBetMilliBb).toBe(1000);
    expect(state.ledger.filter((entry) => entry.kind === 'ante')).toHaveLength(3);
    expect(isChipConserved(state)).toBe(true);
  });

  it('posts big-blind ante only from BB and does not change street bet', () => {
    const state = initializeHand(
      legacyConfig({
        count: 6,
        ante: { type: ANTE_TYPES.BIG_BLIND, amountMilliBb: 600 },
      }),
    );
    const { bigBlindPlayerId } = blindAssignments(state);
    const bb = state.players.find((p) => p.playerId === bigBlindPlayerId);
    expect(state.ledger.filter((entry) => entry.kind === 'ante')).toHaveLength(1);
    expect(state.ledger.find((entry) => entry.kind === 'ante')?.playerId).toBe(bigBlindPlayerId);
    expect(bb?.totalPotContributionMilliBb).toBe(1600);
    expect(bb?.streetContributionMilliBb).toBe(1000);
    expect(state.potMilliBb).toBe(2100);
    expect(state.currentBetMilliBb).toBe(1000);
    expect(isChipConserved(state)).toBe(true);
  });

  it('caps short antes and short blinds cleanly while preserving pendingChance', () => {
    const shortAnte = initializeHand(
      legacyConfig({
        count: 4,
        stack: (seat) => (seat === 3 ? 200 : 100_000),
        ante: { type: ANTE_TYPES.PER_PLAYER, amountMilliBb: 300 },
      }),
    );
    const shortPlayer = shortAnte.players.find((p) => p.playerId === 'P3')!;
    expect(shortPlayer.currentStackMilliBb).toBe(0);
    expect(shortPlayer.totalPotContributionMilliBb).toBe(200);
    expect(shortPlayer.streetContributionMilliBb).toBe(0);
    expect(isPlayerAllIn(shortPlayer)).toBe(true);
    expect(Object.hasOwn(shortPlayer, 'allIn')).toBe(false);
    expect(isChipConserved(shortAnte)).toBe(true);

    const shortBlinds = initializeHand(
      legacyConfig({
        playerSeeds: [
          { playerId: 'P0', seat: 0, startingStackMilliBb: 300 },
          { playerId: 'P1', seat: 1, startingStackMilliBb: 700 },
        ],
      }),
    );
    expect(shortBlinds.potMilliBb).toBe(1000);
    expect(shortBlinds.currentBetMilliBb).toBe(1000);
    expect(shortBlinds.pendingChance?.type).toBe(CHANCE_TYPES.DEAL_HOLE);
    expect(shortBlinds.players.every(isPlayerAllIn)).toBe(true);
    expect(isChipConserved(shortBlinds)).toBe(true);
  });

  it('rejects duplicate ids, duplicate seats, bad button, misaligned stacks, and ClubGG shortfall', () => {
    expect(() =>
      initializeHand(
        legacyConfig({
          playerSeeds: [
            { playerId: 'dup', seat: 0, startingStackMilliBb: 100_000 },
            { playerId: 'dup', seat: 1, startingStackMilliBb: 100_000 },
          ],
        }),
      ),
    ).toThrow(/Duplicate playerId/);
    expect(() =>
      initializeHand(
        legacyConfig({
          playerSeeds: [
            { playerId: 'P0', seat: 0, startingStackMilliBb: 100_000 },
            { playerId: 'P1', seat: 0, startingStackMilliBb: 100_000 },
          ],
        }),
      ),
    ).toThrow(/Duplicate seat/);
    expect(() => initializeHand(legacyConfig({ buttonSeat: 9 }))).toThrow(/buttonSeat/);
    expect(() => initializeHand(legacyConfig({ stack: -1 }))).toThrow(/nonnegative safe integer/);
    expect(() => initializeHand(legacyConfig({ stack: 1001, chipUnitMilliBb: 10 }))).toThrow(/align/);
    expect(() =>
      initializeHand(
        legacyConfig({
          count: 7,
          mode: 'clubgg',
          chipUnitMilliBb: 1,
          stack: (seat) => (seat === 4 ? 99 : 100_000),
        }),
      ),
    ).toThrow(/cannot pay exactly 100 milliBb/);
  });

  it('conserves chips and detects tampered state', () => {
    for (const fixture of [
      legacyConfig(),
      legacyConfig({ count: 10 }),
      legacyConfig({ count: 7, mode: 'clubgg' }),
      legacyConfig({ count: 6, ante: { type: ANTE_TYPES.BIG_BLIND, amountMilliBb: 1000 } }),
    ]) {
      const state = initializeHand(fixture);
      expect(validatePokerState(state)).toBe(state);
      expect(validateInitializedPokerState(state)).toBe(state);
      expect(isChipConserved(state)).toBe(true);
    }

    const tampered = JSON.parse(
      JSON.stringify(initializeHand(legacyConfig())),
    ) as DeepMutable<PokerState>;
    tampered.players[0]!.holeCards = ['As', 'Kh'];
    tampered.players[1]!.holeCards = ['As', 'Qh'];
    expect(() => validatePokerState(tampered)).toThrow(/Duplicate known card: As/);
  });
});

describe('game rules v1/v2 contracts and legacy compatibility', () => {
  it('validates built-in presets, table bounds, straddles, and collection policies', () => {
    expect(BUILT_IN_GAME_RULES_PRESETS).toHaveLength(2);
    expect(Object.isFrozen(BUILT_IN_GAME_RULES_PRESETS)).toBe(true);
    expect(() =>
      validateGameRulesPresetSet([
        NO_RAKE_CASH_GAME_RULES_PRESET,
        { ...structuredClone(NO_RAKE_CASH_GAME_RULES_PRESET), revision: 2 },
      ]),
    ).toThrow(/Duplicate GameRulesPreset id/);

    const legacyClubgg = createGameRulesSnapshotFromLegacyGameConfiguration(
      {
        mode: GAME_MODES.CLUBGG,
        smallBlindMilliBb: 500,
        bigBlindMilliBb: 1000,
        chipUnitMilliBb: 100,
        ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
      },
      7,
    );
    expect(legacyClubgg.definition.format).toBe(GAME_RULES_FORMATS.LEGACY_UNSPECIFIED);
    expect(legacyClubgg.definition.tableSize).toEqual({ minimumSeated: 7, maximumSeated: 10 });
    expect(legacyClubgg.definition.collectionPolicy).toEqual({
      type: GAME_RULES_COLLECTION_TYPES.FIXED_PER_SEATED_PLAYER,
      amountMilliBb: 100,
      timing: GAME_RULES_COLLECTION_TIMINGS.HAND_START_BEFORE_ANTES_AND_BLINDS,
      basis: GAME_RULES_COLLECTION_BASES.SEATED_PLAYERS,
      destination: GAME_RULES_COLLECTION_DESTINATIONS.OUTSIDE_CONTESTABLE_POT,
      rounding: GAME_RULES_COLLECTION_ROUNDING.NONE,
      shortfallPolicy: GAME_RULES_COLLECTION_SHORTFALL_POLICIES.REJECT_HAND,
    });
    expect(FIXED_PER_SEATED_PLAYER_LEGACY_GAME_RULES_PRESET.definition.collectionPolicy.type).toBe(
      GAME_RULES_COLLECTION_TYPES.FIXED_PER_SEATED_PLAYER,
    );

    const legacyHome = createGameRulesSnapshotFromLegacyGameConfiguration(
      {
        mode: GAME_MODES.HOME,
        smallBlindMilliBb: 500,
        bigBlindMilliBb: 1000,
        chipUnitMilliBb: 100,
        ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
      },
      6,
    );
    expect(legacyHome.schemaVersion).toBe(GAME_RULES_SNAPSHOT_SCHEMA_VERSION);
    expect(legacyHome.source).toEqual({
      kind: GAME_RULES_SNAPSHOT_SOURCE_KINDS.LEGACY_COMPATIBILITY,
      presetId: NO_RAKE_CASH_GAME_RULES_PRESET.id,
      presetRevision: NO_RAKE_CASH_GAME_RULES_PRESET.revision,
      legacyMode: 'home',
    });
    expect(legacyHome.semanticFingerprint).toBe(
      getGameRulesSemanticFingerprint(legacyHome.definition),
    );
    expect(validateGameRulesSnapshot(legacyHome)).toStrictEqual(legacyHome);

    const v2State = initializeHandFromGameRulesSnapshot({
      handId: 'snapshot-v2-hand',
      rulesSnapshot: legacyHome,
      buttonSeat: 0,
      players: makePlayers(6),
    });
    expect(v2State.schemaVersion).toBe(POKER_STATE_V2_SCHEMA_VERSION);
    expect(isChipConserved(v2State)).toBe(true);
  });

  it('fails closed on unknown variants, bad table sizes, percentage rake, and v2 tampering', () => {
    const base = structuredClone(NO_RAKE_CASH_GAME_RULES_PRESET.definition) as unknown as Record<
      string,
      unknown
    >;
    expect(() => validateGameRulesDefinition({ ...base, variant: 'pot_limit_omaha' })).toThrow(
      /Unsupported game rules variant/,
    );
    expect(() =>
      createGameRulesDefinition({
        ...NO_RAKE_CASH_GAME_RULES_PRESET.definition,
        tableSize: { minimumSeated: 1, maximumSeated: 10 },
      }),
    ).toThrow(/tableSize/);
    expect(() =>
      createGameRulesDefinition({
        ...NO_RAKE_CASH_GAME_RULES_PRESET.definition,
        straddle: { type: 'utg' as unknown as 'none' },
      }),
    ).toThrow(/Unsupported straddle type/);
    expect(() =>
      createGameRulesDefinition({
        ...NO_RAKE_CASH_GAME_RULES_PRESET.definition,
        collectionPolicy: {
          type: 'percentage_rake' as unknown as 'none',
        },
      }),
    ).toThrow(/Unsupported collection policy type/);

    const v2Def = createGameRulesDefinition({
      ...NO_RAKE_CASH_GAME_RULES_PRESET.definition,
      schemaVersion: GAME_RULES_DEFINITION_V2_SCHEMA_VERSION,
      recordedSettlementPolicy: {
        type: 'source_recorded_rake',
        rakeModel: 'unknown',
      },
    });
    const v2Snap = createGameRulesSnapshot({
      source: { kind: 'direct' },
      setup: { seatedPlayers: 2 },
      definition: v2Def,
    });
    expect(v2Snap.definition.schemaVersion).toBe(GAME_RULES_DEFINITION_V2_SCHEMA_VERSION);
  });
});
