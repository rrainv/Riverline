import { useEffect, useRef, useState } from 'preact/hooks';
import {
  matchesShortcutEvent,
  minimalCardsSignal,
  motionSignal,
  shortcutsSignal,
} from '../../../domain/appearance';
import {
  playersBehindForPosition,
  STRATEGY_STACK_DEPTHS,
  type StrategyStackDepthBb,
  type StrategyTableSize,
  type TrainingDrillTarget,
} from '../../../engine-api';
import type { TrainingStore } from '../../../domain/training';
import { formatNumber, t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { Chip, Kbd } from '../../kit/chip/Chip';
import { ChipButton, SegmentedControl } from '../../kit/choice/Choice';
import { FeltTable, type SeatEmblem, type TableCardSpec, type TableSeat } from '../../kit/felt-table/FeltTable';
import { TeacherCallout } from '../../kit/lamp/Lamp';
import { MixBar, type MixSegment } from '../../kit/mix-bar/MixBar';
import {
  OptionTickets,
  type LadderSizeOption,
  type OptionTicketItem,
} from '../../kit/option-tickets/OptionTickets';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import { InlineEquityDrawer } from '../equity/InlineEquityDrawer';
import styles from './TrainingRoom.module.css';

const DRILL_BOT_EMBLEMS: readonly SeatEmblem[] = ['wave', 'bars', 'prism', 'orbits', 'arc'];

interface DrillMotionTracker {
  lastSig: string | null;
  lastExerciseId: string | null;
  lastGradeAction: string | null;
  dealHero: boolean;
  heroFoldAnim: boolean;
  chipTrigger: number;
  chipSeats: readonly string[];
}

interface QuickDrillViewProps {
  readonly store: TrainingStore;
  readonly isLeakLab?: boolean;
}

function formatActionWord(action: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in'): string {
  switch (action) {
    case 'fold':
      return t('training.drill.fold');
    case 'check':
      return t('training.duel.check');
    case 'call':
      return t('training.drill.call');
    case 'bet':
      return t('training.duel.bet');
    case 'raise':
    case 'all_in':
      return t('strategy.builder.brush.raise');
  }
}

export function QuickDrillView({ store, isLeakLab = false }: QuickDrillViewProps) {
  const filters = store.drillFiltersSignal.value;
  const ex = store.drillExerciseSignal.value;
  const loading = store.drillLoadingSignal.value;
  const selectedTicket = store.drillSelectedTicketSignal.value;
  const selectedSizeId = store.drillSelectedSizeIdSignal.value;
  const customSizes = store.drillCustomSizesBbSignal.value;
  const grade = store.drillGradeSignal.value;
  const sessionStats = store.drillSessionStatsSignal.value;
  const missedQueue = store.missedDrillQueueSignal.value;
  const topLeak = isLeakLab ? store.leakLabTargetsSignal.value[0] ?? null : null;
  const [equityOverlayOpen, setEquityOverlayOpen] = useState(false);
  const motionRef = useRef<DrillMotionTracker>({
    lastSig: null,
    lastExerciseId: null,
    lastGradeAction: null,
    dealHero: false,
    heroFoldAnim: false,
    chipTrigger: 0,
    chipSeats: [],
  });

  const allowCardMotion = motionSignal.value !== 'reduced' && !minimalCardsSignal.value;
  const shortcuts = shortcutsSignal.value;

  useEffect(() => {
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
      if (!ex || grade || loading) return;
      if (matchesShortcutEvent(event, activeShortcuts.fold) && ex.legalSpec.fold.available) {
        event.preventDefault();
        store.selectDrillTicket('fold');
      } else if (matchesShortcutEvent(event, activeShortcuts.call) && ex.legalSpec.call.available) {
        event.preventDefault();
        store.selectDrillTicket('call');
      } else if (matchesShortcutEvent(event, activeShortcuts.raise) && ex.legalSpec.raise.available) {
        event.preventDefault();
        store.selectDrillTicket('raise');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [ex, grade, loading, store]);

  useEffect(() => {
    if (!grade || loading) return;
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
      void store.nextDrillSpot();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [grade, loading, store]);

  const curExerciseId = ex?.exerciseId ?? null;
  const curGradeAction = grade ? grade.chosenActionType : null;
  const curMotionSig = `${curExerciseId ?? 'none'}|${curGradeAction ?? 'unanswered'}`;

  if (!allowCardMotion) {
    motionRef.current.dealHero = false;
    motionRef.current.heroFoldAnim = false;
    motionRef.current.lastSig = curMotionSig;
    motionRef.current.lastExerciseId = curExerciseId;
    motionRef.current.lastGradeAction = curGradeAction;
  } else if (motionRef.current.lastSig !== curMotionSig) {
    if (!curExerciseId) {
      motionRef.current.dealHero = false;
      motionRef.current.heroFoldAnim = false;
    } else if (motionRef.current.lastExerciseId !== curExerciseId) {
      motionRef.current.dealHero = curGradeAction === null;
      motionRef.current.heroFoldAnim = curGradeAction === 'fold';
    } else if (motionRef.current.lastGradeAction === null && curGradeAction !== null) {
      motionRef.current.dealHero = false;
      if (curGradeAction === 'fold') {
        motionRef.current.heroFoldAnim = true;
      } else {
        motionRef.current.heroFoldAnim = false;
        motionRef.current.chipTrigger += 1;
        const betSeats = ex
          ? ex.pokerState.players
              .filter((p) => p.streetContributionMilliBb > 0)
              .map((p) => p.playerId)
          : [];
        motionRef.current.chipSeats = Array.from(new Set(['hero', ...betSeats]));
      }
    }
    motionRef.current.lastSig = curMotionSig;
    motionRef.current.lastExerciseId = curExerciseId;
    motionRef.current.lastGradeAction = curGradeAction;
  }

  const activeMotion = motionRef.current;

  const targetOptions: Array<{ value: TrainingDrillTarget | 'auto'; label: string }> = [
    { value: 'auto', label: t('training.drill.targetAuto') },
    { value: 'preflop_rfi', label: t('training.drill.targetRfi') },
    { value: 'preflop_facing_open', label: t('training.drill.targetOpen') },
    { value: 'preflop_facing_3bet', label: t('training.drill.target3bet') },
  ];

  const tableOptions: Array<{ value: `${StrategyTableSize}`; label: string }> = [
    { value: '6', label: t('strategy.rules.table6') },
    { value: '8', label: t('strategy.rules.table8') },
  ];

  const heroCommittedBb = ex
    ? (ex.pokerState.players.find((p) => p.playerId === 'hero')?.streetContributionMilliBb ?? 0) / 1000
    : 0;

  const raiseSizes: LadderSizeOption[] = ex
    ? ex.raisePresetsBb.map((baseBb, idx) => {
        const id = `s${idx}`;
        const min = (ex.legalSpec.raise.minToMilliBb ?? 2000) / 1000;
        const max = (ex.legalSpec.raise.maxToMilliBb ?? ex.stackDepthBb * 1000) / 1000;
        const val = customSizes[id] ?? baseBb;
        const potAfter = Math.round((ex.potBeforeActionBb + Math.max(0, val - heroCommittedBb)) * 10) / 10;
        return {
          id,
          value: val,
          min,
          max,
          step: 0.5,
          adjustable: true,
          costDetail: t('training.duel.potLabel', { pot: potAfter }),
        };
      })
    : [];

  const chosenSizeVal =
    raiseSizes.find((s) => s.id === selectedSizeId)?.value ?? raiseSizes[0]?.value ?? null;

  const tickets: OptionTicketItem[] = ex
    ? [
        ...(ex.legalSpec.fold.available
          ? [{ id: 'fold', shortcut: '1', label: t('training.drill.fold') }]
          : []),
        ...(ex.legalSpec.call.available
          ? [
              {
                id: 'call',
                shortcut: ex.legalSpec.fold.available ? '2' : '1',
                label: t('training.drill.call'),
                amount: `${ex.toCallBb} bb`,
              },
            ]
          : []),
        ...(ex.legalSpec.raise.available
          ? [
              {
                id: 'raise',
                shortcut: ex.legalSpec.call.available ? '3' : '2',
                label: t('training.drill.raiseTo'),
                amount: chosenSizeVal !== null ? `${chosenSizeVal} bb` : undefined,
              },
            ]
          : []),
      ]
    : [];

  const mixSegments: MixSegment[] = grade
    ? grade.mixSegments.map((seg) => ({
        id: seg.id,
        pct: seg.pct,
        label:
          seg.labelKind === 'fold'
            ? t('training.drill.fold')
            : seg.labelKind === 'call'
              ? t('training.drill.call')
              : `${t('training.drill.raiseTo')} ${seg.amountBb} bb`,
        tone: seg.tone,
      }))
    : [];

  const reasonKey =
    ex?.reasonKind === 'leak_gap'
      ? 'training.drill.teacherReasonGap'
      : ex?.reasonKind === 'baseline_edge'
        ? 'training.drill.teacherReasonEdge'
        : 'training.drill.teacherReasonSpot';

  const teacherText = grade
    ? grade.baselineTier === 'unavailable'
      ? t('training.drill.teacherUnavailable')
      : grade.comparison === 'matches'
        ? t('training.drill.teacherMatches', {
            chosenPct: grade.chosenPct ?? 0,
            reason: t(reasonKey),
          })
        : grade.comparison === 'close'
          ? t('training.drill.teacherClose', {
              chosenPct: grade.chosenPct ?? 0,
              bestPct: grade.bestPct ?? 0,
              reason: t(reasonKey),
            })
          : t('training.drill.teacherDiffers', {
              bestPct: grade.bestPct ?? 0,
              reason: t(reasonKey),
            })
    : '';

  const behindCount = ex ? playersBehindForPosition(ex.tableSize, ex.heroPosition) : 0;

  const heroFoldedByAnswer = grade?.chosenActionType === 'fold';

  const drillSeats: TableSeat[] = ex
    ? ex.pokerState.players.map((p, idx) => {
        const isHero = p.playerId === 'hero';
        const isFolded = p.folded || (isHero && heroFoldedByAnswer);
        const stackBb = Math.round((p.currentStackMilliBb / 1000) * 10) / 10;
        const betBb = Math.round((p.streetContributionMilliBb / 1000) * 10) / 10;

        let cards: TableCardSpec[] | undefined;
        if (isHero) {
          if (!isFolded) {
            cards = ex.heroCards.map((card) => ({
              card,
              motion: allowCardMotion && activeMotion.dealHero ? 'deal' : 'none',
            }));
          } else if (allowCardMotion && activeMotion.heroFoldAnim) {
            cards = ex.heroCards.map((card) => ({
              card,
              state: 'face' as const,
              motion: 'fold' as const,
            }));
          }
        } else if (!isFolded) {
          cards = [{ state: 'back' }, { state: 'back' }];
        }

        return {
          id: p.playerId,
          name: isHero ? `${t('training.duel.heroName')} · ${p.position}` : p.position,
          stack: `${stackBb} bb`,
          emblem: isHero ? 'hero' : DRILL_BOT_EMBLEMS[idx % DRILL_BOT_EMBLEMS.length],
          isHero,
          isDealer: p.position === 'BTN',
          folded: isFolded,
          bet: betBb > 0 ? `${betBb} bb` : undefined,
          cards,
        };
      })
    : [];

  const drillPotBb = ex ? Math.round((ex.pokerState.potMilliBb / 1000) * 10) / 10 : 0;

  return (
    <div className={styles.column}>
      <div className={styles.filterRow}>
        <div className={styles.filterGroup}>
          <SegmentedControl
            ariaLabel={t('training.drill.tableSizeLabel')}
            options={tableOptions}
            value={String(filters.tableSize) as `${StrategyTableSize}`}
            onChange={(val) => {
              void store.setDrillFilters({
                tableSize: Number(val) as StrategyTableSize,
                focusPosition: null,
                focusFamilyId: null,
              });
            }}
          />
          {STRATEGY_STACK_DEPTHS.map((bb) => (
            <ChipButton
              key={bb}
              selected={filters.stackDepthBb === bb}
              onToggle={() => {
                void store.setDrillFilters({
                  stackDepthBb: bb as StrategyStackDepthBb,
                });
              }}
            >
              <PokerNotation>{`${bb} bb`}</PokerNotation>
            </ChipButton>
          ))}
        </div>

        <SegmentedControl
          ariaLabel={t('training.rail.drill')}
          options={targetOptions}
          value={filters.target}
          onChange={(val) => {
            void store.setDrillFilters({
              target: val as TrainingDrillTarget | 'auto',
              focusPosition: null,
              focusFamilyId: null,
            });
          }}
        />
        <ChipButton
          selected={equityOverlayOpen}
          onToggle={() => setEquityOverlayOpen((prev) => !prev)}
        >
          {t('equityOverlay.trigger')} <Kbd>{shortcuts.inlineEquity}</Kbd>
        </ChipButton>
      </div>

      {isLeakLab && topLeak ? (
        <Chip>
          {tNodes('training.drill.leakBanner', {
            position: <PokerNotation>{filters.focusPosition ?? topLeak.position}</PokerNotation>,
            family: t(`strategy.family.${filters.focusFamilyId ?? topLeak.familyId}`),
            delta: (
              <PokerNotation>
                {topLeak.deltaPoints !== null && topLeak.deltaPoints > 0
                  ? `+${topLeak.deltaPoints}`
                  : `${topLeak.deltaPoints ?? 0}`}
              </PokerNotation>
            ),
          })}
        </Chip>
      ) : null}

      {(sessionStats.answeredCount > 0 || missedQueue.length > 0) && (
        <div className={styles.drillSessionBar}>
          <div className={styles.duelBadges}>
            {sessionStats.answeredCount > 0 && (
              <Chip>
                {t('training.drill.sessionProgress', {
                  aligned: formatNumber(sessionStats.baselineAlignedCount),
                  total: formatNumber(sessionStats.answeredCount),
                })}
              </Chip>
            )}
            {sessionStats.currentStreak > 0 && (
              <Chip>
                {t('training.drill.streakBadge', {
                  count: formatNumber(sessionStats.currentStreak),
                })}
              </Chip>
            )}
            {sessionStats.retryingMissed && (
              <Chip>{t('training.drill.retryingMissed')}</Chip>
            )}
          </div>
          {missedQueue.length > 0 && (
            <Button variant="secondary" onClick={() => store.retryMissedSpot()}>
              {t('training.drill.retryMissedBtn', { count: formatNumber(missedQueue.length) })}
            </Button>
          )}
        </div>
      )}

      <div className={styles.mainGrid}>
        <div className={styles.column}>
          <Panel
            label={isLeakLab ? t('training.rail.leakLab') : t('training.rail.drill')}
            title={
              ex ? (
                ex.decisionFamily === 'preflop_rfi'
                  ? tNodes('training.drill.spotPromptRfi', {
                      position: <PokerNotation>{ex.heroPosition}</PokerNotation>,
                    })
                  : ex.decisionFamily === 'preflop_facing_open'
                    ? tNodes('training.drill.spotPromptFacingOpen', {
                        opener: <PokerNotation>{ex.openerPosition ?? ''}</PokerNotation>,
                        bet: <PokerNotation>{ex.openerBetBb ?? 2.5}</PokerNotation>,
                        position: <PokerNotation>{ex.heroPosition}</PokerNotation>,
                      })
                    : tNodes('training.drill.spotPromptFacing3bet', {
                        opener: <PokerNotation>{ex.openerPosition ?? ''}</PokerNotation>,
                        bet: <PokerNotation>{ex.openerBetBb ?? 8.5}</PokerNotation>,
                      })
              ) : (
                t('training.rail.drill')
              )
            }
            tier={{ tier: 'exact', detail: t('tier.detail.priceOnly') }}
            loading={loading && !ex}
          >
            {ex ? (
              <div className={styles.spotSummary}>
                <p className={styles.spotMeta}>
                  <PokerNotation>{ex.heroPosition}</PokerNotation> ·{' '}
                  <PokerNotation>{ex.handClass}</PokerNotation> ·{' '}
                  {tNodes('training.drill.spotMeta', {
                    table: <PokerNotation>{ex.tableSize}</PokerNotation>,
                    stack: <PokerNotation>{ex.stackDepthBb}</PokerNotation>,
                    position: <PokerNotation>{ex.heroPosition}</PokerNotation>,
                    behind: <PokerNotation>{behindCount}</PokerNotation>,
                  })}
                </p>
                <FeltTable
                  mode="hand"
                  compact
                  seats={drillSeats}
                  activeSeatId={ex.pokerState.actingPlayerId ?? undefined}
                  pot={drillPotBb}
                  potUnit="bb"
                  seatCardSize="small"
                  chipsToPotTrigger={allowCardMotion ? activeMotion.chipTrigger : 0}
                  chipsToPotSeats={[...activeMotion.chipSeats]}
                />

                <OptionTickets
                  tickets={tickets}
                  selectedTicketId={selectedTicket ?? undefined}
                  onSelectTicket={(id) => {
                    store.selectDrillTicket(id as 'fold' | 'call' | 'raise');
                  }}
                  ladderLabel={selectedTicket === 'raise' ? t('training.drill.ladderLabel') : undefined}
                  sizes={selectedTicket === 'raise' ? raiseSizes : undefined}
                  selectedSizeId={selectedSizeId ?? undefined}
                  onSelectSize={(sizeId) => store.selectDrillSize(sizeId)}
                  onAdjustSize={(sizeId, val) => store.adjustDrillSize(sizeId, val)}
                  onResetSizes={() => store.resetDrillSizes()}
                  confirmLabel={t('training.drill.confirmAction')}
                  onConfirm={() => {
                    void store.confirmDrillAnswer();
                  }}
                  confirmDisabled={!selectedTicket || grade !== null}
                  confirmed={grade !== null}
                />

                {grade ? (
                  <div className={styles.actionRow}>
                    <Button variant="primary" onClick={() => void store.nextDrillSpot()}>
                      {t('training.drill.nextSpot')}
                    </Button>
                    {sessionStats.answeredCount > 0 ? (
                      <Button variant="secondary" onClick={() => void store.finishDrillSession()}>
                        {t('training.drill.saveSession', { count: sessionStats.answeredCount })}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </Panel>
        </div>

        <div className={styles.column}>
          {ex ? (
            <Panel tier={{ tier: 'exact', detail: t('tier.detail.priceOnly') }}>
              <div className={styles.priceBox}>
                <p className={styles.priceMain}>
                  {tNodes('training.drill.priceReadout', {
                    toCall: <PokerNotation>{ex.toCallBb}</PokerNotation>,
                    potAfter: <PokerNotation>{ex.potAfterCallBb}</PokerNotation>,
                    eq: <PokerNotation>{ex.requiredEquityPct}</PokerNotation>,
                  })}
                </p>
                <p className={styles.priceSub}>{t('training.drill.priceDetail')}</p>
              </div>
            </Panel>
          ) : null}

          <Panel
            label={t('training.drill.mixHeading')}
            title={t('training.drill.mixHeading')}
            tier={{ tier: grade?.baselineTier ?? (ex?.baselineTier ?? 'estimated') }}
          >
            <PanelSection>
              {grade === null ? (
                <div className={styles.planWell}>
                  <p className={styles.planTitle}>{t('training.drill.planHiddenTitle')}</p>
                  <p className={styles.planBody}>{t('training.drill.planHiddenBody')}</p>
                </div>
              ) : (
                <div className={styles.spotSummary}>
                  <div className={styles.planWell}>
                    <p className={styles.planTitle}>
                      {grade.userPlanAction === null
                        ? tNodes('training.drill.planUnknown', {
                            hand: <PokerNotation>{ex?.handClass ?? ''}</PokerNotation>,
                          })
                        : grade.matchesUserPlan
                          ? tNodes('training.drill.planMatched', {
                              action: formatActionWord(grade.userPlanAction),
                              hand: <PokerNotation>{ex?.handClass ?? ''}</PokerNotation>,
                            })
                          : tNodes('training.drill.planDiffers', {
                              planAction: formatActionWord(grade.userPlanAction),
                              chosenAction: formatActionWord(grade.chosenActionType),
                            })}
                    </p>
                  </div>

                  {grade.baselineTier === 'unavailable' ? (
                    <p className={styles.planBody}>
                      {t('training.drill.baselineUnavailable', {
                        table: filters.tableSize,
                        stack: filters.stackDepthBb,
                      })}
                    </p>
                  ) : (
                    <MixBar
                      segments={mixSegments}
                      youPositionPct={grade.youPointerPct}
                      youLabel={t('training.drill.youLabel')}
                      ariaLabel={t('training.drill.mixHeading')}
                    />
                  )}
                </div>
              )}
            </PanelSection>
          </Panel>

          {grade ? (
            <TeacherCallout
              mood={grade.lampMood}
              text={teacherText}
              tier={{ tier: grade.baselineTier }}
            />
          ) : null}
        </div>
      </div>

      <InlineEquityDrawer
        open={equityOverlayOpen}
        onToggle={() => setEquityOverlayOpen((prev) => !prev)}
        onClose={() => setEquityOverlayOpen(false)}
        heroCards={ex ? ex.heroCards : null}
        baseBoard={[]}
        defaultSource="any"
        lockedMessage={grade ? undefined : t('equityOverlay.drillLocked')}
        priceFacts={
          ex && ex.toCallBb > 0
            ? {
                requiredPct: ex.requiredEquityPct,
                callLabel: `${formatNumber(ex.toCallBb, { maximumFractionDigits: 1 })} ${t('training.duel.unitBb')}`,
                potLabel: `${formatNumber(ex.potAfterCallBb, { maximumFractionDigits: 1 })} ${t('training.duel.unitBb')}`,
              }
            : null
        }
      />
    </div>
  );
}
