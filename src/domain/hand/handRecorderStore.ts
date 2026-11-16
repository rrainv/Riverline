import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals';
import {
  createEngineClient,
  HOLDEM_DECK,
  type ActorCallEconomics,
  type EngineClient,
  type GameRulesSnapshot,
  type LegalActionSpec,
  type PokerState,
} from '../../engine-api';
import {
  tokenizeActionShorthandLine,
} from '../shorthand';
import {
  compileShorthandTokensToState,
} from './shorthandCompiler';
import {
  getDefaultStudyRepository,
  type EquityStreet,
  type HeroDecisionNote,
  type RecordedActionMeta,
  type SavedHandPayload,
  type SavedHandRecord,
  type StudyRepository,
  type TableRulesPresetId,
  type ThinkingReasonId,
} from '../storage';
import type {
  AvailableSeatPosition,
  HandRecorderStore,
  RecordedStep,
  RecorderHandSnapshot,
  RecorderInputMode,
  RecorderLadderOption,
  RecorderPresetId,
  RecorderSideTab,
  TablePresetSpec,
  TicketChoiceId,
} from './types';

export const TABLE_PRESETS: Readonly<Record<TableRulesPresetId, TablePresetSpec>> = {
  six_max_100bb: {
    id: 'six_max_100bb',
    unitLabel: 'bb',
    defaultSeatCount: 6,
    allowedSeats: [6],
    startingStackBb: 100,
  },
  home_game_50bb: {
    id: 'home_game_50bb',
    unitLabel: '₪',
    defaultSeatCount: 6,
    allowedSeats: [6, 8],
    startingStackBb: 50,
  },
};

const DEFAULT_HERO_CARDS: readonly [string, string] = ['As', 'Kd'];

let handSequence = 0;

function nextHandId(): string {
  handSequence += 1;
  return `hand-rec-${handSequence}`;
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function snapToHalfOrTenth(value: number): number {
  return Math.round(value * 2) / 2;
}

function formatCompactAmount(milliBb: number): string {
  const units = milliBb / 1000;
  return Number.isInteger(units) ? String(units) : String(roundToTenth(units));
}

function actionStepToToken(step: Extract<RecordedStep, { kind: 'action' }>): string {
  if (step.type === 'fold') return 'f';
  if (step.type === 'check') return 'x';
  if (step.type === 'call') return 'c';
  if (step.type === 'all_in') return 'allin';
  const verb = step.type === 'bet' ? 'b' : 'r';
  const approx = step.approximate ? '~' : '';
  const amt = step.amountToMilliBb !== null ? formatCompactAmount(step.amountToMilliBb) : '0';
  return `${verb}${approx}${amt}`;
}

function stepsToShorthandTokens(steps: readonly RecordedStep[]): string[] {
  const out: string[] = [];
  for (const step of steps) {
    if (step.kind === 'action') {
      out.push(actionStepToToken(step));
    } else if (step.kind === 'chance') {
      out.push('/');
      out.push(step.cards.join(''));
    }
  }
  return out;
}

function pickInitialBoardFallbackCards(
  seatCount: number,
  heroCards: readonly [string, string],
): readonly [string, string] {
  const deck = [...HOLDEM_DECK];
  const cardA = heroCards[0];
  const cardB = heroCards[1];
  if (cardA !== cardB && deck.includes(cardA) && deck.includes(cardB)) {
    return heroCards;
  }
  const available = deck.filter((c) => seatCount > 0 && c !== cardA);
  return [available[0] ?? 'As', available[1] ?? 'Kd'];
}

export interface CreateHandRecorderStoreOptions {
  readonly engine?: EngineClient;
  readonly repository?: StudyRepository;
  readonly autoLoadSaved?: boolean;
  readonly initialPreset?: RecorderPresetId;
}

export function createHandRecorderStore(
  options: CreateHandRecorderStoreOptions = {},
): HandRecorderStore {
  const engine = options.engine ?? createEngineClient({ mode: 'inline' });
  const repository = options.repository ?? getDefaultStudyRepository();

  const tablePresetSignal: Signal<TableRulesPresetId> = signal('six_max_100bb');
  const seatCountSignal: Signal<6 | 8> = signal(6);
  const heroSeatIndexSignal: Signal<number> = signal(0);
  const heroCardsSignal: Signal<readonly [string, string]> = signal(DEFAULT_HERO_CARDS);
  const stepsSignal: Signal<readonly RecordedStep[]> = signal([]);
  const heroNotesSignal: Signal<readonly HeroDecisionNote[]> = signal([]);

  const inputModeSignal: Signal<RecorderInputMode> = signal('tap');
  const activeSideTabSignal: Signal<RecorderSideTab> = signal('record');
  const selectedTicketSignal: Signal<TicketChoiceId | undefined> = signal(undefined);
  const selectedSizeIdSignal: Signal<'s1' | 's2' | 's3'> = signal('s2');
  const sizeOverridesSignal: Signal<Partial<Record<'s1' | 's2' | 's3', number>>> = signal({});
  const approximateSizeSignal: Signal<boolean> = signal(false);
  const pendingBoardCardsSignal: Signal<readonly string[]> = signal([]);

  const shorthandTokensSignal: Signal<readonly string[]> = signal([]);
  const shorthandDraftSignal: Signal<string> = signal('');
  const shorthandErrorSignal: Signal<string | null> = signal(null);

  const selectedNoteActionSeqSignal: Signal<number | null> = signal(null);
  const savedHandsSignal: Signal<readonly SavedHandRecord[]> = signal([]);
  const linkedNightSessionIdSignal: Signal<string | null> = signal(null);
  const handIdSignal: Signal<string> = signal(nextHandId());

  const rulesCache = new Map<number, GameRulesSnapshot>();

  function getRulesSnapshot(seatCount: 6 | 8): GameRulesSnapshot {
    const cached = rulesCache.get(seatCount);
    if (cached) return cached;
    const res = engine.sync.createGameRulesSnapshot({
      source: { kind: 'direct' },
      setup: { seatedPlayers: seatCount },
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
    if (!res.ok) {
      throw new Error(res.error.message);
    }
    rulesCache.set(seatCount, res.data);
    return res.data;
  }

  function createDealtInitialState(
    seatCount: 6 | 8,
    heroSeat: number,
    heroCards: readonly [string, string],
    handId: string,
  ): PokerState {
    const rulesSnapshot = getRulesSnapshot(seatCount);
    const startingStackMilliBb = TABLE_PRESETS[tablePresetSignal.value].startingStackBb * 1000;
    const clampedHeroSeat = ((heroSeat % seatCount) + seatCount) % seatCount;
    const players = Array.from({ length: seatCount }, (_, seat) => ({
      playerId: seat === clampedHeroSeat ? 'hero' : `seat-${seat}`,
      seat,
      startingStackMilliBb,
    }));
    const initRes = engine.sync.initializeRecordedHand({
      handId,
      rulesSnapshot,
      buttonSeat: 0,
      players,
    });
    if (!initRes.ok) {
      throw new Error(initRes.error.message);
    }
    const safeCards = pickInitialBoardFallbackCards(seatCount, heroCards);
    const otherIds = players
      .filter((p) => p.playerId !== 'hero')
      .map((p) => p.playerId);
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

  function replayStepsOntoState(
    baseState: PokerState,
    steps: readonly RecordedStep[],
  ): {
    readonly ok: true;
    readonly state: PokerState;
    readonly actions: readonly RecordedActionMeta[];
  } | {
    readonly ok: false;
    readonly error: string;
    readonly failedIndex: number;
  } {
    let cur = baseState;
    const actions: RecordedActionMeta[] = [];

    for (let i = 0; i < steps.length; i += 1) {
      const step = steps[i]!;
      if (step.kind === 'action') {
        const actor = cur.players.find((p) => p.playerId === step.playerId);
        const res = engine.sync.applyAction(cur, {
          schemaVersion: 'poker-action/v1',
          playerId: step.playerId,
          type: step.type,
          amountToMilliBb: step.amountToMilliBb,
        });
        if (!res.ok) {
          return { ok: false, error: res.error.message, failedIndex: i };
        }
        actions.push({
          seq: actions.length + 1,
          street: cur.street as EquityStreet,
          playerId: step.playerId,
          seatIndex: actor?.seat ?? 0,
          positionLabel: actor?.position ?? '',
          isHero: step.playerId === 'hero',
          type: step.type,
          ...(step.amountToMilliBb !== null ? { amountMilliBb: step.amountToMilliBb } : {}),
          ...(step.approximate ? { approximate: true } : {}),
        });
        cur = res.data;
      } else if (step.kind === 'chance') {
        const res = engine.sync.applyChance(cur, {
          type: step.chanceType,
          cards: step.cards,
        });
        if (!res.ok) {
          return { ok: false, error: res.error.message, failedIndex: i };
        }
        cur = res.data;
      } else {
        const revealRes = engine.sync.applyPrivateReveal(cur, {
          playerId: step.playerId,
          cards: step.cards,
        });
        if (!revealRes.ok) {
          return { ok: false, error: revealRes.error.message, failedIndex: i };
        }
        cur = revealRes.data;
        if (cur.phase === 'showdown' && cur.showdown.status === 'ready') {
          const settled = engine.sync.resolveShowdown(cur);
          if (!settled.ok) {
            return { ok: false, error: settled.error.message, failedIndex: i };
          }
          cur = settled.data;
        }
      }
    }

    return { ok: true, state: cur, actions };
  }

  const unitLabelSignal: ReadonlySignal<'bb' | '₪'> = computed(
    () => TABLE_PRESETS[tablePresetSignal.value].unitLabel,
  );

  const startingStackBbSignal: ReadonlySignal<number> = computed(
    () => TABLE_PRESETS[tablePresetSignal.value].startingStackBb,
  );

  const handSnapshotSignal: ReadonlySignal<RecorderHandSnapshot> = computed(() => {
    const seatCount = seatCountSignal.value;
    const heroSeat = heroSeatIndexSignal.value;
    const heroCards = heroCardsSignal.value;
    const steps = stepsSignal.value;
    const handId = handIdSignal.value;

    const baseState = createDealtInitialState(seatCount, heroSeat, heroCards, handId);
    const availablePositions: AvailableSeatPosition[] = baseState.players
      .map((p) => ({ seatIndex: p.seat, position: p.position }));

    const replayed = replayStepsOntoState(baseState, steps);
    const pokerState = replayed.ok ? replayed.state : baseState;
    const recordedActions = replayed.ok ? replayed.actions : [];

    let legalActions: LegalActionSpec | null = null;
    let callEconomics: ActorCallEconomics | null = null;
    if (pokerState.phase === 'betting' && pokerState.actingPlayerId) {
      const legalRes = engine.sync.legalActions(pokerState);
      if (legalRes.ok) {
        legalActions = legalRes.data;
        const econRes = engine.sync.actorCallEconomics(pokerState, legalActions.playerId);
        if (econRes.ok) {
          callEconomics = econRes.data;
        }
      }
    }

    const deadCardSet = new Set<string>(heroCards);
    for (const c of pokerState.board) deadCardSet.add(c);
    for (const p of pokerState.players) {
      if (Array.isArray(p.holeCards)) {
        for (const c of p.holeCards) deadCardSet.add(c);
      }
    }

    const derivedTokens = stepsToShorthandTokens(steps);

    return {
      pokerState,
      recordedActions,
      legalActions,
      callEconomics,
      availablePositions,
      shorthandLine: derivedTokens.join(' '),
      shorthandTokens: derivedTokens,
      deadCards: [...deadCardSet],
    };
  });

  const currentStreetSignal: ReadonlySignal<EquityStreet> = computed(
    () => handSnapshotSignal.value.pokerState.street as EquityStreet,
  );

  const ladderOptionsSignal: ReadonlySignal<readonly RecorderLadderOption[]> = computed(() => {
    const snap = handSnapshotSignal.value;
    const state = snap.pokerState;
    const legal = snap.legalActions;
    const unit = unitLabelSignal.value;
    if (!legal || state.phase !== 'betting') return [];

    const isBet = legal.bet.available;
    const isRaise = legal.raise.available;
    if (!isBet && !isRaise) return [];

    const minMilli = isBet ? legal.bet.minToMilliBb! : legal.raise.minToMilliBb!;
    const maxMilli =
      legal.allIn.amountToMilliBb ??
      (isBet ? legal.bet.maxToMilliBb! : legal.raise.maxToMilliBb!);
    const minUnits = roundToTenth(minMilli / 1000);
    const maxUnits = roundToTenth(maxMilli / 1000);
    const potUnits = state.potMilliBb / 1000;
    const curBetUnits = state.currentBetMilliBb / 1000;

    let rawDefaults: [number, number, number];
    if (state.street === 'preflop') {
      if (state.currentBetMilliBb <= state.game.bigBlindMilliBb) {
        rawDefaults = [2.2, 2.5, 3];
      } else {
        rawDefaults = [
          snapToHalfOrTenth(curBetUnits * 2.5),
          snapToHalfOrTenth(curBetUnits * 3),
          snapToHalfOrTenth(curBetUnits * 3.5),
        ];
      }
    } else if (state.currentBetMilliBb === 0) {
      rawDefaults = [
        Math.max(minUnits, snapToHalfOrTenth(potUnits * 0.33)),
        Math.max(minUnits, snapToHalfOrTenth(potUnits * 0.5)),
        Math.max(minUnits, snapToHalfOrTenth(potUnits * 0.75)),
      ];
    } else {
      rawDefaults = [
        Math.max(minUnits, snapToHalfOrTenth(curBetUnits * 2.5)),
        Math.max(minUnits, snapToHalfOrTenth(curBetUnits * 3)),
        Math.max(minUnits, snapToHalfOrTenth(curBetUnits + potUnits)),
      ];
    }

    const overrides = sizeOverridesSignal.value;
    const ids: readonly ('s1' | 's2' | 's3')[] = ['s1', 's2', 's3'];

    return ids.map((id, idx) => {
      const candidate = overrides[id] ?? rawDefaults[idx]!;
      const clampedUnits = roundToTenth(Math.min(maxUnits, Math.max(minUnits, candidate)));
      const rawMilli = Math.round(clampedUnits * 1000);
      const chipUnit = state.game.chipUnitMilliBb;
      const snappedMilli = Math.max(
        minMilli,
        Math.min(maxMilli, Math.round(rawMilli / chipUnit) * chipUnit),
      );
      const factsRes = engine.sync.actionSizeFacts(state, legal.playerId, snappedMilli);
      const potShare = factsRes.ok ? factsRes.data.potShare : null;
      const sprAfterCalled = factsRes.ok ? factsRes.data.sprAfterCalled : null;

      return {
        id,
        value: roundToTenth(snappedMilli / 1000),
        unit,
        amountMilliBb: snappedMilli,
        potShare,
        sprAfterCalled,
        min: minUnits,
        max: maxUnits,
        step: 0.5,
        isAllIn: legal.allIn.amountToMilliBb !== null && snappedMilli === legal.allIn.amountToMilliBb,
      };
    });
  });

  const canFoldRemainingToHeroSignal: ReadonlySignal<boolean> = computed(() => {
    const snap = handSnapshotSignal.value;
    const state = snap.pokerState;
    const legal = snap.legalActions;
    if (state.phase !== 'betting' || !legal) return false;
    if (state.actingPlayerId === 'hero') return false;
    const hero = state.players.find((p) => p.playerId === 'hero');
    if (!hero || hero.folded) return false;
    return legal.fold.available;
  });

  const activeHeroNoteSignal = computed(() => {
    const snap = handSnapshotSignal.value;
    const chosenSeq = selectedNoteActionSeqSignal.value;
    const heroActions = snap.recordedActions.filter((a) => a.isHero);
    const fallbackHeroAction = heroActions[heroActions.length - 1];
    const targetSeq = chosenSeq ?? fallbackHeroAction?.seq ?? 0;
    const targetStreet =
      snap.recordedActions.find((a) => a.seq === targetSeq)?.street ??
      (snap.pokerState.street as EquityStreet);
    const existing = heroNotesSignal.value.find(
      (n) => n.actionSeq === targetSeq && n.street === targetStreet,
    );
    return {
      keySeq: targetSeq,
      street: targetStreet,
      reasonChip: existing?.reasonChip,
      customText: existing?.customText ?? '',
    };
  });

  function clearEphemeralInteraction(): void {
    selectedTicketSignal.value = undefined;
    selectedSizeIdSignal.value = 's2';
    sizeOverridesSignal.value = {};
    approximateSizeSignal.value = false;
    pendingBoardCardsSignal.value = [];
    shorthandErrorSignal.value = null;
  }

  function syncShorthandTokensFromSteps(): void {
    shorthandTokensSignal.value = stepsToShorthandTokens(stepsSignal.value);
  }

  function resetHand(): void {
    handIdSignal.value = nextHandId();
    stepsSignal.value = [];
    heroNotesSignal.value = [];
    selectedNoteActionSeqSignal.value = null;
    shorthandTokensSignal.value = [];
    shorthandDraftSignal.value = '';
    clearEphemeralInteraction();
  }

  function setTablePreset(preset: TableRulesPresetId): void {
    if (tablePresetSignal.value === preset) return;
    tablePresetSignal.value = preset;
    const allowed = TABLE_PRESETS[preset].allowedSeats;
    if (!allowed.includes(seatCountSignal.value)) {
      seatCountSignal.value = TABLE_PRESETS[preset].defaultSeatCount;
    }
    if (heroSeatIndexSignal.value >= seatCountSignal.value) {
      heroSeatIndexSignal.value = 0;
    }
    resetHand();
  }

  function setSeatCount(count: 6 | 8): void {
    const allowed = TABLE_PRESETS[tablePresetSignal.value].allowedSeats;
    const target = allowed.includes(count) ? count : allowed[0]!;
    if (seatCountSignal.value === target) return;
    seatCountSignal.value = target;
    if (heroSeatIndexSignal.value >= target) {
      heroSeatIndexSignal.value = 0;
    }
    resetHand();
  }

  function setHeroSeatIndex(seatIndex: number): void {
    const count = seatCountSignal.value;
    const clamped = ((seatIndex % count) + count) % count;
    if (heroSeatIndexSignal.value === clamped) return;
    heroSeatIndexSignal.value = clamped;
    resetHand();
  }

  function setHeroCard(slotIndex: 0 | 1, card: string): void {
    const cur = heroCardsSignal.value;
    const otherSlot = slotIndex === 0 ? 1 : 0;
    if (cur[otherSlot] === card) return;
    const stateBoard = handSnapshotSignal.value.pokerState.board;
    if (stateBoard.includes(card)) return;
    const next: readonly [string, string] =
      slotIndex === 0 ? [card, cur[1]] : [cur[0], card];
    heroCardsSignal.value = next;
  }

  function setInputMode(mode: RecorderInputMode): void {
    inputModeSignal.value = mode;
    if (mode === 'shorthand') {
      syncShorthandTokensFromSteps();
    }
    shorthandErrorSignal.value = null;
  }

  function setActiveSideTab(tab: RecorderSideTab): void {
    activeSideTabSignal.value = tab;
    if (tab === 'saved') {
      void refreshSavedHands();
    }
  }

  function selectTicket(ticket: TicketChoiceId | undefined): void {
    selectedTicketSignal.value = ticket;
    if (ticket !== 'bet' && ticket !== 'raise') {
      approximateSizeSignal.value = false;
    }
  }

  function selectSizeId(sizeId: 's1' | 's2' | 's3'): void {
    selectedSizeIdSignal.value = sizeId;
  }

  function adjustLadderSize(sizeId: 's1' | 's2' | 's3', nextValue: number): void {
    sizeOverridesSignal.value = {
      ...sizeOverridesSignal.value,
      [sizeId]: roundToTenth(nextValue),
    };
    selectedSizeIdSignal.value = sizeId;
  }

  function resetSizeLadder(): void {
    sizeOverridesSignal.value = {};
  }

  function setApproximateSize(next: boolean): void {
    approximateSizeSignal.value = next;
  }

  function appendStep(step: RecordedStep): boolean {
    const nextSteps = [...stepsSignal.value, step];
    const baseState = createDealtInitialState(
      seatCountSignal.value,
      heroSeatIndexSignal.value,
      heroCardsSignal.value,
      handIdSignal.value,
    );
    const test = replayStepsOntoState(baseState, nextSteps);
    if (!test.ok) {
      shorthandErrorSignal.value = test.error;
      return false;
    }
    stepsSignal.value = nextSteps;
    syncShorthandTokensFromSteps();
    clearEphemeralInteraction();
    return true;
  }

  function confirmTicketAction(): boolean {
    const snap = handSnapshotSignal.value;
    const legal = snap.legalActions;
    const ticket = selectedTicketSignal.value;
    if (!legal || !ticket || snap.pokerState.phase !== 'betting') return false;

    if (ticket === 'fold') {
      if (!legal.fold.available) return false;
      return appendStep({
        kind: 'action',
        playerId: legal.playerId,
        type: 'fold',
        amountToMilliBb: null,
        approximate: false,
      });
    }
    if (ticket === 'check') {
      if (!legal.check.available) return false;
      return appendStep({
        kind: 'action',
        playerId: legal.playerId,
        type: 'check',
        amountToMilliBb: null,
        approximate: false,
      });
    }
    if (ticket === 'call') {
      if (!legal.call.available) return false;
      return appendStep({
        kind: 'action',
        playerId: legal.playerId,
        type: 'call',
        amountToMilliBb: null,
        approximate: false,
      });
    }
    if (ticket === 'all_in') {
      if (!legal.allIn.available) return false;
      return appendStep({
        kind: 'action',
        playerId: legal.playerId,
        type: 'all_in',
        amountToMilliBb: null,
        approximate: false,
      });
    }

    const ladder = ladderOptionsSignal.value;
    const chosen =
      ladder.find((opt) => opt.id === selectedSizeIdSignal.value) ?? ladder[0];
    if (!chosen) return false;
    const approx = approximateSizeSignal.value;
    if (chosen.isAllIn) {
      return appendStep({
        kind: 'action',
        playerId: legal.playerId,
        type: 'all_in',
        amountToMilliBb: null,
        approximate: approx,
      });
    }
    return appendStep({
      kind: 'action',
      playerId: legal.playerId,
      type: ticket,
      amountToMilliBb: chosen.amountMilliBb,
      approximate: approx,
    });
  }

  function foldRemainingToHeroOrEnd(): number {
    let added = 0;
    let workingSteps = [...stepsSignal.value];
    const baseState = createDealtInitialState(
      seatCountSignal.value,
      heroSeatIndexSignal.value,
      heroCardsSignal.value,
      handIdSignal.value,
    );

    for (let guard = 0; guard < seatCountSignal.value + 2; guard += 1) {
      const replayed = replayStepsOntoState(baseState, workingSteps);
      if (!replayed.ok) break;
      const st = replayed.state;
      if (st.phase !== 'betting' || !st.actingPlayerId || st.actingPlayerId === 'hero') {
        break;
      }
      const hero = st.players.find((p) => p.playerId === 'hero');
      if (!hero || hero.folded) break;
      const legalRes = engine.sync.legalActions(st);
      if (!legalRes.ok || !legalRes.data.fold.available) break;

      workingSteps = [
        ...workingSteps,
        {
          kind: 'action',
          playerId: st.actingPlayerId,
          type: 'fold',
          amountToMilliBb: null,
          approximate: false,
        },
      ];
      added += 1;
    }

    if (added > 0) {
      stepsSignal.value = workingSteps;
      syncShorthandTokensFromSteps();
      clearEphemeralInteraction();
    }
    return added;
  }

  function togglePendingBoardCard(card: string): void {
    const snap = handSnapshotSignal.value;
    const pending = snap.pokerState.pendingChance;
    if (snap.pokerState.phase !== 'chance' || !pending || pending.type === 'deal_hole') {
      return;
    }
    if (snap.deadCards.includes(card)) return;
    const cur = pendingBoardCardsSignal.value;
    if (cur.includes(card)) {
      pendingBoardCardsSignal.value = cur.filter((c) => c !== card);
      return;
    }
    if (cur.length >= pending.cardCount) {
      pendingBoardCardsSignal.value = [...cur.slice(0, pending.cardCount - 1), card];
      return;
    }
    pendingBoardCardsSignal.value = [...cur, card];
  }

  function commitPendingBoardCards(): boolean {
    const snap = handSnapshotSignal.value;
    const pending = snap.pokerState.pendingChance;
    if (snap.pokerState.phase !== 'chance' || !pending || pending.type === 'deal_hole') {
      return false;
    }
    const chosen = pendingBoardCardsSignal.value;
    if (chosen.length !== pending.cardCount) return false;
    return appendStep({
      kind: 'chance',
      chanceType: pending.type,
      cards: [...chosen],
    });
  }

  function dealRandomPendingStreet(seed?: number): boolean {
    const snap = handSnapshotSignal.value;
    const pending = snap.pokerState.pendingChance;
    if (snap.pokerState.phase !== 'chance' || !pending || pending.type === 'deal_hole') {
      return false;
    }
    const dead = new Set(snap.deadCards);
    const pool = HOLDEM_DECK.filter((c) => !dead.has(c));
    const needed = pending.cardCount;
    const staged = pendingBoardCardsSignal.value.filter((c) => !dead.has(c));
    const picks: string[] = [...staged];

    let rngState = (seed ?? (stepsSignal.value.length * 9301 + 49297)) >>> 0;
    const remainingPool = pool.filter((c) => !picks.includes(c));
    while (picks.length < needed && remainingPool.length > 0) {
      rngState = (rngState * 1664525 + 1013904223) >>> 0;
      const idx = rngState % remainingPool.length;
      const picked = remainingPool.splice(idx, 1)[0]!;
      picks.push(picked);
    }
    if (picks.length !== needed) return false;
    return appendStep({
      kind: 'chance',
      chanceType: pending.type,
      cards: picks,
    });
  }

  function revealOpponentHoleCards(playerId: string, cards: readonly [string, string]): boolean {
    return appendStep({
      kind: 'reveal',
      playerId,
      cards,
    });
  }

  function stepBack(): boolean {
    const steps = stepsSignal.value;
    if (steps.length === 0) return false;
    stepsSignal.value = steps.slice(0, -1);
    syncShorthandTokensFromSteps();
    clearEphemeralInteraction();
    return true;
  }

  function setShorthandTokens(tokens: readonly string[]): void {
    shorthandTokensSignal.value = [...tokens];
    shorthandErrorSignal.value = null;
  }

  function setShorthandDraft(draft: string): void {
    shorthandDraftSignal.value = draft;
    shorthandErrorSignal.value = null;
  }

  function applyShorthandLine(): boolean {
    const draftExtra = shorthandDraftSignal.value.trim()
      ? tokenizeActionShorthandLine(shorthandDraftSignal.value)
      : [];
    const tokens = [...shorthandTokensSignal.value, ...draftExtra];
    if (draftExtra.length > 0) {
      shorthandTokensSignal.value = tokens;
      shorthandDraftSignal.value = '';
    }

    const baseState = createDealtInitialState(
      seatCountSignal.value,
      heroSeatIndexSignal.value,
      heroCardsSignal.value,
      handIdSignal.value,
    );
    const compiled = compileShorthandTokensToState(engine, baseState, tokens);
    if (!compiled.ok) {
      shorthandErrorSignal.value = compiled.message;
      return false;
    }

    stepsSignal.value = [...compiled.steps];
    clearEphemeralInteraction();
    return true;
  }

  function selectNoteActionSeq(seq: number | null): void {
    selectedNoteActionSeqSignal.value = seq;
  }

  function upsertHeroNote(patch: {
    readonly reasonChip?: ThinkingReasonId | undefined;
    readonly toggleChip?: ThinkingReasonId;
    readonly customText?: string;
  }): void {
    const active = activeHeroNoteSignal.value;
    const seq = active.keySeq;
    const street = active.street;
    const existingList = [...heroNotesSignal.value];
    const idx = existingList.findIndex((n) => n.actionSeq === seq && n.street === street);
    const prev = idx >= 0 ? existingList[idx]! : { actionSeq: seq, street };

    let nextChip = prev.reasonChip;
    if (patch.toggleChip !== undefined) {
      nextChip = prev.reasonChip === patch.toggleChip ? undefined : patch.toggleChip;
    } else if ('reasonChip' in patch) {
      nextChip = patch.reasonChip;
    }

    const nextText =
      patch.customText !== undefined ? patch.customText : (prev.customText ?? '');

    if (!nextChip && !nextText.trim()) {
      if (idx >= 0) existingList.splice(idx, 1);
      heroNotesSignal.value = existingList;
      return;
    }

    const nextEntry: HeroDecisionNote = {
      actionSeq: seq,
      street,
      ...(nextChip ? { reasonChip: nextChip } : {}),
      ...(nextText ? { customText: nextText } : {}),
    };
    if (idx >= 0) {
      existingList[idx] = nextEntry;
    } else {
      existingList.push(nextEntry);
    }
    heroNotesSignal.value = existingList;
  }

  function toggleHeroReasonChip(reason: ThinkingReasonId): void {
    upsertHeroNote({ toggleChip: reason });
  }

  function setHeroCustomNote(text: string): void {
    upsertHeroNote({ customText: text });
  }

  function buildSavedPayload(): SavedHandPayload {
    const snap = handSnapshotSignal.value;
    const preset = TABLE_PRESETS[tablePresetSignal.value];
    const heroPlayer = snap.pokerState.players.find((p) => p.playerId === 'hero');
    return {
      handId: handIdSignal.value,
      tablePreset: tablePresetSignal.value,
      unitLabel: preset.unitLabel,
      seatCount: seatCountSignal.value,
      startingStackBb: preset.startingStackBb,
      heroPlayerId: 'hero',
      heroSeat: heroPlayer?.seat ?? heroSeatIndexSignal.value,
      heroPositionLabel: heroPlayer?.position ?? 'BTN',
      heroCards: [heroCardsSignal.value[0], heroCardsSignal.value[1]],
      pokerState: snap.pokerState,
      recordedActions: [...snap.recordedActions],
      heroNotes: [...heroNotesSignal.value],
      shorthandLine: snap.shorthandLine,
      savedKind: snap.pokerState.terminal.isTerminal ? 'completed_hand' : 'mid_hand_spot',
    };
  }

  async function refreshSavedHands(): Promise<SavedHandRecord[]> {
    const list = await repository.listSavedHands();
    savedHandsSignal.value = list;
    return list;
  }

  async function saveCurrentHand(): Promise<SavedHandRecord> {
    const saved = await repository.saveHand(buildSavedPayload());
    const linkedNightId = linkedNightSessionIdSignal.value;
    if (linkedNightId) {
      await repository.linkHandToNight({
        nightSessionId: linkedNightId,
        handObjectId: saved.objectId,
        shorthandSummary: saved.payload.shorthandLine,
      });
    }
    await refreshSavedHands();
    return saved;
  }

  function setLinkedNightSessionId(nightId: string | null): void {
    linkedNightSessionIdSignal.value = nightId;
  }

  function reconstructStepsFromSavedPayload(payload: SavedHandPayload): RecordedStep[] {
    const steps: RecordedStep[] = [];
    const board = payload.pokerState.board;
    let boardConsumed = 0;

    let lastStreet: EquityStreet = 'preflop';
    const flushTransitions = (targetStreet: EquityStreet) => {
      if (lastStreet === 'preflop' && targetStreet !== 'preflop' && board.length >= 3) {
        steps.push({ kind: 'chance', chanceType: 'deal_flop', cards: board.slice(0, 3) });
        boardConsumed = 3;
        lastStreet = 'flop';
      }
      if (lastStreet === 'flop' && (targetStreet === 'turn' || targetStreet === 'river') && board.length >= 4) {
        steps.push({ kind: 'chance', chanceType: 'deal_turn', cards: board.slice(3, 4) });
        boardConsumed = 4;
        lastStreet = 'turn';
      }
      if (lastStreet === 'turn' && targetStreet === 'river' && board.length >= 5) {
        steps.push({ kind: 'chance', chanceType: 'deal_river', cards: board.slice(4, 5) });
        boardConsumed = 5;
        lastStreet = 'river';
      }
    };

    for (const act of payload.recordedActions) {
      flushTransitions(act.street);
      steps.push({
        kind: 'action',
        playerId: act.playerId,
        type: act.type,
        amountToMilliBb: act.amountMilliBb ?? null,
        approximate: Boolean(act.approximate),
      });
    }

    if (boardConsumed < 3 && board.length >= 3) {
      steps.push({ kind: 'chance', chanceType: 'deal_flop', cards: board.slice(0, 3) });
    }
    if (boardConsumed < 4 && board.length >= 4) {
      steps.push({ kind: 'chance', chanceType: 'deal_turn', cards: board.slice(3, 4) });
    }
    if (boardConsumed < 5 && board.length >= 5) {
      steps.push({ kind: 'chance', chanceType: 'deal_river', cards: board.slice(4, 5) });
    }

    for (const p of payload.pokerState.players) {
      if (p.playerId !== 'hero' && Array.isArray(p.holeCards) && p.holeCards.length === 2) {
        steps.push({
          kind: 'reveal',
          playerId: p.playerId,
          cards: [p.holeCards[0]!, p.holeCards[1]!],
        });
      }
    }

    return steps;
  }

  function adaptSavedPayloadForRecorder(payload: SavedHandPayload): SavedHandPayload {
    if (payload.seatCount === 6 || payload.seatCount === 8) {
      const btn = payload.pokerState.buttonSeat;
      if (btn === 0 && payload.pokerState.players.every((p) => p.playerId === (p.seat === payload.heroSeat ? 'hero' : `seat-${p.seat}`))) {
        return payload;
      }
      const n = payload.seatCount;
      const remapSeat = (oldSeat: number) => ((oldSeat - btn) % n + n) % n;
      const newHeroSeat = remapSeat(payload.heroSeat);
      const idMap = new Map<string, { id: string; seat: number }>();
      for (const pl of payload.pokerState.players) {
        const mappedSeat = remapSeat(pl.seat);
        idMap.set(pl.playerId, {
          id: mappedSeat === newHeroSeat ? 'hero' : `seat-${mappedSeat}`,
          seat: mappedSeat,
        });
      }
      return {
        ...payload,
        heroSeat: newHeroSeat,
        heroPlayerId: 'hero',
        pokerState: {
          ...payload.pokerState,
          buttonSeat: 0,
          players: payload.pokerState.players.map((pl) => {
            const m = idMap.get(pl.playerId);
            return {
              ...pl,
              seat: m?.seat ?? remapSeat(pl.seat),
              playerId: m?.id ?? pl.playerId,
            };
          }),
        },
        recordedActions: payload.recordedActions.map((act) => {
          const m = idMap.get(act.playerId);
          return {
            ...act,
            seatIndex: m?.seat ?? remapSeat(act.seatIndex),
            playerId: m?.id ?? act.playerId,
          };
        }),
      };
    }

    const mapPlayerId = (pid: string): string => {
      if (pid === payload.heroPlayerId || pid === 'hero') return 'hero';
      return 'seat-2';
    };

    const adaptedActions: Array<(typeof payload.recordedActions)[number]> = [];
    const seqMap = new Map<number, number>();
    let foldedEarlySeats = false;
    let foldedSb = false;

    for (const act of payload.recordedActions) {
      if (act.street === 'preflop' && !foldedEarlySeats) {
        foldedEarlySeats = true;
        for (const early of [
          { id: 'seat-3', seatIndex: 3, pos: 'UTG' },
          { id: 'seat-4', seatIndex: 4, pos: 'HJ' },
          { id: 'seat-5', seatIndex: 5, pos: 'CO' },
        ] as const) {
          adaptedActions.push({
            seq: adaptedActions.length + 1,
            street: 'preflop',
            playerId: early.id,
            seatIndex: early.seatIndex,
            positionLabel: early.pos,
            isHero: false,
            type: 'fold',
          });
        }
      }

      const mappedId = mapPlayerId(act.playerId);
      if (act.street === 'preflop' && foldedEarlySeats && !foldedSb && mappedId === 'seat-2') {
        foldedSb = true;
        adaptedActions.push({
          seq: adaptedActions.length + 1,
          street: 'preflop',
          playerId: 'seat-1',
          seatIndex: 1,
          positionLabel: 'SB',
          isHero: false,
          type: 'fold',
        });
      }

      const nextSeq = adaptedActions.length + 1;
      seqMap.set(act.seq, nextSeq);
      adaptedActions.push({
        ...act,
        seq: nextSeq,
        playerId: mappedId,
        seatIndex: mappedId === 'hero' ? 0 : 2,
        isHero: mappedId === 'hero',
      });
    }

    return {
      ...payload,
      seatCount: 6,
      heroSeat: 0,
      heroPlayerId: 'hero',
      pokerState: {
        ...payload.pokerState,
        players: payload.pokerState.players.map((pl) => ({
          ...pl,
          playerId: mapPlayerId(pl.playerId),
        })),
      },
      recordedActions: adaptedActions,
      heroNotes: payload.heroNotes.map((note) => ({
        ...note,
        actionSeq: seqMap.get(note.actionSeq) ?? note.actionSeq,
      })),
    };
  }

  function loadSavedHand(record: SavedHandRecord): void {
    const p = adaptSavedPayloadForRecorder(record.payload);
    tablePresetSignal.value = p.tablePreset;
    seatCountSignal.value = p.seatCount === 8 ? 8 : 6;
    heroSeatIndexSignal.value = p.heroSeat;
    heroCardsSignal.value = [p.heroCards[0], p.heroCards[1]];
    handIdSignal.value = p.handId || nextHandId();
    stepsSignal.value = reconstructStepsFromSavedPayload(p);
    heroNotesSignal.value = p.heroNotes.map((n) => ({ ...n }));
    selectedNoteActionSeqSignal.value = null;
    syncShorthandTokensFromSteps();
    clearEphemeralInteraction();
    inputModeSignal.value = 'tap';
    activeSideTabSignal.value = 'record';
  }

  async function archiveSavedHand(objectId: string): Promise<void> {
    await repository.archiveSavedHand(objectId);
    await refreshSavedHands();
  }

  function applyPreset(preset: RecorderPresetId): void {
    tablePresetSignal.value = 'six_max_100bb';
    seatCountSignal.value = 6;
    heroSeatIndexSignal.value = 0; // BTN
    heroCardsSignal.value = ['As', 'Kd'];
    handIdSignal.value = nextHandId();
    heroNotesSignal.value = [];
    selectedNoteActionSeqSignal.value = null;
    activeSideTabSignal.value = 'record';
    shorthandDraftSignal.value = '';
    clearEphemeralInteraction();

    if (preset === 'raise') {
      inputModeSignal.value = 'tap';
      stepsSignal.value = [];
      foldRemainingToHeroOrEnd();
      selectedTicketSignal.value = 'raise';
      selectedSizeIdSignal.value = 's2';
      syncShorthandTokensFromSteps();
      return;
    }

    if (preset === 'flop_grid') {
      inputModeSignal.value = 'tap';
      stepsSignal.value = [
        { kind: 'action', playerId: 'seat-3', type: 'fold', amountToMilliBb: null, approximate: false },
        { kind: 'action', playerId: 'seat-4', type: 'fold', amountToMilliBb: null, approximate: false },
        { kind: 'action', playerId: 'seat-5', type: 'fold', amountToMilliBb: null, approximate: false },
        { kind: 'action', playerId: 'hero', type: 'raise', amountToMilliBb: 2500, approximate: false },
        { kind: 'action', playerId: 'seat-1', type: 'fold', amountToMilliBb: null, approximate: false },
        { kind: 'action', playerId: 'seat-2', type: 'call', amountToMilliBb: null, approximate: false },
      ];
      pendingBoardCardsSignal.value = ['Qh', '7c'];
      syncShorthandTokensFromSteps();
      return;
    }

    if (preset === 'typed_error') {
      inputModeSignal.value = 'shorthand';
      stepsSignal.value = [
        { kind: 'action', playerId: 'seat-3', type: 'fold', amountToMilliBb: null, approximate: false },
        { kind: 'action', playerId: 'seat-4', type: 'fold', amountToMilliBb: null, approximate: false },
      ];
      shorthandTokensSignal.value = ['f', 'f', 'r2.5', 'oops'];
      shorthandErrorSignal.value = 'oops';
      return;
    }

    // 'done'
    inputModeSignal.value = 'tap';
    stepsSignal.value = [
      { kind: 'action', playerId: 'seat-3', type: 'fold', amountToMilliBb: null, approximate: false },
      { kind: 'action', playerId: 'seat-4', type: 'fold', amountToMilliBb: null, approximate: false },
      { kind: 'action', playerId: 'seat-5', type: 'fold', amountToMilliBb: null, approximate: false },
      { kind: 'action', playerId: 'hero', type: 'raise', amountToMilliBb: 2500, approximate: false },
      { kind: 'action', playerId: 'seat-1', type: 'fold', amountToMilliBb: null, approximate: false },
      { kind: 'action', playerId: 'seat-2', type: 'fold', amountToMilliBb: null, approximate: false },
    ];
    heroNotesSignal.value = [
      {
        actionSeq: 4,
        street: 'preflop',
        reasonChip: 'stealing',
        customText: 'Open standard button size with AKo.',
      },
    ];
    syncShorthandTokensFromSteps();
  }

  if (options.initialPreset) {
    applyPreset(options.initialPreset);
  } else {
    resetHand();
  }

  if (options.autoLoadSaved !== false && typeof indexedDB !== 'undefined') {
    void refreshSavedHands().catch(() => {
      // IndexedDB may be unavailable in restricted headless environments.
    });
  }

  return {
    engine,
    repository,
    tablePresetSignal,
    seatCountSignal,
    heroSeatIndexSignal,
    heroCardsSignal,
    stepsSignal,
    heroNotesSignal,
    inputModeSignal,
    activeSideTabSignal,
    selectedTicketSignal,
    selectedSizeIdSignal,
    sizeOverridesSignal,
    approximateSizeSignal,
    pendingBoardCardsSignal,
    shorthandTokensSignal,
    shorthandDraftSignal,
    shorthandErrorSignal,
    selectedNoteActionSeqSignal,
    savedHandsSignal,
    linkedNightSessionIdSignal,
    unitLabelSignal,
    startingStackBbSignal,
    handSnapshotSignal,
    ladderOptionsSignal,
    currentStreetSignal,
    canFoldRemainingToHeroSignal,
    activeHeroNoteSignal,
    setTablePreset,
    setSeatCount,
    setLinkedNightSessionId,
    setHeroSeatIndex,
    setHeroCard,
    setInputMode,
    setActiveSideTab,
    selectTicket,
    selectSizeId,
    adjustLadderSize,
    resetSizeLadder,
    setApproximateSize,
    confirmTicketAction,
    foldRemainingToHeroOrEnd,
    togglePendingBoardCard,
    commitPendingBoardCards,
    dealRandomPendingStreet,
    revealOpponentHoleCards,
    stepBack,
    resetHand,
    setShorthandTokens,
    setShorthandDraft,
    applyShorthandLine,
    selectNoteActionSeq,
    toggleHeroReasonChip,
    setHeroCustomNote,
    refreshSavedHands,
    saveCurrentHand,
    loadSavedHand,
    archiveSavedHand,
    applyPreset,
    buildSavedPayload,
    dispose() {
      if (!options.engine) engine.dispose();
    },
  };
}

let sharedHandRecorderStore: HandRecorderStore | null = null;

export function getSharedHandRecorderStore(): HandRecorderStore {
  if (!sharedHandRecorderStore) {
    sharedHandRecorderStore = createHandRecorderStore();
  }
  return sharedHandRecorderStore;
}

export function resetSharedHandRecorderStore(): void {
  if (sharedHandRecorderStore) {
    sharedHandRecorderStore.dispose();
    sharedHandRecorderStore = null;
  }
}
