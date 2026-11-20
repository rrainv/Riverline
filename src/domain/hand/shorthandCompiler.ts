import {
  HOLDEM_DECK,
  type EngineClient,
  type PokerState,
} from '../../engine-api';
import {
  parseActionShorthandToken,
  validateActionShorthandToken,
} from '../shorthand';
import type {
  EquityStreet,
  RecordedActionMeta,
  SavedHandPayload,
  TableRulesPresetId,
} from '../storage';
import type { RecordedStep } from './types';

export interface ShorthandCompileResult {
  readonly ok: true;
  readonly steps: readonly RecordedStep[];
  readonly pokerState: PokerState;
  readonly recordedActions: readonly RecordedActionMeta[];
  readonly actionCount: number;
  readonly boardCardCount: number;
}

export interface ShorthandCompileError {
  readonly ok: false;
  readonly failedToken: string;
  readonly message: string;
}

export function createInitialDealtHandState(
  engine: EngineClient,
  options: {
    readonly handId: string;
    readonly seatCount: 6 | 8;
    readonly startingStackBb: number;
    readonly heroSeatIndex: number;
    readonly heroCards: readonly [string, string];
  },
): PokerState {
  const rulesRes = engine.sync.createGameRulesSnapshot({
    source: { kind: 'direct' },
    setup: { seatedPlayers: options.seatCount },
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
  if (!rulesRes.ok) {
    throw new Error(rulesRes.error.message);
  }

  const startingStackMilliBb = options.startingStackBb * 1000;
  const clampedHeroSeat =
    ((options.heroSeatIndex % options.seatCount) + options.seatCount) % options.seatCount;
  const players = Array.from({ length: options.seatCount }, (_, seat) => ({
    playerId: seat === clampedHeroSeat ? 'hero' : `seat-${seat}`,
    seat,
    startingStackMilliBb,
  }));

  const initRes = engine.sync.initializeRecordedHand({
    handId: options.handId,
    rulesSnapshot: rulesRes.data,
    buttonSeat: 0,
    players,
  });
  if (!initRes.ok) {
    throw new Error(initRes.error.message);
  }

  const deck = [...HOLDEM_DECK];
  const [c0, c1] = options.heroCards;
  const safeCards: readonly [string, string] =
    c0 !== c1 && deck.includes(c0) && deck.includes(c1)
      ? options.heroCards
      : [deck[0] ?? 'As', deck[1] ?? 'Kd'];

  const otherIds = players.filter((p) => p.playerId !== 'hero').map((p) => p.playerId);
  const dealRes = engine.sync.applyChance(initRes.data, {
    type: 'deal_hole',
    cardsByPlayer: { hero: safeCards },
    hiddenPlayerIds: otherIds,
  });
  if (!dealRes.ok) {
    throw new Error(dealRes.error.message);
  }
  return dealRes.data;
}

/**
 * Compiles validated shorthand tokens onto a dealt initial PokerState.
 * Shared single authority for Hand Recorder and Game Night quick hand capture.
 */
export function compileShorthandTokensToState(
  engine: EngineClient,
  baseState: PokerState,
  tokens: readonly string[],
): ShorthandCompileResult | ShorthandCompileError {
  if (tokens.length === 0) {
    return { ok: false, failedToken: '', message: 'Empty shorthand line' };
  }

  for (const tok of tokens) {
    const validRes = validateActionShorthandToken(tok);
    if (!validRes.valid) {
      return { ok: false, failedToken: tok, message: tok };
    }
  }

  let cur = baseState;
  const parsedSteps: RecordedStep[] = [];
  const recordedActions: RecordedActionMeta[] = [];
  let stagedCards: string[] = [];

  const applyActionStep = (
    step: Extract<RecordedStep, { kind: 'action' }>,
  ): string | null => {
    const actor = cur.players.find((p) => p.playerId === step.playerId);
    const nextRes = engine.sync.applyAction(cur, {
      schemaVersion: 'poker-action/v1',
      playerId: step.playerId,
      type: step.type,
      amountToMilliBb: step.amountToMilliBb,
    });
    if (!nextRes.ok) {
      return nextRes.error.message;
    }
    recordedActions.push({
      seq: recordedActions.length + 1,
      street: cur.street as EquityStreet,
      playerId: step.playerId,
      seatIndex: actor?.seat ?? 0,
      positionLabel: actor?.position ?? '',
      isHero: step.playerId === 'hero',
      type: step.type,
      ...(step.amountToMilliBb !== null ? { amountMilliBb: step.amountToMilliBb } : {}),
      ...(step.approximate ? { approximate: true } : {}),
    });
    parsedSteps.push(step);
    cur = nextRes.data;
    return null;
  };

  const flushBoardIfReady = (): string | null => {
    if (stagedCards.length === 0) return null;
    if (cur.phase !== 'chance' || !cur.pendingChance || cur.pendingChance.type === 'deal_hole') {
      return 'Board cards appeared while betting is still open';
    }
    if (stagedCards.length !== cur.pendingChance.cardCount) {
      return `Expected ${cur.pendingChance.cardCount} board cards for ${cur.pendingChance.type}`;
    }
    const nextRes = engine.sync.applyChance(cur, {
      type: cur.pendingChance.type,
      cards: stagedCards,
    });
    if (!nextRes.ok) {
      return nextRes.error.message;
    }
    parsedSteps.push({
      kind: 'chance',
      chanceType: cur.pendingChance.type,
      cards: [...stagedCards],
    });
    cur = nextRes.data;
    stagedCards = [];
    return null;
  };

  for (const tok of tokens) {
    const parsed = parseActionShorthandToken(tok);
    if (!parsed.ok) {
      return { ok: false, failedToken: tok, message: tok };
    }

    if (parsed.kind === 'street_sep') {
      if (stagedCards.length > 0) {
        const err = flushBoardIfReady();
        if (err) return { ok: false, failedToken: tok, message: err };
      }
      continue;
    }

    if (parsed.kind === 'board_cards') {
      stagedCards.push(...parsed.cards);
      if (
        cur.phase === 'chance' &&
        cur.pendingChance &&
        cur.pendingChance.type !== 'deal_hole' &&
        stagedCards.length === cur.pendingChance.cardCount
      ) {
        const err = flushBoardIfReady();
        if (err) return { ok: false, failedToken: tok, message: err };
      }
      continue;
    }

    if (stagedCards.length > 0) {
      const err = flushBoardIfReady();
      if (err) return { ok: false, failedToken: tok, message: err };
    }

    if (parsed.kind === 'position') {
      const target = cur.players.find((p) => p.position === parsed.position);
      if (!target) {
        return { ok: false, failedToken: tok, message: tok };
      }
      let guard = 0;
      while (cur.phase === 'betting' && cur.actingPlayerId !== target.playerId) {
        if (guard >= cur.players.length) {
          return { ok: false, failedToken: tok, message: tok };
        }
        guard += 1;
        const legalRes = engine.sync.legalActions(cur);
        if (!legalRes.ok) {
          return { ok: false, failedToken: tok, message: legalRes.error.message };
        }
        const legal = legalRes.data;
        const autoType = legal.fold.available
          ? 'fold'
          : legal.check.available
            ? 'check'
            : null;
        if (!autoType) {
          return { ok: false, failedToken: tok, message: tok };
        }
        const err = applyActionStep({
          kind: 'action',
          playerId: legal.playerId,
          type: autoType,
          amountToMilliBb: null,
          approximate: false,
        });
        if (err) return { ok: false, failedToken: tok, message: err };
      }
      if (cur.phase !== 'betting' || cur.actingPlayerId !== target.playerId) {
        return { ok: false, failedToken: tok, message: tok };
      }
      continue;
    }

    if (cur.phase !== 'betting' || !cur.actingPlayerId) {
      return { ok: false, failedToken: tok, message: tok };
    }

    const legalRes = engine.sync.legalActions(cur);
    if (!legalRes.ok) {
      return { ok: false, failedToken: tok, message: legalRes.error.message };
    }
    const legal = legalRes.data;

    let step: Extract<RecordedStep, { kind: 'action' }>;
    if (
      parsed.kind === 'fold' ||
      parsed.kind === 'check' ||
      parsed.kind === 'call' ||
      parsed.kind === 'all_in'
    ) {
      step = {
        kind: 'action',
        playerId: legal.playerId,
        type: parsed.kind,
        amountToMilliBb: null,
        approximate: false,
      };
    } else {
      const isAllInExact =
        legal.allIn.available &&
        legal.allIn.amountToMilliBb !== null &&
        parsed.amountMilliBb === legal.allIn.amountToMilliBb;
      step = isAllInExact
        ? {
            kind: 'action',
            playerId: legal.playerId,
            type: 'all_in',
            amountToMilliBb: null,
            approximate: parsed.approximate,
          }
        : {
            kind: 'action',
            playerId: legal.playerId,
            type: parsed.kind,
            amountToMilliBb: parsed.amountMilliBb,
            approximate: parsed.approximate,
          };
    }

    const err = applyActionStep(step);
    if (err) return { ok: false, failedToken: tok, message: err };
  }

  if (stagedCards.length > 0) {
    const err = flushBoardIfReady();
    if (err) return { ok: false, failedToken: '', message: err };
  }

  return {
    ok: true,
    steps: parsedSteps,
    pokerState: cur,
    recordedActions,
    actionCount: recordedActions.length,
    boardCardCount: cur.board.length,
  };
}

export function buildSavedHandPayloadFromCompiled(input: {
  readonly handId: string;
  readonly tablePreset: TableRulesPresetId;
  readonly unitLabel: 'bb' | '₪';
  readonly seatCount: 6 | 8;
  readonly startingStackBb: number;
  readonly heroSeatIndex: number;
  readonly heroCards: readonly [string, string];
  readonly shorthandLine: string;
  readonly compiled: ShorthandCompileResult;
  readonly handNote?: string;
}): SavedHandPayload {
  const heroPlayer = input.compiled.pokerState.players.find((p) => p.playerId === 'hero');
  const trimmedNote = input.handNote?.trim();
  return {
    handId: input.handId,
    tablePreset: input.tablePreset,
    unitLabel: input.unitLabel,
    seatCount: input.seatCount,
    startingStackBb: input.startingStackBb,
    heroPlayerId: 'hero',
    heroSeat: heroPlayer?.seat ?? input.heroSeatIndex,
    heroPositionLabel: heroPlayer?.position ?? 'BTN',
    heroCards: [input.heroCards[0], input.heroCards[1]],
    pokerState: input.compiled.pokerState,
    recordedActions: [...input.compiled.recordedActions],
    heroNotes: [],
    shorthandLine: input.shorthandLine,
    savedKind: input.compiled.pokerState.terminal.isTerminal
      ? 'completed_hand'
      : 'mid_hand_spot',
    ...(trimmedNote ? { handNote: trimmedNote } : {}),
  };
}
