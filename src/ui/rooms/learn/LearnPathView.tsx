import { LEARN_CONCEPT_IDS, type LearnConceptId, type LearnTrainerMode } from '../../../engine-api';
import type { LearnConceptStatus, LearnStore } from '../../../domain/learn';
import { formatNumber, t, tNodes } from '../../../i18n';
import type { MessageKey } from '../../../i18n/types';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { ChipButton, SegmentedControl } from '../../kit/choice/Choice';
import { OptionTickets, type OptionTicketItem } from '../../kit/option-tickets/OptionTickets';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import { PlayingCard } from '../../kit/playing-card/PlayingCard';
import { cx } from '../../kit/state';
import { LearnGlossaryView } from './LearnGlossaryView';
import styles from './LearnRoom.module.css';

interface LearnPathViewProps {
  readonly store: LearnStore;
  readonly onDrillInTraining: () => void;
}

const SUIT_GLYPHS: Readonly<Record<string, string>> = {
  s: '\u2660\uFE0E',
  h: '\u2665\uFE0E',
  d: '\u2666\uFE0E',
  c: '\u2663\uFE0E',
};

const CONCEPT_KEYS: Record<
  LearnConceptId,
  { readonly name: MessageKey; readonly one: MessageKey; readonly term: MessageKey }
> = {
  pot_odds: {
    name: 'learn.concept.pot_odds.name',
    one: 'learn.concept.pot_odds.one',
    term: 'learn.concept.pot_odds.term',
  },
  equity: {
    name: 'learn.concept.equity.name',
    one: 'learn.concept.equity.one',
    term: 'learn.concept.equity.term',
  },
  ranges: {
    name: 'learn.concept.ranges.name',
    one: 'learn.concept.ranges.one',
    term: 'learn.concept.ranges.term',
  },
  blockers: {
    name: 'learn.concept.blockers.name',
    one: 'learn.concept.blockers.one',
    term: 'learn.concept.blockers.term',
  },
  position: {
    name: 'learn.concept.position.name',
    one: 'learn.concept.position.one',
    term: 'learn.concept.position.term',
  },
  spr: {
    name: 'learn.concept.spr.name',
    one: 'learn.concept.spr.one',
    term: 'learn.concept.spr.term',
  },
  bluffing: {
    name: 'learn.concept.bluffing.name',
    one: 'learn.concept.bluffing.one',
    term: 'learn.concept.bluffing.term',
  },
  value: {
    name: 'learn.concept.value.name',
    one: 'learn.concept.value.one',
    term: 'learn.concept.value.term',
  },
  multiway: {
    name: 'learn.concept.multiway.name',
    one: 'learn.concept.multiway.one',
    term: 'learn.concept.multiway.term',
  },
};

const STATUS_KEYS: Record<LearnConceptStatus, MessageKey> = {
  understood: 'learn.state.understood',
  in_progress: 'learn.state.in_progress',
  ready: 'learn.state.ready',
  later: 'learn.state.later',
};

function formatCardsInline(cards: readonly string[] | undefined): string {
  if (!cards || cards.length === 0) return '';
  return cards
    .map((code) => {
      const rank = code.slice(0, -1).toUpperCase();
      const suit = SUIT_GLYPHS[code.slice(-1).toLowerCase()] ?? code.slice(-1);
      return `${rank}${suit}`;
    })
    .join(' ');
}

function renderExampleLine(conceptId: LearnConceptId, store: LearnStore) {
  const ex = store.conceptExampleSignal.value;
  if (!ex || ex.conceptId !== conceptId) return null;
  const n = ex.numbers;

  switch (conceptId) {
    case 'pot_odds':
      return tNodes('learn.concept.pot_odds.ex', {
        bet: <PokerNotation>{formatNumber(n.betBb ?? 0)}</PokerNotation>,
        potBeforeBet: <PokerNotation>{formatNumber(n.potBeforeBetBb ?? 0)}</PokerNotation>,
        potBeforeCall: <PokerNotation>{formatNumber(n.potBeforeCallBb ?? 0)}</PokerNotation>,
        potAfterCall: <PokerNotation>{formatNumber(n.potAfterCallBb ?? 0)}</PokerNotation>,
        pct: <PokerNotation>{formatNumber(n.requiredPercent ?? 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</PokerNotation>,
      });
    case 'equity':
      return tNodes('learn.concept.equity.ex', {
        hero: <PokerNotation>{formatCardsInline(ex.cards)}</PokerNotation>,
        villain: <PokerNotation>{formatCardsInline(ex.opponentCards)}</PokerNotation>,
        board: <PokerNotation>{formatCardsInline(ex.board)}</PokerNotation>,
        wins: <PokerNotation>{formatNumber(n.wins ?? 0)}</PokerNotation>,
        trials: <PokerNotation>{formatNumber(n.trials ?? 0)}</PokerNotation>,
        pct: <PokerNotation>{formatNumber(n.equityPercent ?? 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</PokerNotation>,
      });
    case 'ranges':
      return tNodes('learn.concept.ranges.ex', {
        pct: <PokerNotation>{formatNumber(n.openPercent ?? 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</PokerNotation>,
        combos: <PokerNotation>{formatNumber(n.openCombos ?? 0)}</PokerNotation>,
        total: <PokerNotation>{formatNumber(n.totalCombos ?? 1326)}</PokerNotation>,
      });
    case 'blockers':
      return tNodes('learn.concept.blockers.ex', {
        cards: <PokerNotation>{formatCardsInline(ex.cards)}</PokerNotation>,
        full: <PokerNotation>{formatNumber(n.fullCombos ?? 6)}</PokerNotation>,
        rem: <PokerNotation>{formatNumber(n.remainingCombos ?? 3)}</PokerNotation>,
      });
    case 'position':
      return tNodes('learn.concept.position.ex', {
        seats: <PokerNotation>{formatNumber(n.tableSize ?? 6)}</PokerNotation>,
        utg: <PokerNotation>{formatNumber(n.utgBehind ?? 5)}</PokerNotation>,
        sb: <PokerNotation>{formatNumber(n.sbBehind ?? 1)}</PokerNotation>,
      });
    case 'spr':
      return tNodes('learn.concept.spr.ex', {
        pot: <PokerNotation>{formatNumber(n.flopPotBb ?? 5)}</PokerNotation>,
        behind: <PokerNotation>{formatNumber(n.effectiveBehindBb ?? 97.5, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</PokerNotation>,
        spr: <PokerNotation>{formatNumber(n.spr ?? 19.5, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</PokerNotation>,
      });
    case 'bluffing':
      return tNodes('learn.concept.bluffing.ex', {
        bet: <PokerNotation>{formatNumber(n.betBb ?? 5)}</PokerNotation>,
        pot: <PokerNotation>{formatNumber(n.potBeforeBetBb ?? 10)}</PokerNotation>,
        foldPct: <PokerNotation>{formatNumber(n.requiredFoldPercent ?? 33.3, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</PokerNotation>,
      });
    case 'value':
      return tNodes('learn.concept.value.ex', {
        bet: <PokerNotation>{formatNumber(n.betBb ?? 8)}</PokerNotation>,
        pot: <PokerNotation>{formatNumber(n.potBeforeBetBb ?? 12)}</PokerNotation>,
        needPct: <PokerNotation>{formatNumber(n.callerNeedPercent ?? 28.6, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</PokerNotation>,
        mdfPct: <PokerNotation>{formatNumber(n.mdfPercent ?? 71.4, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</PokerNotation>,
      });
    case 'multiway':
      return tNodes('learn.concept.multiway.ex', {
        board: <PokerNotation>{formatCardsInline(ex.board)}</PokerNotation>,
        hero: <PokerNotation>{formatCardsInline(ex.cards)}</PokerNotation>,
        v1: <PokerNotation>{formatCardsInline(ex.opponentCards)}</PokerNotation>,
        v2: <PokerNotation>{formatCardsInline(ex.thirdPlayerCards)}</PokerNotation>,
        huPct: <PokerNotation>{formatNumber(n.headsUpEquityPercent ?? 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</PokerNotation>,
        mwPct: <PokerNotation>{formatNumber(n.threeWayEquityPercent ?? 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</PokerNotation>,
        trials: <PokerNotation>{formatNumber(n.threeWayTrials ?? 903)}</PokerNotation>,
      });
  }
}

export function LearnPathView({ store, onDrillInTraining }: LearnPathViewProps) {
  const selectedId = store.selectedConceptIdSignal.value;
  const understoodMap = store.understoodMapSignal.value;
  const ex = store.conceptExampleSignal.value;

  const doneCount = LEARN_CONCEPT_IDS.filter((id) => understoodMap[id]).length;
  const nextConceptId = store.getSuggestedNextConcept();

  const showTrainer = selectedId === 'pot_odds' || selectedId === 'equity';
  const trainerMode = store.trainerModeSignal.value;
  const trainerRound = store.trainerRoundSignal.value;
  const trainerChosen = store.trainerChosenOptionSignal.value;
  const trainerGrade = store.trainerGradeSignal.value;
  const roundResults = store.trainerRoundResultsSignal.value;
  const recordSummary = store.trainerRecordSummarySignal.value;

  const tickets: OptionTicketItem[] = trainerRound.options.map((opt, idx) => {
    const label =
      trainerRound.mode === 'pot_odds'
        ? `${formatNumber(opt.value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
        : t('learn.trainer.outsUnit', { count: opt.value });

    let outcome: 'correct' | 'wrong' | undefined;
    if (trainerGrade !== null) {
      if (opt.isCorrect) {
        outcome = 'correct';
      } else if (trainerChosen === idx) {
        outcome = 'wrong';
      }
    }

    return {
      id: `opt-${idx}`,
      shortcut: String(idx + 1),
      label,
      outcome,
      disabled: trainerGrade !== null,
    };
  });

  const conceptTierDetail =
    ex?.qualifier === 'price_only'
      ? t('tier.detail.priceOnly')
      : ex?.qualifier === 'known_cards'
        ? t('tier.detail.knownCards')
        : undefined;

  const isUnderstood = Boolean(understoodMap[selectedId]);

  const trainerFeedback = (() => {
    if (!trainerGrade) return t('learn.trainer.pickPrompt');
    const prefix = trainerGrade.isCorrect
      ? t('learn.trainer.correctPrefix')
      : t('learn.trainer.wrongPrefix');

    if (trainerGrade.mode === 'pot_odds') {
      const formula = t('learn.trainer.potOddsFormula', {
        bet: formatNumber(trainerGrade.betBb ?? 0),
        potAfterBet: formatNumber(trainerGrade.potAfterBetBb ?? 0),
        pct: formatNumber(trainerGrade.correctValue, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }),
      });
      return `${prefix} ${formula}`;
    }

    const overlapCount = trainerGrade.overlapCount ?? 0;
    const formula =
      overlapCount > 0
        ? t('learn.trainer.outsFormulaOverlap', {
            flush: formatNumber(trainerGrade.flushCount ?? 0),
            straight: formatNumber(trainerGrade.straightCount ?? 0),
            overlap: formatNumber(overlapCount),
            count: formatNumber(trainerGrade.uniqueOutsCount ?? 0),
          })
        : t('learn.trainer.outsFormulaSimple', {
            count: formatNumber(trainerGrade.uniqueOutsCount ?? 0),
          });
    return `${prefix} ${formula}`;
  })();

  const isLastSpot = trainerRound.spotIndex >= trainerRound.totalSpots - 1;

  return (
    <div className={styles.pathLayout}>
      <div className={styles.pathColumn}>
        <Panel label={t('learn.path.heading')} headingLevel="h2">
          <div className={styles.pathMetaRow}>
            <span>
              {t('learn.path.progress', {
                done: formatNumber(doneCount),
                total: formatNumber(LEARN_CONCEPT_IDS.length),
              })}
            </span>
          </div>

          <div className={styles.pathList}>
            {LEARN_CONCEPT_IDS.map((id, index) => {
              const status = store.getConceptStatus(id, index);
              const isSelected = selectedId === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={cx(styles.pathNode, isSelected && styles.pathNodeActive)}
                  aria-current={isSelected ? 'step' : undefined}
                  onClick={() => store.selectConcept(id)}
                >
                  <span
                    className={cx(
                      styles.statusDot,
                      status === 'understood' && styles.statusDotDone,
                      status === 'in_progress' && styles.statusDotNow,
                      status === 'ready' && styles.statusDotReady,
                      status === 'later' && styles.statusDotLater,
                    )}
                    aria-hidden="true"
                  />
                  <span className={styles.nodeText}>
                    <span className={styles.nodeName}>{t(CONCEPT_KEYS[id].name)}</span>
                    <span className={styles.nodeState}>{t(STATUS_KEYS[status])}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className={styles.pathFooter}>
            <Button
              variant="primary"
              onClick={() => store.selectConcept(nextConceptId)}
            >
              {t('learn.path.continueWith', {
                concept: t(CONCEPT_KEYS[nextConceptId].name),
              })}
            </Button>
            <p className={styles.pathOrderNote}>{t('learn.path.orderNote')}</p>
          </div>
        </Panel>
      </div>

      <div className={styles.detailColumn}>
        <Panel
          label={t('learn.concept.eyebrow')}
          title={t(CONCEPT_KEYS[selectedId].name)}
          headingLevel="h2"
          tier={{ tier: 'exact', detail: conceptTierDetail }}
        >
          <div key={selectedId} className={styles.conceptBody}>
            <div className={styles.conceptTopActions}>
              <ChipButton
                selected={isUnderstood}
                onToggle={() => {
                  void store.toggleConceptUnderstood(selectedId);
                }}
              >
                {isUnderstood
                  ? t('learn.concept.understoodBtn')
                  : t('learn.concept.markUnderstood')}
              </ChipButton>
            </div>

            <p className={styles.conceptLead}>{t(CONCEPT_KEYS[selectedId].one)}</p>

            <div className={styles.exampleBox}>
              <div className={styles.exampleHeader}>
                <span className={styles.microLabel}>{t('learn.concept.workedExample')}</span>
              </div>
              {(ex?.cards || ex?.board) && (
                <div className={styles.cardsStrip} dir="ltr">
                  {ex.cards && (
                    <div className={styles.cardGroup}>
                      {ex.cards.map((code) => (
                        <PlayingCard key={`hero-${code}`} card={code} size="small" />
                      ))}
                    </div>
                  )}
                  {ex.board && (
                    <div className={styles.cardGroup}>
                      {ex.board.map((code) => (
                        <PlayingCard key={`board-${code}`} card={code} size="small" />
                      ))}
                    </div>
                  )}
                </div>
              )}
              <p className={styles.exampleText}>{renderExampleLine(selectedId, store)}</p>
            </div>

            {showTrainer ? (
              <PanelSection label={t('learn.trainer.heading')}>
                <div className={styles.trainerStack}>
                  <div className={styles.trainerToolbar}>
                    <SegmentedControl<LearnTrainerMode>
                      options={[
                        { value: 'pot_odds', label: t('learn.trainer.modePotOdds') },
                        { value: 'outs', label: t('learn.trainer.modeOuts') },
                      ]}
                      value={trainerMode}
                      onChange={(nextMode) => store.setTrainerMode(nextMode)}
                      ariaLabel={t('learn.trainer.ariaMode')}
                    />
                    <div className={styles.progressDots} aria-hidden="true">
                      {roundResults.map((res, idx) => (
                        <span
                          key={idx}
                          className={cx(
                            styles.progressDot,
                            res === true && styles.progressDotHit,
                            res === false && styles.progressDotMiss,
                            res === null && idx === trainerRound.spotIndex && styles.progressDotCurrent,
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  {trainerRound.mode === 'outs' && trainerRound.heroCards && trainerRound.board && (
                    <div className={styles.cardsStrip} dir="ltr">
                      <div className={styles.cardGroup}>
                        {trainerRound.heroCards.map((code) => (
                          <PlayingCard key={`th-${code}`} card={code} size="small" />
                        ))}
                      </div>
                      <div className={styles.cardGroup}>
                        {trainerRound.board.map((code) => (
                          <PlayingCard key={`tb-${code}`} card={code} size="small" />
                        ))}
                      </div>
                    </div>
                  )}

                  <p className={styles.trainerPrompt}>
                    {trainerRound.mode === 'pot_odds'
                      ? tNodes('learn.trainer.potOddsPrompt', {
                          pot: <PokerNotation>{formatNumber(trainerRound.potBeforeBetBb ?? 0)}</PokerNotation>,
                          bet: <PokerNotation>{formatNumber(trainerRound.betBb ?? 0)}</PokerNotation>,
                        })
                      : tNodes('learn.trainer.outsPrompt', {
                          board: <PokerNotation>{formatCardsInline(trainerRound.board)}</PokerNotation>,
                          hero: <PokerNotation>{formatCardsInline(trainerRound.heroCards)}</PokerNotation>,
                        })}
                  </p>

                  <OptionTickets
                    tickets={tickets}
                    selectedTicketId={
                      trainerChosen !== null ? `opt-${trainerChosen}` : undefined
                    }
                    onSelectTicket={(ticketId) => {
                      const idx = Number(ticketId.replace('opt-', ''));
                      if (Number.isInteger(idx)) {
                        void store.pickTrainerOption(idx);
                      }
                    }}
                    showConfirm={false}
                    ariaLabel={t('learn.trainer.heading')}
                  />

                  <div className={styles.trainerFeedbackRow} aria-live="polite">
                    <p className={styles.trainerFeedbackText}>{trainerFeedback}</p>
                    {trainerGrade !== null && (
                      <Button variant="secondary" onClick={() => store.nextTrainerSpot()}>
                        {isLastSpot
                          ? t('learn.trainer.startOver')
                          : t('learn.trainer.nextSpot')}
                      </Button>
                    )}
                  </div>

                  <p className={styles.trainerRecordLine}>
                    {trainerMode === 'pot_odds'
                      ? t('learn.trainer.recordPotOdds', {
                          correct: formatNumber(recordSummary.potOddsCorrect),
                          total: formatNumber(recordSummary.potOddsTotal),
                        })
                      : t('learn.trainer.recordOuts', {
                          correct: formatNumber(recordSummary.outsCorrect),
                          total: formatNumber(recordSummary.outsTotal),
                        })}
                  </p>
                </div>
              </PanelSection>
            ) : (
              <div className={styles.conceptFooter}>
                <div className={styles.cardGroup}>
                  <Button variant="secondary" onClick={onDrillInTraining}>
                    {t('learn.concept.drillBtn')}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => store.selectConcept('pot_odds')}
                  >
                    {t('learn.concept.openTrainerBtn')}
                  </Button>
                </div>
                <span className={styles.termTriplet}>
                  {t('learn.concept.keyTerm', {
                    term: t(CONCEPT_KEYS[selectedId].term),
                  })}
                </span>
              </div>
            )}
          </div>
        </Panel>

        <LearnGlossaryView store={store} compact />
      </div>
    </div>
  );
}
