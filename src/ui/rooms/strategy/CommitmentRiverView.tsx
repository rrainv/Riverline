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
type StreetFraction = '0' | '0.33' | '0.5' | '0.67' | '1' | '1.25' | '1.5' | 'allin' | 'geo';

export function solveGeometricFraction(spr: number, streets: 1 | 2 | 3): number {
  if (!(spr > 0)) return 0;
  return (Math.pow(2 * spr + 1, 1 / streets) - 1) / 2;
}

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
  { id: '1.25', labelKey: 'strategy.commitment.fracOver125' },
  { id: '1.5', labelKey: 'strategy.commitment.fracOver150' },
  { id: 'allin', labelKey: 'strategy.commitment.fracAllIn' },
  { id: 'geo', labelKey: 'strategy.commitment.fracGeo' },
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
  geoRatio: number,
  isFinalStreet: boolean,
): number {
  if (behindBb <= 0 || fraction === '0') return 0;
  if (fraction === 'allin') return round1(behindBb);
  if (fraction === 'geo') {
    if (isFinalStreet) return round1(behindBb);
    return round1(Math.min(behindBb, potBb * geoRatio));
  }
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
  const [geoStreets, setGeoStreets] = useState<2 | 3>(3);

  const activePreset = POT_PRESETS.find((p) => p.id === potPresetId) ?? POT_PRESETS[0]!;
  const flopStartSpr =
    activePreset.flopPotBb > 0
      ? Math.max(0, stackDepthBb - activePreset.investedBb) / activePreset.flopPotBb
      : 0;
  const geoRatio2 = solveGeometricFraction(flopStartSpr, 2);
  const geoRatio3 = solveGeometricFraction(flopStartSpr, 3);
  const activeGeoRatio = geoStreets === 2 ? geoRatio2 : geoRatio3;
  const activeGeoPct = round1(activeGeoRatio * 100);

  const streets = useMemo<readonly StreetComputation[]>(() => {
    let curPot = activePreset.flopPotBb;
    let curBehind = Math.max(0, stackDepthBb - activePreset.investedBb);

    const defs: readonly {
      id: 'flop' | 'turn' | 'river';
      label: string;
      fraction: StreetFraction;
    }[] = [
      { id: 'flop', label: t('strategy.commitment.streetFlop'), fraction: flopFraction },
      { id: 'turn', label: t('strategy.commitment.streetTurn'), fraction: turnFraction },
      { id: 'river', label: t('strategy.commitment.streetRiver'), fraction: riverFraction },
    ];

    return defs.map((d, idx) => {
      const startPotBb = round1(curPot);
      const startBehindBb = round1(curBehind);
      const startSpr = startPotBb > 0 ? round1(startBehindBb / startPotBb) : 0;
      const betBb = computeBetBb(
        d.fraction,
        startPotBb,
        startBehindBb,
        activeGeoRatio,
        idx === defs.length - 1,
      );
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
  }, [
    activePreset,
    stackDepthBb,
    thresholdSpr,
    opponents,
    flopFraction,
    turnFraction,
    riverFraction,
    activeGeoRatio,
  ]);

  const firstCommittedStreet = streets.find((s) => s.isCommitted);
  const finalSpr = streets[streets.length - 1]?.afterCallSpr ?? 0;
  const riverStreet = streets[streets.length - 1];
  const riverJamPotPct =
    riverStreet && riverStreet.startPotBb > 0 && riverStreet.startBehindBb > 0
      ? round1((riverStreet.startBehindBb / riverStreet.startPotBb) * 100)
      : 0;

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

          <div className={styles.commitmentControlGroup}>
            <span className={styles.commitmentControlLabel}>
              {t('strategy.commitment.geoPlanLabel')}
            </span>
            <div className={styles.chipGroup}>
              <ChipButton
                selected={
                  flopFraction === '0' &&
                  turnFraction === 'geo' &&
                  riverFraction === 'geo' &&
                  geoStreets === 2
                }
                onToggle={() => {
                  setGeoStreets(2);
                  setFlopFraction('0');
                  setTurnFraction('geo');
                  setRiverFraction('geo');
                }}
              >
                {t('strategy.commitment.geoTwoStreet', { pct: formatBb(round1(geoRatio2 * 100)) })}
              </ChipButton>
              <ChipButton
                selected={
                  flopFraction === 'geo' &&
                  turnFraction === 'geo' &&
                  riverFraction === 'geo' &&
                  geoStreets === 3
                }
                onToggle={() => {
                  setGeoStreets(3);
                  setFlopFraction('geo');
                  setTurnFraction('geo');
                  setRiverFraction('geo');
                }}
              >
                {t('strategy.commitment.geoThreeStreet', { pct: formatBb(round1(geoRatio3 * 100)) })}
              </ChipButton>
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
          {riverJamPotPct > 0
            ? ` · ${t('strategy.commitment.riverJamPct', { pct: formatBb(riverJamPotPct) })}`
            : ''}
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
                      {opt.id === 'geo'
                        ? t('strategy.commitment.fracGeo', { pct: formatBb(activeGeoPct) })
                        : t(opt.labelKey as never)}
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
