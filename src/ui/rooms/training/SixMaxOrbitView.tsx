import { useEffect, useState } from 'preact/hooks';
import { shortcutsSignal } from '../../../domain/appearance';
import {
  ORBIT_BOTS,
  getOrbitBotStyle,
  getSixMaxPositionLabel,
  type OrbitLineupId,
  type TrainingActionTicketId,
  type TrainingStore,
} from '../../../domain/training';
import { formatNumber, t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { Chip, Kbd } from '../../kit/chip/Chip';
import { ChipButton, SegmentedControl } from '../../kit/choice/Choice';
import { FeltTable, type TableCardSpec, type TableSeat } from '../../kit/felt-table/FeltTable';
import { HistoryRail, type HistoryStreetGroup } from '../../kit/history-rail/HistoryRail';
import {
  OptionTickets,
  type LadderSizeOption,
  type OptionTicketItem,
} from '../../kit/option-tickets/OptionTickets';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import { InlineEquityDrawer } from '../equity/InlineEquityDrawer';
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
  const [setupLineup, setSetupLineup] = useState<OrbitLineupId>('standard_mix');
  const [equityOverlayOpen, setEquityOverlayOpen] = useState(false);
  const [inspectedHandNumber, setInspectedHandNumber] = useState<number | null>(null);

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

  if (!live) {
    return (
      <div className={styles.column}>
        <Panel title={t('training.orbit.heading')}>
          <div className={styles.spotSummary}>
            <p className={styles.promptText}>{t('training.setup.orbitIntro')}</p>
            <PanelSection label={t('training.orbit.lineupAria')}>
              <SegmentedControl<OrbitLineupId>
                ariaLabel={t('training.orbit.lineupAria')}
                value={setupLineup}
                onChange={setSetupLineup}
                options={[
                  { value: 'standard_mix', label: t('training.orbit.lineup.standard_mix') },
                  { value: 'home_game_loose', label: t('training.orbit.lineup.home_game_loose') },
                  { value: 'pressure_regs', label: t('training.orbit.lineup.pressure_regs') },
                ]}
              />
            </PanelSection>
            <div className={styles.actionRow}>
              <Button
                variant="primary"
                onClick={() => {
                  void store.startSixMaxOrbit(undefined, setupLineup);
                }}
              >
                {t('training.setup.orbitStart')}
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

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
    const botStyle = bot ? getOrbitBotStyle(live.lineupId, bot.playerId) : 'balanced';
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
        : `${posLabel} · ${t(`training.duel.style.${botStyle}`)}`,
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

  const rawPotMilliBb = live.pokerState.terminal.isTerminal
    ? live.pokerState.players.reduce((sum, p) => sum + p.totalPotContributionMilliBb, 0)
    : live.pokerState.potMilliBb;
  const potBb = Math.round((rawPotMilliBb / 1000) * 10) / 10;
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
          <SegmentedControl<OrbitLineupId>
            ariaLabel={t('training.orbit.lineupAria')}
            value={live.lineupId}
            onChange={(nextLineup) => {
              if (nextLineup !== live.lineupId) {
                void store.startSixMaxOrbit(live.sessionSeed + 101, nextLineup);
              }
            }}
            options={[
              { value: 'standard_mix', label: t('training.orbit.lineup.standard_mix') },
              { value: 'home_game_loose', label: t('training.orbit.lineup.home_game_loose') },
              { value: 'pressure_regs', label: t('training.orbit.lineup.pressure_regs') },
            ]}
          />
          <ChipButton
            selected={live.readTableOpen}
            onToggle={() => store.toggleOrbitReadTable()}
          >
            {t('training.orbit.readTableBtn')}
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
              void store.startSixMaxOrbit(live.sessionSeed + 101, live.lineupId);
            }}
          >
            {t('training.orbit.newOrbitBtn')}
          </Button>
        </div>
      </div>

      {live.readTableOpen ? (
        <div className={styles.readTableCard}>
          <p className={styles.planTitle}>{t('training.orbit.readTableTitle')}</p>
          <div className={styles.handLogStrip}>
            {Object.values(live.botStatsByPlayer).map((row) => (
              <Chip key={row.playerId}>
                <PokerNotation>
                  {`${row.name}: VPIP ${row.vpipHands}/${row.handsPlayed} · PFR ${row.pfrHands}/${row.handsPlayed} · Agg ${row.aggressiveActions}`}
                </PokerNotation>
              </Chip>
            ))}
          </div>
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
                  onSelectSize={(sizeId) => {
                    store.selectOrbitSize(sizeId);
                    const nextTicket: TrainingActionTicketId = legal?.bet.available
                      ? 'bet'
                      : legal?.raise.available
                        ? 'raise'
                        : 'all_in';
                    store.selectOrbitTicket(nextTicket);
                  }}
                  onAdjustSize={(sizeId, val) => {
                    store.adjustOrbitSize(sizeId, val);
                    const nextTicket: TrainingActionTicketId = legal?.bet.available
                      ? 'bet'
                      : legal?.raise.available
                        ? 'raise'
                        : 'all_in';
                    store.selectOrbitTicket(nextTicket);
                  }}
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
                <PanelSection label={t('training.orbit.positionBreakdownHeading')}>
                  {live.completedHands.length > 0 && (() => {
                    const biggest = live.completedHands.reduce((best, cand) => {
                      const bestAbs = Math.abs(best.netBb);
                      const candAbs = Math.abs(cand.netBb);
                      if (candAbs > bestAbs) return cand;
                      if (candAbs === bestAbs && cand.netBb < best.netBb) return cand;
                      return best;
                    }, live.completedHands[0]!);
                    const activeInspected =
                      live.completedHands.find((h) => h.handNumber === inspectedHandNumber) ??
                      biggest;
                    return (
                      <>
                        <div className={styles.actionRow}>
                          <Button
                            variant="secondary"
                            onClick={() => setInspectedHandNumber(biggest.handNumber)}
                          >
                            {t('training.orbit.biggestSwingBtn', {
                              hand: biggest.handNumber,
                              net: biggest.netBb > 0 ? `+${biggest.netBb}` : String(biggest.netBb),
                            })}
                          </Button>
                        </div>
                        <div className={styles.handLogStrip}>
                          {live.completedHands.map((hand) => (
                            <button
                              key={hand.handId}
                              type="button"
                              className={
                                activeInspected.handNumber === hand.handNumber
                                  ? `${styles.handLogBtn} ${styles.handLogBtnActive}`
                                  : styles.handLogBtn
                              }
                              onClick={() => setInspectedHandNumber(hand.handNumber)}
                            >
                              <PokerNotation>#{hand.handNumber}</PokerNotation>
                              <PokerNotation>{hand.heroPositionLabel}</PokerNotation>
                              <PokerNotation>{hand.heroCards.map(formatCardGlyph).join('')}</PokerNotation>
                              <PokerNotation>
                                {hand.netBb > 0 ? `+${hand.netBb}` : hand.netBb} bb
                              </PokerNotation>
                            </button>
                          ))}
                        </div>
                        <div className={styles.inspectedHandCard}>
                          <p className={styles.planBody}>
                            <PokerNotation>
                              {`#${activeInspected.handNumber} ${activeInspected.heroPositionLabel} (${activeInspected.heroCards.map(formatCardGlyph).join(' ')}) · ${activeInspected.endedAtStreet} · ${activeInspected.savedPayload.shorthandLine}`}
                            </PokerNotation>
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </PanelSection>
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
                      void store.startSixMaxOrbit(live.sessionSeed + 101, live.lineupId);
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

      <InlineEquityDrawer
        open={equityOverlayOpen}
        onToggle={() => setEquityOverlayOpen((prev) => !prev)}
        onClose={() => setEquityOverlayOpen(false)}
        heroCards={live.heroCards}
        baseBoard={live.pokerState.board}
        revealedVillainCards={null}
        villainLabel={t('training.orbit.heading')}
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
