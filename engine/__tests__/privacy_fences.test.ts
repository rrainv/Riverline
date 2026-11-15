import { describe, expect, it } from 'vitest';
import {
  ACTION_TYPES,
  ANTE_TYPES,
  CANONICAL_HAND_REPLAY_RECONSTRUCTION_SCHEMA_VERSION,
  CANONICAL_HAND_REPLAY_SOURCE_SCHEMA_VERSION,
  CHANCE_TYPES,
  GAME_MODES,
  REPLAY_FRAME_OPERATIONS,
  applyAction,
  applyChance,
  applyPrivateReveal,
  createAction,
  createCanonicalHandReplaySource,
  createOpponentActorInformation,
  createTrainingMemoryPresentationGate,
  deriveCanonicalHandReplayEvent,
  initializeHand,
  isHiddenHoleCards,
  reconstructCanonicalHandReplaySource,
  resolveShowdown,
  type PokerState,
} from '../index';

function baseConfig(handId = 'privacy-test') {
  return {
    handId,
    game: {
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: [
      { playerId: 'P0', seat: 0, startingStackMilliBb: 100_000 },
      { playerId: 'P1', seat: 1, startingStackMilliBb: 100_000 },
    ],
  };
}

function dealtKnownPair(
  p0Cards: readonly [string, string],
  p1Cards: readonly [string, string],
): PokerState {
  return applyChance(initializeHand(baseConfig()), {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { P0: p0Cards, P1: p1Cards },
  });
}

describe('Step 7 regressions: bot/actor privacy fence, replay non-leakage, and training embargo', () => {
  it('bot actor information strictly hides all opponent hole cards even when known in live PokerState', () => {
    const stateA = dealtKnownPair(['As', 'Ad'], ['2c', '7d']);
    const stateB = dealtKnownPair(['As', 'Ad'], ['Kh', 'Kd']);

    const infoA = createOpponentActorInformation({ pokerState: stateA, actorSeat: 0 });
    const infoB = createOpponentActorInformation({ pokerState: stateB, actorSeat: 0 });

    // Changing P1's hole cards in engine state produces an identical actor view for P0
    expect(infoA).toEqual(infoB);
    expect(infoA.ownCards).toEqual(['As', 'Ad']);
    expect(JSON.stringify(infoA)).not.toContain('2c');
    expect(JSON.stringify(infoA)).not.toContain('7d');
    expect(JSON.stringify(infoA)).not.toContain('Kh');
    expect(Object.isFrozen(infoA)).toBe(true);

    // Rejects wrong seat or spoofed ownCards
    expect(() =>
      createOpponentActorInformation({ pokerState: stateA, actorSeat: 1 }),
    ).toThrow(/current actor/i);
    expect(() =>
      createOpponentActorInformation({
        pokerState: stateA,
        actorSeat: 0,
        ownCards: ['Kh', 'Kd'],
      }),
    ).toThrow();
  });

  it('replay reconstruction never leaks later private reveal backward into earlier frames', () => {
    const s0 = initializeHand(baseConfig('replay-fence'));
    const s1 = applyChance(s0, {
      type: CHANCE_TYPES.DEAL_HOLE,
      cardsByPlayer: { P0: ['As', 'Ad'] },
      hiddenPlayerIds: ['P1'],
    });
    const s2 = applyAction(s1, createAction('P0', ACTION_TYPES.ALL_IN));
    const s3 = applyAction(s2, createAction('P1', ACTION_TYPES.CALL));
    const s4 = applyChance(s3, { type: CHANCE_TYPES.DEAL_FLOP, cards: ['2c', '3d', '4s'] });
    const s5 = applyChance(s4, { type: CHANCE_TYPES.DEAL_TURN, cards: ['9h'] });
    const s6 = applyChance(s5, { type: CHANCE_TYPES.DEAL_RIVER, cards: ['Kc'] });
    const s7 = applyPrivateReveal(s6, { playerId: 'P1', cards: ['Qd', 'Qs'] });
    const s8 = resolveShowdown(s7);

    const events = [
      deriveCanonicalHandReplayEvent({
        sequence: 0,
        operation: REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND,
        state: s0,
      }),
      deriveCanonicalHandReplayEvent({
        sequence: 1,
        operation: REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED,
        previousState: s0,
        state: s1,
      }),
      deriveCanonicalHandReplayEvent({
        sequence: 2,
        operation: REPLAY_FRAME_OPERATIONS.ACTION,
        previousState: s1,
        state: s2,
      }),
      deriveCanonicalHandReplayEvent({
        sequence: 3,
        operation: REPLAY_FRAME_OPERATIONS.ACTION,
        previousState: s2,
        state: s3,
      }),
      deriveCanonicalHandReplayEvent({
        sequence: 4,
        operation: REPLAY_FRAME_OPERATIONS.DEAL_BOARD,
        previousState: s3,
        state: s4,
      }),
      deriveCanonicalHandReplayEvent({
        sequence: 5,
        operation: REPLAY_FRAME_OPERATIONS.DEAL_BOARD,
        previousState: s4,
        state: s5,
      }),
      deriveCanonicalHandReplayEvent({
        sequence: 6,
        operation: REPLAY_FRAME_OPERATIONS.DEAL_BOARD,
        previousState: s5,
        state: s6,
      }),
      deriveCanonicalHandReplayEvent({
        sequence: 7,
        operation: REPLAY_FRAME_OPERATIONS.REVEAL_HOLE,
        previousState: s6,
        state: s7,
      }),
      deriveCanonicalHandReplayEvent({
        sequence: 8,
        operation: REPLAY_FRAME_OPERATIONS.SHOWDOWN,
        previousState: s7,
        state: s8,
      }),
    ];

    const source = createCanonicalHandReplaySource({ heroPlayerId: 'P0', events });
    expect(source.schemaVersion).toBe(CANONICAL_HAND_REPLAY_SOURCE_SCHEMA_VERSION);
    const rebuilt = reconstructCanonicalHandReplaySource(source);
    expect(rebuilt.schemaVersion).toBe(CANONICAL_HAND_REPLAY_RECONSTRUCTION_SCHEMA_VERSION);
    expect(rebuilt.frames).toHaveLength(9);

    // Frame 0: undealt
    expect(rebuilt.frames[0]!.state.players.every((p) => p.holeCards === null)).toBe(true);
    // Frames 1..6 (before reveal_hole at sequence 7): P1 must remain hidden without Qd/Qs leaked!
    for (let idx = 1; idx <= 6; idx += 1) {
      const frame = rebuilt.frames[idx]!;
      expect(isHiddenHoleCards(frame.state.players[1]!.holeCards)).toBe(true);
      expect(JSON.stringify(frame)).not.toContain('Qd');
      expect(JSON.stringify(frame)).not.toContain('Qs');
    }
    // Frames 7..8: P1 revealed as QdQs and settled
    expect(rebuilt.frames[7]!.state.players[1]!.holeCards).toEqual(['Qd', 'Qs']);
    expect(rebuilt.finalState.terminal.winnerPlayerIds).toEqual(['P0']);
  });

  it('embargoes analysis while a full-hand training session is in progress', () => {
    const embargoed = createTrainingMemoryPresentationGate(
      { mode: 'full_hand', status: 'active' },
      { fullHandReviewUnlocked: false },
    );
    expect(embargoed.feedbackEmbargoed).toBe(true);
    expect(embargoed.revealAnswerAndReference).toBe(false);
    expect(embargoed.revealReviewReasons).toBe(false);
    expect(embargoed.revealSessionVerdict).toBe(false);

    const unlocked = createTrainingMemoryPresentationGate(
      { mode: 'full_hand', status: 'completed' },
      { fullHandReviewUnlocked: true },
    );
    expect(unlocked.feedbackEmbargoed).toBe(false);
    expect(unlocked.revealAnswerAndReference).toBe(true);
    expect(unlocked.revealReviewReasons).toBe(true);
    expect(unlocked.revealSessionVerdict).toBe(true);
  });
});
