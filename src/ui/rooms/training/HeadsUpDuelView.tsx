import type { TrainingStore } from '../../../domain/training';
import { formatNumber, t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { Chip } from '../../kit/chip/Chip';
import { ChipButton } from '../../kit/choice/Choice';
import { EquityList, EquityRow } from '../../kit/equity-row/EquityRow';
import { FeltTable, type TableCardSpec, type TableSeat } from '../../kit/felt-table/FeltTable';
import { HistoryRail, type HistoryStreetGroup } from '../../kit/history-rail/HistoryRail';
import {
  OptionTickets,
  type LadderSizeOption,
  type OptionTicketItem,
} from '../../kit/option-tickets/OptionTickets';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import styles from './TrainingRoom.module.css';

interface HeadsUpDuelViewProps {
  readonly store: TrainingStore;
  readonly onOpenReview?: () => void;
}

export function HeadsUpDuelView({ store, onOpenReview }: HeadsUpDuelViewProps) {
  const live = store.duelStateSignal.value;
  if (!live) return null;

  const selectedTicket = store.duelSelectedTicketSignal.value;
  const selectedSizeId = store.duelSelectedSizeIdSignal.value;

  const heroPlayer = live.pokerState.players.find((p) => p.playerId === 'hero')!;
  const astraPlayer = live.pokerState.players.find((p) => p.playerId === 'astra')!;

  const heroStackBb = Math.round((heroPlayer.currentStackMilliBb / 1000) * 10) / 10;
  const astraStackBb = Math.round((astraPlayer.currentStackMilliBb / 1000) * 10) / 10;
  const potBb = Math.round((live.pokerState.potMilliBb / 1000) * 10) / 10;

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
      cards: [{ card: live.heroCards[0] }, { card: live.heroCards[1] }],
      actionBubble: live.heroBubble ?? undefined,
    },
    {
      id: 'astra',
      name: t('training.duel.astraName'),
      stack: `${formatNumber(astraStackBb, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} bb`,
      styleLine: live.heroIsButton ? t('training.duel.bbTag') : t('training.duel.btnTag'),
      emblem: 'orbits',
      isDealer: !live.heroIsButton,
      folded: astraPlayer.folded,
      thinking: live.astraThinking,
      cards: live.revealedAstraCards
        ? [{ card: live.revealedAstraCards[0] }, { card: live.revealedAstraCards[1] }]
        : [{ state: 'back' }, { state: 'back' }],
      actionBubble: live.astraThinking ? t('training.duel.thinking') : (live.astraBubble ?? undefined),
    },
  ];

  const boardCards: TableCardSpec[] = live.pokerState.board.map((card) => ({ card }));

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
          ? [{ id: 'fold', shortcut: '1', label: t('training.duel.fold') }]
          : []),
        ...(legal.check.available
          ? [{ id: 'check', shortcut: legal.fold.available ? '2' : '1', label: t('training.duel.check') }]
          : []),
        ...(legal.call.available
          ? [
              {
                id: 'call',
                shortcut: '2',
                label: t('training.duel.call'),
                amount: `${Math.round((legal.call.commitMilliBb / 1000) * 10) / 10} bb`,
              },
            ]
          : []),
        ...(legal.bet.available
          ? [
              {
                id: 'bet',
                shortcut: '3',
                label: t('training.duel.bet'),
                amount: activePreset ? `${activePreset.amountBb} bb` : undefined,
              },
            ]
          : legal.raise.available
            ? [
                {
                  id: 'raise',
                  shortcut: '3',
                  label: t('training.duel.raiseTo'),
                  amount: activePreset ? `${activePreset.amountBb} bb` : undefined,
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
              : t('training.duel.potLabel', { pot: potBb }),
        isHero: item.actor === 'hero',
        action: item.cards ? (
          <PokerNotation>{item.cards.join(' ')}</PokerNotation>
        ) : (
          tNodes(item.textKey as 'training.duel.action_fold', {
            actor:
              item.actor === 'hero' ? t('training.duel.heroName') : t('training.duel.astraName'),
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
          <ChipButton
            selected={live.readTableOpen}
            onToggle={() => store.toggleReadTable()}
          >
            {t('training.duel.readTableBtn')}
          </ChipButton>
          <Button
            variant="secondary"
            onClick={() => {
              void store.startHeadsUpDuel(live.sessionSeed + 101);
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
                      void store.startHeadsUpDuel(live.sessionSeed + 99);
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
                </p>
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
                      cards: <PokerNotation>{live.heroCards.join(' ')}</PokerNotation>,
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
                              : t('training.duel.astraName')
                          }
                          isHero={pl.id === 'hero'}
                          cards={
                            pl.id === 'hero'
                              ? [{ card: live.heroCards[0] }, { card: live.heroCards[1] }]
                              : live.revealedAstraCards
                                ? [
                                    { card: live.revealedAstraCards[0] },
                                    { card: live.revealedAstraCards[1] },
                                  ]
                                : [{ state: 'back' }, { state: 'back' }]
                          }
                          rangeLabel={pl.id === 'astra' && !live.revealedAstraCards ? 'any' : undefined}
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
    </div>
  );
}
