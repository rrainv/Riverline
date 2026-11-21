import { useMemo, useState } from 'preact/hooks';
import type { StrategyStore } from '../../../domain/strategy';
import { formatNumber, t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Chip } from '../../kit/chip/Chip';
import { ChipButton } from '../../kit/choice/Choice';
import { Panel } from '../../kit/panel/Panel';
import { cx } from '../../kit/state';
import styles from './StrategyRoom.module.css';

export interface CommitmentRiverViewProps {
  readonly store: StrategyStore;
}

type PotPresetId = 'hu_raised' | 'iso_limpers' | 'three_bet';
type StreetFraction = '0' | '0.33' | '0.5' | '0.67' | '1' | 'allin';

interface PotPresetSpec {
  readonly id: PotPresetId;
  readonly flopPotBb: number;
  readonly investedBb: number;
}

const POT_PRESETS: readonly PotPresetSpec[] = [
  { id: 'hu_raised', flopPotBb: 5.5, investedBb: 2.5 },
  { id: 'iso_limpers', flopPotBb: 11.5, investedBb: 4.5 },
  { id: 'three_bet', flopPotBb: 15.5, investedBb: 7.5 },
];

const SPR_THRESHOLDS = [1.5, 2.0, 2.5, 3.0] as const;

const FRACTION_OPTIONS: readonly { id: StreetFraction; labelKey: string }[] = [
  { id: '0', labelKey: 'strategy.commitment.fracCheck' },
  { id: '0.33', labelKey: 'strategy.commitment.fracThird' },
  { id: '0.5', labelKey: 'strategy.commitment.fracHalf' },
  { id: '0.67', labelKey: 'strategy.commitment.fracTwoThirds' },
  { id: '1', labelKey: 'strategy.commitment.fracPot' },
  { id: 'allin', labelKey: 'strategy.commitment.fracAllIn' },
];

interface StreetComputation {
  readonly streetId: 'flop' | 'turn' | 'river';
  readonly streetLabel: string;
  readonly startPotBb: number;
  readonly startBehindBb: number;
  readonly startSpr: number;
  readonly betBb: number;
  readonly afterCallPotBb: number;
  readonly afterCallBehindBb: number;
  readonly afterCallSpr: number;
  readonly foldNeededPct: number;
  readonly perOpponentFoldPct: number;
  readonly isCommitted: boolean;
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

function computeBetBb(
  fraction: StreetFraction,
  potBb: number,
  behindBb: number,
): number {
  if (behindBb <= 0 || fraction === '0') return 0;
  if (fraction === 'allin') return round1(behindBb);
  const raw = potBb * Number(fraction);
  return round1(Math.min(behindBb, raw));
}

function formatBb(val: number): string {
  return formatNumber(val, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function CommitmentRiverView({ store }: CommitmentRiverViewProps) {
  const stackDepthBb = store.stackDepthBbSignal.value;
  const [potPresetId, setPotPresetId] = useState<PotPresetId>('hu_raised');
  const [thresholdSpr, setThresholdSpr] = useState<number>(2.0);
  const [opponents, setOpponents] = useState<number>(1);
  const [flopFraction, setFlopFraction] = useState<StreetFraction>('0.5');
  const [turnFraction, setTurnFraction] = useState<StreetFraction>('0.67');
  const [riverFraction, setRiverFraction] = useState<StreetFraction>('allin');

  const streets = useMemo<readonly StreetComputation[]>(() => {
    const preset = POT_PRESETS.find((p) => p.id === potPresetId) ?? POT_PRESETS[0]!;
    let curPot = preset.flopPotBb;
    let curBehind = Math.max(0, stackDepthBb - preset.investedBb);

    const defs: readonly {
      id: 'flop' | 'turn' | 'river';
      label: string;
      fraction: StreetFraction;
    }[] = [
      { id: 'flop', label: t('strategy.commitment.streetFlop'), fraction: flopFraction },
      { id: 'turn', label: t('strategy.commitment.streetTurn'), fraction: turnFraction },
      { id: 'river', label: t('strategy.commitment.streetRiver'), fraction: riverFraction },
    ];

    return defs.map((d) => {
      const startPotBb = round1(curPot);
      const startBehindBb = round1(curBehind);
      const startSpr = startPotBb > 0 ? round1(startBehindBb / startPotBb) : 0;
      const betBb = computeBetBb(d.fraction, startPotBb, startBehindBb);
      const afterCallPotBb = round1(startPotBb + betBb * 2);
      const afterCallBehindBb = round1(Math.max(0, startBehindBb - betBb));
      const afterCallSpr = afterCallPotBb > 0 ? round1(afterCallBehindBb / afterCallPotBb) : 0;
      const foldRatio = betBb > 0 && betBb + startPotBb > 0 ? betBb / (betBb + startPotBb) : 0;
      const foldNeededPct = round1(foldRatio * 100);
      const perOpponentFoldPct =
        foldRatio > 0 && opponents > 1
          ? round1(Math.pow(foldRatio, 1 / opponents) * 100)
          : foldNeededPct;
      const isCommitted = startSpr <= thresholdSpr || afterCallSpr <= thresholdSpr;

      curPot = afterCallPotBb;
      curBehind = afterCallBehindBb;

      return {
        streetId: d.id,
        streetLabel: d.label,
        startPotBb,
        startBehindBb,
        startSpr,
        betBb,
        afterCallPotBb,
        afterCallBehindBb,
        afterCallSpr,
        foldNeededPct,
        perOpponentFoldPct,
        isCommitted,
      };
    });
  }, [potPresetId, stackDepthBb, thresholdSpr, opponents, flopFraction, turnFraction, riverFraction]);

  const firstCommittedStreet = streets.find((s) => s.isCommitted);
  const finalSpr = streets[streets.length - 1]?.afterCallSpr ?? 0;

  const setFractionForStreet = (streetId: 'flop' | 'turn' | 'river', next: StreetFraction) => {
    if (streetId === 'flop') setFlopFraction(next);
    else if (streetId === 'turn') setTurnFraction(next);
    else setRiverFraction(next);
  };

  const getFractionForStreet = (streetId: 'flop' | 'turn' | 'river'): StreetFraction => {
    if (streetId === 'flop') return flopFraction;
    if (streetId === 'turn') return turnFraction;
    return riverFraction;
  };

  const presetLabel = (id: PotPresetId): string => {
    if (id === 'hu_raised') return t('strategy.commitment.potHuRaised');
    if (id === 'iso_limpers') return t('strategy.commitment.potIsoLimpers');
    return t('strategy.commitment.potThreeBet');
  };

  return (
    <div className={styles.commitmentStack}>
      <Panel
        label={t('strategy.commitment.eyebrow')}
        title={t('strategy.commitment.title')}
        headingLevel="h2"
        tier={{ tier: 'exact', detail: t('tier.detail.priceOnly') }}
      >
        <p className={styles.sectionLead}>{t('strategy.commitment.lead')}</p>

        <div className={styles.commitmentControls}>
          <div className={styles.commitmentControlGroup}>
            <span className={styles.commitmentControlLabel}>
              {t('strategy.commitment.potPresetLabel')}
            </span>
            <div className={styles.chipGroup}>
              {POT_PRESETS.map((preset) => (
                <ChipButton
                  key={preset.id}
                  selected={potPresetId === preset.id}
                  onToggle={() => setPotPresetId(preset.id)}
                >
                  {presetLabel(preset.id)}
                </ChipButton>
              ))}
            </div>
          </div>

          <div className={styles.commitmentControlGroup}>
            <span className={styles.commitmentControlLabel}>
              {t('strategy.commitment.thresholdLabel')}
            </span>
            <div className={styles.chipGroup}>
              {SPR_THRESHOLDS.map((spr) => (
                <ChipButton
                  key={spr}
                  selected={thresholdSpr === spr}
                  onToggle={() => setThresholdSpr(spr)}
                >
                  <PokerNotation>{formatBb(spr)}</PokerNotation>
                </ChipButton>
              ))}
            </div>
          </div>

          <div className={styles.commitmentControlGroup}>
            <span className={styles.commitmentControlLabel}>
              {t('strategy.commitment.opponentsLabel')}
            </span>
            <div className={styles.chipGroup}>
              {[1, 2, 3].map((count) => (
                <ChipButton
                  key={count}
                  selected={opponents === count}
                  onToggle={() => setOpponents(count)}
                >
                  {t('strategy.commitment.opponentsCount', { count })}
                </ChipButton>
              ))}
            </div>
          </div>
        </div>

        <p className={styles.commitmentSummaryBanner}>
          {firstCommittedStreet
            ? t('strategy.commitment.summaryCommitted', {
                street: firstCommittedStreet.streetLabel,
                threshold: formatBb(thresholdSpr),
              })
            : t('strategy.commitment.summaryUncommitted', {
                threshold: formatBb(thresholdSpr),
                spr: formatBb(finalSpr),
              })}
        </p>

        <div className={styles.commitmentGrid}>
          {streets.map((street) => {
            const activeFrac = getFractionForStreet(street.streetId);
            return (
              <div
                key={street.streetId}
                className={cx(
                  styles.commitmentCard,
                  street.isCommitted && styles.commitmentCardActive,
                )}
              >
                <div className={styles.commitmentCardHead}>
                  <h3 className={styles.commitmentStreetTitle}>{street.streetLabel}</h3>
                  {street.isCommitted && (
                    <Chip>{t('strategy.commitment.committedBadge')}</Chip>
                  )}
                </div>

                <div className={styles.commitmentMetrics}>
                  <div className={styles.commitmentMetricRow}>
                    <span className={styles.commitmentMetricLabel}>
                      {t('strategy.commitment.startPot')}
                    </span>
                    <PokerNotation>{`${formatBb(street.startPotBb)} bb`}</PokerNotation>
                  </div>
                  <div className={styles.commitmentMetricRow}>
                    <span className={styles.commitmentMetricLabel}>
                      {t('strategy.commitment.stackBehind')}
                    </span>
                    <PokerNotation>{`${formatBb(street.startBehindBb)} bb`}</PokerNotation>
                  </div>
                  <div className={styles.commitmentMetricRow}>
                    <span className={styles.commitmentMetricLabel}>
                      {t('strategy.commitment.sprLabel')}
                    </span>
                    <PokerNotation>{formatBb(street.startSpr)}</PokerNotation>
                  </div>
                </div>

                <div className={styles.commitmentFracRow}>
                  {FRACTION_OPTIONS.map((opt) => (
                    <ChipButton
                      key={opt.id}
                      selected={activeFrac === opt.id}
                      onToggle={() => setFractionForStreet(street.streetId, opt.id)}
                    >
                      {t(opt.labelKey as never)}
                    </ChipButton>
                  ))}
                </div>

                <div className={styles.commitmentMetrics}>
                  <div className={styles.commitmentMetricRow}>
                    <span className={styles.commitmentMetricLabel}>
                      {t('strategy.commitment.betSize')}
                    </span>
                    <PokerNotation>{`${formatBb(street.betBb)} bb`}</PokerNotation>
                  </div>
                  <div className={styles.commitmentMetricRow}>
                    <span className={styles.commitmentMetricLabel}>
                      {t('strategy.commitment.foldNeeded')}
                    </span>
                    <PokerNotation>{`${formatBb(street.foldNeededPct)}%`}</PokerNotation>
                  </div>
                  {opponents > 1 && (
                    <div className={styles.commitmentMetricRow}>
                      <span className={styles.commitmentMetricLabel}>
                        {t('strategy.commitment.perOpponentFold', { count: opponents })}
                      </span>
                      <PokerNotation>{`${formatBb(street.perOpponentFoldPct)}%`}</PokerNotation>
                    </div>
                  )}
                  <div className={styles.commitmentMetricRow}>
                    <span className={styles.commitmentMetricLabel}>
                      {t('strategy.commitment.afterCallPot')}
                    </span>
                    <PokerNotation>{`${formatBb(street.afterCallPotBb)} bb`}</PokerNotation>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
