import { useMemo, useState } from 'preact/hooks';
import {
  PREFLOP_HAND_CLASSES,
  PREFLOP_MATRIX_RANKS,
} from '../../../engine-api';
import { t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { ChipButton } from '../../kit/choice/Choice';
import { FactTile, FactTileRow } from '../../kit/fact-tile/FactTile';
import { HeatGrid, type HeatGridRow, type HeatTone } from '../../kit/heat-grid/HeatGrid';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import { PlayingCard } from '../../kit/playing-card/PlayingCard';
import styles from './TrainingRoom.module.css';

interface HandReadingScenario {
  readonly id: string;
  readonly lineSummary: string;
  readonly board: readonly string[];
  readonly prompt: string;
  readonly targetClasses: readonly string[];
}

const SCENARIOS: readonly HandReadingScenario[] = [
  {
    id: 'co-cbet-dry-k72',
    lineSummary: '6-max 100 bb · CO opens 2.5 bb, BTN calls',
    board: ['Ks', '7d', '2c'],
    prompt: 'CO c-bets 33% pot on this dry K-high board. Narrow CO’s value + bluff c-betting range.',
    targetClasses: [
      'AA', 'KK', 'QQ', 'JJ', 'TT', '77', '22',
      'AKs', 'AKo', 'KQs', 'KQo', 'KJs', 'KTs', 'K9s',
      'AQs', 'AJs', 'ATs', 'QJs', 'JTs', 'T9s', '98s', '87s', '65s', '54s',
    ],
  },
  {
    id: 'btn-3bet-aq5',
    lineSummary: '6-max 100 bb · BTN opens 2.5 bb, BB 3-bets 10 bb, BTN calls',
    board: ['Ah', 'Qc', '5s'],
    prompt: 'BB c-bets 50% pot in a 3-bet pot. Narrow BB’s continuing c-bet range.',
    targetClasses: [
      'AA', 'QQ', '55', 'KK', 'JJ',
      'AKs', 'AKo', 'AQs', 'AQo', 'AJs', 'ATs', 'A5s', 'A4s',
      'KQs', 'KJs', 'QJs', 'JTs', 'T9s', '98s', '76s',
    ],
  },
  {
    id: 'utg-check-986',
    lineSummary: '6-max 100 bb · UTG opens 2.5 bb, BB calls',
    board: ['9s', '8s', '6d'],
    prompt: 'UTG checks back on a coordinated 9-8-6 two-tone flop. Which hands stay in UTG’s check range?',
    targetClasses: [
      'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77',
      'AKs', 'AQs', 'AJs', 'KQs', 'KJs', 'QJs', 'A9s', 'K9s', 'T9s', '98s', '87s', '76s',
    ],
  },
  {
    id: 'sb-bb-srp-j62',
    lineSummary: '6-max 100 bb · SB opens 3 bb, BB calls',
    board: ['Jh', '6c', '2d'],
    prompt: 'BB calls a 33% flop c-bet. Narrow BB’s continuing defend range.',
    targetClasses: [
      'JJ', '66', '22', 'TT', '99', '88', '77', '55', '44', '33',
      'AJs', 'AJo', 'KJs', 'KJo', 'QJs', 'JTs', 'J9s',
      'A6s', 'K6s', '76s', '65s', 'A2s', 'KQs', 'QTs', 'T9s', '98s', '54s',
    ],
  },
];

function isBroadways(hc: string): boolean {
  const r1 = hc[0]!;
  const r2 = hc[1]!;
  const b = new Set(['A', 'K', 'Q', 'J', 'T']);
  return b.has(r1) && b.has(r2);
}

export function HandReadingDrillView() {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [checked, setChecked] = useState(false);

  const scenario = SCENARIOS[scenarioIdx % SCENARIOS.length]!;
  const targetSet = useMemo(() => new Set(scenario.targetClasses), [scenario]);

  const toggleClass = (hc: string) => {
    if (checked) setChecked(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(hc)) next.delete(hc);
      else next.add(hc);
      return next;
    });
  };

  const applyBrush = (pred: (hc: string) => boolean) => {
    setChecked(false);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const hc of PREFLOP_HAND_CLASSES) {
        if (pred(hc)) next.add(hc);
      }
      return next;
    });
  };

  const metrics = useMemo(() => {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (const hc of PREFLOP_HAND_CLASSES) {
      const inSel = selected.has(hc);
      const inTgt = targetSet.has(hc);
      if (inSel && inTgt) tp += 1;
      else if (inSel && !inTgt) fp += 1;
      else if (!inSel && inTgt) fn += 1;
    }
    const union = tp + fp + fn;
    const overlapPct = union > 0 ? Math.round((tp / union) * 100) : 0;
    const precisionPct = tp + fp > 0 ? Math.round((tp / (tp + fp)) * 100) : 0;
    const recallPct = tp + fn > 0 ? Math.round((tp / (tp + fn)) * 100) : 0;
    return { tp, fp, fn, overlapPct, precisionPct, recallPct };
  }, [selected, targetSet]);

  const gridRows: HeatGridRow[] = PREFLOP_MATRIX_RANKS.map((rowRank, r) => ({
    id: rowRank,
    label: rowRank,
    cells: PREFLOP_MATRIX_RANKS.map((colRank, c) => {
      const hc = r === c ? `${rowRank}${colRank}` : r < c ? `${rowRank}${colRank}s` : `${colRank}${rowRank}o`;
      const inSel = selected.has(hc);
      const inTgt = targetSet.has(hc);
      let tone: HeatTone = 'neutral';
      if (checked) {
        if (inSel && inTgt) tone = 'okHigh';
        else if (inSel && !inTgt) tone = 'overLow';
        else if (!inSel && inTgt) tone = 'underLow';
      } else if (inSel) {
        tone = 'okLow';
      }
      return {
        id: hc,
        label: hc,
        tone,
        ariaLabel: hc,
      };
    }),
  }));

  return (
    <div className={styles.column}>
      <Panel
        title={t('training.handReading.heading')}
        label={t('training.title')}
        tier={{ tier: 'estimated', detail: t('training.handReading.tierDetail') }}
      >
        <div className={styles.spotSummary}>
          <p className={styles.spotMeta}>
            <PokerNotation>{scenario.lineSummary}</PokerNotation>
          </p>
          <div className={styles.handCards}>
            {scenario.board.map((card) => (
              <PlayingCard key={card} card={card} size="small" />
            ))}
          </div>
          <p className={styles.promptText}>{scenario.prompt}</p>

          <PanelSection label={t('training.handReading.brushesLabel')}>
            <div className={styles.filterGroup}>
              <ChipButton selected={false} onToggle={() => applyBrush((hc) => hc.length === 2)}>
                {t('strategy.family.pairs')}
              </ChipButton>
              <ChipButton selected={false} onToggle={() => applyBrush(isBroadways)}>
                {t('training.handReading.brushBroadways')}
              </ChipButton>
              <ChipButton selected={false} onToggle={() => applyBrush((hc) => hc.endsWith('s'))}>
                {t('training.handReading.brushSuited')}
              </ChipButton>
              <Button
                variant="secondary"
                onClick={() => {
                  setChecked(false);
                  setSelected(new Set());
                }}
              >
                {t('training.handReading.clearBtn')}
              </Button>
            </div>
          </PanelSection>

          <div dir="ltr">
            <HeatGrid
              variant="matrix13"
              ariaLabel={t('training.handReading.heading')}
              rows={gridRows}
              onActivateCell={(cell) => toggleClass(cell.id)}
            />
          </div>

          <div className={styles.actionRow}>
            <Button
              variant="primary"
              disabled={selected.size === 0}
              onClick={() => setChecked(true)}
            >
              {t('training.handReading.checkBtn')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setScenarioIdx((prev) => (prev + 1) % SCENARIOS.length);
                setSelected(new Set());
                setChecked(false);
              }}
            >
              {t('training.handReading.nextBtn')}
            </Button>
          </div>

          {checked && (
            <FactTileRow>
              <FactTile label={t('training.handReading.overlap')} value={metrics.overlapPct} decimals={0} unit="%" instant />
              <FactTile label={t('training.handReading.precision')} value={metrics.precisionPct} decimals={0} unit="%" instant />
              <FactTile label={t('training.handReading.recall')} value={metrics.recallPct} decimals={0} unit="%" instant />
            </FactTileRow>
          )}
        </div>
      </Panel>
    </div>
  );
}
