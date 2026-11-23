import { useState } from 'preact/hooks';
import {
  deriveFamilyCutoffFromProjection,
  familyRaiseCombosFromProjection,
  getStrategyFamily,
  isSpotMapCellPossible,
  playersBehindForPosition,
  positionsForTableSize,
  PREFLOP_MATRIX_RANKS,
  STRATEGY_FAMILIES,
  type StrategyFamilyId,
} from '../../../engine-api';
import { t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import type { StrategyPaintAction, StrategyStore } from '../../../domain/strategy';
import { Button } from '../../kit/button/Button';
import { Chip } from '../../kit/chip/Chip';
import { ChipButton, SegmentedControl } from '../../kit/choice/Choice';
import { FamilyStrip } from '../../kit/family-strip/FamilyStrip';
import {
  HeatGrid,
  type HeatGridCell,
  type HeatGridRow,
  type MatrixCellState,
} from '../../kit/heat-grid/HeatGrid';
import { Panel } from '../../kit/panel/Panel';
import { cx } from '../../kit/state';
import styles from './StrategyRoom.module.css';

interface PlanBuilderViewProps {
  readonly store: StrategyStore;
  readonly onDrillSpot?: (spot: {
    readonly position: string;
    readonly familyId: StrategyFamilyId;
  }) => void;
}

export function PlanBuilderView({ store, onDrillSpot }: PlanBuilderViewProps) {
  const [showMatrixDiff, setShowMatrixDiff] = useState(false);
  const tableSize = store.tableSizeSignal.value;
  const stackDepthBb = store.stackDepthBbSignal.value;
  const selected = store.selectedSpotSignal.value;
  const familyId = store.selectedFamilyIdSignal.value;
  const projection = store.matrixProjectionSignal.value;
  const comparison = store.baselineComparisonSignal.value;
  const baselineRevealed = store.baselineRevealedSignal.value;
  const paintAction = store.paintActionSignal.value;
  const saveStatus = store.saveStatusSignal.value;

  const positions = positionsForTableSize(tableSize);
  const validPositions = positions.filter((pos) =>
    isSpotMapCellPossible(tableSize, selected.rowId, pos),
  );
  const family = getStrategyFamily(familyId);
  const cutoffIndex = deriveFamilyCutoffFromProjection(projection, familyId);
  const behind = playersBehindForPosition(tableSize, selected.position);

  const stripItems = family.hands.map((h) => ({
    id: h.handClass,
    hand: h.handClass,
    combos: h.combos,
  }));

  const isRfi = selected.rowId === 'first_in';

  const diffActive =
    showMatrixDiff &&
    baselineRevealed &&
    comparison.available &&
    comparison.baselineCutoffIndex !== null;
  const familyHandSet = new Set(family.hands.map((h) => h.handClass));
  const baselineHandSet = new Set(
    diffActive
      ? family.hands
          .slice(0, (comparison.baselineCutoffIndex ?? -1) + 1)
          .map((h) => h.handClass)
      : [],
  );

  // Build 13x13 HeatGrid rows
  const matrixRows: HeatGridRow[] = PREFLOP_MATRIX_RANKS.map((rowRank, rowIndex) => {
    const cells: HeatGridCell[] = [];
    for (let colIndex = 0; colIndex < PREFLOP_MATRIX_RANKS.length; colIndex += 1) {
      const cell = projection.cells[rowIndex * PREFLOP_MATRIX_RANKS.length + colIndex]!;
      let matrixState: MatrixCellState = 'unknown';
      if (diffActive && familyHandSet.has(cell.handClass)) {
        const userRaise = cell.dominantAction === 'raise' || cell.dominantAction === 'all_in';
        const baseRaise = baselineHandSet.has(cell.handClass);
        if (userRaise && baseRaise) matrixState = 'match';
        else if (userRaise && !baseRaise) matrixState = 'yours';
        else if (!userRaise && baseRaise) matrixState = 'baseline';
        else matrixState = 'unknown';
      } else if (cell.status !== 'unknown') {
        if (cell.dominantAction === 'raise' || cell.dominantAction === 'all_in') {
          matrixState = 'yours';
        } else if (cell.dominantAction === 'call') {
          matrixState = 'match';
        } else {
          matrixState = 'baseline';
        }
      }
      cells.push({
        id: cell.handClass,
        label: cell.handClass,
        ariaLabel: `${cell.handClass}: ${cell.dominantAction ?? 'unknown'}`,
        matrixState,
      });
    }
    return { id: rowRank, cells };
  });

  const heroPosIdx = positions.indexOf(selected.position);

  const brushOptions: Array<{ value: StrategyPaintAction; label: string }> = [
    { value: 'raise', label: t('strategy.builder.brush.raise') },
    { value: 'call', label: t('strategy.builder.brush.call') },
    { value: 'fold', label: t('strategy.builder.brush.fold') },
    { value: 'clear', label: t('strategy.builder.brush.clear') },
  ];

  return (
    <div className={styles.splitGrid}>
      <div className={styles.colStack}>
        <Panel
          label={`${t('strategy.builder.eyebrow')} · ${t(`strategy.spotMap.row.${selected.rowId}`)}`}
          title={tNodes('strategy.spotMap.continueTitle', {
            position: <PokerNotation>{selected.position}</PokerNotation>,
            row: t(`strategy.family.${familyId}`),
          })}
        >
          <div className={styles.betweenRow}>
            <p className={styles.bodyText}>{t('strategy.builder.stripHint')}</p>
            <Chip>
              {t('strategy.builder.behind', { count: behind })}
            </Chip>
          </div>

          <div className={styles.chipGroup}>
            {validPositions.map((pos) => (
              <ChipButton
                key={pos}
                selected={pos === selected.position}
                onToggle={() => store.selectSpot(selected.rowId, pos)}
              >
                <PokerNotation>{pos}</PokerNotation>
              </ChipButton>
            ))}
          </div>

          <div className={styles.chipGroup}>
            {STRATEGY_FAMILIES.map((f) => (
              <ChipButton
                key={f.id}
                selected={f.id === familyId}
                onToggle={() => store.selectFamily(f.id as StrategyFamilyId)}
              >
                {t(`strategy.family.${f.id}`)}
              </ChipButton>
            ))}
          </div>

          <FamilyStrip
            ariaLabel={t(`strategy.family.${familyId}`)}
            contextLabel={`${selected.position} · ${t(`strategy.spotMap.row.${selected.rowId}`)}`}
            items={stripItems}
            cutoffIndex={cutoffIndex}
            baselineCutoffIndex={
              baselineRevealed && comparison.available && comparison.baselineCutoffIndex !== null
                ? comparison.baselineCutoffIndex
                : undefined
            }
            onChangeCutoff={(nextIdx) => void store.setFamilyCutoff(nextIdx)}
          />

          <div className={styles.betweenRow}>
            <div className={styles.actionRow}>
              <Button
                variant="secondary"
                onClick={() => void store.clearSelectedFamily()}
              >
                {t('strategy.builder.clear')}
              </Button>
              {saveStatus === 'saved' && (
                <span className={styles.footnote}>
                  {t('strategy.builder.saved')}
                </span>
              )}
            </div>
            {isRfi && (
              <div className={styles.actionRow}>
                <Button
                  variant="primary"
                  disabled={cutoffIndex < 0 || baselineRevealed}
                  onClick={() => store.revealBaseline()}
                >
                  {t('strategy.builder.compare')}
                </Button>
                {onDrillSpot && (
                  <Button
                    variant="secondary"
                    onClick={() => onDrillSpot({ position: selected.position, familyId })}
                  >
                    {t('strategy.leakMap.drillSpot')}
                  </Button>
                )}
              </div>
            )}
          </div>
        </Panel>

        <Panel
          label={t('strategy.builder.baselineEyebrow')}
          tier={{
            tier: comparison.available ? 'estimated' : 'unavailable',
          }}
        >
          <div className={styles.seatDotsRow}>
            {positions.map((pos, idx) => (
              <span
                key={pos}
                className={cx(
                  styles.seatDot,
                  idx < heroPosIdx && styles.seatDotFold,
                  idx === heroPosIdx && styles.seatDotHero,
                  idx > heroPosIdx && styles.seatDotBehind,
                )}
              >
                <PokerNotation>{pos}</PokerNotation>
              </span>
            ))}
          </div>

          <div
            key={`${selected.position}-${familyId}-${String(baselineRevealed)}`}
            className={styles.revealSurface}
          >
            {!comparison.available ? (
              <div className={styles.colStack}>
                <strong className={styles.subTitle}>
                  {t('strategy.builder.baselineUnavailableTitle')}
                </strong>
                <p className={styles.bodyText}>
                  {t('strategy.builder.baselineUnavailableBody', {
                    stack: stackDepthBb,
                  })}
                </p>
              </div>
            ) : !baselineRevealed ? (
              <div className={styles.colStack}>
                <strong className={styles.subTitle}>
                  {t('strategy.builder.baselineHiddenTitle')}
                </strong>
                <p className={styles.bodyText}>
                  {t('strategy.builder.baselineHiddenBody')}
                </p>
              </div>
            ) : comparison.deltaHands === 0 ? (
              <div className={styles.colStack}>
                <strong className={styles.subTitle}>
                  {tNodes('strategy.builder.baselineMatchTitle', {
                    hand: (
                      <PokerNotation>
                        {comparison.baselineCutoffHand ?? '—'}
                      </PokerNotation>
                    ),
                  })}
                </strong>
                <p className={styles.bodyText}>
                  {t('strategy.builder.baselineMatchBody')}
                </p>
              </div>
            ) : (
              <div className={styles.colStack}>
                <strong className={styles.subTitle}>
                  {tNodes('strategy.builder.baselineDiffTitle', {
                    user: (
                      <PokerNotation>
                        {comparison.userCutoffHand ?? '—'}
                      </PokerNotation>
                    ),
                    base: (
                      <PokerNotation>
                        {comparison.baselineCutoffHand ?? '—'}
                      </PokerNotation>
                    ),
                  })}
                </strong>
                <p className={styles.bodyText}>
                  {(comparison.deltaHands ?? 0) > 0
                    ? tNodes('strategy.builder.baselineWiderBody', {
                        hands: Math.abs(comparison.deltaHands ?? 0),
                        combos: Math.abs(comparison.deltaCombos ?? 0),
                        position: <PokerNotation>{selected.position}</PokerNotation>,
                        behind,
                      })
                    : tNodes('strategy.builder.baselineTighterBody', {
                        hands: Math.abs(comparison.deltaHands ?? 0),
                        combos: Math.abs(comparison.deltaCombos ?? 0),
                        position: <PokerNotation>{selected.position}</PokerNotation>,
                      })}
                </p>
              </div>
            )}
          </div>

          <p className={styles.footnote}>
            {t('strategy.builder.baselineFootnote')}
          </p>
        </Panel>
      </div>

      <div className={styles.colStack}>
        <Panel label={t('strategy.builder.matrixTitle')}>
          <div className={styles.betweenRow}>
            <span className={styles.footnote}>
              {t('strategy.builder.paintBrush')}
            </span>
            <div className={styles.chipGroup}>
              {baselineRevealed && comparison.available && (
                <ChipButton
                  selected={showMatrixDiff}
                  onToggle={() => setShowMatrixDiff((prev) => !prev)}
                >
                  {t('strategy.builder.diffToggle')}
                </ChipButton>
              )}
              <SegmentedControl
                ariaLabel={t('strategy.builder.paintBrush')}
                options={brushOptions}
                value={paintAction}
                onChange={(val) => store.setPaintAction(val)}
              />
            </div>
          </div>

          <HeatGrid
            variant="matrix13"
            ariaLabel={t('strategy.builder.matrixAria')}
            rows={matrixRows}
            animateEntrance={false}
            onActivateCell={(cell) => void store.paintMatrixCell(cell.id)}
          />
        </Panel>

        <Panel label={t('strategy.builder.openSummaryTitle')}>
          <div className={styles.openBigStat}>
            <PokerNotation>
              {projection.openCombos > 0 ? `${projection.openPct}%` : '—'}
            </PokerNotation>
          </div>
          <p className={styles.bodyText}>
            {projection.openCombos > 0
              ? tNodes('strategy.builder.openSummaryText', {
                  combos: projection.openCombos,
                  position: <PokerNotation>{selected.position}</PokerNotation>,
                })
              : tNodes('strategy.builder.openSummaryEmpty', {
                  position: <PokerNotation>{selected.position}</PokerNotation>,
                })}
          </p>

          <div className={styles.barList}>
            {STRATEGY_FAMILIES.map((f) => {
              const raised = familyRaiseCombosFromProjection(projection, f.id);
              const ratio = f.totalCombos > 0 ? raised / f.totalCombos : 0;
              return (
                <div key={f.id} className={styles.barRow}>
                  <span>{t(`strategy.family.${f.id}`)}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ transform: `scaleX(${ratio})` }}
                    />
                  </div>
                  <strong className={styles.barNum}>{raised}</strong>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
