import type { StrategyFamilyId } from '../../../engine-api';
import { formatNumber, t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import type { StrategyStore } from '../../../domain/strategy';
import { Button } from '../../kit/button/Button';
import { Chip } from '../../kit/chip/Chip';
import {
  HeatGrid,
  type HeatGridCell,
  type HeatGridColumnFooter,
  type HeatGridRow,
  type HeatTone,
} from '../../kit/heat-grid/HeatGrid';
import { TeacherCallout } from '../../kit/lamp/Lamp';
import { Panel } from '../../kit/panel/Panel';
import styles from './StrategyRoom.module.css';

interface LeakMapViewProps {
  readonly store: StrategyStore;
  readonly onDrillSpot?: (spot: {
    readonly position: string;
    readonly familyId: StrategyFamilyId;
  }) => void;
}

function toneForDelta(delta: number | null): HeatTone {
  if (delta === null) return 'neutral';
  if (delta >= 20) return 'overHigh';
  if (delta > 0) return 'overLow';
  if (delta <= -20) return 'underHigh';
  if (delta < 0) return 'underLow';
  return 'okLow';
}

export function LeakMapView({ store, onDrillSpot }: LeakMapViewProps) {
  const leakMap = store.leakMapSignal.value;
  const selectedCellKey = store.selectedLeakCellKeySignal.value;
  const myPlayReport = store.myPlayReportSignal.value;

  const rows: HeatGridRow[] = leakMap.rows.map((row) => ({
    id: row.familyId,
    label: t(`strategy.family.${row.familyId}`),
    cells: row.cells.map((cell): HeatGridCell => {
      const id = `${cell.familyId}|${cell.position}`;
      const label =
        cell.deltaPoints === null
          ? '—'
          : cell.deltaPoints > 0
            ? `+${cell.deltaPoints}`
            : String(cell.deltaPoints);
      return {
        id,
        label,
        ariaLabel: `${t(`strategy.family.${cell.familyId}`)} ${cell.position}: ${label}`,
        tone: toneForDelta(cell.deltaPoints),
      };
    }),
  }));

  const columnFooters: HeatGridColumnFooter[] = leakMap.columnFooters.map((f) => ({
    id: f.position,
    valueLabel: `${f.userOpenPct}%`,
    fillPercent: Math.min(100, f.userOpenPct * 1.6),
    baselinePercent:
      f.baselineOpenPct !== null ? Math.min(100, f.baselineOpenPct * 1.6) : undefined,
    sampleLabel: String(f.openCombos),
  }));

  const sampleHandsCount = leakMap.columnFooters.reduce((sum, f) => sum + f.sampleHands, 0);

  const selectedCell = leakMap.rows
    .flatMap((r) => r.cells)
    .find((c) => `${c.familyId}|${c.position}` === selectedCellKey);

  const selectedPosReal = selectedCell
    ? myPlayReport?.rows.find(
        (r) => r.position.toUpperCase() === selectedCell.position.toUpperCase(),
      ) ?? null
    : null;

  const baseTeacherText = selectedCell
    ? selectedCell.deltaPoints !== null
      ? t('strategy.leakMap.teacherDetail', {
          family: t(`strategy.family.${selectedCell.familyId}`),
          position: selectedCell.position,
          behind: selectedCell.playersBehind,
          delta:
            selectedCell.deltaPoints > 0
              ? `+${selectedCell.deltaPoints}`
              : String(selectedCell.deltaPoints),
        })
      : selectedCell.available
        ? t('strategy.leakMap.unsetFamilyNote', {
            family: t(`strategy.family.${selectedCell.familyId}`),
            position: selectedCell.position,
          })
        : t('strategy.leakMap.unavailableNote', { stack: leakMap.stackDepthBb })
    : leakMap.tier === 'unavailable'
      ? t('strategy.leakMap.unavailableNote', { stack: leakMap.stackDepthBb })
      : t('strategy.leakMap.teacherPick');

  const teacherText = selectedPosReal
    ? `${baseTeacherText} ${t('strategy.leakMap.realPlayInline', {
        position: selectedPosReal.position,
        vpip: formatNumber(selectedPosReal.vpipPct),
        pfr: formatNumber(selectedPosReal.pfrPct),
        hands: formatNumber(selectedPosReal.handsCount),
      })}`
    : baseTeacherText;

  return (
    <div className={styles.splitGrid}>
      <Panel
        label={t('strategy.leakMap.eyebrow')}
        title={t('strategy.leakMap.title')}
        tier={{ tier: leakMap.tier }}
      >
        <HeatGrid
          variant="leakMap"
          ariaLabel={t('strategy.leakMap.aria')}
          columnHeaders={leakMap.positions}
          rows={rows}
          columnFooters={columnFooters}
          footerRowLabel={t('strategy.leakMap.footerLabel')}
          activeId={selectedCellKey}
          animateEntrance={false}
          onActivateCell={(cell) => {
            store.selectedLeakCellKeySignal.value = cell.id;
          }}
        />
        <p className={styles.footnote}>
          {leakMap.tier === 'estimated'
            ? t('strategy.leakMap.note', { count: sampleHandsCount })
            : t('strategy.leakMap.unavailableNote', { stack: leakMap.stackDepthBb })}
        </p>

        <div className={styles.realPlayOverlay}>
          <div className={styles.betweenRow}>
            <span className={styles.spotColHead}>{t('strategy.leakMap.realPlayHeading')}</span>
            {myPlayReport && myPlayReport.totalHands > 0 && myPlayReport.isWatching && (
              <Chip>{t('review.myPlay.watchingShort')}</Chip>
            )}
          </div>
          {!myPlayReport || myPlayReport.rows.length === 0 ? (
            <p className={styles.footnote}>{t('strategy.leakMap.realPlayEmpty')}</p>
          ) : (
            <div className={styles.realPlayRows}>
              {myPlayReport.rows.map((row) => (
                <div key={row.position} className={styles.realPlayRow}>
                  <PokerNotation>{row.position}</PokerNotation>
                  <span className={styles.realPlayStat}>
                    <PokerNotation>{`${formatNumber(row.handsCount)}`}</PokerNotation>
                    {row.isWatching ? ` (${t('review.myPlay.watchingShort')})` : ''}
                  </span>
                  <span className={styles.realPlayStat}>
                    <PokerNotation>{`VPIP ${formatNumber(row.vpipPct)}% · PFR ${formatNumber(row.pfrPct)}% · 3B ${formatNumber(row.threeBetPct)}%`}</PokerNotation>
                  </span>
                  <span className={styles.realPlayStat}>
                    <PokerNotation>{`${row.netBb > 0 ? '+' : ''}${formatNumber(row.netBb)} bb`}</PokerNotation>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <div className={styles.colStack}>
        <TeacherCallout
          heading={t('strategy.leakMap.teacherEyebrow')}
          mood={selectedCell?.deltaPoints ? 'curious' : 'idle'}
          text={teacherText}
          tier={{ tier: leakMap.tier }}
          action={
            selectedCell
              ? {
                  label: t('strategy.spotMap.openBuilder'),
                  onClick: () => {
                    store.selectFamily(selectedCell.familyId as StrategyFamilyId);
                    store.openSpotInBuilder('first_in', selectedCell.position);
                  },
                }
              : undefined
          }
        />
        {selectedCell && onDrillSpot && (
          <div className={styles.actionRow}>
            <Button
              variant="secondary"
              onClick={() =>
                onDrillSpot({
                  position: selectedCell.position,
                  familyId: selectedCell.familyId as StrategyFamilyId,
                })
              }
            >
              {t('strategy.leakMap.drillSpot')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
