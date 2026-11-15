import type { StrategyFamilyId } from '../../../engine-api';
import { t } from '../../../i18n';
import type { StrategyStore } from '../../../domain/strategy';
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
}

function toneForDelta(delta: number | null): HeatTone {
  if (delta === null) return 'neutral';
  if (delta >= 20) return 'overHigh';
  if (delta > 0) return 'overLow';
  if (delta <= -20) return 'underHigh';
  if (delta < 0) return 'underLow';
  return 'okLow';
}

export function LeakMapView({ store }: LeakMapViewProps) {
  const leakMap = store.leakMapSignal.value;
  const selectedCellKey = store.selectedLeakCellKeySignal.value;

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
    sampleLabel: String(f.sampleHands),
  }));

  const selectedCell = leakMap.rows
    .flatMap((r) => r.cells)
    .find((c) => `${c.familyId}|${c.position}` === selectedCellKey);

  const teacherText = selectedCell
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
      : t('strategy.leakMap.unavailableNote', { stack: leakMap.stackDepthBb })
    : leakMap.tier === 'unavailable'
      ? t('strategy.leakMap.unavailableNote', { stack: leakMap.stackDepthBb })
      : t('strategy.leakMap.teacherPick');

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
            ? t('strategy.leakMap.note', { count: 0 })
            : t('strategy.leakMap.unavailableNote', { stack: leakMap.stackDepthBb })}
        </p>
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
      </div>
    </div>
  );
}
