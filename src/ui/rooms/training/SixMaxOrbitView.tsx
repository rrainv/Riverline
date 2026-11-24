import { useEffect } from 'preact/hooks';
import { shortcutsSignal } from '../../../domain/appearance';
import {
  ORBIT_BOTS,
  getSixMaxPositionLabel,
  type TrainingActionTicketId,
  type TrainingStore,
} from '../../../domain/training';
import { formatNumber, t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { Chip } from '../../kit/chip/Chip';
import { FeltTable, type TableCardSpec, type TableSeat } from '../../kit/felt-table/FeltTable';
import { HistoryRail, type HistoryStreetGroup } from '../../kit/history-rail/HistoryRail';
import {
  OptionTickets,
  type LadderSizeOption,
  type OptionTicketItem,
} from '../../kit/option-tickets/OptionTickets';
import { Panel } from '../../kit/panel/Panel';
import { formatCardGlyph } from '../equity/equityFormatters';
import { formatDuelBubble } from './HeadsUpDuelView';
import styles from './TrainingRoom.module.css';

export interface SixMaxOrbitViewProps {
  readonly store: TrainingStore;
  readonly onOpenReview?: () => void;
}

function formatWinnerNames(winnerIds: readonly string[]): string {
  return winnerIds
    .map((id) => {
      if (id === 'hero') return t('training.duel.heroName');
      return ORBIT_BOTS.find((b) => b.playerId === id)?.name ?? id;
    })
    .join(', ');
}

export function SixMaxOrbitView({ store, onOpenReview }: SixMaxOrbitViewProps) {
  const live = store.orbitStateSignal.value;

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
      void store.dealNextOrbitHand();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canDealNext, store]);

  if (!live) return null;

  const shortcuts = shortcutsSignal.value;
  const selectedTicket = store.orbitSelectedTicketSignal.value;
  const selectedSizeId = store.orbitSelectedSizeIdSignal.value;

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

  const seats: TableSeat[] = live.pokerState.players.map((player) => {
    const isHero = player.playerId === 'hero';
    const bot = ORBIT_BOTS.find((b) => b.playerId === player.playerId);
    const posLabel = getSixMaxPositionLabel(player.seat, live.buttonSeat);
    const stackBb = Math.round((player.currentStackMilliBb / 1000) * 10) / 10;
    const isWinner =
      isShowdown && live.pokerState.terminal.winnerPlayerIds.includes(player.playerId);
    const revealed = live.revealedCardsByPlayer[player.playerId];
    const isThinking = live.thinkingPlayerId === player.playerId;

    let cards: TableCardSpec[] | undefined;
    if (!player.folded) {
      if (isHero) {
        cards = [
          {
            card: live.heroCards[0],
            winning: isWinner && winningCardSet.has(live.heroCards[0]),
          },
          {
            card: live.heroCards[1],
            winning: isWinner && winningCardSet.has(live.heroCards[1]),
          },
        ];
      } else if (revealed) {
        cards = [
          {
            card: revealed[0],
            winning: isWinner && winningCardSet.has(revealed[0]),
          },
          {
            card: revealed[1],
            winning: isWinner && winningCardSet.has(revealed[1]),
          },
        ];
      } else {
        cards = [{ state: 'back' }, { state: 'back' }];
      }
    }

    return {
      id: player.playerId,
      name: isHero ? t('training.duel.heroName') : (bot?.name ?? player.playerId),
      stack: `${formatNumber(stackBb, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} bb`,
      styleLine: isHero
        ? posLabel
        : `${posLabel} · ${t(`training.duel.style.${bot?.style ?? 'balanced'}`)}`,
      emblem: isHero ? 'hero' : 'orbits',
      isHero,
      isDealer: player.seat === live.buttonSeat,
      folded: player.folded,
      thinking: isThinking,
      cards,
      actionBubble: isThinking
        ? t('training.duel.thinking')
        : formatDuelBubble(live.bubblesByPlayer[player.playerId] ?? null),
    };
  });

  const boardCards: TableCardSpec[] = live.pokerState.board.map((card) => ({
    card,
    winning: isShowdown && winningCardSet.has(card),
  }));

  const potBb = Math.round((live.pokerState.potMilliBb / 1000) * 10) / 10;
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
    live.sizePresets.find((s) => s.id === selectedSizeId) ??
    live.sizePresets[1] ??
    live.sizePresets[0] ??
    null;

  const legal = live.legalSpec;
  const isHeroTurn =
    !live.finishedOrbit &&
    !live.pokerState.terminal.isTerminal &&
    !live.thinkingPlayerId &&
    live.pokerState.actingPlayerId === 'hero' &&
    legal !== null;

  const tickets: OptionTicketItem[] =
    isHeroTurn && legal
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
          item.actor === 'board'
            ? t('training.duel.potLabel', { pot: potBb })
            : item.actorName,
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
      : String(live.heroCumulativeNetBb);

  const lastNet = live.lastHandNetBb ?? 0;
  const handOverKey =
    lastNet > 0
      ? 'training.duel.handOverWin'
      : lastNet < 0
        ? 'training.duel.handOverLoss'
        : 'training.duel.handOverTie';

  const showdownResultText = isShowdown
    ? formatWinnerNames(live.pokerState.terminal.winnerPlayerIds)
    : undefined;

  return (
    <div className={styles.room}>
      <div className={styles.duelTopRow}>
        <div className={styles.duelBadges}>
          <Chip>
            {tNodes('training.orbit.handBadge', {
              hand: <PokerNotation>{live.handNumber}</PokerNotation>,
              total: <PokerNotation>{live.totalHands}</PokerNotation>,
            })}
          </Chip>
          <Chip>
            {tNodes('training.orbit.positionBadge', {
              pos: <PokerNotation>{live.heroPositionLabel}</PokerNotation>,
            })}
          </Chip>
          <Chip>
            {tNodes('training.duel.netBadge', {
              net: <PokerNotation>{signedNet}</PokerNotation>,
            })}
          </Chip>
        </div>

        <div className={styles.actionRow}>
          <Button
            variant="secondary"
            onClick={() => {
              void store.startSixMaxOrbit(live.sessionSeed + 101);
            }}
          >
            {t('training.orbit.newOrbitBtn')}
          </Button>
        </div>
      </div>

      <div className={styles.mainGrid}>
        <div className={styles.column}>
          <FeltTable
            pot={potBb}
            activeSeatId={live.pokerState.actingPlayerId ?? undefined}
            board={boardCards}
            seats={seats}
            showdownResult={showdownResultText}
          />

          {isHeroTurn ? (
            <Panel title={t('training.orbit.heading')}>
              <div className={styles.spotSummary}>
                <OptionTickets
                  tickets={tickets}
                  selectedTicketId={selectedTicket ?? undefined}
                  onSelectTicket={(id) =>
                    store.selectOrbitTicket(id as TrainingActionTicketId)
                  }
                  ladderLabel={sizes.length > 0 ? t('training.duel.ladderLabel') : undefined}
                  sizes={sizes}
                  selectedSizeId={selectedSizeId ?? undefined}
                  onSelectSize={(sizeId) => store.selectOrbitSize(sizeId)}
                  onAdjustSize={(sizeId, val) => store.adjustOrbitSize(sizeId, val)}
                  onResetSizes={() => store.resetOrbitSizes()}
                  confirmLabel={t('training.duel.confirmAction')}
                  onConfirm={() => {
                    void store.confirmOrbitAction();
                  }}
                  confirmDisabled={!selectedTicket}
                />
              </div>
            </Panel>
          ) : live.finishedOrbit ? (
            <Panel title={t('training.orbit.summaryTitle')}>
              <div className={styles.spotSummary}>
                <p className={styles.summaryText}>
                  {tNodes('training.orbit.summaryBody', {
                    hands: <PokerNotation>{live.completedHands.length}</PokerNotation>,
                    net: <PokerNotation>{signedNet}</PokerNotation>,
                  })}
                </p>
                <div className={styles.handLogStrip}>
                  {live.completedHands.map((hand) => (
                    <div key={hand.handId} className={styles.handLogBtn}>
                      <PokerNotation>#{hand.handNumber}</PokerNotation>
                      <PokerNotation>{hand.heroPositionLabel}</PokerNotation>
                      <PokerNotation>{hand.heroCards.map(formatCardGlyph).join('')}</PokerNotation>
                      <PokerNotation>
                        {hand.netBb > 0 ? `+${hand.netBb}` : hand.netBb} bb
                      </PokerNotation>
                    </div>
                  ))}
                </div>
                <div className={styles.actionRow}>
                  <Button
                    variant="primary"
                    onClick={() => {
                      void store.saveOrbitHandsToReview();
                    }}
                  >
                    {live.savedToReviewCount !== null
                      ? t('training.duel.savedToReview', { count: live.savedToReviewCount })
                      : t('training.duel.saveToReview')}
                  </Button>
                  {live.savedToReviewCount !== null && onOpenReview ? (
                    <Button variant="secondary" onClick={onOpenReview}>
                      {t('training.duel.openInReview')}
                    </Button>
                  ) : null}
                  <Button
                    variant="secondary"
                    onClick={() => {
                      void store.startSixMaxOrbit(live.sessionSeed + 101);
                    }}
                  >
                    {t('training.orbit.newOrbitBtn')}
                  </Button>
                </div>
              </div>
            </Panel>
          ) : live.pokerState.terminal.isTerminal ? (
            <Panel title={t('training.orbit.heading')}>
              <div className={styles.spotSummary}>
                <p className={styles.summaryText}>
                  {tNodes(handOverKey, {
                    net: <PokerNotation>{Math.abs(lastNet)}</PokerNotation>,
                  })}
                </p>
                <div className={styles.actionRow}>
                  <Button
                    variant="primary"
                    onClick={() => {
                      void store.dealNextOrbitHand();
                    }}
                  >
                    {t('training.duel.dealNextHand')}
                  </Button>
                </div>
              </div>
            </Panel>
          ) : (
            <Panel title={t('training.orbit.heading')}>
              <p className={styles.planBody}>{t('training.duel.thinking')}</p>
            </Panel>
          )}
        </div>

        <div className={styles.column}>
          <Panel title={t('training.duel.historyHeading')}>
            <HistoryRail groups={historyGroups} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
