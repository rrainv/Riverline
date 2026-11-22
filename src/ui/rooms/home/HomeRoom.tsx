import { useState } from 'preact/hooks';
import { appearanceSignal } from '../../../domain/appearance';
import type {
  HomeNextStepAction,
  HomeNextStepItem,
  HomeOfferItem,
  HomeStore,
} from '../../../domain/home';
import type { StrategyFamilyId, StrategySpotRowId } from '../../../engine-api';
import { formatNumber, t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { Chip } from '../../kit/chip/Chip';
import {
  HeatGrid,
  type HeatGridCell,
  type HeatGridRow,
  type HeatTone,
} from '../../kit/heat-grid/HeatGrid';
import { Lamp, type LampMood } from '../../kit/lamp/Lamp';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import styles from './HomeRoom.module.css';

export interface HomeRoomProps {
  readonly store: HomeStore;
  readonly onOpenTraining: (
    mode: 'hub' | 'quick_drill' | 'duel' | 'leak_lab',
    leak?: { readonly position: string; readonly familyId: StrategyFamilyId },
  ) => void;
  readonly onOpenStrategy: (
    view: 'spotMap' | 'builder' | 'leakMap',
    spot?: { readonly rowId: StrategySpotRowId; readonly position: string; readonly leakCellKey?: string },
  ) => void;
  readonly onOpenReview: (handObjectId?: string) => void;
  readonly onOpenHandRecorder: () => void;
  readonly onOpenEquity: (matchupId?: string) => void;
  readonly onOpenNights: (sessionId?: string, tab?: 'ledger' | 'settle') => void;
}

function toneForCompactDelta(delta: number | null, sampleHands: number): HeatTone {
  if (sampleHands === 0 || delta === null) return 'neutral';
  if (delta >= 20) return 'overHigh';
  if (delta > 0) return 'overLow';
  if (delta <= -20) return 'underHigh';
  if (delta < 0) return 'underLow';
  return 'okLow';
}

function formatSignedDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

export function HomeRoom({
  store,
  onOpenTraining,
  onOpenStrategy,
  onOpenReview,
  onOpenHandRecorder,
  onOpenEquity,
  onOpenNights,
}: HomeRoomProps) {
  const [lampWoken, setLampWoken] = useState(false);

  const prefs = appearanceSignal.value;
  const loading = store.loadingSignal.value;
  const greetingBucket = store.greetingBucketSignal.value;
  const visitState = store.visitStateSignal.value;
  const weekly = store.weeklySummarySignal.value;
  const leakMap = store.leakMapSignal.value;
  const topLeak = store.topLeakSignal.value;
  const nextSteps = store.nextStepsSignal.value;
  const nightCard = store.nightCardSignal.value;
  const offers = store.offersSignal.value;
  const habitSummary = store.habitSummarySignal.value;
  const errors = store.sectionErrorsSignal.value;

  const hasAnyError =
    errors.hands || errors.matchups || errors.evidence || errors.training || errors.nights;

  const sampleByPos = new Map<string, number>();
  for (const foot of leakMap.columnFooters) {
    sampleByPos.set(foot.position, foot.sampleHands);
  }

  const snapshotIds = new Set<StrategyFamilyId>([
    'pairs',
    'suited_aces',
    'suited_connectors',
    'offsuit_broadways',
  ]);
  if (topLeak && !snapshotIds.has(topLeak.familyId)) {
    snapshotIds.delete('offsuit_broadways');
    snapshotIds.add(topLeak.familyId);
  }

  const leakRows: HeatGridRow[] = leakMap.rows
    .filter((row) => snapshotIds.has(row.familyId))
    .map((row) => ({
      id: row.familyId,
      label: t(`strategy.family.${row.familyId}`),
      cells: row.cells.map((cell): HeatGridCell => {
        const sampleHands = sampleByPos.get(cell.position) ?? 0;
        const hasData = sampleHands > 0 && cell.available && cell.deltaPoints !== null;
        const label = hasData ? formatSignedDelta(cell.deltaPoints!) : '—';
        return {
          id: `${cell.familyId}|${cell.position}`,
          label,
          ariaLabel: `${t(`strategy.family.${cell.familyId}`)} ${cell.position}: ${label}`,
          tone: toneForCompactDelta(cell.deltaPoints, sampleHands),
        };
      }),
    }));

  const lampMood: LampMood = loading
    ? 'thinking'
    : visitState === 'first_visit'
      ? lampWoken
        ? 'speaking'
        : 'curious'
      : topLeak === null && weekly.hasAnyActivity
        ? 'approving'
        : 'idle';

  const runAction = (action: HomeNextStepAction) => {
    switch (action.kind) {
      case 'continue_night':
        onOpenNights(action.sessionId, action.tab);
        break;
      case 'finish_spot':
      case 'review_hand':
        onOpenReview(action.handObjectId);
        break;
      case 'finish_plan':
        onOpenStrategy('builder', { rowId: action.rowId, position: action.position });
        break;
      case 'drill_leak':
        onOpenTraining('leak_lab', { position: action.position, familyId: action.familyId });
        break;
      case 'quick_drill':
        onOpenTraining('quick_drill');
        break;
      case 'record_hand':
        onOpenHandRecorder();
        break;
      case 'open_equity':
        onOpenEquity(action.matchupId);
        break;
    }
  };

  const renderStepContent = (step: HomeNextStepItem) => {
    switch (step.kind) {
      case 'continue_night':
        return {
          title: t('home.steps.continueNight.title', { title: step.titleText ?? '' }),
          reason: t('home.steps.continueNight.reason', { count: step.playerCount ?? 0 }),
          cta: t('home.steps.continueNight.cta'),
        };
      case 'finish_spot':
        return {
          title: tNodes('home.steps.finishSpot.title', {
            hand: <PokerNotation>{step.titleText ?? ''}</PokerNotation>,
          }),
          reason: t('home.steps.finishSpot.reason'),
          cta: t('home.steps.finishSpot.cta'),
        };
      case 'finish_plan':
        return {
          title: tNodes('home.steps.finishPlan.title', {
            position: <PokerNotation>{step.position ?? ''}</PokerNotation>,
          }),
          reason: t('home.steps.finishPlan.reason'),
          cta: t('home.steps.finishPlan.cta'),
        };
      case 'drill_leak': {
        const deltaStr = formatSignedDelta(step.deltaPoints ?? 0);
        const familyLabel = step.familyId ? t(`strategy.family.${step.familyId}`) : '';
        return {
          title: tNodes('home.steps.drillLeak.title', {
            family: familyLabel,
            position: <PokerNotation>{step.position ?? ''}</PokerNotation>,
          }),
          reason: step.isWatching
            ? tNodes('home.steps.drillLeak.reasonWatching', {
                delta: <PokerNotation>{deltaStr}</PokerNotation>,
                sample: <PokerNotation>{step.sampleCount ?? 0}</PokerNotation>,
              })
            : tNodes('home.steps.drillLeak.reason', {
                delta: <PokerNotation>{deltaStr}</PokerNotation>,
                sample: <PokerNotation>{step.sampleCount ?? 0}</PokerNotation>,
              }),
          cta: t('home.steps.drillLeak.cta'),
        };
      }
      case 'review_hand':
        return {
          title: tNodes('home.steps.reviewHand.title', {
            hand: <PokerNotation>{step.titleText ?? ''}</PokerNotation>,
          }),
          reason: t('home.steps.reviewHand.reason'),
          cta: t('home.steps.reviewHand.cta'),
        };
      case 'quick_drill':
      default:
        return {
          title: t('home.steps.quickDrill.title'),
          reason: t('home.steps.quickDrill.reason'),
          cta: t('home.steps.quickDrill.cta'),
        };
    }
  };

  const renderOfferContent = (offer: HomeOfferItem) => {
    switch (offer.kind) {
      case 'map_3bet':
        return {
          title: t('home.offers.map3bet.title'),
          reason: t('home.offers.map3bet.reason', { count: offer.unansweredSpotsCount ?? 0 }),
          onClick: () => runAction(offer.action),
        };
      case 'duel_astra':
        return {
          title: t('home.offers.duelAstra.title'),
          reason: t('home.offers.duelAstra.reason'),
          onClick: () => onOpenTraining('duel'),
        };
      case 'reopen_matchup':
        return {
          title: t('home.offers.reopenMatchup.title'),
          reason: tNodes('home.offers.reopenMatchup.reason', {
            matchup: <PokerNotation>{offer.matchupTitle ?? ''}</PokerNotation>,
          }),
          onClick: () => runAction(offer.action),
        };
      case 'explore_equity':
        return {
          title: t('home.offers.exploreEquity.title'),
          reason: t('home.offers.exploreEquity.reason'),
          onClick: () => runAction(offer.action),
        };
      case 'record_hand':
        return {
          title: t('home.offers.recordHand.title'),
          reason: t('home.offers.recordHand.reason'),
          onClick: () => runAction(offer.action),
        };
    }
  };

  const dayFormatter = new Intl.DateTimeFormat(prefs.lang, { weekday: 'narrow' });
  const dayLongFormatter = new Intl.DateTimeFormat(prefs.lang, { weekday: 'short' });

  return (
    <div className={styles.room}>
      <div className={styles.coachGrid}>
        <Panel
          as="section"
          titleId="home-greeting-heading"
          tier={
            topLeak
              ? { tier: topLeak.tier, source: t('tier.source.baseline') }
              : { tier: 'unavailable' }
          }
          loading={loading}
        >
          <div className={styles.coachCard}>
            {prefs.showLamp && (
              <div className={styles.lampStage}>
                <Lamp
                  size={128}
                  mood={lampMood}
                  onWake={() => setLampWoken(true)}
                />
              </div>
            )}

            <div className={styles.eyebrow}>{t('home.teacher.eyebrow')}</div>
            <h1 id="home-greeting-heading" className={styles.greeting}>
              {t(`home.greeting.${greetingBucket}`)}
            </h1>
            <p className={styles.coachSummary}>
              {visitState === 'first_visit'
                ? t('home.coach.firstVisitSummary')
                : t('home.coach.returningSummary', { count: nextSteps.length })}
            </p>
            {hasAnyError && <p className={styles.errorNote}>{t('home.coach.partialError')}</p>}

            <PanelSection label={t('home.leak.heading')}>
              <div className={styles.leakHeader}>
                <div className={styles.leakTitleGroup}>
                  {topLeak?.isWatching && (
                    <Chip>{t('home.leak.watchingBadge', { count: topLeak.sampleHands })}</Chip>
                  )}
                </div>
                <Button
                  variant="secondary"
                  onClick={() =>
                    onOpenStrategy(
                      'leakMap',
                      topLeak
                        ? {
                            rowId: 'first_in',
                            position: topLeak.position,
                            leakCellKey: topLeak.key,
                          }
                        : undefined,
                    )
                  }
                >
                  {t('home.leak.openLink')}
                </Button>
              </div>

              <HeatGrid
                variant="leakMap"
                compact
                ariaLabel={t('home.leak.aria')}
                columnHeaders={leakMap.positions}
                rows={leakRows}
                activeId={topLeak?.key ?? store.selectedLeakCellKeySignal.value}
                animateEntrance={false}
                onActivateCell={(cell) => {
                  store.selectLeakCell(cell.id);
                  const pos = cell.id.split('|')[1];
                  if (pos) {
                    onOpenStrategy('leakMap', {
                      rowId: 'first_in',
                      position: pos,
                      leakCellKey: cell.id,
                    });
                  }
                }}
              />

              <p className={styles.leakCaption}>
                {topLeak
                  ? topLeak.isWatching
                    ? tNodes('home.leak.captionWatching', {
                        sample: <PokerNotation>{topLeak.sampleHands}</PokerNotation>,
                      })
                    : tNodes('home.leak.captionTop', {
                        family: t(`strategy.family.${topLeak.familyId}`),
                        position: <PokerNotation>{topLeak.position}</PokerNotation>,
                        delta: <PokerNotation>{formatSignedDelta(topLeak.deltaPoints)}</PokerNotation>,
                        sample: <PokerNotation>{topLeak.sampleHands}</PokerNotation>,
                      })
                  : t('home.leak.captionEmpty')}
              </p>
            </PanelSection>
          </div>
        </Panel>

        <div className={styles.mainStack}>
          {visitState === 'first_visit' ? (
            <Panel
              label={t('home.firstVisit.eyebrow')}
              title={t('home.firstVisit.title')}
              loading={loading}
            >
              <p className={styles.firstVisitBody}>{t('home.firstVisit.body')}</p>
              <div className={styles.actionRow}>
                <Button variant="primary" onClick={onOpenHandRecorder}>
                  {t('home.firstVisit.primaryCta')}
                </Button>
                <Button variant="secondary" onClick={() => onOpenTraining('quick_drill')}>
                  {t('home.firstVisit.drillCta')}
                </Button>
                <Button variant="secondary" onClick={() => onOpenStrategy('spotMap')}>
                  {t('home.firstVisit.strategyCta')}
                </Button>
                <Button variant="secondary" onClick={() => onOpenEquity()}>
                  {t('home.firstVisit.equityCta')}
                </Button>
              </div>
            </Panel>
          ) : (
            <section aria-label={t('home.steps.heading')} className={styles.stepsList}>
              {nextSteps.map((step, index) => {
                const content = renderStepContent(step);
                const rankClass =
                  step.rank === 1
                    ? styles.stepRankPrimary
                    : step.rank === 2
                      ? styles.stepRankSecond
                      : undefined;
                return (
                  <div
                    key={step.id}
                    className={`${styles.stepItem} ${styles.stepAnimated}`}
                    style={{ '--home-step': index } as Record<string, number>}
                  >
                    <Panel>
                      <div className={styles.stepRow}>
                        <span
                          className={
                            rankClass ? `${styles.stepRank} ${rankClass}` : styles.stepRank
                          }
                          aria-hidden="true"
                        >
                          {step.rank}
                        </span>
                        <div className={styles.stepBody}>
                          <h2 className={styles.stepTitle}>{content.title}</h2>
                          <p className={styles.stepReason}>{content.reason}</p>
                        </div>
                        <div className={styles.stepAction}>
                          <Button
                            variant={step.primary ? 'primary' : 'secondary'}
                            onClick={() => runAction(step.action)}
                          >
                            {content.cta}
                          </Button>
                        </div>
                      </div>
                    </Panel>
                  </div>
                );
              })}
            </section>
          )}

          <div className={nightCard ? `${styles.twoUpGrid} ${styles.twoUpGridSplit}` : styles.twoUpGrid}>
            {nightCard && (
              <Panel
                label={t('home.night.heading')}
                title={nightCard.title}
                tier={{ tier: 'exact', detail: t('nights.summary.tierDetail') }}
              >
                <div className={styles.nightCardBody}>
                  <div className={styles.nightMetaRow}>
                    <Chip>
                      {nightCard.status === 'settled'
                        ? t('nights.status.settled')
                        : t('nights.status.active')}
                    </Chip>
                    <span className={styles.nightFactLine}>
                      {tNodes('home.night.meta', {
                        players: <PokerNotation>{nightCard.playerCount}</PokerNotation>,
                        status:
                          nightCard.status === 'settled'
                            ? t('nights.status.settled')
                            : t('nights.status.active'),
                        hands: <PokerNotation>{nightCard.linkedHandsCount}</PokerNotation>,
                      })}
                    </span>
                  </div>

                  <p className={styles.nightFactLine}>
                    {tNodes('home.night.totalIn', {
                      amount: <PokerNotation>{nightCard.totalInDisplay}</PokerNotation>,
                    })}
                  </p>
                  {nightCard.topNetDisplay && nightCard.topNetPlayerName ? (
                    <p className={styles.nightFactLine}>
                      {tNodes('home.night.topResult', {
                        name: nightCard.topNetPlayerName,
                        amount: <PokerNotation>{nightCard.topNetDisplay}</PokerNotation>,
                      })}
                    </p>
                  ) : null}

                  <div className={styles.actionRow}>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        onOpenNights(
                          nightCard.sessionId,
                          nightCard.status === 'settled' ? 'settle' : 'ledger',
                        )
                      }
                    >
                      {t('home.night.openNight')}
                    </Button>
                    {nightCard.firstLinkedHandId && (
                      <Button
                        variant="secondary"
                        onClick={() => onOpenReview(nightCard.firstLinkedHandId!)}
                      >
                        {t('home.night.reviewHand')}
                      </Button>
                    )}
                  </div>
                </div>
              </Panel>
            )}

            <Panel loading={loading}>
              <div className={styles.weekHeaderRow}>
                <span className={styles.eyebrow}>{t('home.week.heading')}</span>
                <button
                  type="button"
                  className={styles.weekHeaderLink}
                  onClick={() => onOpenTraining('hub')}
                >
                  <span>{t('home.week.openTraining')}</span>
                  <span aria-hidden="true">›</span>
                </button>
              </div>

              <div className={styles.weekMetrics}>
                <div className={styles.weekMetricItem}>
                  <b className={styles.weekMetricValue}>
                    {formatNumber(weekly.sessionsCount, { maximumFractionDigits: 0 })}
                  </b>
                  <span className={styles.weekMetricLabel}>{t('home.week.sessions')}</span>
                </div>
                <div className={styles.weekMetricItem}>
                  <b className={styles.weekMetricValue}>
                    {formatNumber(weekly.spotsCount, { maximumFractionDigits: 0 })}
                  </b>
                  <span className={styles.weekMetricLabel}>{t('home.week.spots')}</span>
                </div>
                <div className={styles.weekMetricItem}>
                  <b className={styles.weekMetricValue}>
                    {formatNumber(weekly.handsRecordedCount, { maximumFractionDigits: 0 })}
                  </b>
                  <span className={styles.weekMetricLabel}>{t('home.week.hands')}</span>
                </div>
              </div>

              <div
                className={styles.weekBars}
                role="list"
                aria-label={t('home.week.chartAria')}
              >
                {weekly.days.map((day) => {
                  const dateObj = new Date(day.dateMs);
                  const shortDay = dayFormatter.format(dateObj);
                  const ariaDay = dayLongFormatter.format(dateObj);
                  return (
                    <div
                      key={day.dateKey}
                      role="listitem"
                      className={styles.weekDayCol}
                      aria-label={t('home.week.dayAria', {
                        day: ariaDay,
                        spots: day.spotsCount,
                        hands: day.handsCount,
                      })}
                    >
                      <div className={styles.weekBarTrack} aria-hidden="true">
                        {day.heightPct > 0 ? (
                          <span
                            className={styles.weekBarFill}
                            style={{ transform: `scaleY(${day.heightPct / 100})` }}
                          />
                        ) : (
                          <span className={styles.weekBarEmpty} />
                        )}
                      </div>
                      <span className={styles.weekDayLabel}>{shortDay}</span>
                    </div>
                  );
                })}
              </div>

              {!weekly.hasAnyActivity && (
                <p className={styles.weekEmptyNote}>{t('home.week.empty')}</p>
              )}

              {visitState !== 'first_visit' && habitSummary && (
                <PanelSection label={t('home.habits.heading')}>
                  <div className={styles.habitRow}>
                    <div className={styles.habitMeta}>
                      {habitSummary.topTag && (
                        <span className={styles.habitLine}>
                          {t('home.habits.topTag', {
                            tag: t(`review.tags.${habitSummary.topTag}`),
                            count: formatNumber(habitSummary.topTagCount),
                          })}
                          {habitSummary.isWatching && (
                            <Chip>{t('home.habits.watching', { count: habitSummary.topTagCount })}</Chip>
                          )}
                        </span>
                      )}
                      {habitSummary.duelSessionsCount > 0 && (
                        <span className={styles.habitSub}>
                          {t('home.habits.duelsCount', {
                            count: formatNumber(habitSummary.duelSessionsCount),
                          })}
                        </span>
                      )}
                    </div>
                    {habitSummary.topTag && (
                      <Button variant="secondary" onClick={() => onOpenReview()}>
                        {t('home.habits.openReview')}
                      </Button>
                    )}
                  </div>
                </PanelSection>
              )}
            </Panel>
          </div>

          {offers.length > 0 && (
            <section aria-label={t('home.offers.eyebrow')} className={styles.offersGrid}>
              {offers.map((offer) => {
                const info = renderOfferContent(offer);
                return (
                  <button
                    key={offer.id}
                    type="button"
                    className={styles.offerTile}
                    onClick={info.onClick}
                  >
                    <span className={styles.eyebrow}>{t('home.offers.eyebrow')}</span>
                    <span className={styles.offerTitle}>{info.title}</span>
                    <span className={styles.offerReason}>{info.reason}</span>
                  </button>
                );
              })}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
