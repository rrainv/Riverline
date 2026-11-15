import { useState } from 'preact/hooks';
import { t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../button/Button';
import { SegmentedControl } from '../choice/Choice';
import { Panel, PanelSection } from '../panel/Panel';
import styles from '../sheet/KitSheet.module.css';
import {
  HistoryRail,
  StreetStrip,
  type HistoryStreetGroup,
  type StreetStripItem,
} from './HistoryRail';

export function HistoryRailSheetEntry() {
  const [view, setView] = useState<'rail' | 'strip'>('rail');
  const [currentRowId, setCurrentRowId] = useState('flop-cbet');
  const [currentStreetId, setCurrentStreetId] = useState('flop');
  const [extraTurnRow, setExtraTurnRow] = useState(false);

  const groups: HistoryStreetGroup[] = [
    {
      id: 'pre',
      streetLabel: t('kit.choice.streetPreflop'),
      potLabel: '1.5 bb',
      rows: [
        {
          id: 'pre-open',
          actor: 'CO',
          action: tNodes('kit.history.actRaiseTo', { amount: <PokerNotation>2.5 bb</PokerNotation> }),
        },
        {
          id: 'pre-hero',
          actor: 'Hero',
          isHero: true,
          action: tNodes('kit.history.actRaiseTo', { amount: <PokerNotation>8.0 bb</PokerNotation> }),
          tag: t('kit.history.tagThreeBet'),
        },
        {
          id: 'pre-call',
          actor: 'CO',
          action: t('kit.tickets.call'),
        },
      ],
    },
    {
      id: 'flop',
      streetLabel: t('kit.choice.streetFlop'),
      potLabel: '17.5 bb',
      rows: [
        {
          id: 'flop-check',
          actor: 'CO',
          action: t('kit.history.actCheck'),
        },
        {
          id: 'flop-cbet',
          actor: 'Hero',
          isHero: true,
          action: tNodes('kit.history.actBet', { amount: <PokerNotation>6.0 bb</PokerNotation> }),
        },
      ],
    },
    ...(extraTurnRow
      ? [
          {
            id: 'turn',
            streetLabel: t('kit.choice.streetTurn'),
            potLabel: '29.5 bb',
            rows: [
              {
                id: 'turn-call',
                actor: 'CO',
                action: t('kit.history.actCheck'),
              },
              {
                id: 'turn-hero',
                actor: 'Hero',
                isHero: true,
                action: tNodes('kit.history.actBet', {
                  amount: <PokerNotation>18.0 bb</PokerNotation>,
                }),
              },
            ],
          },
        ]
      : []),
  ];

  const streets: StreetStripItem[] = [
    {
      id: 'preflop',
      streetLabel: t('kit.choice.streetPreflop'),
      result: tNodes('kit.history.resRaiseTo', { amount: <PokerNotation>8.0 bb</PokerNotation> }),
      pot: '17.5 bb',
      spr: '5.2',
    },
    {
      id: 'flop',
      streetLabel: t('kit.choice.streetFlop'),
      cards: ['Qh', '7c', '2h'],
      result: tNodes('kit.history.resCbetCalled', { amount: <PokerNotation>6.0 bb</PokerNotation> }),
      pot: '29.5 bb',
      spr: '2.9',
    },
    {
      id: 'turn',
      streetLabel: t('kit.choice.streetTurn'),
      cards: ['4c'],
      result: tNodes('kit.history.resBetFold', { amount: <PokerNotation>18.0 bb</PokerNotation> }),
      pot: '47.5 bb',
      spr: '1.5',
    },
    {
      id: 'river',
      streetLabel: t('kit.choice.streetRiver'),
      cards: ['9s'],
      result: t('kit.history.resUnreached'),
      pot: '29.5 bb',
      spr: '1.5',
      disabled: true,
    },
  ];

  return (
    <Panel title={t('kit.history.sectionTitle')}>
      <div className={styles.inlineRow}>
        <SegmentedControl<'rail' | 'strip'>
          ariaLabel={t('kit.history.sectionTitle')}
          value={view}
          onChange={setView}
          options={[
            { value: 'rail', label: t('kit.history.railLabel') },
            { value: 'strip', label: t('kit.history.stripLabel') },
          ]}
        />
        {view === 'rail' && (
          <Button
            variant="secondary"
            onClick={() => {
              setExtraTurnRow((v) => !v);
              setCurrentRowId((cur) => (cur === 'turn-hero' ? 'flop-cbet' : 'turn-hero'));
            }}
          >
            {extraTurnRow ? t('kit.history.resetRow') : t('kit.history.appendRow')}
          </Button>
        )}
      </div>

      {view === 'rail' ? (
        <PanelSection label={t('kit.history.railLabel')}>
          <HistoryRail
            groups={groups}
            currentRowId={currentRowId}
            onSelectRow={setCurrentRowId}
            forceRowState={{ rowId: 'pre-open', state: 'hover' }}
          />
        </PanelSection>
      ) : (
        <PanelSection label={t('kit.history.stripLabel')}>
          <StreetStrip
            streets={streets}
            currentStreetId={currentStreetId}
            onSelectStreet={setCurrentStreetId}
          />
        </PanelSection>
      )}
    </Panel>
  );
}
