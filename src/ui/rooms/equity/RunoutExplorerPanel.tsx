import type { EquityStore } from '../../../domain/equity';
import type { EquityStreet } from '../../../domain/storage';
import { formatNumber, t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { Chip } from '../../kit/chip/Chip';
import { SegmentedControl } from '../../kit/choice/Choice';
import { HeatGrid } from '../../kit/heat-grid/HeatGrid';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import {
  buildRunoutHeatGridRows,
  formatCardGlyph,
  formatEffectGroupLabel,
  formatSignedDelta,
} from './equityFormatters';
import styles from './EquityRoom.module.css';

export function RunoutExplorerPanel({ store }: { store: EquityStore }) {
  const street = store.streetSignal.value;
  const board = store.boardSignal.value;
  const turnCard = store.turnCardSignal.value;
  const riverCard = store.riverCardSignal.value;
  const runouts = store.runoutSnapshotSignal.value;
  const deadSet = new Set(store.deadCardsSignal.value);

  const hasFlop = board.length >= 3;
  const hasTurn = Boolean(turnCard);

  const streetOptions: ReadonlyArray<{ value: EquityStreet; label: string; disabled?: boolean }> = [
    { value: 'preflop', label: t('equity.stepper.preflop') },
    { value: 'flop', label: t('equity.stepper.flop'), disabled: !hasFlop },
    { value: 'turn', label: t('equity.stepper.turn'), disabled: !hasFlop },
    { value: 'river', label: t('equity.stepper.river'), disabled: !hasTurn },
  ];

  const panelTitle =
    street === 'river' && riverCard
      ? tNodes('equity.runouts.titleRiver', {
          card: <PokerNotation>{formatCardGlyph(riverCard)}</PokerNotation>,
        })
      : street === 'turn' && turnCard
        ? tNodes('equity.runouts.titleTurn', {
            card: <PokerNotation>{formatCardGlyph(turnCard)}</PokerNotation>,
          })
        : t('equity.runouts.titleFlop');

  const isLoadingRunouts = runouts.status === 'idle' || runouts.status === 'calculating';

  const runoutRows = Object.values(runouts.rowsByCard);
  const hasVolatilityShape = !isLoadingRunouts && runoutRows.length > 0;
  let upgrades = 0;
  let bricks = 0;
  let dangers = 0;
  if (hasVolatilityShape) {
    for (const row of runoutRows) {
      const rowWithPct = row as { readonly deltaPct?: number };
      const deltaPct =
        typeof rowWithPct.deltaPct === 'number'
          ? rowWithPct.deltaPct
          : (row.equityDelta ?? 0) * 100;
      if (deltaPct >= 5) {
        upgrades += 1;
      } else if (deltaPct <= -5) {
        dangers += 1;
      } else {
        bricks += 1;
      }
    }
  }

  const gridRows = buildRunoutHeatGridRows({
    rowsByCard: runouts.rowsByCard,
    deadSet,
    isLoading: isLoadingRunouts,
    selectedCardId: street === 'river' ? riverCard : null,
    excludedCardId: street === 'turn' || street === 'river' ? turnCard : null,
  });

  return (
    <Panel title={panelTitle}>
      <div className={styles.stepperWrap}>
        <SegmentedControl
          ariaLabel={t('equity.stepper.aria')}
          options={streetOptions}
          value={street}
          onChange={(next) => store.setStreet(next)}
        />
        <div className={styles.boardActions}>
          {street === 'river' && (
            <Button variant="secondary" onClick={() => store.stepBackWithEscape()}>
              {t('equity.runouts.stepBackTurn')}
            </Button>
          )}
          {street === 'turn' && (
            <Button variant="secondary" onClick={() => store.stepBackWithEscape()}>
              {t('equity.runouts.clearTurn')}
            </Button>
          )}
        </div>
      </div>

      {street === 'preflop' || !hasFlop ? (
        <p className={styles.mutedHint}>{t('equity.runouts.preflopHint')}</p>
      ) : (
        <>
          <PanelSection>
            {hasVolatilityShape && (
              <div
                className={styles.volatilityStrip}
                role="group"
                aria-label={t('equity.volatility.heading')}
              >
                <span className={styles.volatilityLabel}>{t('equity.volatility.heading')}</span>
                <div className={styles.volatilityChips}>
                  <Chip>{t('equity.volatility.upgrades', { count: upgrades })}</Chip>
                  <Chip>{t('equity.volatility.bricks', { count: bricks })}</Chip>
                  <Chip>{t('equity.volatility.dangers', { count: dangers })}</Chip>
                </div>
              </div>
            )}
            <HeatGrid
              variant="runout"
              ariaLabel={
                street === 'flop'
                  ? t('equity.runouts.gridAriaTurn')
                  : t('equity.runouts.gridAriaRiver')
              }
              rows={gridRows}
              activeId={street === 'river' ? riverCard : null}
              animateEntrance={false}
              onActivateCell={(cell) => store.selectRunoutCard(cell.id)}
              onClearActive={() => {
                store.stepBackWithEscape();
              }}
              legend={[
                { key: 'helps', label: t('kit.heat.legendHelps'), tone: 'okHigh' },
                { key: 'hurts', label: t('kit.heat.legendHurts'), tone: 'overHigh' },
                { key: 'neutral', label: t('kit.heat.cardNeutral', { card: '' }).replace('·', '').trim(), tone: 'neutral' },
                { key: 'struck', label: t('kit.heat.cardInPlay', { card: '' }).replace('·', '').trim(), tone: 'struck' },
              ]}
            />
            <p className={styles.mutedHint}>{t('equity.runouts.escapeHint')}</p>
          </PanelSection>

          {runouts.groups.length > 0 && (
            <PanelSection label={t('equity.effects.heading')}>
              <div className={styles.effectList}>
                {runouts.groups.map((group) => {
                  const previewCards = group.rows
                    .slice(0, 6)
                    .map((row) => formatCardGlyph(row.cards[0]!))
                    .join(' ');
                  const overflowCount = group.rows.length > 6 ? group.rows.length - 6 : 0;
                  return (
                    <div key={group.effectGroup} className={styles.effectRow}>
                      <div className={styles.effectRowMain}>
                        <span className={styles.effectTitle}>
                          {formatEffectGroupLabel(group.effectGroup)}
                        </span>
                        <span className={styles.effectCardsInline}>
                          <PokerNotation>{previewCards}</PokerNotation>
                          {overflowCount > 0 && (
                            <>
                              {' '}
                              +<PokerNotation>{formatNumber(overflowCount)}</PokerNotation>
                            </>
                          )}
                        </span>
                      </div>
                      <span
                        className={`${styles.effectAvg} ${group.avgDeltaPct >= 0 ? styles.deltaUp : styles.deltaDown}`}
                      >
                        <PokerNotation>{formatSignedDelta(group.avgDeltaPct)}</PokerNotation>
                      </span>
                    </div>
                  );
                })}
              </div>
            </PanelSection>
          )}
        </>
      )}
    </Panel>
  );
}
