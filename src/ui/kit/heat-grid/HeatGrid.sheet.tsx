import { useMemo, useState } from 'preact/hooks';
import { t } from '../../../i18n';
import { Button } from '../button/Button';
import { SegmentedControl } from '../choice/Choice';
import { Panel, PanelSection } from '../panel/Panel';
import {
  HeatGrid,
  type HeatGridCell,
  type HeatGridColumnFooter,
  type HeatGridLegendEntry,
  type HeatGridRow,
  type HeatGridVariant,
  type HeatTone,
  type MatrixCellState,
} from './HeatGrid';
import styles from './HeatGrid.module.css';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
const SUITS = [
  { code: 's', sym: '♠' },
  { code: 'h', sym: '♥' },
  { code: 'd', sym: '♦' },
  { code: 'c', sym: '♣' },
] as const;

const IN_PLAY = new Set(['As', 'Kd', '7h', 'Js', '4h']);
const HELPS_HIGH = new Set(['Ah', 'Ad', 'Ac', 'Ks', 'Kh', 'Th', '9h', '5h']);
const HELPS_LOW = new Set(['Qh', 'Jh', '8h', '6h', '3h', '2h', 'Ts', '9s']);
const HURTS_HIGH = new Set(['Kc', 'Qd', 'Qc', 'Jd', 'Tc', 'Td']);
const HURTS_LOW = new Set(['Qs', 'Jc', '9d', '8d', '8c']);

function buildRunoutRows(): HeatGridRow[] {
  return SUITS.map((suit) => ({
    id: `suit-${suit.code}`,
    cells: RANKS.map((rank): HeatGridCell => {
      const code = `${rank}${suit.code}`;
      const display = `${rank}${suit.sym}`;
      let tone: HeatTone = 'neutral';
      let detail = t('kit.heat.cardNeutral', { card: display });
      const struck = IN_PLAY.has(code);
      if (struck) {
        tone = 'struck';
        detail = t('kit.heat.cardInPlay', { card: display });
      } else if (HELPS_HIGH.has(code)) {
        tone = 'okHigh';
        detail = t('kit.heat.cardHelps', { card: display });
      } else if (HELPS_LOW.has(code)) {
        tone = 'okLow';
        detail = t('kit.heat.cardHelps', { card: display });
      } else if (HURTS_HIGH.has(code)) {
        tone = 'overHigh';
        detail = t('kit.heat.cardHurts', { card: display });
      } else if (HURTS_LOW.has(code)) {
        tone = 'overLow';
        detail = t('kit.heat.cardHurts', { card: display });
      }
      return {
        id: code,
        label: display,
        ariaLabel: detail,
        tone,
        struck,
      };
    }),
  }));
}

function buildLeakRows(): {
  rows: HeatGridRow[];
  columns: string[];
  footers: HeatGridColumnFooter[];
} {
  const columns = [
    t('kit.heat.colBehindOne'),
    t('kit.heat.colBehindTwo'),
    t('kit.heat.colBehindThree'),
    t('kit.heat.colBehindFour'),
  ];

  const data: Array<{
    id: string;
    label: string;
    vals: Array<{
      delta: string;
      n: number;
      tone: HeatTone;
      tick?: boolean;
    }>;
  }> = [
    {
      id: 'pairs',
      label: t('kit.heat.rowPairs'),
      vals: [
        { delta: '+1%', n: 118, tone: 'neutral', tick: true },
        { delta: '+2%', n: 94, tone: 'overLow', tick: true },
        { delta: '0%', n: 81, tone: 'neutral', tick: true },
        { delta: '-4%', n: 109, tone: 'underLow' },
      ],
    },
    {
      id: 'ax',
      label: t('kit.heat.rowAx'),
      vals: [
        { delta: '+8%', n: 146, tone: 'overHigh' },
        { delta: '+5%', n: 122, tone: 'overLow', tick: true },
        { delta: '-2%', n: 97, tone: 'underLow' },
        { delta: '-7%', n: 131, tone: 'underHigh' },
      ],
    },
    {
      id: 'broadways',
      label: t('kit.heat.rowBroadways'),
      vals: [
        { delta: '+3%', n: 152, tone: 'overLow', tick: true },
        { delta: '-1%', n: 119, tone: 'neutral', tick: true },
        { delta: '-6%', n: 104, tone: 'underHigh' },
        { delta: '-9%', n: 88, tone: 'underHigh' },
      ],
    },
    {
      id: 'sc',
      label: t('kit.heat.rowSuitedConn'),
      vals: [
        { delta: '+9%', n: 134, tone: 'overHigh' },
        { delta: '+6%', n: 110, tone: 'overHigh' },
        { delta: '+2%', n: 79, tone: 'overLow', tick: true },
        { delta: '-3%', n: 91, tone: 'underLow' },
      ],
    },
    {
      id: 'weak',
      label: t('kit.heat.rowWeak'),
      vals: [
        { delta: '+7%', n: 168, tone: 'overHigh' },
        { delta: '+4%', n: 141, tone: 'overLow' },
        { delta: '-1%', n: 115, tone: 'neutral', tick: true },
        { delta: '-5%', n: 127, tone: 'underHigh' },
      ],
    },
  ];

  const rows: HeatGridRow[] = data.map((row) => ({
    id: row.id,
    label: row.label,
    cells: row.vals.map((cell, cIdx): HeatGridCell => ({
      id: `${row.id}-c${cIdx}`,
      label: cell.delta,
      subLabel: t('kit.heat.sampleCount', { count: cell.n }),
      ariaLabel: `${row.label}, ${columns[cIdx]}: ${cell.delta} (${t('kit.heat.sampleCount', { count: cell.n })})`,
      tone: cell.tone,
      hasBaselineTick: cell.tick,
    })),
  }));

  const footers: HeatGridColumnFooter[] = [
    { id: 'f0', valueLabel: '47%', fillPercent: 47, baselinePercent: 41, sampleLabel: t('kit.heat.sampleCount', { count: 718 }) },
    { id: 'f1', valueLabel: '35%', fillPercent: 35, baselinePercent: 31, sampleLabel: t('kit.heat.sampleCount', { count: 586 }) },
    { id: 'f2', valueLabel: '22%', fillPercent: 22, baselinePercent: 25, sampleLabel: t('kit.heat.sampleCount', { count: 476 }) },
    { id: 'f3', valueLabel: '14%', fillPercent: 14, baselinePercent: 20, sampleLabel: t('kit.heat.sampleCount', { count: 546 }) },
  ];

  return { rows, columns, footers };
}

function matrixHandName(r: number, c: number): string {
  const r1 = RANKS[r];
  const r2 = RANKS[c];
  if (r === c) return `${r1}${r2}`;
  if (r < c) return `${r1}${r2}s`;
  return `${r2}${r1}o`;
}

function matrixStateFor(r: number, c: number): MatrixCellState {
  if (r === c) return r <= 7 ? 'match' : r <= 10 ? 'yours' : 'unknown';
  if (r < c) {
    // suited above diagonal
    if (r === 0 && c <= 6) return 'match';
    if (r === 0 && c <= 10) return 'yours';
    if (r <= 2 && c <= 5) return 'match';
    if (r <= 4 && c <= 7 && c - r <= 3) return 'baseline';
    if (r <= 6 && c <= 8) return 'unknown';
    return 'unknown';
  }
  // offsuit below diagonal
  if (c === 0 && r <= 4) return 'match';
  if (c === 0 && r === 5) return 'baseline';
  if (c <= 2 && r <= 3) return 'yours';
  return 'unknown';
}

function buildMatrixRows(): HeatGridRow[] {
  const stateText: Record<MatrixCellState, string> = {
    match: t('kit.heat.stateMatch'),
    yours: t('kit.heat.stateYours'),
    baseline: t('kit.heat.stateBaseline'),
    unknown: t('kit.heat.stateUnknown'),
  };

  return RANKS.map((rankRow, r) => ({
    id: `m-row-${rankRow}`,
    cells: RANKS.map((_, c): HeatGridCell => {
      const hand = matrixHandName(r, c);
      const state = matrixStateFor(r, c);
      return {
        id: `m-${hand}`,
        label: hand,
        ariaLabel: `${hand} · ${stateText[state]}`,
        matrixState: state,
      };
    }),
  }));
}

export function HeatGridSheetEntry() {
  const [view, setView] = useState<HeatGridVariant>('runout');
  const [activeId, setActiveId] = useState<string | null>('Th');
  const [replayKey, setReplayKey] = useState(0);

  const runoutRows = useMemo(() => buildRunoutRows(), []);
  const leakData = useMemo(() => buildLeakRows(), []);
  const matrixRows = useMemo(() => buildMatrixRows(), []);

  const viewOptions: Array<{ value: HeatGridVariant; label: string }> = [
    { value: 'runout', label: t('kit.heat.view.runout') },
    { value: 'leakMap', label: t('kit.heat.view.leakMap') },
    { value: 'matrix13', label: t('kit.heat.view.matrix13') },
  ];

  const currentRows =
    view === 'runout' ? runoutRows : view === 'leakMap' ? leakData.rows : matrixRows;

  const activeCell = useMemo(() => {
    if (!activeId) return null;
    for (const row of currentRows) {
      for (const cell of row.cells) {
        if (cell.id === activeId) return cell;
      }
    }
    return null;
  }, [activeId, currentRows]);

  const legend: HeatGridLegendEntry[] =
    view === 'runout'
      ? [
          { key: 'helps', label: t('kit.heat.legendHelps'), tone: 'okHigh' },
          { key: 'hurts', label: t('kit.heat.legendHurts'), tone: 'overHigh' },
          { key: 'inPlay', label: t('kit.heat.cardInPlay', { card: 'As' }).replace(/^As\s*·\s*/, ''), tone: 'struck' },
        ]
      : view === 'leakMap'
        ? [
            { key: 'over', label: t('kit.heat.legendOver'), tone: 'overHigh' },
            { key: 'under', label: t('kit.heat.legendUnder'), tone: 'underHigh' },
            { key: 'tick', label: t('kit.heat.legendBaselineTick'), isTick: true },
          ]
        : [
            { key: 'match', label: t('kit.heat.stateMatch'), matrixState: 'match' },
            { key: 'yours', label: t('kit.heat.stateYours'), matrixState: 'yours' },
            { key: 'baseline', label: t('kit.heat.stateBaseline'), matrixState: 'baseline' },
            { key: 'unknown', label: t('kit.heat.stateUnknown'), matrixState: 'unknown' },
          ];

  const restCell: HeatGridCell = { id: 's-rest', label: 'A♠', ariaLabel: 'A♠', tone: 'neutral' };
  const hoverCell: HeatGridCell = { id: 's-hover', label: 'K♥', ariaLabel: 'K♥', tone: 'okLow', forceState: 'hover' };
  const focusCell: HeatGridCell = { id: 's-focus', label: 'Q♦', ariaLabel: 'Q♦', tone: 'overLow', forceState: 'focus' };
  const pressedCell: HeatGridCell = { id: 's-active', label: 'J♣', ariaLabel: 'J♣', tone: 'okHigh', forceState: 'pressed' };
  const disabledCell: HeatGridCell = { id: 's-struck', label: 'T♠', ariaLabel: 'T♠', tone: 'struck', struck: true };

  return (
    <Panel title={t('kit.heat.sectionTitle')}>
      <div className={styles.sheetCols}>
        <PanelSection label={t('kit.heat.viewLabel')}>
          <div className={styles.stack}>
            <div className={styles.controlsBar}>
              <SegmentedControl<HeatGridVariant>
                ariaLabel={t('kit.heat.viewLabel')}
                options={viewOptions}
                value={view}
                onChange={(nextView) => {
                  setView(nextView);
                  setActiveId(
                    nextView === 'runout' ? 'Th' : nextView === 'leakMap' ? 'ax-c0' : 'm-AKs',
                  );
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="secondary" onClick={() => setActiveId(null)}>
                  {t('kit.heat.clearActive')}
                </Button>
                <Button variant="secondary" onClick={() => setReplayKey((k) => k + 1)}>
                  {t('kit.heat.replayEntrance')}
                </Button>
              </div>
            </div>

            <div className={styles.statusBar}>
              <span>
                {activeCell
                  ? t('kit.heat.activeCellLabel', {
                      label: activeCell.label,
                      detail: activeCell.ariaLabel,
                    })
                  : t('kit.heat.noneFocused')}
              </span>
            </div>

            <HeatGrid
              key={`${view}-${replayKey}`}
              variant={view}
              ariaLabel={
                view === 'runout'
                  ? t('kit.heat.runoutAria')
                  : view === 'leakMap'
                    ? t('kit.heat.leakAria')
                    : t('kit.heat.matrixAria')
              }
              rows={currentRows}
              columnHeaders={view === 'leakMap' ? leakData.columns : undefined}
              columnFooters={view === 'leakMap' ? leakData.footers : undefined}
              footerRowLabel={view === 'leakMap' ? t('kit.heat.footerYouOpen') : undefined}
              activeId={activeId}
              onActivateCell={(cell) =>
                setActiveId((prev) => (prev === cell.id ? null : cell.id))
              }
              onClearActive={() => setActiveId(null)}
              legend={legend}
            />
          </div>
        </PanelSection>

        <PanelSection label={t('kit.heat.statesLabel')}>
          <div className={styles.statesSide}>
            <div className={styles.stateMiniTile}>
              <span>{t('kit.state.rest')}</span>
              <HeatGrid
                variant="runout"
                ariaLabel={t('kit.state.rest')}
                rows={[{ id: 'r1', cells: [restCell] }]}
                animateEntrance={false}
              />
            </div>
            <div className={styles.stateMiniTile}>
              <span>{t('kit.state.hover')}</span>
              <HeatGrid
                variant="runout"
                ariaLabel={t('kit.state.hover')}
                rows={[{ id: 'r2', cells: [hoverCell] }]}
                animateEntrance={false}
              />
            </div>
            <div className={styles.stateMiniTile}>
              <span>{t('kit.state.focus')}</span>
              <HeatGrid
                variant="runout"
                ariaLabel={t('kit.state.focus')}
                rows={[{ id: 'r3', cells: [focusCell] }]}
                animateEntrance={false}
              />
            </div>
            <div className={styles.stateMiniTile}>
              <span>{t('kit.state.pressed')}</span>
              <HeatGrid
                variant="runout"
                ariaLabel={t('kit.state.pressed')}
                rows={[{ id: 'r4', cells: [pressedCell] }]}
                activeId="s-active"
                animateEntrance={false}
              />
            </div>
            <div className={styles.stateMiniTile}>
              <span>{t('kit.state.disabled')}</span>
              <HeatGrid
                variant="runout"
                ariaLabel={t('kit.state.disabled')}
                rows={[{ id: 'r5', cells: [disabledCell] }]}
                animateEntrance={false}
              />
            </div>
          </div>
        </PanelSection>
      </div>
    </Panel>
  );
}
