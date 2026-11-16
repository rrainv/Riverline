import type { EquityStore } from '../../../domain/equity';
import type { EquityStreet } from '../../../domain/storage';
import { CARD_RANKS, CARD_SUITS } from '../../../engine-api';
import { formatNumber, t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { SegmentedControl } from '../../kit/choice/Choice';
import { HeatGrid, type HeatGridRow, type HeatTone } from '../../kit/heat-grid/HeatGrid';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import {
  formatCardGlyph,
  formatEffectGroupLabel,
  formatSignedDelta,
} from './equityFormatters';
import styles from './EquityRoom.module.css';

const RANKS_HIGH_TO_LOW = [...CARD_RANKS].reverse();
const SUITS_LIST = [...CARD_SUITS];

function toneForDelta(deltaFraction: number | null, inPlay: boolean): HeatTone {
  if (inPlay) return 'struck';
  if (deltaFraction === null) return 'neutral';
  const pct = deltaFraction * 100;
  if (pct >= 8) return 'okHigh';
  if (pct >= 2) return 'okLow';
  if (pct <= -8) return 'overHigh';
  if (pct <= -2) return 'overLow';
  return 'neutral';
}

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

  const gridRows: HeatGridRow[] = SUITS_LIST.map((suit) => ({
    id: suit,
    cells: RANKS_HIGH_TO_LOW.map((rank) => {
      const code = `${rank}${suit}`;
      const row = runouts.rowsByCard[code];
      const isSelected = street === 'river' && riverCard === code;
      // When choosing/viewing the turn card or river card, board flop + player cards + picked turn card are struck
      const struck =
        row === undefined ||
        (deadSet.has(code) && !isSelected) ||
        ((street === 'turn' || street === 'river') && turnCard === code);
      const label = formatCardGlyph(code);
      const tone = toneForDelta(row?.equityDelta ?? null, struck);
      const ariaLabel = struck
        ? t('kit.heat.cardInPlay', { card: label })
        : row && row.equityDelta !== null && row.equityDelta > 0.02
          ? t('kit.heat.cardHelps', { card: label })
          : row && row.equityDelta !== null && row.equityDelta < -0.02
            ? t('kit.heat.cardHurts', { card: label })
            : t('kit.heat.cardNeutral', { card: label });

      return {
        id: code,
        label,
        ariaLabel,
        tone,
        struck,
        disabled: struck,
      };
    }),
  }));

  return (
    <Panel title={panelTitle}>
      <div
        className={styles.stepperWrap}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && store.stepBackWithEscape()) {
            e.preventDefault();
          }
        }}
      >
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
