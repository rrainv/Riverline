import { useState } from 'preact/hooks';
import { t } from '../../../i18n';
import { Button } from '../button/Button';
import { SegmentedControl } from '../choice/Choice';
import { Panel } from '../panel/Panel';
import styles from '../sheet/KitSheet.module.css';
import { FeltTable, type TableCardSpec, type TableMenuSeat, type TableSeat } from './FeltTable';

type TablePhase = 'thinking' | 'action' | 'chips' | 'showdown';
type TableSheetMode = 'hand' | 'menu';

export function FeltTableSheetEntry() {
  const [sheetMode, setSheetMode] = useState<TableSheetMode>('hand');
  const [phase, setPhase] = useState<TablePhase>('action');
  const [chipTrigger, setChipTrigger] = useState(0);
  const [selectedMenu, setSelectedMenu] = useState('drill');

  const baseSeats: TableSeat[] = [
    {
      id: 'hero',
      name: t('kit.table.demo.hero'),
      stack: '97.0 bb',
      isHero: true,
      emblem: 'hero',
      actionBubble: phase === 'action' ? t('kit.table.demo.callsThree') : undefined,
      bet: phase === 'action' ? '3.0 bb' : undefined,
      cards:
        phase === 'showdown'
          ? [
              { card: 'Kc', winning: true, motion: 'flip' },
              { card: 'Qc', dimmed: true, motion: 'flip' },
            ]
          : [{ card: 'Kc' }, { card: 'Qc' }],
    },
    {
      id: 'lyra',
      name: 'Lyra',
      stack: '100 bb',
      styleLine: t('kit.table.demo.styleTight'),
      emblem: 'wave',
      isDealer: true,
      folded: true,
    },
    {
      id: 'orion',
      name: 'Orion',
      stack: '97.0 bb',
      styleLine: t('kit.table.demo.styleLoose'),
      emblem: 'bars',
      thinking: phase === 'thinking',
      actionBubble: phase === 'chips' ? t('kit.table.demo.checks') : undefined,
      bet: phase === 'action' ? '3.0 bb' : undefined,
      cards:
        phase === 'showdown'
          ? [
              { card: 'As', dimmed: true, motion: 'flip' },
              { card: 'Jd', dimmed: true, motion: 'flip' },
            ]
          : [{ state: 'back' }, { state: 'back' }],
    },
    {
      id: 'vega',
      name: 'Vega',
      stack: '99.5 bb',
      styleLine: t('kit.table.demo.styleSteady'),
      emblem: 'prism',
      folded: true,
    },
    {
      id: 'nebula',
      name: 'Nebula',
      stack: '88.5 bb',
      styleLine: t('kit.table.demo.styleCalm'),
      emblem: 'orbits',
      folded: true,
    },
    {
      id: 'astra',
      name: 'Astra',
      stack: '104 bb',
      styleLine: t('kit.table.demo.styleBalanced'),
      emblem: 'arc',
      actionBubble: phase === 'action' ? t('kit.table.demo.raisesNine') : undefined,
      bet: phase === 'action' ? '9.0 bb' : undefined,
      cards:
        phase === 'showdown'
          ? [
              { card: 'Kd', winning: true, motion: 'flip' },
              { card: 'Kh', winning: true, motion: 'flip' },
            ]
          : [{ state: 'back' }, { state: 'back' }],
    },
  ];

  const board: TableCardSpec[] =
    phase === 'showdown'
      ? [
          { card: 'Ks', winning: true },
          { card: '7c', dimmed: true },
          { card: '2h', dimmed: true },
          { card: '4d', winning: true },
          { card: '4s', winning: true },
        ]
      : [
          { card: 'Ks', motion: phase === 'chips' ? 'deal' : 'none' },
          { card: '7c', motion: phase === 'chips' ? 'deal' : 'none' },
          { card: '2h', motion: phase === 'chips' ? 'deal' : 'none' },
          { state: 'slot' },
          { state: 'slot' },
        ];

  const activeSeatId =
    phase === 'thinking' ? 'orion' : phase === 'action' ? 'astra' : phase === 'chips' ? 'hero' : undefined;
  const pot = phase === 'action' ? 7.5 : phase === 'chips' ? 19.5 : phase === 'showdown' ? 42.0 : 4.5;

  const menuSeats: TableMenuSeat[] = [
    {
      id: 'drill',
      title: t('kit.table.menu.drill'),
      subtitle: t('kit.table.menu.drillSub'),
      emblem: 'pie',
      selected: selectedMenu === 'drill',
      onClick: () => setSelectedMenu('drill'),
    },
    {
      id: 'duel',
      title: t('kit.table.menu.duel'),
      subtitle: t('kit.table.menu.duelSub'),
      emblem: 'eye',
      forceState: 'hover',
      onClick: () => setSelectedMenu('duel'),
    },
    {
      id: 'full',
      title: t('kit.table.menu.full'),
      subtitle: t('kit.table.menu.fullSub'),
      emblem: 'grid',
      forceState: 'focus',
      onClick: () => setSelectedMenu('full'),
    },
    {
      id: 'labs',
      title: t('kit.table.menu.labs'),
      subtitle: t('kit.table.menu.labsSub'),
      emblem: 'chart',
      disabled: true,
    },
  ];

  return (
    <Panel title={t('kit.table.sectionTitle')}>
      <div className={styles.inlineRow}>
        <SegmentedControl<TableSheetMode>
          ariaLabel={t('kit.table.sectionTitle')}
          value={sheetMode}
          onChange={setSheetMode}
          options={[
            { value: 'hand', label: t('kit.table.handModeLabel') },
            { value: 'menu', label: t('kit.table.menuModeLabel') },
          ]}
        />
        {sheetMode === 'hand' && (
          <SegmentedControl<TablePhase>
            ariaLabel={t('kit.table.handModeLabel')}
            value={phase}
            onChange={(nextPhase) => {
              setPhase(nextPhase);
              if (nextPhase === 'chips') {
                setChipTrigger((n) => n + 1);
              }
            }}
            options={[
              { value: 'thinking', label: t('kit.table.phaseThinking') },
              { value: 'action', label: t('kit.table.phaseAction') },
              { value: 'chips', label: t('kit.table.phaseChips') },
              { value: 'showdown', label: t('kit.table.phaseShowdown') },
            ]}
          />
        )}
      </div>

      {sheetMode === 'hand' ? (
        <FeltTable
          seats={baseSeats}
          activeSeatId={activeSeatId}
          pot={pot}
          board={board}
          chipsToPotTrigger={chipTrigger}
          chipsToPotSeats={['hero', 'orion', 'astra']}
          showdownResult={phase === 'showdown' ? t('kit.table.demo.showdownResult') : undefined}
        />
      ) : (
        <FeltTable
          mode="menu"
          menuSeats={menuSeats}
          eyebrow={t('kit.table.menu.eyebrow')}
          heading={t('kit.table.menu.heading')}
          body={t('kit.table.menu.body')}
          centerAction={
            <Button variant="primary" onClick={() => setSelectedMenu('drill')}>
              {t('kit.table.menu.cta')}
            </Button>
          }
        />
      )}
    </Panel>
  );
}
