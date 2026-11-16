import {
  countSetFamiliesInProjection,
  STRATEGY_FAMILIES,
  type StrategySpotSummary,
} from '../../../engine-api';
import { t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import type { StrategyStore } from '../../../domain/strategy';
import { Button } from '../../kit/button/Button';
import { Chip } from '../../kit/chip/Chip';
import { Lamp } from '../../kit/lamp/Lamp';
import { Panel } from '../../kit/panel/Panel';
import { cx } from '../../kit/state';
import styles from './StrategyRoom.module.css';

interface SpotMapViewProps {
  readonly store: StrategyStore;
}

function spotCellSummary(spot: StrategySpotSummary): string {
  if (spot.state === 'cannot_happen') return '';
  if (spot.state === 'not_asked') return '—';
  if (spot.rowId === 'first_in' && spot.openPct !== null) {
    return `${spot.openPct}%`;
  }
  if (spot.raisePct !== null && spot.callPct !== null) {
    return `3b ${spot.raisePct}% · c ${spot.callPct}%`;
  }
  return `${spot.setFamilyCount}/${spot.totalFamilyCount}`;
}

function spotCellSubLabel(spot: StrategySpotSummary): string {
  if (spot.state === 'cannot_happen') return '';
  if (spot.state === 'conflict') return t('strategy.spotMap.cell.conflict');
  if (spot.state === 'in_progress') return t('strategy.spotMap.cell.inProgress');
  if (spot.state === 'set') {
    return spot.rowId === 'first_in'
      ? t('strategy.spotMap.cell.opens')
      : t('strategy.spotMap.state.set');
  }
  return t('strategy.spotMap.cell.notAsked');
}

export function SpotMapView({ store }: SpotMapViewProps) {
  const spotMap = store.spotMapSignal.value;
  const selected = store.selectedSpotSignal.value;

  const selectedCell =
    spotMap.rows
      .flatMap((r) => r.cells)
      .find(
        (c) => c.rowId === selected.rowId && c.position === selected.position,
      ) ?? spotMap.rows[0]?.cells[0];

  const selectedProjection = store.matrixProjectionSignal.value;
  const setFamiliesCount = countSetFamiliesInProjection(selectedProjection);
  const recommended = spotMap.recommendedSpot;

  const colStyle = {
    '--spot-cols': String(spotMap.positions.length),
  } as Record<string, string>;

  return (
    <div className={styles.splitGrid}>
      <div className={styles.colStack}>
        {recommended && (
          <Panel>
            <div className={styles.continueBanner}>
              <div className={styles.continueBody}>
                <Lamp
                  mood={recommended.state === 'conflict' ? 'curious' : 'idle'}
                  size={44}
                />
                <div className={styles.continueText}>
                  <span className={styles.eyebrow}>
                    {t('strategy.spotMap.continueEyebrow')}
                  </span>
                  <strong className={styles.subTitle}>
                    {tNodes('strategy.spotMap.continueTitle', {
                      position: <PokerNotation>{recommended.position}</PokerNotation>,
                      row: t(`strategy.spotMap.row.${recommended.rowId}`),
                    })}
                  </strong>
                  <p className={styles.bodyText}>
                    {recommended.state === 'conflict'
                      ? t('strategy.spotMap.continueConflict', {
                          count: recommended.conflictHands.length,
                        })
                      : t('strategy.spotMap.continueReason', {
                          set: recommended.setFamilyCount,
                          total: recommended.totalFamilyCount,
                        })}
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                onClick={() =>
                  store.openSpotInBuilder(recommended.rowId, recommended.position)
                }
              >
                {t('strategy.spotMap.continueCta')}
              </Button>
            </div>
          </Panel>
        )}

        <Panel
          label={t('strategy.spotMap.eyebrow')}
          title={t('strategy.spotMap.title')}
        >
          <div className={styles.progressRow}>
            <Chip>
              {t('strategy.spotMap.progress', {
                set: spotMap.setSpotsCount,
                total: spotMap.totalValidSpotsCount,
              })}
            </Chip>
            <div className={styles.spotProgressTrack} aria-hidden="true">
              <div
                className={styles.spotProgressFill}
                style={{
                  transform: `scaleX(${
                    spotMap.totalValidSpotsCount > 0
                      ? spotMap.setSpotsCount / spotMap.totalValidSpotsCount
                      : 0
                  })`,
                }}
              />
            </div>
          </div>

          {spotMap.setSpotsCount === 0 && (
            <p className={styles.emptyGuidanceBanner}>{t('strategy.spotMap.emptyGuidance')}</p>
          )}

          <div className={styles.spotGridWrap} style={colStyle}>
            <div className={styles.spotRow}>
              <span />
              {spotMap.positions.map((pos) => (
                <span key={pos} className={styles.spotColHead}>
                  <PokerNotation>{pos}</PokerNotation>
                </span>
              ))}
            </div>

            {spotMap.rows.map((row) => (
              <div key={row.rowId} className={styles.spotRow}>
                <span className={styles.spotRowLabel}>
                  {t(`strategy.spotMap.row.${row.rowId}`)}
                </span>
                {row.cells.map((cell) => {
                  const isSel =
                    cell.rowId === selected.rowId &&
                    cell.position === selected.position;
                  const isNa = cell.state === 'cannot_happen';
                  return (
                    <button
                      key={`${cell.rowId}-${cell.position}`}
                      type="button"
                      disabled={isNa}
                      onClick={() => store.selectSpot(cell.rowId, cell.position)}
                      aria-label={`${cell.position} ${t(`strategy.spotMap.row.${cell.rowId}`)}`}
                      className={cx(
                        styles.spotCell,
                        cell.state === 'set' && styles.spotCellSet,
                        cell.state === 'in_progress' && styles.spotCellProgress,
                        cell.state === 'conflict' && styles.spotCellConflict,
                        isNa && styles.spotCellNa,
                        isSel && styles.spotCellSelected,
                      )}
                    >
                      <span className={styles.spotCellMain}>
                        <PokerNotation>{spotCellSummary(cell)}</PokerNotation>
                      </span>
                      {!isNa && (
                        <span className={styles.spotCellSub}>
                          {spotCellSubLabel(cell)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className={styles.legendRow}>
            <span className={styles.legendItem}>
              <i className={cx(styles.legendSwatch, styles.swatchSet)} />
              {t('strategy.spotMap.state.set')}
            </span>
            <span className={styles.legendItem}>
              <i className={cx(styles.legendSwatch, styles.swatchProgress)} />
              {t('strategy.spotMap.state.in_progress')}
            </span>
            <span className={styles.legendItem}>
              <i className={cx(styles.legendSwatch, styles.swatchEmpty)} />
              {t('strategy.spotMap.state.not_asked')}
            </span>
            <span className={styles.legendItem}>
              <i className={cx(styles.legendSwatch, styles.swatchConflict)} />
              {t('strategy.spotMap.state.conflict')}
            </span>
            <span className={styles.legendItem}>
              <i className={cx(styles.legendSwatch, styles.swatchNa)} />
              {t('strategy.spotMap.state.cannot_happen')}
            </span>
          </div>

          <p className={styles.footnote}>{t('strategy.spotMap.footnote')}</p>
        </Panel>
      </div>

      <div className={styles.colStack}>
        {selectedCell && (
          <Panel
            label={tNodes('strategy.spotMap.continueTitle', {
              position: <PokerNotation>{selectedCell.position}</PokerNotation>,
              row: t(`strategy.spotMap.row.${selectedCell.rowId}`),
            })}
          >
            <div className={styles.betweenRow}>
              <Chip>
                {t(`strategy.spotMap.state.${selectedCell.state}`)}
              </Chip>
              <Button
                variant="primary"
                disabled={selectedCell.state === 'cannot_happen'}
                onClick={() =>
                  store.openSpotInBuilder(
                    selectedCell.rowId,
                    selectedCell.position,
                  )
                }
              >
                {t('strategy.spotMap.openBuilder')}
              </Button>
            </div>
            <p className={styles.bodyText}>
              {selectedCell.state === 'conflict'
                ? tNodes('strategy.spotMap.detail.conflict', {
                    hands: (
                      <PokerNotation>
                        {selectedCell.conflictHands.join(', ')}
                      </PokerNotation>
                    ),
                  })
                : selectedCell.state === 'set'
                  ? t('strategy.spotMap.detail.set')
                  : selectedCell.state === 'in_progress'
                    ? t('strategy.spotMap.detail.inProgress')
                    : t('strategy.spotMap.detail.notAsked')}
            </p>
          </Panel>
        )}

        {selectedCell && selectedCell.conflictHands.length > 0 && (
          <Panel label={t('strategy.conflict.eyebrow')}>
            {selectedCell.conflictHands.map((hand) => (
              <div key={hand} className={styles.colStack}>
                <p className={styles.bodyText}>
                  {tNodes('strategy.conflict.body', {
                    hand: <PokerNotation>{hand}</PokerNotation>,
                  })}
                </p>
                <div className={styles.actionRow}>
                  <Button
                    variant="secondary"
                    onClick={() => void store.resolveConflict(hand, 'keep')}
                  >
                    {t('strategy.conflict.keep')}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void store.resolveConflict(hand, 'change')}
                  >
                    {t('strategy.conflict.change')}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void store.resolveConflict(hand, 'later')}
                  >
                    {t('strategy.conflict.later')}
                  </Button>
                </div>
              </div>
            ))}
            <p className={styles.footnote}>{t('strategy.conflict.note')}</p>
          </Panel>
        )}

        <Panel
          label={t('strategy.spotMap.familiesTitle')}
          title={t('strategy.spotMap.familiesCount', {
            set: setFamiliesCount,
            total: STRATEGY_FAMILIES.length,
          })}
        >
          <div className={styles.familyList}>
            {STRATEGY_FAMILIES.map((family) => {
              const byHand = new Map(
                selectedProjection.cells.map((c) => [c.handClass, c]),
              );
              const setCount = family.hands.filter(
                (h) => byHand.get(h.handClass)?.status !== 'unknown',
              ).length;
              const isFull = setCount === family.hands.length;
              const isPart = setCount > 0 && !isFull;

              return (
                <button
                  key={family.id}
                  type="button"
                  disabled={!selectedCell || selectedCell.state === 'cannot_happen'}
                  className={styles.familyRowBtn}
                  onClick={() => {
                    if (!selectedCell || selectedCell.state === 'cannot_happen') return;
                    store.selectFamily(family.id);
                    store.openSpotInBuilder(selectedCell.rowId, selectedCell.position);
                  }}
                >
                  <i
                    className={cx(
                      styles.familyDot,
                      isFull && styles.familyDotSet,
                      isPart && styles.familyDotPart,
                    )}
                    aria-hidden="true"
                  />
                  <span className={styles.familyName}>{t(`strategy.family.${family.id}`)}</span>
                  <span className={styles.familyStatus}>
                    {isFull
                      ? t('strategy.spotMap.familySet')
                      : isPart
                        ? `${setCount}/${family.hands.length}`
                        : t('strategy.spotMap.familyUnknown')}
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
