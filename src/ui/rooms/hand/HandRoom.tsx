import { useEffect, useRef, useState } from 'preact/hooks';
import type { HandCategory } from '../../../engine-api';
import {
  minimalCardsSignal,
  motionSignal,
  shortcutsSignal,
} from '../../../domain/appearance';
import { activeGameSettingsSignal } from '../../../domain/gameSettings';
import { playTableSound } from '../../../domain/audio/tableAudio';
import {
  parseHandHistoryText,
  RECORDER_ANTE_MODES,
  RECORDER_BLIND_PRESETS,
  RECORDER_STACK_DEPTHS_BB,
  splitMultiHandHistory,
  type HandRecorderStore,
  type RecorderLadderOption,
  type TicketChoiceId,
} from '../../../domain/hand';
import { getSharedReviewStore } from '../../../domain/review';
import { navigateTo, settingsSectionSignal } from '../../../domain/shellState';
import type { ExternalSolverSpotInput } from '../../../domain/solver';
import { validateActionShorthandToken } from '../../../domain/shorthand';
import type { SavedHandRecord, ThinkingReasonId } from '../../../domain/storage';
import { formatNumber, formatPercent, t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { Kbd } from '../../kit/chip/Chip';
import { ChipButton, SegmentedControl, type SegmentOption } from '../../kit/choice/Choice';
import { FeltTable, type SeatEmblem, type TableCardSpec, type TableSeat } from '../../kit/felt-table/FeltTable';
import { HeatGrid, type HeatGridRow } from '../../kit/heat-grid/HeatGrid';
import { HistoryRail, type HistoryStreetGroup } from '../../kit/history-rail/HistoryRail';
import { TextField } from '../../kit/input/TextField';
import { TokenInput } from '../../kit/input/TokenInput';
import {
  OptionTickets,
  type LadderSizeOption,
  type OptionTicketItem,
} from '../../kit/option-tickets/OptionTickets';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import { PopoverMenu } from '../../kit/overlay/PopoverMenu';
import { CardPicker } from '../../kit/playing-card/CardPicker';
import { PlayingCard } from '../../kit/playing-card/PlayingCard';
import { readDurationMs } from '../../kit/state';
import { formatCategoryLabel } from '../equity/equityFormatters';
import { InlineEquityDrawer } from '../equity/InlineEquityDrawer';
import styles from './HandRoom.module.css';

const RANKS_HIGH_TO_LOW = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
const SUITS_LIST = ['s', 'h', 'd', 'c'] as const;
const SUIT_GLYPHS: Readonly<Record<string, string>> = {
  s: '\u2660\uFE0E',
  h: '\u2665\uFE0E',
  d: '\u2666\uFE0E',
  c: '\u2663\uFE0E',
};
const SEAT_EMBLEMS: readonly SeatEmblem[] = ['wave', 'bars', 'prism', 'orbits', 'arc', 'grid', 'pie', 'eye'];
const THINKING_REASONS: readonly ThinkingReasonId[] = [
  'stealing',
  'value',
  'draw',
  'pot_committed',
  'bluff_catch',
];

function formatCardGlyph(code: string): string {
  if (code.length !== 2) return code;
  const r = code[0] === 'T' ? '10' : code[0]!;
  const s = SUIT_GLYPHS[code[1]!] ?? code[1]!;
  return `${r}${s}`;
}

function formatUnitsValue(milliBb: number): string {
  const units = milliBb / 1000;
  return formatNumber(units, { maximumFractionDigits: 1 });
}

function formatAmountWithUnit(milliBb: number, unit: 'bb' | '₪'): string {
  const num = formatUnitsValue(milliBb);
  return unit === '₪' ? `₪${num}` : `${num} bb`;
}

function formatStreetLabel(street: string): string {
  switch (street) {
    case 'preflop':
      return t('recorder.street.preflop');
    case 'flop':
      return t('recorder.street.flop');
    case 'turn':
      return t('recorder.street.turn');
    case 'river':
      return t('recorder.street.river');
    default:
      return street;
  }
}

function formatActionWord(type: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in'): string {
  switch (type) {
    case 'fold':
      return t('recorder.tickets.fold');
    case 'check':
      return t('recorder.tickets.check');
    case 'call':
      return t('recorder.tickets.call');
    case 'bet':
      return t('recorder.tickets.bet');
    case 'raise':
      return t('recorder.tickets.raise');
    case 'all_in':
      return t('recorder.tickets.allIn');
  }
}

function formatCostDetail(opt: RecorderLadderOption): string {
  const pct = opt.potShare !== null ? formatPercent(opt.potShare, 0) : '';
  if (!pct) return '';
  if (opt.sprAfterCalled !== null) {
    return t('recorder.tickets.costShareSpr', {
      pct,
      spr: formatNumber(opt.sprAfterCalled, { maximumFractionDigits: 1 }),
    });
  }
  return t('recorder.tickets.costShare', { pct });
}

interface HandMotionSnapshot {
  readonly handId: string;
  readonly heroCards: readonly [string | undefined, string | undefined];
  readonly board: readonly string[];
  readonly street: string;
  readonly potMilliBb: number;
  readonly actionCount: number;
  readonly isSettled: boolean;
  readonly foldedIds: ReadonlySet<string>;
  readonly revealedIds: ReadonlySet<string>;
  readonly contributingSeatIds: readonly string[];
  readonly activeNonFoldedSeatIds: readonly string[];
}

interface HandMotionTracker {
  lastSig: string | null;
  prev: HandMotionSnapshot | null;
  dealHeroIndices: ReadonlySet<number>;
  dealBoardFrom: number;
  foldedSeatIds: ReadonlySet<string>;
  revealedSeatIds: ReadonlySet<string>;
  chipTrigger: number;
  chipSeats: readonly string[];
}

type CardPickerTarget =
  | { readonly kind: 'hero'; readonly slotIndex: 0 | 1; readonly title: string }
  | { readonly kind: 'reveal'; readonly playerId: string; readonly title: string };

export interface HandRoomProps {
  store: HandRecorderStore;
  readonly onReturnToNight?: (nightSessionId: string) => void;
  readonly onOpenInEquity?: (input: {
    readonly board: readonly string[];
    readonly players: readonly {
      readonly label: string;
      readonly rawInput: string;
      readonly isHero: boolean;
    }[];
  }) => void;
  readonly onSolveSpot?: (input: ExternalSolverSpotInput) => void;
}

export function HandRoom({ store, onReturnToNight, onOpenInEquity, onSolveSpot }: HandRoomProps) {
  const tablePreset = store.tablePresetSignal.value;
  const seatCount = store.seatCountSignal.value;
  const startingStackBb = store.startingStackBbSignal.value;
  const seatStackOverrides = store.seatStackOverridesBbSignal.value;
  const anteMode = store.anteModeSignal.value;
  const heroSeatIndex = store.heroSeatIndexSignal.value;
  const heroCards = store.heroCardsSignal.value;
  const unit = store.unitLabelSignal.value;
  const snap = store.handSnapshotSignal.value;
  const state = snap.pokerState;

  const inputMode = store.inputModeSignal.value;
  const selectedTicket = store.selectedTicketSignal.value;
  const selectedSizeId = store.selectedSizeIdSignal.value;
  const approximateSize = store.approximateSizeSignal.value;
  const pendingBoardCards = store.pendingBoardCardsSignal.value;
  const ladderOptions = store.ladderOptionsSignal.value;
  const canFoldRemaining = store.canFoldRemainingToHeroSignal.value;

  const shorthandTokens = store.shorthandTokensSignal.value;
  const shorthandDraft = store.shorthandDraftSignal.value;
  const shorthandError = store.shorthandErrorSignal.value;
  const activeNote = store.activeHeroNoteSignal.value;
  const linkedNightId = store.linkedNightSessionIdSignal.value;

  const [rulesOpen, setRulesOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<CardPickerTarget | null>(null);
  const heroCardRefs = useRef<Array<HTMLButtonElement | null>>([null, null]);
  const [revealStagedFirst, setRevealStagedFirst] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [lastSavedRecord, setLastSavedRecord] = useState<SavedHandRecord | null>(null);
  const [equityOverlayOpen, setEquityOverlayOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<string | null>(null);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [randomMenuOpen, setRandomMenuOpen] = useState(false);
  const randomBtnRef = useRef<HTMLButtonElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const motionRef = useRef<HandMotionTracker>({
    lastSig: null,
    prev: null,
    dealHeroIndices: new Set<number>(),
    dealBoardFrom: 0,
    foldedSeatIds: new Set<string>(),
    revealedSeatIds: new Set<string>(),
    chipTrigger: 0,
    chipSeats: [],
  });

  const allowCardMotion = motionSignal.value !== 'reduced' && !minimalCardsSignal.value;
  const shortcuts = shortcutsSignal.value;

  const curFoldedIds = new Set(state.players.filter((p) => p.folded).map((p) => p.playerId));
  const curRevealedIds = new Set(
    state.players
      .filter((p) => p.playerId !== 'hero' && !p.folded && Array.isArray(p.holeCards))
      .map((p) => p.playerId),
  );
  const curContributingSeats = state.players
    .filter((p) => p.streetContributionMilliBb > 0)
    .map((p) => p.playerId);
  const curActiveSeats = state.players.filter((p) => !p.folded).map((p) => p.playerId);
  const isSettledNow = state.phase === 'showdown' || state.terminal.isTerminal;

  const curMotionSnapshot: HandMotionSnapshot = {
    handId: state.handId ?? '',
    heroCards: [heroCards[0], heroCards[1]],
    board: [...state.board],
    street: state.street,
    potMilliBb: state.potMilliBb,
    actionCount: snap.recordedActions.length,
    isSettled: isSettledNow,
    foldedIds: curFoldedIds,
    revealedIds: curRevealedIds,
    contributingSeatIds: curContributingSeats,
    activeNonFoldedSeatIds: curActiveSeats,
  };

  const curMotionSig = [
    curMotionSnapshot.handId,
    curMotionSnapshot.heroCards.join(','),
    curMotionSnapshot.board.join(','),
    curMotionSnapshot.street,
    curMotionSnapshot.potMilliBb,
    curMotionSnapshot.actionCount,
    curMotionSnapshot.isSettled ? 1 : 0,
    [...curFoldedIds].join(','),
    [...curRevealedIds].join(','),
    curContributingSeats.join(','),
  ].join('|');

  if (!allowCardMotion) {
    motionRef.current.dealHeroIndices = new Set<number>();
    motionRef.current.dealBoardFrom = curMotionSnapshot.board.length;
    motionRef.current.foldedSeatIds = new Set<string>();
    motionRef.current.revealedSeatIds = new Set<string>();
    motionRef.current.lastSig = curMotionSig;
    motionRef.current.prev = curMotionSnapshot;
  } else if (motionRef.current.lastSig !== curMotionSig) {
    const prev = motionRef.current.prev;
    if (!prev || prev.handId !== curMotionSnapshot.handId) {
      motionRef.current.dealHeroIndices =
        curMotionSnapshot.board.length === 0 && !curMotionSnapshot.isSettled
          ? new Set([0, 1])
          : new Set<number>();
      motionRef.current.dealBoardFrom = curMotionSnapshot.board.length;
      motionRef.current.foldedSeatIds = new Set<string>();
      motionRef.current.revealedSeatIds = new Set<string>();
    } else {
      const nextDealHero = new Set<number>();
      if (curMotionSnapshot.heroCards[0] !== prev.heroCards[0]) nextDealHero.add(0);
      if (curMotionSnapshot.heroCards[1] !== prev.heroCards[1]) nextDealHero.add(1);
      motionRef.current.dealHeroIndices = nextDealHero;

      const isUndo =
        curMotionSnapshot.board.length < prev.board.length ||
        curMotionSnapshot.actionCount < prev.actionCount;

      if (isUndo) {
        motionRef.current.dealBoardFrom = curMotionSnapshot.board.length;
        motionRef.current.foldedSeatIds = new Set<string>();
        motionRef.current.revealedSeatIds = new Set<string>();
      } else {
        if (curMotionSnapshot.board.length > prev.board.length) {
          motionRef.current.dealBoardFrom = prev.board.length;
        }
        motionRef.current.foldedSeatIds = new Set(
          [...curFoldedIds].filter((id) => !prev.foldedIds.has(id)),
        );
        motionRef.current.revealedSeatIds = new Set(
          [...curRevealedIds].filter((id) => !prev.revealedIds.has(id)),
        );

        const streetChanged = prev.street !== curMotionSnapshot.street;
        const settledNow = !prev.isSettled && curMotionSnapshot.isSettled;
        if (
          (streetChanged || settledNow) &&
          (prev.contributingSeatIds.length > 0 ||
            curMotionSnapshot.potMilliBb > prev.potMilliBb)
        ) {
          motionRef.current.chipTrigger += 1;
          motionRef.current.chipSeats =
            prev.contributingSeatIds.length > 0
              ? [...prev.contributingSeatIds]
              : [...curMotionSnapshot.activeNonFoldedSeatIds];
        }
      }
    }
    motionRef.current.lastSig = curMotionSig;
    motionRef.current.prev = curMotionSnapshot;
  }

  const activeMotion = motionRef.current;

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const handleSave = async () => {
    const saved = await store.saveCurrentHand();
    setLastSavedRecord(saved);
    setSavedNotice(true);
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    const noticeMs = readDurationMs('--dur-notice');
    if (noticeMs > 0) {
      saveTimerRef.current = window.setTimeout(() => {
        setSavedNotice(false);
      }, noticeMs);
    }
  };

  // Header controls options
  const tablePresetOptions: SegmentOption<'six_max_100bb' | 'home_game_50bb'>[] = [
    { value: 'six_max_100bb', label: <PokerNotation>{t('recorder.preset.sixMax')}</PokerNotation> },
    { value: 'home_game_50bb', label: <PokerNotation>{t('recorder.preset.homeGame')}</PokerNotation> },
  ];

  const seatCountOptions: SegmentOption<'6' | '8'>[] = [
    { value: '6', label: t('recorder.seats.six') },
    { value: '8', label: t('recorder.seats.eight') },
  ];

  const positionOptions: SegmentOption<string>[] = snap.availablePositions.map((pos) => ({
    value: String(pos.seatIndex),
    label: <PokerNotation>{pos.position}</PokerNotation>,
  }));

  const modeOptions: SegmentOption<'tap' | 'shorthand'>[] = [
    { value: 'tap', label: t('recorder.mode.tap') },
    { value: 'shorthand', label: t('recorder.mode.shorthand') },
  ];

  // Latest action per player for table bubbles
  const lastActionByPlayer = new Map<string, (typeof snap.recordedActions)[number]>();
  for (const act of snap.recordedActions) {
    if (act.street === state.street) {
      lastActionByPlayer.set(act.playerId, act);
    }
  }

  const winningCardSet = new Set<string>();
  if (state.showdown.handRanksByPlayer) {
    for (const wId of state.terminal.winnerPlayerIds) {
      const rank = state.showdown.handRanksByPlayer[wId];
      if (rank) {
        for (const c of rank.bestFiveCards) winningCardSet.add(c);
      }
    }
  }

  const tableSeats: TableSeat[] = state.players.map((p, idx) => {
    const isHero = p.playerId === 'hero';
    const isWinner = state.terminal.isTerminal && state.terminal.winnerPlayerIds.includes(p.playerId);
    const lastAct = lastActionByPlayer.get(p.playerId);
    let actionBubble: string | undefined;
    if (p.folded) {
      actionBubble = t('recorder.turn.folded');
    } else if (lastAct) {
      const verb = formatActionWord(lastAct.type);
      if (lastAct.amountMilliBb !== undefined && lastAct.type !== 'fold' && lastAct.type !== 'check') {
        const prefix = lastAct.approximate ? '~' : '';
        actionBubble = `${verb} ${prefix}${formatAmountWithUnit(lastAct.amountMilliBb, unit)}`;
      } else {
        actionBubble = verb;
      }
    }

    let cards: TableCardSpec[] | undefined;
    if (!p.folded) {
      if (Array.isArray(p.holeCards)) {
        cards = p.holeCards.map((c, cIdx) => ({
          card: c,
          state: 'face' as const,
          winning: isWinner && winningCardSet.has(c),
          motion: !allowCardMotion
            ? 'none'
            : isHero && activeMotion.dealHeroIndices.has(cIdx)
              ? 'deal'
              : !isHero && activeMotion.revealedSeatIds.has(p.playerId)
                ? 'flip'
                : 'none',
        }));
      } else if (p.holeCards && typeof p.holeCards === 'object' && 'status' in p.holeCards && p.holeCards.status === 'hidden') {
        cards = [
          { state: 'back' as const },
          { state: 'back' as const },
        ];
      }
    } else if (allowCardMotion && activeMotion.foldedSeatIds.has(p.playerId)) {
      cards = Array.isArray(p.holeCards)
        ? p.holeCards.map((c) => ({ card: c, state: 'face' as const, motion: 'fold' as const }))
        : [
            { state: 'back' as const, motion: 'fold' as const },
            { state: 'back' as const, motion: 'fold' as const },
          ];
    }

    return {
      id: p.playerId,
      name: isHero ? `${p.position} (${t('recorder.table.heroLabel')})` : p.position,
      stack: formatAmountWithUnit(p.currentStackMilliBb, unit),
      emblem: isHero ? 'hero' : SEAT_EMBLEMS[idx % SEAT_EMBLEMS.length],
      isHero,
      isDealer: p.seat === state.buttonSeat,
      folded: p.folded,
      thinking: false,
      actionBubble,
      bet:
        state.phase === 'betting' && p.streetContributionMilliBb > 0
          ? formatAmountWithUnit(p.streetContributionMilliBb, unit)
          : undefined,
      cards,
    };
  });

  const boardSpecs: TableCardSpec[] = state.board.map((c, idx) => ({
    card: c,
    state: 'face' as const,
    winning: state.terminal.isTerminal && winningCardSet.has(c),
    motion: allowCardMotion && idx >= activeMotion.dealBoardFrom ? 'deal' : 'none',
  }));

  const payoutTotalMilliBb = state.terminal.isTerminal
    ? Object.values(state.terminal.payoutsMilliBbByPlayer).reduce((sum, v) => sum + v, 0)
    : 0;
  const contribTotalMilliBb = state.players.reduce(
    (sum, p) => sum + p.totalPotContributionMilliBb,
    0,
  );
  const displayPotMilliBb =
    state.potMilliBb > 0
      ? state.potMilliBb
      : payoutTotalMilliBb > 0
        ? payoutTotalMilliBb
        : contribTotalMilliBb;

  // HistoryRail grouped by street
  const historyGroups: HistoryStreetGroup[] = [];
  const streetOrder = ['preflop', 'flop', 'turn', 'river'] as const;
  for (const st of streetOrder) {
    const rowsForStreet = snap.recordedActions.filter((a) => a.street === st);
    if (rowsForStreet.length === 0) continue;
    historyGroups.push({
      id: st,
      streetLabel: formatStreetLabel(st),
      potLabel:
        st === state.street
          ? t('recorder.history.streetPot', { pot: formatAmountWithUnit(displayPotMilliBb, unit) })
          : undefined,
      rows: rowsForStreet.map((act) => {
        const actWord = formatActionWord(act.type);
        const amtText =
          act.amountMilliBb !== undefined && act.type !== 'fold' && act.type !== 'check'
            ? ` ${act.approximate ? '~' : ''}${formatAmountWithUnit(act.amountMilliBb, unit)}`
            : '';
        return {
          id: `seq-${act.seq}`,
          actor: act.positionLabel,
          isHero: act.isHero,
          action: <PokerNotation>{`${actWord}${amtText}`}</PokerNotation>,
          tag: act.approximate ? '~' : undefined,
        };
      }),
    });
  }

  const latestRowId =
    snap.recordedActions.length > 0
      ? `seq-${snap.recordedActions[snap.recordedActions.length - 1]!.seq}`
      : undefined;

  // Build OptionTickets list
  const legal = snap.legalActions;
  const tickets: OptionTicketItem[] = [];
  if (legal && state.phase === 'betting') {
    if (legal.fold.available) {
      tickets.push({
        id: 'fold',
        shortcut: shortcuts.fold,
        label: t('recorder.tickets.fold'),
      });
    }
    if (legal.check.available) {
      tickets.push({
        id: 'check',
        shortcut: 'X',
        label: t('recorder.tickets.check'),
      });
    }
    if (legal.call.available) {
      tickets.push({
        id: 'call',
        shortcut: shortcuts.call,
        label: t('recorder.tickets.call'),
        amount: formatAmountWithUnit(legal.call.commitMilliBb, unit),
      });
    }
    if (legal.bet.available) {
      tickets.push({
        id: 'bet',
        shortcut: 'B',
        label: t('recorder.tickets.bet'),
      });
    }
    if (legal.raise.available) {
      tickets.push({
        id: 'raise',
        shortcut: shortcuts.raise,
        label: t('recorder.tickets.raise'),
      });
    }
    if (legal.allIn.available && legal.allIn.amountToMilliBb !== null) {
      tickets.push({
        id: 'all_in',
        shortcut: shortcuts.allIn,
        label: t('recorder.tickets.allIn'),
        amount: formatAmountWithUnit(legal.allIn.amountToMilliBb, unit),
      });
    }
  }

  const showLadder = selectedTicket === 'bet' || selectedTicket === 'raise';
  const kitSizes: LadderSizeOption[] | undefined = showLadder
    ? ladderOptions.map((opt) => ({
        id: opt.id,
        value: opt.value,
        unit,
        costDetail: formatCostDetail(opt),
        min: opt.min,
        max: opt.max,
        step: opt.step,
      }))
    : undefined;

  // Build HeatGrid for board picking when state.phase === 'chance'
  const deadSet = new Set(snap.deadCards);
  const boardHeatRows: HeatGridRow[] = SUITS_LIST.map((suit) => ({
    id: suit,
    cells: RANKS_HIGH_TO_LOW.map((rank) => {
      const code = `${rank}${suit}`;
      const struck = deadSet.has(code);
      const isPicked = pendingBoardCards.includes(code);
      const label = formatCardGlyph(code);
      return {
        id: code,
        label,
        ariaLabel: label,
        tone: isPicked ? ('okHigh' as const) : struck ? ('struck' as const) : ('neutral' as const),
        struck,
        disabled: struck,
      };
    }),
  }));

  const currentActor = state.actingPlayerId
    ? state.players.find((p) => p.playerId === state.actingPlayerId)
    : undefined;

  const neededBoardCount = state.pendingChance?.cardCount ?? 0;
  const chancePrompt =
    state.pendingChance?.type === 'deal_flop'
      ? t('recorder.board.dealFlop')
      : state.pendingChance?.type === 'deal_turn'
        ? t('recorder.board.dealTurn')
        : t('recorder.board.dealRiver');

  const isShowdownSolved = state.terminal.isTerminal && state.terminal.reason === 'showdown';
  const tierConfig = isShowdownSolved
    ? { tier: 'exact' as const, detail: t('recorder.tier.knownCards') }
    : { tier: 'exact' as const, detail: t('recorder.tier.priceOnly') };

  const semanticShorthandError =
    shorthandError &&
    shorthandTokens.every((tok) => validateActionShorthandToken(tok).valid)
      ? shorthandError
      : null;

  const winnerLabels = state.terminal.winnerPlayerIds
    .map((id) => {
      const pos = state.players.find((p) => p.playerId === id)?.position ?? id;
      const cat =
        state.terminal.reason === 'showdown'
          ? state.showdown.handRanksByPlayer?.[id]?.category
          : undefined;
      return cat ? `${pos} (${formatCategoryLabel(cat as HandCategory)})` : pos;
    })
    .join(', ');

  const canOpenInEquity =
    Boolean(onOpenInEquity) &&
    heroCards.length === 2 &&
    Boolean(heroCards[0] && heroCards[1]) &&
    [0, 3, 4, 5].includes(state.board.length);

  const handleOpenInEquity = () => {
    if (!onOpenInEquity || !canOpenInEquity) return;
    const heroPlayer = state.players.find((p) => p.playerId === 'hero');
    const heroPos = heroPlayer?.position ?? 'BTN';
    const revealedOpponents = state.players
      .filter(
        (p) =>
          p.playerId !== 'hero' &&
          !p.folded &&
          Array.isArray(p.holeCards) &&
          p.holeCards.length === 2,
      )
      .map((p) => ({
        label: p.position,
        rawInput: (p.holeCards as readonly string[]).join(''),
        isHero: false,
      }));

    onOpenInEquity({
      board: [...state.board],
      players: [
        { label: heroPos, rawInput: heroCards.join(''), isHero: true },
        ...(revealedOpponents.length > 0
          ? revealedOpponents
          : [{ label: 'Villain', rawInput: 'any', isHero: false }]),
      ],
    });
  };

  return (
    <div className={styles.room}>
      <header className={styles.roomHeader}>
        <div className={styles.headingGroup}>
          <h1 className={styles.roomTitle}>{t('recorder.title')}</h1>
          <p className={styles.roomSubtitle}>{t('recorder.subtitle')}</p>
        </div>

        <div className={styles.headerControls}>
          <SegmentedControl
            ariaLabel={t('recorder.preset.label')}
            options={tablePresetOptions}
            value={tablePreset}
            onChange={(next) => store.setTablePreset(next)}
          />
          <SegmentedControl
            ariaLabel={t('recorder.seats.label')}
            options={seatCountOptions}
            value={String(seatCount) as '6' | '8'}
            onChange={(next) => store.setSeatCount(Number(next) as 6 | 8)}
          />
          <div className={styles.headerButtons}>
            <button
              type="button"
              className={styles.rulesToggleBtn}
              aria-expanded={rulesOpen}
              onClick={() => setRulesOpen((prev) => !prev)}
            >
              {t('recorder.rules.toggleBtn')}
            </button>
            <Button variant="secondary" onClick={() => store.resetHand()}>
              {t('recorder.actions.newHand')}
            </Button>
            <Button
              variant={
                inputMode === 'tap' && (state.phase === 'terminal' || state.phase === 'showdown')
                  ? 'primary'
                  : 'secondary'
              }
              confirmed={savedNotice}
              onClick={() => void handleSave()}
            >
              {state.terminal.isTerminal
                ? t('recorder.actions.saveHand')
                : t('recorder.actions.saveSpot')}
            </Button>
            {savedNotice && (
              <span className={styles.savedTag} role="status">
                {t('recorder.actions.saved')}
              </span>
            )}
            {lastSavedRecord && lastSavedRecord.payload.handId === state.handId && (
              <Button
                variant="secondary"
                onClick={() => {
                  const reviewStore = getSharedReviewStore();
                  reviewStore.openSavedHand(lastSavedRecord);
                  reviewStore.setActiveSideTab('review');
                  navigateTo('review');
                }}
              >
                {t('review.actions.openReview')}
              </Button>
            )}
            {linkedNightId && onReturnToNight && (
              <Button variant="secondary" onClick={() => onReturnToNight(linkedNightId)}>
                {t('recorder.actions.backToNight')}
              </Button>
            )}
            {onSolveSpot && (state.board.length === 4 || state.board.length === 5) && heroCards.length === 2 && (
              <Button
                variant="secondary"
                onClick={() => {
                  const potBb = Math.max(1, state.potMilliBb / 1000);
                  const heroP = state.players.find((p) => p.playerId === 'hero');
                  const stackBb = heroP ? Math.max(1, heroP.currentStackMilliBb / 1000) : 40;
                  const oopText = heroCards.join('');
                  const ipText = 'QQ+, AKs, AQs, KQs, JTs';
                  onSolveSpot({
                    sourceRoomLabel: t('rooms.hand.nav'),
                    board: [...state.board],
                    oopRangeText: oopText,
                    ipRangeText: ipText,
                    potBb,
                    effectiveStackBb: stackBb,
                    summaryLine: `Board ${state.board.join(' ')} · Pot ${potBb} bb · Stack ${stackBb} bb · ${oopText} vs ${ipText}`,
                  });
                }}
              >
                {t('strategy.solver.solveSpotBtn')}
              </Button>
            )}
            <ChipButton
              selected={equityOverlayOpen}
              onToggle={() => setEquityOverlayOpen((prev) => !prev)}
            >
              {t('equityOverlay.trigger')} <Kbd>{shortcuts.inlineEquity}</Kbd>
            </ChipButton>
          </div>
        </div>
      </header>

      {rulesOpen && (
        <Panel title={t('recorder.rules.heading')}>
          <div className={styles.rulesChipsRow} style={{ marginBottom: '0.75rem' }}>
            <Button
              variant="secondary"
              onClick={() => {
                const gs = activeGameSettingsSignal.value;
                store.setSeatCount(gs.tableSize >= 7 ? 8 : 6);
                const closestDepth = RECORDER_STACK_DEPTHS_BB.reduce((best, cand) =>
                  Math.abs(cand - gs.defaultStackBb) < Math.abs(best - gs.defaultStackBb)
                    ? cand
                    : best,
                );
                store.setStartingStackBb(closestDepth);
                const mappedAnte =
                  gs.anteMode === 'bb_ante'
                    ? 'bb_ante_1'
                    : gs.anteMode === 'per_seat'
                      ? 'per_player_0_2'
                      : 'none';
                store.setAnteMode(mappedAnte);
              }}
            >
              {t('recorder.rules.syncGameRulesBtn', { name: activeGameSettingsSignal.value.name })}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                settingsSectionSignal.value = 'game';
                navigateTo('settings');
              }}
            >
              {t('settings.tab.game')}
            </Button>
          </div>
          <div className={styles.rulesGrid}>
            <div className={styles.rulesGroup}>
              <span className={styles.microLabel}>{t('recorder.rules.stackLabel')}</span>
              <div className={styles.rulesChipsRow}>
                {RECORDER_STACK_DEPTHS_BB.map((depth) => (
                  <ChipButton
                    key={depth}
                    selected={startingStackBb === depth}
                    onToggle={() => store.setStartingStackBb(depth)}
                  >
                    <PokerNotation>{`${depth} ${unit}`}</PokerNotation>
                  </ChipButton>
                ))}
              </div>
            </div>

            <div className={styles.rulesGroup}>
              <span className={styles.microLabel}>{t('recorder.rules.blindsLabel')}</span>
              <div className={styles.rulesChipsRow}>
                {RECORDER_BLIND_PRESETS.map((blind) => (
                  <ChipButton
                    key={blind}
                    selected={store.blindPresetSignal.value === blind}
                    onToggle={() => store.setBlindPreset(blind)}
                  >
                    <PokerNotation>{blind}</PokerNotation>
                  </ChipButton>
                ))}
              </div>
            </div>

            <div className={styles.rulesGroup}>
              <span className={styles.microLabel}>{t('recorder.rules.anteLabel')}</span>
              <div className={styles.rulesChipsRow}>
                {RECORDER_ANTE_MODES.map((mode) => (
                  <ChipButton
                    key={mode}
                    selected={anteMode === mode}
                    onToggle={() => store.setAnteMode(mode)}
                  >
                    {t(`recorder.rules.ante.${mode}`)}
                  </ChipButton>
                ))}
              </div>
            </div>

            <div className={styles.rulesGroup}>
              <span className={styles.microLabel}>{t('recorder.rules.seatStacksLabel')}</span>
              <div className={styles.rulesChipsRow}>
                {snap.availablePositions.map((pos) => {
                  const seatStackBb = seatStackOverrides[pos.seatIndex] ?? startingStackBb;
                  const isOverridden = seatStackOverrides[pos.seatIndex] !== undefined;
                  return (
                    <ChipButton
                      key={pos.seatIndex}
                      selected={isOverridden}
                      onToggle={() => {
                        const curIdx = RECORDER_STACK_DEPTHS_BB.indexOf(
                          seatStackBb as (typeof RECORDER_STACK_DEPTHS_BB)[number],
                        );
                        const nextDepth =
                          RECORDER_STACK_DEPTHS_BB[
                            (curIdx + 1 + RECORDER_STACK_DEPTHS_BB.length) %
                              RECORDER_STACK_DEPTHS_BB.length
                          ]!;
                        store.setSeatStackOverrideBb(pos.seatIndex, nextDepth);
                      }}
                    >
                      <PokerNotation>
                        {t('recorder.rules.seatStackItem', {
                          position: pos.position,
                          stack: seatStackBb,
                          unit,
                        })}
                      </PokerNotation>
                    </ChipButton>
                  );
                })}
                {Object.keys(seatStackOverrides).length > 0 && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      for (const pos of snap.availablePositions) {
                        store.setSeatStackOverrideBb(pos.seatIndex, null);
                      }
                    }}
                  >
                    {t('recorder.rules.resetStacks')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Panel>
      )}

      <div className={styles.mainGrid}>
        <div className={styles.column}>
          <Panel>
            <div className={styles.setupBar}>
              <div className={styles.setupGroup}>
                <span className={styles.microLabel}>{t('recorder.setup.heroPosition')}</span>
                <SegmentedControl
                  ariaLabel={t('recorder.setup.heroPosition')}
                  options={positionOptions}
                  value={String(heroSeatIndex)}
                  onChange={(next) => store.setHeroSeatIndex(Number(next))}
                />
              </div>

              <div className={styles.setupGroup}>
                <span className={styles.microLabel}>{t('recorder.setup.heroCards')}</span>
                <div className={styles.heroCardsRow}>
                  {([0, 1] as const).map((slotIdx) => (
                    <button
                      key={slotIdx}
                      ref={(el) => {
                        heroCardRefs.current[slotIdx] = el;
                      }}
                      type="button"
                      className={styles.cardSlotButton}
                      aria-label={t('recorder.setup.cardSlotAria', { slot: slotIdx + 1 })}
                      onClick={() =>
                        setPickerTarget({
                          kind: 'hero',
                          slotIndex: slotIdx,
                          title: t('recorder.setup.cardSlotAria', { slot: slotIdx + 1 }),
                        })
                      }
                    >
                      <PlayingCard card={heroCards[slotIdx]} size="small" hoverLift />
                    </button>
                  ))}
                  <div className={styles.randomMenuWrap}>
                    <Button
                      buttonRef={(el) => {
                        randomBtnRef.current = el;
                      }}
                      variant="secondary"
                      onClick={() => setRandomMenuOpen((open) => !open)}
                    >
                      {t('random.menuButton')}
                    </Button>
                    <PopoverMenu
                      open={randomMenuOpen}
                      onClose={() => setRandomMenuOpen(false)}
                      anchorEl={randomBtnRef.current}
                      width={220}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className={styles.randomMenuItem}
                        onClick={() => {
                          store.randomizeHeroCards();
                          setRandomMenuOpen(false);
                        }}
                      >
                        {t('random.heroCards')}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={styles.randomMenuItem}
                        onClick={() => {
                          const nextSeat =
                            (heroSeatIndex + 1 + Math.floor(Math.random() * Math.max(1, seatCount - 1))) %
                            seatCount;
                          store.setHeroSeatIndex(nextSeat);
                          setRandomMenuOpen(false);
                        }}
                      >
                        {t('random.heroPosition')}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={styles.randomMenuItem}
                        onClick={() => {
                          const nextSeat =
                            (heroSeatIndex + 1 + Math.floor(Math.random() * Math.max(1, seatCount - 1))) %
                            seatCount;
                          store.setHeroSeatIndex(nextSeat);
                          store.randomizeHeroCards();
                          setRandomMenuOpen(false);
                        }}
                      >
                        {t('random.heroBoth')}
                      </button>
                      {state.phase === 'chance' && (
                        <button
                          type="button"
                          role="menuitem"
                          className={styles.randomMenuItem}
                          onClick={() => {
                            store.dealRandomPendingStreet();
                            setRandomMenuOpen(false);
                          }}
                        >
                          {t('recorder.board.randomStreet')}
                        </button>
                      )}
                    </PopoverMenu>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.tableBox}>
              <FeltTable
                mode="hand"
                compact
                seats={tableSeats}
                activeSeatId={state.phase === 'betting' ? (state.actingPlayerId ?? undefined) : undefined}
                pot={displayPotMilliBb / 1000}
                potUnit={unit}
                board={boardSpecs}
                chipsToPotTrigger={allowCardMotion ? activeMotion.chipTrigger : 0}
                chipsToPotSeats={[...activeMotion.chipSeats]}
                ariaLabel={t('recorder.table.aria')}
              />

              <div className={styles.feltReadoutBar}>
                <div className={styles.readoutTextGroup}>
                  <span>
                    {tNodes('recorder.table.potReadout', {
                      pot: <PokerNotation>{formatAmountWithUnit(displayPotMilliBb, unit)}</PokerNotation>,
                    })}
                  </span>
                  {snap.callEconomics && snap.callEconomics.callCommitmentMilliBb > 0 && (
                    <span>
                      {tNodes('recorder.table.toCallReadout', {
                        amount: (
                          <PokerNotation>
                            {formatAmountWithUnit(snap.callEconomics.callCommitmentMilliBb, unit)}
                          </PokerNotation>
                        ),
                      })}
                      {snap.callEconomics.requiredRawEquity !== null
                        ? ` · ${t('recorder.table.requiredEquityReadout', {
                            pct: formatPercent(snap.callEconomics.requiredRawEquity, 1),
                          })}`
                        : ''}
                    </span>
                  )}
                </div>
                {canOpenInEquity && (
                  <Button variant="secondary" onClick={handleOpenInEquity}>
                    {t('recorder.actions.openInEquity')}
                  </Button>
                )}
              </div>
            </div>
          </Panel>

          <Panel label={t('recorder.thinking.heading')}>
            <div className={styles.thinkingStack}>
              <div className={styles.reasonChips}>
                {THINKING_REASONS.map((reasonId) => (
                  <ChipButton
                    key={reasonId}
                    selected={activeNote.reasonChip === reasonId}
                    onToggle={() => store.toggleHeroReasonChip(reasonId)}
                  >
                    {t(`recorder.thinking.${reasonId}`)}
                  </ChipButton>
                ))}
              </div>
              <TextField
                multiline
                rows={2}
                value={activeNote.customText}
                onValueChange={(next) => store.setHeroCustomNote(next)}
                placeholder={t('recorder.thinking.notePlaceholder')}
                ariaLabel={t('recorder.thinking.noteAria')}
                ltrInput={false}
              />
            </div>

            <PanelSection label={t('recorder.handNote.heading')}>
              <TextField
                multiline
                rows={2}
                ltrInput={false}
                value={store.handNoteSignal.value}
                onValueChange={(next) => store.setHandNote(next)}
                placeholder={t('recorder.handNote.placeholder')}
                ariaLabel={t('recorder.handNote.aria')}
              />
            </PanelSection>
          </Panel>
        </div>

        <div className={styles.column}>
          <Panel>
            <div className={styles.historyHeaderRow}>
              <span className={styles.microLabel}>{t('recorder.history.heading')}</span>
              <Button
                variant="secondary"
                disabled={store.stepsSignal.value.length === 0}
                onClick={() => store.stepBack()}
              >
                {t('recorder.actions.undo')}
              </Button>
            </div>
            {historyGroups.length === 0 ? (
              <p className={styles.mutedHint}>{t('recorder.history.empty')}</p>
            ) : (
              <div className={styles.historyScroll}>
                <HistoryRail
                  groups={historyGroups}
                  currentRowId={latestRowId}
                  onSelectRow={(rowId) => {
                    const seq = Number(rowId.replace('seq-', ''));
                    if (Number.isInteger(seq)) store.selectNoteActionSeq(seq);
                  }}
                />
              </div>
            )}
          </Panel>

          <Panel
            label={t('recorder.mode.label')}
            title={
              currentActor
                ? currentActor.playerId === 'hero'
                  ? t('recorder.turn.prompt', {
                      actor: t('recorder.table.heroLabel'),
                      position: currentActor.position,
                    })
                  : t('recorder.turn.promptPositionOnly', {
                      position: currentActor.position,
                    })
                : state.phase === 'chance'
                  ? chancePrompt
                  : state.phase === 'showdown'
                    ? t('recorder.showdown.heading')
                    : t('recorder.terminal.heading')
            }
            tier={tierConfig}
          >
            <div className={styles.modeBar}>
              <SegmentedControl
                ariaLabel={t('recorder.mode.label')}
                options={modeOptions}
                value={inputMode}
                onChange={(next) => store.setInputMode(next)}
              />
              {inputMode === 'tap' && (
                <div className={styles.headerButtons}>
                  <ChipButton
                    selected={store.quickTapVillainsSignal.value}
                    onToggle={(next) => store.setQuickTapVillains(next)}
                  >
                    {t('recorder.actions.quickTapVillains')}
                  </ChipButton>
                  {canFoldRemaining && (
                    <Button variant="secondary" onClick={() => store.foldRemainingToHeroOrEnd()}>
                      {t('recorder.actions.foldRemaining')}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {inputMode === 'shorthand' ? (
              <div className={styles.shorthandBox}>
                <TokenInput
                  tokens={[...shorthandTokens]}
                  onTokensChange={(next) => store.setShorthandTokens(next)}
                  draft={shorthandDraft}
                  onDraftChange={(next) => store.setShorthandDraft(next)}
                  validateToken={(tok) => {
                    const res = validateActionShorthandToken(tok);
                    return res.valid
                      ? { valid: true }
                      : {
                          valid: false,
                          reason: res.reasonKey ? t(res.reasonKey) : t('recorder.shorthand.errToken'),
                        };
                  }}
                  placeholder={t('recorder.shorthand.placeholder')}
                  ariaLabel={t('recorder.shorthand.label')}
                />

                {semanticShorthandError && (
                  <p className={styles.errorText} role="alert">
                    {semanticShorthandError}
                  </p>
                )}

                <div className={styles.shorthandFooter}>
                  <p className={styles.helperText}>
                    <PokerNotation>{t('recorder.shorthand.helper')}</PokerNotation>
                  </p>
                  <div className={styles.toolbarActions}>
                    <ChipButton
                      selected={keypadOpen}
                      onToggle={() => setKeypadOpen((open) => !open)}
                    >
                      {t('recorder.keypad.toggle')}
                    </ChipButton>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setPasteOpen((open) => !open);
                        setPasteError(null);
                        setBatchStatus(null);
                      }}
                    >
                      {t('recorder.import.toggle')}
                    </Button>
                    <Button variant="primary" onClick={() => store.applyShorthandLine()}>
                      {t('recorder.shorthand.apply')}
                    </Button>
                  </div>
                </div>

                {keypadOpen && (
                  <div className={styles.toolbarActions} role="group" aria-label={t('recorder.keypad.toggle')}>
                    {(['F', 'X', 'C', 'R 2.5', 'B 50%', 'B 67%', 'AI'] as const).map((macro) => (
                      <Button
                        key={macro}
                        variant="secondary"
                        onClick={() => {
                          const parts = macro.split(' ');
                          store.setShorthandTokens([...shorthandTokens, ...parts]);
                        }}
                      >
                        <PokerNotation>{macro}</PokerNotation>
                      </Button>
                    ))}
                    <Button
                      variant="secondary"
                      disabled={shorthandTokens.length === 0}
                      onClick={() => store.setShorthandTokens(shorthandTokens.slice(0, -1))}
                    >
                      {'⌫'}
                    </Button>
                  </div>
                )}

                {pasteOpen && (
                  <div className={styles.shorthandBox}>
                    <TextField
                      multiline
                      rows={4}
                      value={pasteText}
                      onValueChange={(next) => {
                        setPasteText(next);
                        setPasteError(null);
                      }}
                      placeholder={t('recorder.import.placeholder')}
                      ariaLabel={t('recorder.import.aria')}
                      ltrInput={true}
                    />
                    {pasteError && (
                      <p className={styles.errorText} role="alert">
                        {pasteError}
                      </p>
                    )}
                    {batchStatus && (
                      <p className={styles.helperText} role="status">
                        {batchStatus}
                      </p>
                    )}
                    <div className={styles.toolbarActions}>
                      {(() => {
                        const batchChunks = splitMultiHandHistory(pasteText);
                        return batchChunks.length >= 2 ? (
                          <Button
                            variant="primary"
                            onClick={() => {
                              void (async () => {
                                let imported = 0;
                                for (const chunk of batchChunks) {
                                  const parsed = parseHandHistoryText(chunk);
                                  if (!parsed.ok) continue;
                                  if (parsed.seatCount !== undefined) {
                                    store.setSeatCount(parsed.seatCount);
                                  }
                                  const latestState = store.handSnapshotSignal.value.pokerState;
                                  if (parsed.heroPositionLabel) {
                                    const targetPos = parsed.heroPositionLabel.toUpperCase();
                                    const matchSeat = latestState.players.find(
                                      (p) => p.position.toUpperCase() === targetPos,
                                    );
                                    if (matchSeat) store.setHeroSeatIndex(matchSeat.seat);
                                  }
                                  if (parsed.heroCards) {
                                    store.setHeroCard(0, parsed.heroCards[0]);
                                    store.setHeroCard(1, parsed.heroCards[1]);
                                  }
                                  store.setShorthandTokens([...parsed.tokens]);
                                  store.setShorthandDraft('');
                                  if (store.applyShorthandLine()) {
                                    await store.saveCurrentHand();
                                    imported += 1;
                                  }
                                }
                                setBatchStatus(
                                  t('recorder.import.batchDone', {
                                    imported,
                                    total: batchChunks.length,
                                  }),
                                );
                              })();
                            }}
                          >
                            {t('recorder.import.batchBtn', { count: batchChunks.length })}
                          </Button>
                        ) : null;
                      })()}
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const parsed = parseHandHistoryText(pasteText);
                          if (!parsed.ok) {
                            setPasteError(parsed.message);
                            return;
                          }
                          if (parsed.seatCount !== undefined) {
                            store.setSeatCount(parsed.seatCount);
                          }
                          const latestState = store.handSnapshotSignal.value.pokerState;
                          if (parsed.heroPositionLabel) {
                            const targetPos = parsed.heroPositionLabel.toUpperCase();
                            const matchSeat = latestState.players.find(
                              (p) => p.position.toUpperCase() === targetPos,
                            );
                            if (matchSeat) {
                              store.setHeroSeatIndex(matchSeat.seat);
                            }
                          }
                          if (parsed.heroCards) {
                            store.setHeroCard(0, parsed.heroCards[0]);
                            store.setHeroCard(1, parsed.heroCards[1]);
                          }
                          store.setShorthandTokens([...parsed.tokens]);
                          store.setShorthandDraft('');
                          if (store.applyShorthandLine()) {
                            if (parsed.revealedCardsByPosition) {
                              const postState = store.handSnapshotSignal.value.pokerState;
                              for (const [pos, cards] of Object.entries(parsed.revealedCardsByPosition)) {
                                const seatPlayer = postState.players.find(
                                  (p) =>
                                    p.position.toUpperCase() === pos.toUpperCase() &&
                                    p.seat !== store.heroSeatIndexSignal.value,
                                );
                                if (seatPlayer) {
                                  store.revealOpponentHoleCards(seatPlayer.playerId, cards);
                                }
                              }
                            }
                            setPasteOpen(false);
                            setPasteError(null);
                          }
                        }}
                      >
                        {t('recorder.import.apply')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : state.phase === 'betting' ? (
              <>
                <OptionTickets
                  tickets={tickets}
                  selectedTicketId={selectedTicket}
                  onSelectTicket={(id) => {
                    const choice = id as TicketChoiceId;
                    store.selectTicket(choice);
                    if (
                      store.quickTapVillainsSignal.value &&
                      currentActor &&
                      currentActor.playerId !== 'hero' &&
                      (choice === 'fold' || choice === 'check' || choice === 'call')
                    ) {
                      playTableSound('confirm');
                      store.confirmTicketAction();
                    }
                  }}
                  ladderLabel={showLadder ? t('recorder.tickets.ladderLabel') : undefined}
                  sizes={kitSizes}
                  selectedSizeId={selectedSizeId}
                  onSelectSize={(id) => store.selectSizeId(id as 's1' | 's2' | 's3')}
                  onAdjustSize={(id, nextVal) =>
                    store.adjustLadderSize(id as 's1' | 's2' | 's3', nextVal)
                  }
                  onResetSizes={() => store.resetSizeLadder()}
                  confirmLabel={t('recorder.actions.confirmAction')}
                  onConfirm={() => store.confirmTicketAction()}
                  confirmDisabled={!selectedTicket}
                />

                {showLadder && (
                  <div className={styles.quickRow}>
                    <ChipButton
                      selected={approximateSize}
                      onToggle={(next) => store.setApproximateSize(next)}
                    >
                      {t('recorder.actions.approximate')}
                    </ChipButton>
                    {state.potMilliBb > 0 &&
                      kitSizes &&
                      kitSizes.length > 0 &&
                      ([0.33, 0.5, 0.75, 1] as const).map((pct) => {
                        const targetSize =
                          kitSizes.find((s) => s.id === selectedSizeId) ?? kitSizes[0]!;
                        const rawBb = Math.round(((state.potMilliBb * pct) / 1000) * 10) / 10;
                        const minBb = targetSize.min ?? 0.5;
                        const maxBb = targetSize.max ?? rawBb;
                        const clampedBb = Math.max(minBb, Math.min(maxBb, rawBb));
                        return (
                          <Button
                            key={pct}
                            variant="secondary"
                            onClick={() =>
                              store.adjustLadderSize(
                                targetSize.id as 's1' | 's2' | 's3',
                                clampedBb,
                              )
                            }
                          >
                            {pct === 1
                              ? t('recorder.tickets.potFull')
                              : `${Math.round(pct * 100)}%`}
                          </Button>
                        );
                      })}
                  </div>
                )}
              </>
            ) : state.phase === 'chance' ? (
              <div className={styles.boardPickerBox}>
                <div className={styles.stagedSlots}>
                  <div className={styles.stagedCards}>
                    {Array.from({ length: neededBoardCount }, (_, i) => {
                      const picked = pendingBoardCards[i];
                      return picked ? (
                        <PlayingCard key={picked} card={picked} size="small" />
                      ) : (
                        <span key={i} className={styles.stagedSlotEmpty}>
                          {t('recorder.board.slotEmpty')}
                        </span>
                      );
                    })}
                  </div>
                  <div className={styles.stagedActions}>
                    <Button
                      variant="primary"
                      disabled={pendingBoardCards.length !== neededBoardCount}
                      onClick={() => store.commitPendingBoardCards()}
                    >
                      {t('recorder.board.confirmStreet', {
                        picked: pendingBoardCards.length,
                        needed: neededBoardCount,
                      })}
                    </Button>
                    <Button variant="secondary" onClick={() => store.dealRandomPendingStreet()}>
                      {t('recorder.board.randomStreet')}
                    </Button>
                  </div>
                </div>

                <HeatGrid
                  variant="runout"
                  ariaLabel={t('recorder.board.gridAria')}
                  rows={boardHeatRows}
                  activeId={pendingBoardCards[pendingBoardCards.length - 1] ?? null}
                  onActivateCell={(cell) => store.togglePendingBoardCard(cell.id)}
                />
              </div>
            ) : state.phase === 'showdown' ? (
              <div className={styles.terminalBox}>
                <p className={styles.terminalLine}>{t('recorder.showdown.revealPrompt')}</p>
                <div className={styles.revealRow}>
                  {(state.showdown.requiredRevealPlayerIds ?? []).map((pid) => {
                    const p = state.players.find((pl) => pl.playerId === pid);
                    if (!p) return null;
                    return (
                      <Button
                        key={pid}
                        variant="secondary"
                        onClick={() => {
                          setRevealStagedFirst(null);
                          setPickerTarget({
                            kind: 'reveal',
                            playerId: pid,
                            title: t('recorder.showdown.pickCardTitle', { slot: 1 }),
                          });
                        }}
                      >
                        {t('recorder.showdown.revealBtn', { position: p.position })}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className={styles.terminalBox}>
                <p className={styles.terminalLine}>
                  {state.terminal.reason === 'showdown'
                    ? t('recorder.terminal.wonShowdown', { winners: winnerLabels })
                    : t('recorder.terminal.wonFold', { winners: winnerLabels })}
                </p>
                {Object.entries(state.terminal.payoutsMilliBbByPlayer).map(([pid, amt]) => {
                  const pos = state.players.find((p) => p.playerId === pid)?.position ?? pid;
                  return (
                    <p key={pid} className={styles.terminalLine}>
                      {tNodes('recorder.terminal.payoutLine', {
                        position: <PokerNotation>{pos}</PokerNotation>,
                        amount: <PokerNotation>{formatAmountWithUnit(amt, unit)}</PokerNotation>,
                      })}
                    </p>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <CardPicker
        open={pickerTarget !== null}
        title={pickerTarget?.title ?? ''}
        deadCards={
          new Set([
            ...snap.deadCards,
            ...(revealStagedFirst ? [revealStagedFirst] : []),
          ])
        }
        selectedCard={
          pickerTarget?.kind === 'hero' ? heroCards[pickerTarget.slotIndex] : undefined
        }
        returnFocusTo={
          pickerTarget?.kind === 'hero' ? heroCardRefs.current[pickerTarget.slotIndex] : null
        }
        closeOnSelect={
          pickerTarget?.kind === 'hero'
            ? pickerTarget.slotIndex !== 0
            : pickerTarget?.kind !== 'reveal' || Boolean(revealStagedFirst)
        }
        onSelectCard={(card) => {
          if (!pickerTarget) return;
          if (!card) {
            setRevealStagedFirst(null);
            setPickerTarget(null);
            return;
          }
          if (pickerTarget.kind === 'hero') {
            store.setHeroCard(pickerTarget.slotIndex, card);
            if (pickerTarget.slotIndex === 0) {
              setPickerTarget({
                kind: 'hero',
                slotIndex: 1,
                title: t('recorder.setup.cardSlotAria', { slot: 2 }),
              });
              return;
            }
            setPickerTarget(null);
            return;
          }
          if (!revealStagedFirst) {
            setRevealStagedFirst(card);
            setPickerTarget({
              kind: 'reveal',
              playerId: pickerTarget.playerId,
              title: t('recorder.showdown.pickCardTitle', { slot: 2 }),
            });
            return;
          }
          store.revealOpponentHoleCards(pickerTarget.playerId, [revealStagedFirst, card]);
          setRevealStagedFirst(null);
          setPickerTarget(null);
        }}
        onClose={() => {
          setRevealStagedFirst(null);
          setPickerTarget(null);
        }}
      />

      <InlineEquityDrawer
        open={equityOverlayOpen}
        onToggle={() => setEquityOverlayOpen((prev) => !prev)}
        onClose={() => setEquityOverlayOpen(false)}
        heroCards={heroCards[0] && heroCards[1] ? ([heroCards[0], heroCards[1]] as const) : null}
        baseBoard={state.board}
        defaultSource="any"
        priceFacts={
          snap.callEconomics &&
          snap.callEconomics.callCommitmentMilliBb > 0 &&
          snap.callEconomics.requiredRawEquity !== null
            ? {
                requiredPct: Math.round(snap.callEconomics.requiredRawEquity * 1000) / 10,
                callLabel: formatAmountWithUnit(snap.callEconomics.callCommitmentMilliBb, unit),
                potLabel: formatAmountWithUnit(
                  snap.callEconomics.actorContestablePotAfterCallMilliBb,
                  unit,
                ),
              }
            : null
        }
      />
    </div>
  );
}
