import { useMemo, useState } from 'preact/hooks';
import {
  computeRunoutSuitAndRankShifts,
  DEFAULT_RUNOUT_SAMPLES,
  REFINED_RUNOUT_SAMPLES,
  type EquityStore,
} from '../../../domain/equity';
import type { EquityStreet } from '../../../domain/storage';
import { formatNumber, formatPercent, t, tNodes } from '../../../i18n';
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
  const players = store.playersSignal.value;
  const street = store.streetSignal.value;
  const board = store.boardSignal.value;
  const turnCard = store.turnCardSignal.value;
  const riverCard = store.riverCardSignal.value;
  const runouts = store.runoutSnapshotSignal.value;
  const deadSet = new Set(store.deadCardsSignal.value);
  const [perspective, setPerspective] = useState<'hero' | 'villain'>('hero');
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const effectivePerspective = players.length === 2 ? perspective : 'hero';
  const invertDelta = effectivePerspective === 'villain';

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
  const expectedRunoutTotal = Math.max(1, 52 - deadSet.size);
  const runoutProgressPct = Math.min(
    100,
    Math.round((runoutRows.length / expectedRunoutTotal) * 100),
  );
  const hasVolatilityShape = !isLoadingRunouts && runoutRows.length > 0;
  let upgrades = 0;
  let bricks = 0;
  let dangers = 0;
  if (hasVolatilityShape) {
    for (const row of runoutRows) {
      const rowWithPct = row as { readonly deltaPct?: number };
      const rawDeltaPct =
        typeof rowWithPct.deltaPct === 'number'
          ? rowWithPct.deltaPct
          : (row.equityDelta ?? 0) * 100;
      const deltaPct = invertDelta ? -rawDeltaPct : rawDeltaPct;
      if (deltaPct >= 5) {
        upgrades += 1;
      } else if (deltaPct <= -5) {
        dangers += 1;
      } else {
        bricks += 1;
      }
    }
  }

  const favorabilitySummary = useMemo(() => {
    if (runoutRows.length === 0) return null;
    const entries = runoutRows
      .filter((r) => r.equity !== null && r.cards[0])
      .map((r) => {
        const pct = invertDelta ? 100 - (r.equity as number) * 100 : (r.equity as number) * 100;
        return { card: r.cards[0]!, equityPct: pct };
      })
      .sort((a, b) => a.equityPct - b.equityPct);
    if (entries.length === 0) return null;
    const favorableCount = entries.filter((e) => e.equityPct >= 50).length;
    const favorablePct = Math.round((favorableCount / entries.length) * 1000) / 10;
    const avgEquityPct =
      Math.round((entries.reduce((sum, e) => sum + e.equityPct, 0) / entries.length) * 10) / 10;
    const worst = entries[0]!;
    const best = entries[entries.length - 1]!;
    return {
      entries,
      favorableCount,
      favorablePct,
      avgEquityPct,
      worst,
      best,
    };
  }, [runoutRows, invertDelta]);

  const gridRows = buildRunoutHeatGridRows({
    rowsByCard: runouts.rowsByCard,
    deadSet,
    isLoading: isLoadingRunouts,
    selectedCardId: street === 'river' ? riverCard : null,
    excludedCardId: street === 'turn' || street === 'river' ? turnCard : null,
    invertDelta,
  });

  const highlightedCardIds = useMemo(() => {
    if (!hoveredGroupId) return undefined;
    const grp = runouts.groups.find((g) => g.effectGroup === hoveredGroupId);
    if (!grp) return undefined;
    return new Set(grp.rows.map((r) => r.cards[0]!));
  }, [hoveredGroupId, runouts.groups]);

  const hoveredRow = hoveredCardId ? runouts.rowsByCard[hoveredCardId] : undefined;
  const hoveredGroup = hoveredCardId
    ? runouts.groups.find((g) => g.rows.some((r) => r.cards[0] === hoveredCardId))?.effectGroup
    : undefined;
  const hoveredEquityPct =
    hoveredRow && hoveredRow.equity !== null
      ? invertDelta
        ? 100 - hoveredRow.equity * 100
        : hoveredRow.equity * 100
      : null;
  const hoveredDeltaPct =
    hoveredRow && hoveredRow.equityDelta !== null
      ? (invertDelta ? -hoveredRow.equityDelta : hoveredRow.equityDelta) * 100
      : null;

  const runoutTier =
    street !== 'preflop' && hasFlop
      ? runouts.method === 'exact'
        ? { tier: 'exact' as const, detail: t('tier.detail.knownCards') }
        : {
            tier: 'estimated' as const,
            detail: t('equity.method.estimated', {
              samples: formatNumber(
                store.refinedSamplesSignal.value ? REFINED_RUNOUT_SAMPLES : DEFAULT_RUNOUT_SAMPLES,
              ),
            }),
          }
      : undefined;

  return (
    <section aria-busy={isLoadingRunouts}>
    <Panel title={panelTitle} tier={runoutTier}>
      <div className={styles.stepperWrap}>
        <SegmentedControl
          ariaLabel={t('equity.stepper.aria')}
          options={streetOptions}
          value={street}
          onChange={(next) => store.setStreet(next)}
        />
        <div className={styles.boardActions}>
          {players.length === 2 && street !== 'preflop' && hasFlop && (
            <SegmentedControl<'hero' | 'villain'>
              ariaLabel={t('equity.runouts.perspectiveAria')}
              options={[
                { value: 'hero', label: t('equity.row.hero') },
                { value: 'villain', label: t('equity.row.villain', { index: 1 }) },
              ]}
              value={effectivePerspective}
              onChange={setPerspective}
            />
          )}
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
            {isLoadingRunouts && (
              <div
                className={styles.runoutProgressTrack}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={runoutProgressPct}
              >
                <div
                  className={styles.runoutProgressFill}
                  style={{ width: `${runoutProgressPct}%` }}
                />
              </div>
            )}
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
            {favorabilitySummary && (
              <div className={styles.favorabilityBlock}>
                <div className={styles.favorabilityMetrics}>
                  <span>
                    {tNodes('equity.runouts.favorableMetric', {
                      pct: (
                        <strong>
                          <PokerNotation>{formatPercent(favorabilitySummary.favorablePct / 100, 0)}</PokerNotation>
                        </strong>
                      ),
                    })}
                  </span>
                  <span>
                    {tNodes('equity.runouts.avgMetric', {
                      pct: (
                        <strong>
                          <PokerNotation>{formatPercent(favorabilitySummary.avgEquityPct / 100, 1)}</PokerNotation>
                        </strong>
                      ),
                    })}
                  </span>
                  <span>
                    <PokerNotation>
                      {`${formatCardGlyph(favorabilitySummary.worst.card)} ${formatPercent(favorabilitySummary.worst.equityPct / 100, 0)} -> ${formatCardGlyph(favorabilitySummary.best.card)} ${formatPercent(favorabilitySummary.best.equityPct / 100, 0)}`}
                    </PokerNotation>
                  </span>
                </div>
                <div
                  className={styles.favorabilityCurve}
                  role="img"
                  aria-label={t('equity.runouts.curveAria', {
                    count: favorabilitySummary.entries.length,
                    pct: formatNumber(favorabilitySummary.favorablePct),
                  })}
                >
                  <span className={styles.favorabilityMidline} aria-hidden="true" />
                  {favorabilitySummary.entries.map((entry) => {
                    const heightPct = Math.max(8, Math.min(100, Math.round(entry.equityPct)));
                    return (
                      <span
                        key={entry.card}
                        className={`${styles.favorabilityTick} ${
                          entry.equityPct >= 50
                            ? styles.favorabilityTickOk
                            : styles.favorabilityTickWarn
                        }`}
                        style={{ blockSize: `${heightPct}%` }}
                        onMouseEnter={() => setHoveredCardId(entry.card)}
                        onMouseLeave={() => setHoveredCardId(null)}
                      />
                    );
                  })}
                </div>
              </div>
            )}
            {hasVolatilityShape && (() => {
              const shifts = computeRunoutSuitAndRankShifts(runoutRows, invertDelta);
              if (shifts.suits.length === 0 && shifts.rankTiers.length === 0) return null;
              return (
                <div className={styles.blockerClassesGroup}>
                  <span className={styles.blockerSubheading}>
                    {t('equity.runouts.suitRankShiftHeading')}
                  </span>
                  <div className={styles.blockerChipRow}>
                    {shifts.suits.map((s) => (
                      <Chip key={`suit-${s.key}`}>
                        <PokerNotation>
                          {`${formatCardGlyph(`A${s.key}`).slice(-1)} ${formatSignedDelta(s.avgDeltaPct)}`}
                        </PokerNotation>
                      </Chip>
                    ))}
                    {shifts.rankTiers.map((tier) => (
                      <Chip key={`tier-${tier.key}`}>
                        <PokerNotation>
                          {`${tier.key} ${formatSignedDelta(tier.avgDeltaPct)}`}
                        </PokerNotation>
                      </Chip>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div dir="ltr">
              <HeatGrid
                variant="runout"
                ariaLabel={
                  street === 'flop'
                    ? t('equity.runouts.gridAriaTurn')
                    : t('equity.runouts.gridAriaRiver')
                }
                rows={gridRows}
                activeId={street === 'river' ? riverCard : null}
                highlightedIds={highlightedCardIds}
                animateEntrance={false}
                onActivateCell={(cell) => store.selectRunoutCard(cell.id)}
                onHoverCell={(cell) => setHoveredCardId(cell ? cell.id : null)}
                onClearActive={() => {
                  store.stepBackWithEscape();
                }}
                legend={[
                  {
                    key: 'helps',
                    label: invertDelta
                      ? t('equity.runouts.legendHelpsVillain')
                      : t('kit.heat.legendHelps'),
                    tone: 'okHigh',
                  },
                  {
                    key: 'hurts',
                    label: invertDelta
                      ? t('equity.runouts.legendHurtsVillain')
                      : t('kit.heat.legendHurts'),
                    tone: 'overHigh',
                  },
                  { key: 'neutral', label: t('kit.heat.cardNeutral', { card: '' }).replace('·', '').trim(), tone: 'neutral' },
                  { key: 'struck', label: t('kit.heat.cardInPlay', { card: '' }).replace('·', '').trim(), tone: 'struck' },
                ]}
              />
            </div>
            <p className={styles.runoutHoverBar}>
              {hoveredRow && hoveredEquityPct !== null ? (
                <PokerNotation>
                  {`${formatCardGlyph(hoveredRow.cards[0]!)} · ${formatPercent(hoveredEquityPct / 100, 1)}${
                    hoveredDeltaPct !== null ? ` (${formatSignedDelta(hoveredDeltaPct)})` : ''
                  }${hoveredGroup ? ` · ${formatEffectGroupLabel(hoveredGroup)}` : ''}`}
                </PokerNotation>
              ) : (
                t('equity.runouts.escapeHint')
              )}
            </p>
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
                  const groupDeltaPct = invertDelta ? -group.avgDeltaPct : group.avgDeltaPct;
                  const isGroupHighlighted = hoveredGroup === group.effectGroup;
                  return (
                    <div
                      key={group.effectGroup}
                      className={
                        isGroupHighlighted
                          ? `${styles.effectRow} ${styles.effectRowHighlighted}`
                          : styles.effectRow
                      }
                      onMouseEnter={() => setHoveredGroupId(group.effectGroup)}
                      onMouseLeave={() => setHoveredGroupId(null)}
                    >
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
                        className={`${styles.effectAvg} ${groupDeltaPct >= 0 ? styles.deltaUp : styles.deltaDown}`}
                      >
                        <PokerNotation>{formatSignedDelta(groupDeltaPct)}</PokerNotation>
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
    </section>
  );
}
