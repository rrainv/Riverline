import {
  playersBehindForPosition,
  STRATEGY_STACK_DEPTHS,
  type StrategyStackDepthBb,
  type StrategyTableSize,
  type TrainingDrillTarget,
} from '../../../engine-api';
import type { TrainingStore } from '../../../domain/training';
import { t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { Chip } from '../../kit/chip/Chip';
import { ChipButton, SegmentedControl } from '../../kit/choice/Choice';
import { TeacherCallout } from '../../kit/lamp/Lamp';
import { MixBar, type MixSegment } from '../../kit/mix-bar/MixBar';
import {
  OptionTickets,
  type LadderSizeOption,
  type OptionTicketItem,
} from '../../kit/option-tickets/OptionTickets';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import { PlayingCard } from '../../kit/playing-card/PlayingCard';
import styles from './TrainingRoom.module.css';

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
  const topLeak = isLeakLab ? store.leakLabTargetsSignal.value[0] ?? null : null;

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

  const raiseSizes: LadderSizeOption[] = ex
    ? ex.raisePresetsBb.map((baseBb, idx) => {
        const id = `s${idx}`;
        const min = (ex.legalSpec.raise.minToMilliBb ?? 2000) / 1000;
        const max = (ex.legalSpec.raise.maxToMilliBb ?? ex.stackDepthBb * 1000) / 1000;
        const val = customSizes[id] ?? baseBb;
        return {
          id,
          value: val,
          min,
          max,
          step: 0.5,
          adjustable: true,
          costDetail: `${val} bb`,
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

      <div className={styles.mainGrid}>
        <div className={styles.column}>
          <Panel
            label={isLeakLab ? t('training.rail.leakLab') : t('training.rail.drill')}
            title={
              ex ? (
                <span>
                  <PokerNotation>{ex.heroPosition}</PokerNotation> ·{' '}
                  <PokerNotation>{ex.handClass}</PokerNotation>
                </span>
              ) : (
                t('training.rail.drill')
              )
            }
            tier={{ tier: 'exact', detail: t('tier.detail.priceOnly') }}
            loading={loading && !ex}
          >
            {ex ? (
              <div className={styles.spotSummary}>
                <div className={styles.spotTopRow}>
                  <div className={styles.heroHandRow}>
                    <div className={styles.handCards}>
                      <PlayingCard card={ex.heroCards[0]} size="standard" />
                      <PlayingCard card={ex.heroCards[1]} size="standard" />
                    </div>
                    <div>
                      <p className={styles.spotMeta}>
                        {tNodes('training.drill.spotMeta', {
                          table: <PokerNotation>{ex.tableSize}</PokerNotation>,
                          stack: <PokerNotation>{ex.stackDepthBb}</PokerNotation>,
                          position: <PokerNotation>{ex.heroPosition}</PokerNotation>,
                          behind: <PokerNotation>{behindCount}</PokerNotation>,
                        })}
                      </p>
                      <p className={styles.promptText}>
                        {ex.decisionFamily === 'preflop_rfi'
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
                              })}
                      </p>
                    </div>
                  </div>
                </div>

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

                <OptionTickets
                  tickets={tickets}
                  selectedTicketId={selectedTicket ?? undefined}
                  onSelectTicket={(id) => {
                    store.selectDrillTicket(id as 'fold' | 'call' | 'raise');
                  }}
                  ladderLabel={t('training.drill.ladderLabel')}
                  sizes={raiseSizes}
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
    </div>
  );
}
