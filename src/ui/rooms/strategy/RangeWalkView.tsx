import { useMemo, useRef, useState } from 'preact/hooks';
import {
  getSharedEngineClient,
  HOLDEM_DECK,
  PREFLOP_MATRIX_RANKS,
} from '../../../engine-api';
import type { StrategyStore } from '../../../domain/strategy';
import {
  analyzeRangeWalkStreet,
  compareRangeWalkClash,
  handClassAtMatrixCell,
  RANGE_WALK_BOARD_PRESETS,
  RANGE_WALK_BUCKETS,
  RANGE_WALK_PRESETS,
  type RangeWalkBucketId,
  type RangeWalkPriorFilter,
  type RangeWalkStreet,
} from '../../../domain/strategy/rangeWalk';
import { formatNumber, t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { Chip } from '../../kit/chip/Chip';
import { ChipButton, SegmentedControl } from '../../kit/choice/Choice';
import { HeatGrid, type HeatGridRow, type HeatTone } from '../../kit/heat-grid/HeatGrid';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import { CardPicker } from '../../kit/playing-card/CardPicker';
import { PlayingCard } from '../../kit/playing-card/PlayingCard';
import styles from './StrategyRoom.module.css';

export interface RangeWalkViewProps {
  readonly store: StrategyStore;
}

function toneForBucket(bucket: RangeWalkBucketId | null): HeatTone {
  switch (bucket) {
    case 'strong':
      return 'okHigh';
    case 'one_pair':
      return 'okLow';
    case 'draw':
      return 'overLow';
    default:
      return 'neutral';
  }
}

function bucketLabel(bucket: RangeWalkBucketId): string {
  switch (bucket) {
    case 'strong':
      return t('strategy.rangeWalk.bucketStrong');
    case 'one_pair':
      return t('strategy.rangeWalk.bucketOnePair');
    case 'draw':
      return t('strategy.rangeWalk.bucketDraw');
    case 'air':
      return t('strategy.rangeWalk.bucketAir');
  }
}

export function RangeWalkView({ store }: RangeWalkViewProps) {
  const [rangeText, setRangeText] = useState('top 15%');
  const [compareVillain, setCompareVillain] = useState(false);
  const [villainRangeText, setVillainRangeText] = useState('top 38%');
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [street, setStreet] = useState<RangeWalkStreet>('flop');
  const [boardFive, setBoardFive] = useState<readonly [string, string, string, string, string]>(
    RANGE_WALK_BOARD_PRESETS[0]!.cards,
  );
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const boardSlotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [keptByStreet, setKeptByStreet] = useState<
    Record<'flop' | 'turn' | 'river', ReadonlySet<RangeWalkBucketId>>
  >(() => ({
    flop: new Set(['strong', 'one_pair', 'draw']),
    turn: new Set(['strong', 'one_pair', 'draw']),
    river: new Set(['strong', 'one_pair', 'draw']),
  }));

  const keptBuckets =
    street === 'preflop' ? new Set(RANGE_WALK_BUCKETS) : keptByStreet[street];

  const matrixProj = store.matrixProjectionSignal.value;
  const strategyPlanClasses = useMemo(() => {
    const raiseClasses = matrixProj.cells
      .filter((c) => c.dominantAction === 'raise')
      .map((c) => c.handClass);
    if (raiseClasses.length > 0) return raiseClasses;
    return matrixProj.cells.filter((c) => c.dominantAction === 'call').map((c) => c.handClass);
  }, [matrixProj]);

  const visibleBoard = useMemo(() => {
    if (street === 'preflop') return [];
    if (street === 'flop') return boardFive.slice(0, 3);
    if (street === 'turn') return boardFive.slice(0, 4);
    return [...boardFive];
  }, [street, boardFive]);

  const priorFilters = useMemo<readonly RangeWalkPriorFilter[]>(() => {
    if (street === 'turn') {
      return [{ board: boardFive.slice(0, 3), keptBuckets: keptByStreet.flop }];
    }
    if (street === 'river') {
      return [
        { board: boardFive.slice(0, 3), keptBuckets: keptByStreet.flop },
        { board: boardFive.slice(0, 4), keptBuckets: keptByStreet.turn },
      ];
    }
    return [];
  }, [street, boardFive, keptByStreet]);

  const analysis = useMemo(
    () =>
      analyzeRangeWalkStreet({
        rangeText,
        board: visibleBoard,
        keptBuckets,
        priorFilters,
        engine: getSharedEngineClient(),
      }),
    [rangeText, visibleBoard, keptBuckets, priorFilters],
  );

  const villainAnalysis = useMemo(() => {
    if (!compareVillain || visibleBoard.length < 3) return null;
    return analyzeRangeWalkStreet({
      rangeText: villainRangeText,
      board: visibleBoard,
      keptBuckets: new Set(RANGE_WALK_BUCKETS),
      engine: getSharedEngineClient(),
    });
  }, [compareVillain, villainRangeText, visibleBoard]);

  const clashSummary = useMemo(() => {
    if (!villainAnalysis || !villainAnalysis.valid || !analysis.valid || analysis.isPreflop) {
      return null;
    }
    return compareRangeWalkClash(analysis, villainAnalysis);
  }, [analysis, villainAnalysis]);

  const selectedCell = selectedClass ? analysis.cellsByClass[selectedClass] ?? null : null;

  const matrixRows: HeatGridRow[] = useMemo(() => {
    return PREFLOP_MATRIX_RANKS.map((_, rowIdx) => ({
      id: `rw-row-${rowIdx}`,
      cells: PREFLOP_MATRIX_RANKS.map((__, colIdx) => {
        const handClass = handClassAtMatrixCell(rowIdx, colIdx);
        const cell = analysis.cellsByClass[handClass];
        if (!cell) {
          return {
            id: handClass,
            label: handClass,
            ariaLabel: handClass,
            tone: 'neutral' as HeatTone,
            disabled: true,
          };
        }
        const tone: HeatTone = analysis.isPreflop
          ? 'okLow'
          : cell.keptLive > 0
            ? toneForBucket(cell.dominantBucket)
            : 'struck';
        return {
          id: handClass,
          label: handClass,
          subLabel: String(analysis.isPreflop ? cell.totalLive : cell.keptLive),
          ariaLabel: `${handClass}: ${analysis.isPreflop ? cell.totalLive : cell.keptLive}`,
          tone,
        };
      }),
    }));
  }, [analysis]);

  const toggleBucket = (bucket: RangeWalkBucketId) => {
    if (street === 'preflop') return;
    setKeptByStreet((prev) => {
      const next = new Set(prev[street]);
      if (next.has(bucket)) next.delete(bucket);
      else next.add(bucket);
      return { ...prev, [street]: next };
    });
  };

  const handleRandomBoard = () => {
    const deck = [...HOLDEM_DECK];
    for (let i = deck.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = deck[i]!;
      deck[i] = deck[j]!;
      deck[j] = tmp;
    }
    setBoardFive([deck[0]!, deck[1]!, deck[2]!, deck[3]!, deck[4]!]);
    if (street === 'preflop') setStreet('flop');
  };

  const streetOptions: Array<{ value: RangeWalkStreet; label: string }> = [
    { value: 'preflop', label: t('recorder.street.preflop') },
    { value: 'flop', label: t('recorder.street.flop') },
    { value: 'turn', label: t('recorder.street.turn') },
    { value: 'river', label: t('recorder.street.river') },
  ];

  return (
    <div className={styles.commitmentStack}>
      <Panel
        label={t('strategy.rangeWalk.eyebrow')}
        title={t('strategy.rangeWalk.title')}
        headingLevel="h2"
        tier={{ tier: 'exact', detail: t('tier.detail.knownCards') }}
      >
        <p className={styles.sectionLead}>{t('strategy.rangeWalk.lead')}</p>

        <div className={styles.rangeWalkControls}>
          <div className={styles.rangeWalkControlBlock}>
            <span className={styles.commitmentControlLabel}>
              {t('strategy.rangeWalk.rangeLabel')}
            </span>
            <div className={styles.rangeWalkInputRow}>
              <input
                type="text"
                className={styles.rangeWalkInput}
                value={rangeText}
                aria-label={t('strategy.rangeWalk.rangeAria')}
                onInput={(e) => setRangeText((e.target as HTMLInputElement).value)}
                dir="ltr"
              />
              <div className={styles.chipGroup}>
                {RANGE_WALK_PRESETS.map((preset) => (
                  <ChipButton
                    key={preset.id}
                    selected={rangeText.trim().toLowerCase() === preset.range}
                    onToggle={() => setRangeText(preset.range)}
                  >
                    {preset.label}
                  </ChipButton>
                ))}
                <ChipButton
                  selected={false}
                  disabled={strategyPlanClasses.length === 0}
                  onToggle={() => {
                    if (strategyPlanClasses.length > 0) {
                      setRangeText(strategyPlanClasses.join(', '));
                    }
                  }}
                >
                  {t('strategy.rangeWalk.loadMyPlan')}
                </ChipButton>
                <ChipButton
                  selected={compareVillain}
                  onToggle={() => setCompareVillain((prev) => !prev)}
                >
                  {t('strategy.rangeWalk.compareToggle')}
                </ChipButton>
              </div>
            </div>
            {compareVillain && (
              <div className={styles.rangeWalkInputRow}>
                <input
                  type="text"
                  className={styles.rangeWalkInput}
                  value={villainRangeText}
                  aria-label={t('strategy.rangeWalk.villainRangeAria')}
                  onInput={(e) => setVillainRangeText((e.target as HTMLInputElement).value)}
                  dir="ltr"
                />
              </div>
            )}
            {!analysis.valid && (
              <span className={styles.rangeWalkError}>{t('strategy.rangeWalk.rangeInvalid')}</span>
            )}
          </div>

          <div className={styles.rangeWalkControlBlock}>
            <span className={styles.commitmentControlLabel}>
              {t('strategy.rangeWalk.boardLabel')}
            </span>
            <div className={styles.rangeWalkInputRow}>
              <SegmentedControl<RangeWalkStreet>
                ariaLabel={t('strategy.rangeWalk.streetAria')}
                options={streetOptions}
                value={street}
                onChange={setStreet}
              />
              <div className={styles.chipGroup}>
                {RANGE_WALK_BOARD_PRESETS.map((bp) => (
                  <ChipButton
                    key={bp.id}
                    selected={boardFive[0] === bp.cards[0] && boardFive[1] === bp.cards[1]}
                    onToggle={() => {
                      setBoardFive(bp.cards);
                      if (street === 'preflop') setStreet('flop');
                    }}
                  >
                    <PokerNotation>{bp.label}</PokerNotation>
                  </ChipButton>
                ))}
                <Button variant="secondary" onClick={handleRandomBoard}>
                  {t('strategy.rangeWalk.randomBoard')}
                </Button>
              </div>
              {visibleBoard.length > 0 && (
                <div className={styles.rangeWalkBoardCards} dir="ltr">
                  {visibleBoard.map((card, slotIdx) => (
                    <button
                      key={`${slotIdx}-${card}`}
                      ref={(el) => {
                        boardSlotRefs.current[slotIdx] = el;
                      }}
                      type="button"
                      className={styles.rangeWalkBoardBtn}
                      aria-label={t('equity.board.slotTitle', { slot: slotIdx + 1 })}
                      onClick={() => setPickerSlot(slotIdx)}
                    >
                      <PlayingCard card={card} size="mini" hoverLift />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <p className={styles.commitmentSummaryBanner}>
          {analysis.isPreflop
            ? t('strategy.rangeWalk.preflopSummary', {
                total: formatNumber(analysis.liveCombos),
                pct: formatNumber(Math.round((analysis.liveCombos / 1326) * 1000) / 10, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }),
              })
            : t('strategy.rangeWalk.retentionSummary', {
                kept: formatNumber(analysis.keptCombos),
                total: formatNumber(analysis.liveCombos),
                pct: formatNumber(analysis.keptPct, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }),
              })}
          {clashSummary && (
            <>
              {' · '}
              {t('strategy.rangeWalk.clashSummary', {
                heroNut: formatNumber(clashSummary.heroNutPct, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }),
                villainNut: formatNumber(clashSummary.villainNutPct, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }),
                heroMade: formatNumber(clashSummary.heroMadePct, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }),
                villainMade: formatNumber(clashSummary.villainMadePct, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }),
              })}
            </>
          )}
        </p>

        <div className={styles.splitGrid}>
          <PanelSection>
            <HeatGrid
              variant="matrix13"
              ariaLabel={t('strategy.rangeWalk.matrixAria')}
              rows={matrixRows}
              activeId={selectedClass}
              onActivateCell={(cell) =>
                setSelectedClass((prev) => (prev === cell.id ? null : cell.id))
              }
              onClearActive={() => setSelectedClass(null)}
              animateEntrance={false}
            />
          </PanelSection>

          <PanelSection label={t('strategy.rangeWalk.breakdownHeading')}>
            {!analysis.isPreflop && (
              <div className={styles.chipGroup}>
                {RANGE_WALK_BUCKETS.map((bucket) => (
                  <ChipButton
                    key={bucket}
                    selected={keptBuckets.has(bucket)}
                    onToggle={() => toggleBucket(bucket)}
                  >
                    {`${bucketLabel(bucket)} (${formatNumber(analysis.bucketCounts[bucket])})`}
                  </ChipButton>
                ))}
              </div>
            )}

            <div className={styles.rangeWalkBars}>
              {RANGE_WALK_BUCKETS.map((bucket) => {
                const count = analysis.bucketCounts[bucket];
                const pct =
                  analysis.liveCombos > 0
                    ? Math.round((count / analysis.liveCombos) * 1000) / 10
                    : 0;
                return (
                  <div key={bucket} className={styles.barRow}>
                    <span className={styles.barLabel}>{bucketLabel(bucket)}</span>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{ transform: `scaleX(${Math.min(1, pct / 100)})` }}
                      />
                    </div>
                    <span className={styles.barNum}>
                      <PokerNotation>
                        {`${formatNumber(count)} (${formatNumber(pct, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}%)`}
                      </PokerNotation>
                    </span>
                  </div>
                );
              })}
            </div>

            {!analysis.isPreflop && (
              <p className={styles.mutedNote}>
                {t('strategy.rangeWalk.blockedNote', {
                  blocked: formatNumber(analysis.blockedCombos),
                })}
                {analysis.foldedPriorCombos > 0
                  ? ` · ${t('strategy.rangeWalk.foldedPriorNote', {
                      folded: formatNumber(analysis.foldedPriorCombos),
                    })}`
                  : ''}
              </p>
            )}

            {selectedCell && selectedCell.combos.length > 0 && (
              <div className={styles.rangeWalkInspector}>
                <span className={styles.commitmentControlLabel}>
                  {t('strategy.rangeWalk.inspectorHeading', {
                    handClass: selectedCell.handClass,
                  })}
                </span>
                <div className={styles.chipGroup} dir="ltr">
                  {selectedCell.combos.map((combo) => (
                    <Chip key={combo.cards.join('')}>
                      <PokerNotation>{combo.cards.join('')}</PokerNotation>
                      {combo.bucket ? ` · ${bucketLabel(combo.bucket)}` : ''}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </PanelSection>
        </div>
      </Panel>

      <CardPicker
        open={pickerSlot !== null}
        onClose={() => setPickerSlot(null)}
        title={t('equity.board.slotTitle', { slot: (pickerSlot ?? 0) + 1 })}
        deadCards={new Set(boardFive.filter((_, idx) => idx !== pickerSlot))}
        selectedCard={pickerSlot !== null ? (boardFive[pickerSlot] ?? null) : null}
        clearLabel={t('equity.board.clearCard')}
        closeLabel={t('equity.board.closePicker')}
        returnFocusTo={pickerSlot !== null ? (boardSlotRefs.current[pickerSlot] ?? null) : null}
        onSelectCard={(card) => {
          if (pickerSlot !== null && card) {
            setBoardFive((prev) => {
              const next = [...prev] as [string, string, string, string, string];
              next[pickerSlot] = card;
              return next;
            });
          }
          setPickerSlot(null);
        }}
      />
    </div>
  );
}
