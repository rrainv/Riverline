import { useEffect, useRef, useState } from 'preact/hooks';
import {
  type HandRecorderStore,
  type RecorderLadderOption,
  type TicketChoiceId,
} from '../../../domain/hand';
import { getSharedReviewStore } from '../../../domain/review';
import { navigateTo } from '../../../domain/shellState';
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
import { Panel } from '../../kit/panel/Panel';
import { CardPicker } from '../../kit/playing-card/CardPicker';
import { PlayingCard } from '../../kit/playing-card/PlayingCard';
import { readDurationMs } from '../../kit/state';
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

type CardPickerTarget =
  | { readonly kind: 'hero'; readonly slotIndex: 0 | 1; readonly title: string }
  | { readonly kind: 'reveal'; readonly playerId: string; readonly title: string };

export interface HandRoomProps {
  store: HandRecorderStore;
}

export function HandRoom({ store }: HandRoomProps) {
  const tablePreset = store.tablePresetSignal.value;
  const seatCount = store.seatCountSignal.value;
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

  const [pickerTarget, setPickerTarget] = useState<CardPickerTarget | null>(null);
  const heroCardRefs = useRef<Array<HTMLButtonElement | null>>([null, null]);
  const [revealStagedFirst, setRevealStagedFirst] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [lastSavedRecord, setLastSavedRecord] = useState<SavedHandRecord | null>(null);
  const [equityOverlayOpen, setEquityOverlayOpen] = useState(false);
  const saveTimerRef = useRef<number | null>(null);

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
    { value: 'six_max_100bb', label: t('recorder.preset.sixMax') },
    { value: 'home_game_50bb', label: t('recorder.preset.homeGame') },
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
        cards = p.holeCards.map((c) => ({
          card: c,
          state: 'face' as const,
          winning: isWinner && winningCardSet.has(c),
        }));
      } else if (p.holeCards && typeof p.holeCards === 'object' && 'status' in p.holeCards && p.holeCards.status === 'hidden') {
        cards = [
          { state: 'back' as const },
          { state: 'back' as const },
        ];
      }
    }

    return {
      id: p.playerId,
      name: isHero ? `${p.position} (${t('recorder.table.heroLabel')})` : p.position,
      stack: formatAmountWithUnit(p.currentStackMilliBb, unit),
      emblem: isHero ? 'hero' : SEAT_EMBLEMS[idx % SEAT_EMBLEMS.length],
      isHero,
      isDealer: p.seat === state.buttonSeat,
      folded: p.folded,
      thinking: state.phase === 'betting' && state.actingPlayerId === p.playerId,
      actionBubble,
      bet:
        state.phase === 'betting' && p.streetContributionMilliBb > 0
          ? formatAmountWithUnit(p.streetContributionMilliBb, unit)
          : undefined,
      cards,
    };
  });

  const boardSpecs: TableCardSpec[] = state.board.map((c) => ({
    card: c,
    state: 'face' as const,
    winning: state.terminal.isTerminal && winningCardSet.has(c),
  }));

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
          ? t('recorder.history.streetPot', { pot: formatAmountWithUnit(state.potMilliBb, unit) })
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
        shortcut: 'F',
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
        shortcut: 'C',
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
        shortcut: 'R',
        label: t('recorder.tickets.raise'),
      });
    }
    if (legal.allIn.available && legal.allIn.amountToMilliBb !== null) {
      tickets.push({
        id: 'all_in',
        shortcut: 'A',
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
    .map((id) => state.players.find((p) => p.playerId === id)?.position ?? id)
    .join(', ');

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
          {tablePreset === 'home_game_50bb' && (
            <SegmentedControl
              ariaLabel={t('recorder.seats.label')}
              options={seatCountOptions}
              value={String(seatCount) as '6' | '8'}
              onChange={(next) => store.setSeatCount(Number(next) as 6 | 8)}
            />
          )}
          <div className={styles.headerButtons}>
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
            {savedNotice && lastSavedRecord && (
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
            <ChipButton
              selected={equityOverlayOpen}
              onToggle={() => setEquityOverlayOpen((prev) => !prev)}
            >
              {t('equityOverlay.trigger')} <Kbd>E</Kbd>
            </ChipButton>
          </div>
        </div>
      </header>

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
                </div>
              </div>
            </div>

            <div className={styles.tableBox}>
              <FeltTable
                mode="hand"
                compact
                seats={tableSeats}
                activeSeatId={state.phase === 'betting' ? (state.actingPlayerId ?? undefined) : undefined}
                pot={state.potMilliBb / 1000}
                potUnit={unit}
                board={boardSpecs}
                ariaLabel={t('recorder.table.aria')}
              />

              <div className={styles.feltReadoutBar}>
                <span>
                  {tNodes('recorder.table.potReadout', {
                    pot: <PokerNotation>{formatAmountWithUnit(state.potMilliBb, unit)}</PokerNotation>,
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
                value={activeNote.customText}
                onValueChange={(next) => store.setHeroCustomNote(next)}
                placeholder={t('recorder.thinking.notePlaceholder')}
                ariaLabel={t('recorder.thinking.noteAria')}
                ltrInput={false}
              />
            </div>
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
                ? t('recorder.turn.prompt', {
                    actor: currentActor.playerId === 'hero'
                      ? t('recorder.table.heroLabel')
                      : currentActor.position,
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
              {inputMode === 'tap' && canFoldRemaining && (
                <Button variant="secondary" onClick={() => store.foldRemainingToHeroOrEnd()}>
                  {t('recorder.actions.foldRemaining')}
                </Button>
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
                  <Button variant="primary" onClick={() => store.applyShorthandLine()}>
                    {t('recorder.shorthand.apply')}
                  </Button>
                </div>
              </div>
            ) : state.phase === 'betting' ? (
              <>
                <OptionTickets
                  tickets={tickets}
                  selectedTicketId={selectedTicket}
                  onSelectTicket={(id) => store.selectTicket(id as TicketChoiceId)}
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
                <h3 className={styles.terminalHeading}>{t('recorder.terminal.heading')}</h3>
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
        closeOnSelect={pickerTarget?.kind !== 'reveal' || Boolean(revealStagedFirst)}
        onSelectCard={(card) => {
          if (!pickerTarget) return;
          if (!card) {
            setRevealStagedFirst(null);
            setPickerTarget(null);
            return;
          }
          if (pickerTarget.kind === 'hero') {
            store.setHeroCard(pickerTarget.slotIndex, card);
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
