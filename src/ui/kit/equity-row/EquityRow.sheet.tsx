import { useState } from 'preact/hooks';
import { t } from '../../../i18n';
import { Button } from '../button/Button';
import { SegmentedControl } from '../choice/Choice';
import { Panel, PanelSection } from '../panel/Panel';
import styles from '../sheet/KitSheet.module.css';
import { EquityList, EquityRow, type EquityRowDensity } from './EquityRow';

interface DemoRow {
  id: string;
  who: string;
  whoMeta?: string;
  isHero?: boolean;
  cards?: Array<{ card?: string; state?: 'face' | 'back' }>;
  rangeLabel?: string;
  equityPct: number;
  previousEquityPct?: number;
  deltaPct?: number;
  rightNowKey: 'kit.equity.factTopPair' | 'kit.equity.factFlushDraw' | 'kit.equity.factUnknown';
}

const INITIAL_ROWS: DemoRow[] = [
  {
    id: 'hero',
    who: 'Hero',
    whoMeta: 'BTN',
    isHero: true,
    cards: [{ card: 'Ah' }, { card: 'Kh' }],
    equityPct: 62.4,
    previousEquityPct: 54.0,
    deltaPct: 8.4,
    rightNowKey: 'kit.equity.factFlushDraw',
  },
  {
    id: 'v1',
    who: 'Astra',
    whoMeta: 'BB',
    rangeLabel: 'QQ+, AK',
    equityPct: 26.8,
    previousEquityPct: 33.0,
    deltaPct: -6.2,
    rightNowKey: 'kit.equity.factTopPair',
  },
  {
    id: 'v2',
    who: 'Orion',
    whoMeta: 'CO',
    cards: [{ state: 'back' }, { state: 'back' }],
    equityPct: 10.8,
    previousEquityPct: 13.0,
    deltaPct: -2.2,
    rightNowKey: 'kit.equity.factUnknown',
  },
];

export function EquityRowSheetEntry() {
  const [density, setDensity] = useState<EquityRowDensity>('dense');
  const [rows, setRows] = useState<DemoRow[]>(INITIAL_ROWS);
  const [expandedId, setExpandedId] = useState<string | null>('hero');

  const reorder = () => {
    setRows((prev) => (prev.length > 1 ? [...prev.slice(1), prev[0]!] : prev));
  };

  const addSeat = () => {
    if (rows.some((r) => r.id === 'v3')) return;
    setRows((prev) => [
      ...prev,
      {
        id: 'v3',
        who: 'Lyra',
        whoMeta: 'SB',
        cards: [{ card: '9s' }, { card: '9d' }],
        equityPct: 18.2,
        previousEquityPct: 21.0,
        deltaPct: -2.8,
        rightNowKey: 'kit.equity.factTopPair',
      },
    ]);
  };

  return (
    <Panel title={t('kit.equity.sectionTitle')}>
      <PanelSection label={t('kit.equity.densityLabel')}>
        <div className={styles.inlineRow}>
          <SegmentedControl<EquityRowDensity>
            ariaLabel={t('kit.equity.densityLabel')}
            value={density}
            onChange={setDensity}
            options={[
              { value: 'roomy', label: t('kit.equity.density.roomy') },
              { value: 'dense', label: t('kit.equity.density.dense') },
              { value: 'compact', label: t('kit.equity.density.compact') },
            ]}
          />
          <Button variant="secondary" onClick={reorder}>
            {t('kit.equity.flipOrder')}
          </Button>
          <Button variant="secondary" onClick={addSeat} disabled={rows.some((r) => r.id === 'v3')}>
            {t('kit.equity.addSeat')}
          </Button>
          <Button variant="secondary" onClick={() => setRows(INITIAL_ROWS)}>
            {t('kit.equity.resetRows')}
          </Button>
        </div>

        <EquityList rowKeys={rows.map((r) => r.id)}>
          {rows.map((row) => (
            <EquityRow
              key={row.id}
              id={row.id}
              who={row.who}
              whoMeta={row.whoMeta}
              isHero={row.isHero}
              cards={row.cards}
              rangeLabel={row.rangeLabel}
              equityPct={row.equityPct}
              previousEquityPct={row.previousEquityPct}
              deltaPct={row.deltaPct}
              rightNow={t(row.rightNowKey)}
              density={density}
              expanded={expandedId === row.id}
              onToggleExpand={() =>
                setExpandedId((cur) => (cur === row.id ? null : row.id))
              }
              expandedContent={t('kit.equity.expandedDetail')}
              onRemove={
                rows.length > 2
                  ? () => setRows((prev) => prev.filter((item) => item.id !== row.id))
                  : undefined
              }
            />
          ))}
        </EquityList>
      </PanelSection>
    </Panel>
  );
}
