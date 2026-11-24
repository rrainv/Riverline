import { useEffect, useRef, useState } from 'preact/hooks';
import {
  matchesShortcutEvent,
  minimalCardsSignal,
  motionSignal,
  shortcutsSignal,
} from '../../../domain/appearance';
import type { DuelActionBubble, TrainingStore } from '../../../domain/training';
import type { DuelBotStyleId, HandCategory } from '../../../engine-api';
import { formatNumber, t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { Chip, Kbd } from '../../kit/chip/Chip';
import { ChipButton, SegmentedControl } from '../../kit/choice/Choice';
import { EquityList, EquityRow } from '../../kit/equity-row/EquityRow';
import { FeltTable, type TableCardSpec, type TableSeat } from '../../kit/felt-table/FeltTable';
import { HistoryRail, type HistoryStreetGroup } from '../../kit/history-rail/HistoryRail';
import { TeacherCallout } from '../../kit/lamp/Lamp';
import {
  OptionTickets,
  type LadderSizeOption,
  type OptionTicketItem,
} from '../../kit/option-tickets/OptionTickets';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import { InlineEquityDrawer } from '../equity/InlineEquityDrawer';
import { formatCardGlyph, formatCategoryLabel } from '../equity/equityFormatters';
import styles from './TrainingRoom.module.css';

interface DuelMotionSnapshot {
  readonly handKey: string;
  readonly board: readonly string[];
  readonly street: string;
  readonly potMilliBb: number;
  readonly actionCount: number;
  readonly isSettled: boolean;
  readonly heroFolded: boolean;
  readonly astraFolded: boolean;
  readonly astraRevealed: boolean;
  readonly contributingSeatIds: readonly string[];
  readonly activeNonFoldedSeatIds: readonly string[];
}

interface DuelMotionTracker {
  lastSig: string | null;
  prev: DuelMotionSnapshot | null;
  dealHero: boolean;
  dealBoardFrom: number;
  heroFoldAnim: boolean;
  astraFoldAnim: boolean;
  astraFlipAnim: boolean;
  chipTrigger: number;
  chipSeats: readonly string[];
}

interface HeadsUpDuelViewProps {
  readonly store: TrainingStore;
  readonly onOpenReview?: () => void;
}

export function formatDuelBubble(bubble: DuelActionBubble | null) {
  if (!bubble) return undefined;
  const labelKey =
    bubble.type === 'fold'
      ? 'training.duel.fold'
      : bubble.type === 'check'
        ? 'training.duel.check'
        : bubble.type === 'call'
          ? 'training.duel.call'
          : bubble.type === 'bet'
            ? 'training.duel.bet'
            : bubble.type === 'raise'
              ? 'training.duel.raiseTo'
              : 'training.duel.allIn';
  const label = t(labelKey);
  if (
    bubble.amountBb !== null &&
    (bubble.type === 'bet' || bubble.type === 'raise' || bubble.type === 'all_in')
  ) {
    return (
      <>
        {label}{' '}
        <PokerNotation>
          {bubble.amountBb} {t('training.duel.unitBb')}
        </PokerNotation>
      </>
    );
  }
  return label;
}

export function HeadsUpDuelView({ store, onOpenReview }: HeadsUpDuelViewProps) {
  const live = store.duelStateSignal.value;
  const [equityOverlayOpen, setEquityOverlayOpen] = useState(false);
  const [inspectedHandNumber, setInspectedHandNumber] = useState<number | null>(null);
  const motionRef = useRef<DuelMotionTracker>({
    lastSig: null,
    prev: null,
    dealHero: false,
    dealBoardFrom: 0,
    heroFoldAnim: false,
    astraFoldAnim: false,
    astraFlipAnim: false,
    chipTrigger: 0,
    chipSeats: [],
  });

  const canDealNext = Boolean(
    live && live.pokerState.terminal.isTerminal && live.handNumber < live.totalHands,
  );
  useEffect(() => {
    if (!canDealNext) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'BUTTON' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      void store.dealNextDuelHand();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canDealNext, store]);

  const canHeroActInDuel = Boolean(
    live &&
      !live.finishedMatch &&
      !live.pokerState.terminal.isTerminal &&
      !live.astraThinking &&
      live.pokerState.actingPlayerId === 'hero' &&
      live.legalSpec,
  );
  useEffect(() => {
    if (!canHeroActInDuel || !live?.legalSpec) return;
    const legalSpec = live.legalSpec;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (document.querySelector('[data-shortcut-capture="true"]')) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (document.querySelector('[role="dialog"]')) return;
      const activeShortcuts = shortcutsSignal.value;
      if (matchesShortcutEvent(event, activeShortcuts.allIn) && legalSpec.allIn.available) {
        event.preventDefault();
        if (legalSpec.bet.available || legalSpec.raise.available) {
          store.selectDuelTicket(legalSpec.bet.available ? 'bet' : 'raise');
          store.selectDuelSize('allin');
        } else {
          store.selectDuelTicket('all_in');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canHeroActInDuel, live?.legalSpec, store]);

  if (!live) return null;

  const allowCardMotion = motionSignal.value !== 'reduced' && !minimalCardsSignal.value;
  const shortcuts = shortcutsSignal.value;

  const selectedTicket = store.duelSelectedTicketSignal.value;
  const selectedSizeId = store.duelSelectedSizeIdSignal.value;

  const heroPlayer = live.pokerState.players.find((p) => p.playerId === 'hero')!;
  const astraPlayer = live.pokerState.players.find((p) => p.playerId === 'astra')!;

  const curContributingSeats = live.pokerState.players
    .filter((p) => p.streetContributionMilliBb > 0)
    .map((p) => p.playerId);
  const curActiveSeats = live.pokerState.players
    .filter((p) => !p.folded)
    .map((p) => p.playerId);

  const curMotionSnapshot: DuelMotionSnapshot = {
    handKey: `${live.sessionSeed}-${live.handNumber}`,
    board: [...live.pokerState.board],
    street: live.pokerState.street,
    potMilliBb: live.pokerState.potMilliBb,
    actionCount: live.pokerState.actionHistory.length,
    isSettled: live.pokerState.terminal.isTerminal,
    heroFolded: heroPlayer.folded,
    astraFolded: astraPlayer.folded,
    astraRevealed: Boolean(live.revealedAstraCards),
    contributingSeatIds: curContributingSeats,
    activeNonFoldedSeatIds: curActiveSeats,
  };

  const curMotionSig = [
    curMotionSnapshot.handKey,
    live.heroCards.join(','),
    curMotionSnapshot.board.join(','),
    curMotionSnapshot.street,
    curMotionSnapshot.potMilliBb,
    curMotionSnapshot.actionCount,
    curMotionSnapshot.isSettled ? 1 : 0,
    curMotionSnapshot.heroFolded ? 1 : 0,
    curMotionSnapshot.astraFolded ? 1 : 0,
    live.revealedAstraCards ? live.revealedAstraCards.join(',') : '',
    curContributingSeats.join(','),
  ].join('|');

  if (!allowCardMotion) {
    motionRef.current.dealHero = false;
    motionRef.current.dealBoardFrom = curMotionSnapshot.board.length;
    motionRef.current.heroFoldAnim = false;
    motionRef.current.astraFoldAnim = false;
    motionRef.current.astraFlipAnim = false;
    motionRef.current.lastSig = curMotionSig;
    motionRef.current.prev = curMotionSnapshot;
  } else if (motionRef.current.lastSig !== curMotionSig) {
    const prev = motionRef.current.prev;
    if (!prev || prev.handKey !== curMotionSnapshot.handKey) {
      motionRef.current.dealHero =
        curMotionSnapshot.board.length === 0 && !curMotionSnapshot.isSettled;
      motionRef.current.dealBoardFrom = curMotionSnapshot.board.length;
      motionRef.current.heroFoldAnim = false;
      motionRef.current.astraFoldAnim = false;
      motionRef.current.astraFlipAnim = false;
    } else {
      motionRef.current.dealHero =
        motionRef.current.dealHero &&
        curMotionSnapshot.board.length === 0 &&
        !curMotionSnapshot.isSettled &&
        live.heroBubble === null;
      if (curMotionSnapshot.board.length > prev.board.length) {
        motionRef.current.dealBoardFrom = prev.board.length;
      } else if (curMotionSnapshot.board.length < prev.board.length) {
        motionRef.current.dealBoardFrom = curMotionSnapshot.board.length;
      }
      motionRef.current.heroFoldAnim = curMotionSnapshot.heroFolded && !prev.heroFolded;
      motionRef.current.astraFoldAnim = curMotionSnapshot.astraFolded && !prev.astraFolded;
      motionRef.current.astraFlipAnim = curMotionSnapshot.astraRevealed && !prev.astraRevealed;

      const streetChanged = prev.street !== curMotionSnapshot.street;
      const settledNow = !prev.isSettled && curMotionSnapshot.isSettled;
      if (
        (streetChanged || settledNow) &&
        (prev.contributingSeatIds.length > 0 || curMotionSnapshot.potMilliBb > prev.potMilliBb)
      ) {
        motionRef.current.chipTrigger += 1;
        motionRef.current.chipSeats =
          prev.contributingSeatIds.length > 0
            ? [...prev.contributingSeatIds]
            : [...curMotionSnapshot.activeNonFoldedSeatIds];
      }
    }
    motionRef.current.lastSig = curMotionSig;
    motionRef.current.prev = curMotionSnapshot;
  }

  const activeMotion = motionRef.current;

  const heroStackBb = Math.round((heroPlayer.currentStackMilliBb / 1000) * 10) / 10;
  const astraStackBb = Math.round((astraPlayer.currentStackMilliBb / 1000) * 10) / 10;
  const potBb = Math.round((live.pokerState.potMilliBb / 1000) * 10) / 10;

  const isShowdown =
    live.pokerState.terminal.isTerminal && live.pokerState.terminal.reason === 'showdown';
  const winningCardSet = new Set<string>();
  if (isShowdown && live.pokerState.showdown.handRanksByPlayer) {
    for (const wId of live.pokerState.terminal.winnerPlayerIds) {
      const rank = live.pokerState.showdown.handRanksByPlayer[wId];
      if (rank) {
        for (const c of rank.bestFiveCards) winningCardSet.add(c);
      }
    }
  }
  const heroIsWinner = isShowdown && live.pokerState.terminal.winnerPlayerIds.includes('hero');
  const astraIsWinner = isShowdown && live.pokerState.terminal.winnerPlayerIds.includes('astra');
  const showdownResultText = isShowdown
    ? live.pokerState.terminal.winnerPlayerIds
        .map((wId) => {
          const who = wId === 'hero' ? t('training.duel.heroName') : t('training.duel.astraName');
          const cat = live.pokerState.showdown.handRanksByPlayer?.[wId]?.category;
          return cat ? `${who} (${formatCategoryLabel(cat as HandCategory)})` : who;
        })
        .join(', ')
    : undefined;

  const heroSeatCards: TableCardSpec[] | undefined = !heroPlayer.folded
    ? [
        {
          card: live.heroCards[0],
          winning: heroIsWinner && winningCardSet.has(live.heroCards[0]),
          motion: allowCardMotion && activeMotion.dealHero ? 'deal' : 'none',
        },
        {
          card: live.heroCards[1],
          winning: heroIsWinner && winningCardSet.has(live.heroCards[1]),
          motion: allowCardMotion && activeMotion.dealHero ? 'deal' : 'none',
        },
      ]
    : allowCardMotion && activeMotion.heroFoldAnim
      ? [
          { card: live.heroCards[0], state: 'face', motion: 'fold' },
          { card: live.heroCards[1], state: 'face', motion: 'fold' },
        ]
      : undefined;

  const astraSeatCards: TableCardSpec[] | undefined = !astraPlayer.folded
    ? live.revealedAstraCards
      ? [
          {
            card: live.revealedAstraCards[0],
            winning: astraIsWinner && winningCardSet.has(live.revealedAstraCards[0]),
            motion: allowCardMotion && activeMotion.astraFlipAnim ? 'flip' : 'none',
          },
          {
            card: live.revealedAstraCards[1],
            winning: astraIsWinner && winningCardSet.has(live.revealedAstraCards[1]),
            motion: allowCardMotion && activeMotion.astraFlipAnim ? 'flip' : 'none',
          },
        ]
      : [{ state: 'back' }, { state: 'back' }]
    : allowCardMotion && activeMotion.astraFoldAnim
      ? [
          { state: 'back', motion: 'fold' },
          { state: 'back', motion: 'fold' },
        ]
      : undefined;

  const seats: TableSeat[] = [
    {
      id: 'hero',
      name: t('training.duel.heroName'),
      stack: `${formatNumber(heroStackBb, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} bb`,
      styleLine: live.heroIsButton ? t('training.duel.btnTag') : t('training.duel.bbTag'),
      emblem: 'hero',
      isHero: true,
      isDealer: live.heroIsButton,
      folded: heroPlayer.folded,
      cards: heroSeatCards,
      actionBubble: formatDuelBubble(live.heroBubble),
    },
    {
      id: 'astra',
      name: t('training.duel.astraName'),
      stack: `${formatNumber(astraStackBb, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} bb`,
      styleLine: `${live.heroIsButton ? t('training.duel.bbTag') : t('training.duel.btnTag')} · ${t(`training.duel.style.${live.botStyle}`)}`,
      emblem: 'orbits',
      isDealer: !live.heroIsButton,
      folded: astraPlayer.folded,
      thinking: live.astraThinking,
      cards: astraSeatCards,
      actionBubble: live.astraThinking
        ? t('training.duel.thinking')
        : formatDuelBubble(live.astraBubble),
    },
  ];

  const boardCards: TableCardSpec[] = live.pokerState.board.map((card, idx) => ({
    card,
    winning: isShowdown && winningCardSet.has(card),
    motion: allowCardMotion && idx >= activeMotion.dealBoardFrom ? 'deal' : 'none',
  }));

  const sizes: LadderSizeOption[] = live.sizePresets.map((preset) => ({
    id: preset.id,
    label: preset.labelKey ? t(preset.labelKey) : preset.pctLabel,
    displayAmount: `${preset.amountBb} bb`,
    value: preset.amountBb,
    adjustable: preset.adjustable,
    step: 0.5,
    min: preset.amountBb > 0 ? 1 : 0.5,
    max: 100,
    costDetail: t('training.duel.costDetail', {
      call: preset.costLineValues.callBb,
      pot: preset.costLineValues.potIfCalledBb,
      behind: preset.costLineValues.behindBb,
      spr: preset.costLineValues.spr,
    }),
  }));

  const activePreset =
    live.sizePresets.find((s) => s.id === selectedSizeId) ?? live.sizePresets[1] ?? live.sizePresets[0] ?? null;

  const legal = live.legalSpec;
  const isHeroTurn =
    !live.finishedMatch &&
    !live.pokerState.terminal.isTerminal &&
    !live.astraThinking &&
    live.pokerState.actingPlayerId === 'hero' &&
    legal !== null;

  const tickets: OptionTicketItem[] = isHeroTurn && legal
    ? [
        ...(legal.fold.available
          ? [{ id: 'fold', shortcut: shortcuts.fold, label: t('training.duel.fold') }]
          : []),
        ...(legal.check.available
          ? [{ id: 'check', shortcut: shortcuts.call, label: t('training.duel.check') }]
          : []),
        ...(legal.call.available
          ? [
              {
                id: 'call',
                shortcut: shortcuts.call,
                label: t('training.duel.call'),
                amount: `${Math.round((legal.call.commitMilliBb / 1000) * 10) / 10} bb`,
              },
            ]
          : []),
        ...(legal.bet.available
          ? [
              {
                id: 'bet',
                shortcut: shortcuts.raise,
                label: t('training.duel.bet'),
                amount: activePreset ? `${activePreset.amountBb} bb` : undefined,
              },
            ]
          : legal.raise.available
            ? [
                {
                  id: 'raise',
                  shortcut: shortcuts.raise,
                  label: t('training.duel.raiseTo'),
                  amount: activePreset ? `${activePreset.amountBb} bb` : undefined,
                },
              ]
            : legal.allIn.available
              ? [
                  {
                    id: 'all_in',
                    shortcut: shortcuts.allIn,
                    label: t('training.duel.allIn'),
                    amount: `${Math.round(((legal.allIn.amountToMilliBb ?? 0) / 1000) * 10) / 10} bb`,
                  },
                ]
              : []),
      ]
    : [];

  const streetOrder = ['preflop', 'flop', 'turn', 'river'] as const;
  const historyGroups: HistoryStreetGroup[] = [];
  for (const street of streetOrder) {
    const rows = live.historyItems.filter((item) => item.street === street);
    if (rows.length === 0) continue;
    historyGroups.push({
      id: street,
      streetLabel: t(`recorder.street.${street}`),
      rows: rows.map((item) => ({
        id: item.id,
        actor:
          item.actor === 'hero'
            ? t('training.duel.heroName')
            : item.actor === 'astra'
              ? t('training.duel.astraName')
              : t('training.duel.potLabel', { pot: item.potBb ?? potBb }),
        isHero: item.actor === 'hero',
        action: item.cards ? (
          <PokerNotation>{item.cards.map(formatCardGlyph).join(' ')}</PokerNotation>
        ) : (
          tNodes(item.textKey as 'training.duel.action_fold', {
            amount: <PokerNotation>{item.amountBb ?? 0}</PokerNotation>,
          })
        ),
      })),
    });
  }

  const signedNet =
    live.heroCumulativeNetBb > 0
      ? `+${live.heroCumulativeNetBb}`
      : `${live.heroCumulativeNetBb}`;

  const topKeyMoments = live.finishedMatch
    ? [...live.completedHands]
        .sort((a, b) => Math.abs(b.netBb) - Math.abs(a.netBb))
        .slice(0, 3)
    : [];

  const inspectedHand = live.finishedMatch
    ? (live.completedHands.find((h) => h.handNumber === inspectedHandNumber) ??
      live.completedHands[0] ??
      null)
    : null;
  const activeInspectedHandNumber = inspectedHand?.handNumber ?? null;

  return (
    <div className={styles.column}>
      <div className={styles.duelTopRow}>
        <div className={styles.duelBadges}>
          <Chip>
            {tNodes('training.duel.handBadge', {
              hand: <PokerNotation>{live.handNumber}</PokerNotation>,
              total: <PokerNotation>{live.totalHands}</PokerNotation>,
            })}
          </Chip>
          <Chip>
            {tNodes('training.duel.netBadge', {
              net: <PokerNotation>{signedNet}</PokerNotation>,
            })}
          </Chip>
        </div>

        <div className={styles.actionRow}>
          <SegmentedControl<DuelBotStyleId>
            ariaLabel={t('training.duel.style.label')}
            value={live.botStyle}
            onChange={(nextStyle) => {
              if (nextStyle !== live.botStyle) {
                void store.startHeadsUpDuel(live.sessionSeed + 101, nextStyle);
              }
            }}
            options={[
              { value: 'balanced', label: t('training.duel.style.balanced') },
              { value: 'loose_aggressive', label: t('training.duel.style.loose_aggressive') },
              { value: 'tight_aggressive', label: t('training.duel.style.tight_aggressive') },
            ]}
          />
          <ChipButton
            selected={live.readTableOpen}
            onToggle={() => store.toggleReadTable()}
          >
            {t('training.duel.readTableBtn')}
          </ChipButton>
          <ChipButton
            selected={equityOverlayOpen}
            onToggle={() => setEquityOverlayOpen((prev) => !prev)}
          >
            {t('equityOverlay.trigger')} <Kbd>{shortcuts.inlineEquity}</Kbd>
          </ChipButton>
          <Button
            variant="secondary"
            onClick={() => {
              void store.startHeadsUpDuel(live.sessionSeed + 101, live.botStyle);
            }}
          >
            {t('training.duel.newDuelBtn')}
          </Button>
        </div>
      </div>

      {live.readTableOpen ? (
        <div className={styles.readTableCard}>
          <p className={styles.planTitle}>
            {t('training.duel.readTableTitle', { hands: live.botStats.handsPlayed })}
          </p>
          <p className={styles.planBody}>
            {t('training.duel.readTableSample', {
              vpip: live.botStats.vpipHands,
              pfr: live.botStats.pfrHands,
              cbet: live.botStats.cbetHands,
              cbetOpps: live.botStats.cbetOpps,
              folds: live.botStats.foldToBetCount,
              facing: live.botStats.facingBetCount,
              hands: live.botStats.handsPlayed,
            })}
          </p>
        </div>
      ) : null}

      <div className={styles.mainGrid}>
        <div className={styles.column}>
          <FeltTable
            pot={potBb}
            activeSeatId={live.pokerState.actingPlayerId ?? undefined}
            board={boardCards}
            seats={seats}
            showdownResult={showdownResultText}
            chipsToPotTrigger={allowCardMotion ? activeMotion.chipTrigger : 0}
            chipsToPotSeats={[...activeMotion.chipSeats]}
          />

          {isHeroTurn ? (
            <Panel title={t('training.duel.heading')} tier={{ tier: 'exact', detail: t('tier.detail.priceOnly') }}>
              <div className={styles.spotSummary}>
                <OptionTickets
                  tickets={tickets}
                  selectedTicketId={selectedTicket ?? undefined}
                  onSelectTicket={(id) =>
                    store.selectDuelTicket(id as 'fold' | 'check' | 'call' | 'bet' | 'raise')
                  }
                  ladderLabel={sizes.length > 0 ? t('training.duel.ladderLabel') : undefined}
                  sizes={sizes}
                  selectedSizeId={selectedSizeId ?? undefined}
                  onSelectSize={(sizeId) => store.selectDuelSize(sizeId)}
                  onAdjustSize={(sizeId, val) => store.adjustDuelSize(sizeId, val)}
                  onResetSizes={() => store.resetDuelSizes()}
                  confirmLabel={t('training.duel.confirmAction')}
                  onConfirm={() => {
                    void store.confirmDuelAction();
                  }}
                  confirmDisabled={!selectedTicket}
                />

                {activePreset ? (
                  <p className={styles.duelPriceLine}>
                    {tNodes('training.duel.selectedPriceLine', {
                      call: <PokerNotation>{activePreset.costLineValues.callBb}</PokerNotation>,
                      pot: <PokerNotation>{activePreset.costLineValues.potIfCalledBb}</PokerNotation>,
                      behind: <PokerNotation>{activePreset.costLineValues.behindBb}</PokerNotation>,
                      odds: <PokerNotation>{activePreset.costLineValues.oddsPct}</PokerNotation>,
                    })}
                  </p>
                ) : null}
              </div>
            </Panel>
          ) : live.finishedMatch ? (
            <Panel title={t('training.duel.summaryTitle')}>
              <div className={styles.spotSummary}>
                <p className={styles.summaryText}>
                  {tNodes('training.duel.summaryBody', {
                    hands: <PokerNotation>{live.completedHands.length}</PokerNotation>,
                    net: <PokerNotation>{signedNet}</PokerNotation>,
                  })}
                </p>
                <p className={styles.planBody}>{t('training.duel.report.varianceNote')}</p>

                {live.completedHands.length > 0 ? (
                  <PanelSection label={t('training.duel.report.handStripHeading')}>
                    {(() => {
                      const biggest = live.completedHands.reduce((best, cand) => {
                        const bestAbs = Math.abs(best.netBb);
                        const candAbs = Math.abs(cand.netBb);
                        if (candAbs > bestAbs) return cand;
                        if (candAbs === bestAbs && cand.netBb < best.netBb) return cand;
                        return best;
                      }, live.completedHands[0]!);
                      const signedBiggest =
                        biggest.netBb > 0 ? `+${biggest.netBb}` : String(biggest.netBb);
                      return (
                        <div className={styles.actionRow}>
                          <Button
                            variant="secondary"
                            onClick={() => setInspectedHandNumber(biggest.handNumber)}
                          >
                            {t('training.duel.report.biggestSpotBtn', {
                              hand: biggest.handNumber,
                              net: signedBiggest,
                            })}
                          </Button>
                        </div>
                      );
                    })()}
                    <div className={styles.handLogStrip}>
                      {live.completedHands.map((hand) => (
                        <button
                          key={hand.handId}
                          type="button"
                          className={
                            activeInspectedHandNumber === hand.handNumber
                              ? `${styles.handLogBtn} ${styles.handLogBtnActive}`
                              : styles.handLogBtn
                          }
                          aria-pressed={activeInspectedHandNumber === hand.handNumber}
                          onClick={() => setInspectedHandNumber(hand.handNumber)}
                        >
                          <PokerNotation>#{hand.handNumber}</PokerNotation>
                          <PokerNotation>{hand.heroCards.map(formatCardGlyph).join('')}</PokerNotation>
                          <PokerNotation>
                            {hand.netBb > 0 ? '+' + hand.netBb : hand.netBb} bb
                          </PokerNotation>
                        </button>
                      ))}
                    </div>

                    {inspectedHand ? (
                      <div className={styles.inspectedHandCard}>
                        <div className={styles.inspectedHeader}>
                          <p className={styles.planTitle}>
                            {tNodes('training.duel.report.inspectHeading', {
                              hand: <PokerNotation>{inspectedHand.handNumber}</PokerNotation>,
                            })}
                          </p>
                          <span className={styles.momentNetBadge}>
                            <PokerNotation>
                              {inspectedHand.netBb > 0
                                ? '+' + inspectedHand.netBb
                                : inspectedHand.netBb}{' '}
                              bb
                            </PokerNotation>
                          </span>
                        </div>
                        <p className={styles.spotMeta}>
                          {tNodes('training.duel.report.momentLine', {
                            hand: <PokerNotation>{inspectedHand.handNumber}</PokerNotation>,
                            street: t(`recorder.street.${inspectedHand.endedAtStreet}`),
                            heroCards: (
                              <PokerNotation>
                                {inspectedHand.heroCards.map(formatCardGlyph).join(' ')}
                              </PokerNotation>
                            ),
                            astraCards: (
                              <PokerNotation>
                                {inspectedHand.savedPayload.pokerState.terminal.reason === 'showdown'
                                  ? inspectedHand.astraCards.map(formatCardGlyph).join(' ')
                                  : '??'}
                              </PokerNotation>
                            ),
                          })}
                        </p>
                        {inspectedHand.savedPayload.pokerState.board.length > 0 ? (
                          <p className={styles.planBody}>
                            <PokerNotation>
                              {inspectedHand.savedPayload.pokerState.board
                                .map(formatCardGlyph)
                                .join(' ')}
                            </PokerNotation>
                          </p>
                        ) : null}
                        {inspectedHand.savedPayload.shorthandLine ? (
                          <p className={styles.shorthandLine}>
                            <PokerNotation>{inspectedHand.savedPayload.shorthandLine}</PokerNotation>
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </PanelSection>
                ) : null}

                {topKeyMoments.length > 0 ? (
                  <PanelSection label={t('training.duel.report.keyMomentsHeading')}>
                    <ul className={styles.keyMomentList}>
                      {topKeyMoments.map((m) => (
                        <li key={m.handId} className={styles.keyMomentRow}>
                          <span className={styles.leakLabel}>
                            {tNodes('training.duel.report.momentLine', {
                              hand: <PokerNotation>{m.handNumber}</PokerNotation>,
                              street: t(`recorder.street.${m.endedAtStreet}`),
                              heroCards: (
                                <PokerNotation>
                                  {m.heroCards.map(formatCardGlyph).join(' ')}
                                </PokerNotation>
                              ),
                              astraCards: (
                                <PokerNotation>
                                  {m.savedPayload.pokerState.terminal.reason === 'showdown'
                                    ? m.astraCards.map(formatCardGlyph).join(' ')
                                    : '??'}
                                </PokerNotation>
                              ),
                            })}
                          </span>
                          <span className={styles.momentNetBadge}>
                            <PokerNotation>
                              {m.netBb > 0 ? '+' + m.netBb : m.netBb} bb
                            </PokerNotation>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </PanelSection>
                ) : null}

                <PanelSection label={t('training.duel.report.tendenciesHeading')}>
                  <div className={styles.readTableCard}>
                    <p className={styles.planBody}>
                      {t('training.duel.readTableSample', {
                        vpip: live.botStats.vpipHands,
                        pfr: live.botStats.pfrHands,
                        cbet: live.botStats.cbetHands,
                        cbetOpps: live.botStats.cbetOpps,
                        folds: live.botStats.foldToBetCount,
                        facing: live.botStats.facingBetCount,
                        hands: live.botStats.handsPlayed,
                      })}
                    </p>
                  </div>
                </PanelSection>

                <div className={styles.actionRow}>
                  <Button
                    variant="primary"
                    disabled={live.savedToReviewCount > 0}
                    onClick={() => {
                      void store.saveDuelHandsToReview();
                    }}
                  >
                    {live.savedToReviewCount > 0
                      ? t('training.duel.savedToReview', { count: live.savedToReviewCount })
                      : t('training.duel.saveToReview')}
                  </Button>
                  {onOpenReview ? (
                    <Button variant="secondary" onClick={onOpenReview}>
                      {t('training.duel.openInReview')}
                    </Button>
                  ) : null}
                  <Button
                    variant="secondary"
                    onClick={() => {
                      void store.startHeadsUpDuel(live.sessionSeed + 99, live.botStyle);
                    }}
                  >
                    {t('training.duel.playAgain')}
                  </Button>
                </div>
              </div>
            </Panel>
          ) : live.pokerState.terminal.isTerminal ? (
            <Panel
              title={t('training.duel.heading')}
              tier={
                live.handEquity
                  ? { tier: live.handEquity.method === 'exact' ? 'exact' : 'estimated' }
                  : undefined
              }
            >
              <div className={styles.spotSummary}>
                <p className={styles.summaryText}>
                  {(live.lastHandNetBb ?? 0) > 0
                    ? t('training.duel.handOverWin', { net: live.lastHandNetBb ?? 0 })
                    : (live.lastHandNetBb ?? 0) < 0
                      ? t('training.duel.handOverLoss', { net: live.lastHandNetBb ?? 0 })
                      : t('training.duel.handOverTie')}
                  {showdownResultText ? ` · ${showdownResultText}` : ''}
                </p>
                <TeacherCallout
                  surface="well"
                  mood={(live.lastHandNetBb ?? 0) >= 0 ? 'approving' : 'curious'}
                  text={t('training.duel.postHandNote', {
                    pot: formatNumber(Math.round((live.pokerState.potMilliBb / 1000) * 10) / 10, {
                      maximumFractionDigits: 1,
                    }),
                    street: t(`recorder.street.${live.pokerState.street}`),
                  })}
                />
                <div className={styles.actionRow}>
                  <Button
                    variant="primary"
                    onClick={() => {
                      void store.dealNextDuelHand();
                    }}
                  >
                    {t('training.duel.dealNextHand', {
                      next: live.handNumber + 1,
                      total: live.totalHands,
                    })}
                  </Button>
                  <Button
                    variant="secondary"
                    loading={live.equityLoading}
                    onClick={() => {
                      void store.computeDuelHandEquity();
                    }}
                  >
                    {t('training.duel.showEquityBtn')}
                  </Button>
                </div>

                {live.handEquity ? (
                  <PanelSection
                    label={tNodes('training.duel.equityTitle', {
                      cards: <PokerNotation>{live.heroCards.map(formatCardGlyph).join(' ')}</PokerNotation>,
                      street: t(`recorder.street.${live.pokerState.street}`),
                    })}
                  >
                    <EquityList rowKeys={live.handEquity.players.map((p) => p.id)}>
                      {live.handEquity.players.map((pl) => (
                        <EquityRow
                          key={pl.id}
                          id={pl.id}
                          who={
                            pl.id === 'hero'
                              ? t('training.duel.heroName')
                              : t('training.duel.anyTwoLabel')
                          }
                          isHero={pl.id === 'hero'}
                          cards={
                            pl.id === 'hero'
                              ? [{ card: live.heroCards[0] }, { card: live.heroCards[1] }]
                              : [{ state: 'back' }, { state: 'back' }]
                          }
                          rangeLabel={pl.id === 'hero' ? undefined : 'any'}
                          barTone={pl.id === 'hero' ? 'accent' : 'brass'}
                          equityPct={Math.round(pl.equity * 1000) / 10}
                        />
                      ))}
                    </EquityList>
                    <p className={styles.planBody}>{t('training.duel.equityNote')}</p>
                  </PanelSection>
                ) : null}
              </div>
            </Panel>
          ) : null}
        </div>

        <div className={styles.column}>
          <Panel title={t('training.duel.historyHeading')}>
            <HistoryRail
              groups={historyGroups}
              ariaLabel={t('training.duel.historyHeading')}
            />
          </Panel>
        </div>
      </div>

      <InlineEquityDrawer
        open={equityOverlayOpen}
        onToggle={() => setEquityOverlayOpen((prev) => !prev)}
        onClose={() => setEquityOverlayOpen(false)}
        heroCards={live.heroCards}
        baseBoard={live.pokerState.board}
        revealedVillainCards={live.revealedAstraCards}
        villainLabel={t('training.duel.astraName')}
        defaultSource="any"
        priceFacts={
          live.callEconomics &&
          live.callEconomics.callCommitmentMilliBb > 0 &&
          live.callEconomics.requiredRawEquity !== null
            ? {
                requiredPct: Math.round(live.callEconomics.requiredRawEquity * 1000) / 10,
                callLabel: `${formatNumber(
                  Math.round((live.callEconomics.callCommitmentMilliBb / 1000) * 10) / 10,
                  { maximumFractionDigits: 1 },
                )} ${t('training.duel.unitBb')}`,
                potLabel: `${formatNumber(
                  Math.round((live.callEconomics.actorContestablePotAfterCallMilliBb / 1000) * 10) / 10,
                  { maximumFractionDigits: 1 },
                )} ${t('training.duel.unitBb')}`,
              }
            : null
        }
      />
    </div>
  );
}
