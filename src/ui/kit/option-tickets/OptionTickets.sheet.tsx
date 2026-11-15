import { useState } from 'preact/hooks';
import { formatNumber, t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { SegmentedControl } from '../choice/Choice';
import { Panel } from '../panel/Panel';
import { StateMatrix } from '../sheet/StateMatrix';
import styles from '../sheet/KitSheet.module.css';
import { OptionTickets, type LadderSizeOption } from './OptionTickets';

const DEFAULT_PRESETS = [6.0, 8.0, 10.5];
type TicketsView = 'interactive' | 'states';

export function OptionTicketsSheetEntry() {
  const [view, setView] = useState<TicketsView>('interactive');
  const [chosenTicket, setChosenTicket] = useState<string | undefined>('raise');
  const [presets, setPresets] = useState<number[]>(DEFAULT_PRESETS);
  const [selectedSizeId, setSelectedSizeId] = useState('s1');
  const [confirmed, setConfirmed] = useState(false);

  const selectedPreset = presets[selectedSizeId === 's0' ? 0 : selectedSizeId === 's1' ? 1 : 2] ?? presets[1]!;

  const sizes: LadderSizeOption[] = presets.map((val, idx) => {
    const id = `s${idx}`;
    const callNeeded = Math.max(0.5, Math.round((val - 2.5) * 10) / 10);
    return {
      id,
      value: val,
      unit: 'bb',
      min: 3.5,
      max: 25,
      step: 0.5,
      costDetail: t('kit.tickets.villainNeeds', {
        amount: `${formatNumber(callNeeded, { maximumFractionDigits: 1 })} bb`,
      }),
      costTier: { tier: 'exact', detail: t('tier.detail.priceOnly') },
    };
  });

  const confirmText =
    chosenTicket === 'fold'
      ? t('kit.tickets.confirmFold')
      : chosenTicket === 'call'
        ? t('kit.tickets.confirmCall', { amount: '2.5 bb' })
        : chosenTicket === 'raise'
          ? t('kit.tickets.confirmRaise', {
              amount: `${formatNumber(selectedPreset, { maximumFractionDigits: 1 })} bb`,
            })
          : t('kit.tickets.confirmPlaceholder');

  return (
    <Panel title={t('kit.tickets.sectionTitle')}>
      <div className={styles.inlineRow}>
        <SegmentedControl<TicketsView>
          ariaLabel={t('kit.tickets.sectionTitle')}
          value={view}
          onChange={setView}
          options={[
            { value: 'interactive', label: t('kit.tickets.interactiveLabel') },
            { value: 'states', label: t('kit.tickets.ariaLabel') },
          ]}
        />
        <span className={styles.specimenEyebrow}>
          {tNodes('kit.tickets.shortcutHint', { key: <PokerNotation>1 · 2 · 3</PokerNotation> })}
        </span>
      </div>

      {view === 'interactive' ? (
        <OptionTickets
          tickets={[
            { id: 'fold', shortcut: '1', label: t('kit.tickets.fold') },
            { id: 'call', shortcut: '2', label: t('kit.tickets.call'), amount: '2.5 bb' },
            {
              id: 'raise',
              shortcut: '3',
              label: t('kit.tickets.raiseTo'),
              amount: `${formatNumber(selectedPreset, { maximumFractionDigits: 1 })} bb`,
            },
          ]}
          selectedTicketId={chosenTicket}
          onSelectTicket={(id) => {
            setChosenTicket(id);
            setConfirmed(false);
          }}
          sizes={sizes}
          selectedSizeId={selectedSizeId}
          onSelectSize={(id) => {
            setSelectedSizeId(id);
            setConfirmed(false);
          }}
          onAdjustSize={(id, nextVal) => {
            const idx = Number(id.slice(1));
            setPresets((prev) => prev.map((v, i) => (i === idx ? nextVal : v)));
            setConfirmed(false);
          }}
          onResetSizes={() => {
            setPresets(DEFAULT_PRESETS);
            setSelectedSizeId('s1');
            setConfirmed(false);
          }}
          confirmLabel={confirmText}
          confirmed={confirmed}
          onConfirm={() => setConfirmed(true)}
        />
      ) : (
        <StateMatrix
          states={{
            rest: (
              <OptionTickets
                showConfirm={false}
                tickets={[
                  { id: 'f', shortcut: '1', label: t('kit.tickets.fold') },
                  { id: 'c', shortcut: '2', label: t('kit.tickets.call'), amount: '2.5 bb' },
                ]}
                onSelectTicket={() => {}}
              />
            ),
            hover: (
              <OptionTickets
                showConfirm={false}
                tickets={[
                  { id: 'c', shortcut: '2', label: t('kit.tickets.call'), amount: '2.5 bb', forceState: 'hover' },
                ]}
                onSelectTicket={() => {}}
              />
            ),
            pressed: (
              <OptionTickets
                showConfirm={false}
                tickets={[
                  { id: 'c', shortcut: '2', label: t('kit.tickets.call'), amount: '2.5 bb', forceState: 'pressed' },
                ]}
                onSelectTicket={() => {}}
              />
            ),
            focus: (
              <OptionTickets
                showConfirm={false}
                tickets={[
                  { id: 'c', shortcut: '2', label: t('kit.tickets.call'), amount: '2.5 bb', forceState: 'focus' },
                ]}
                onSelectTicket={() => {}}
              />
            ),
            disabled: (
              <OptionTickets
                showConfirm={false}
                tickets={[
                  { id: 'r', shortcut: '3', label: t('kit.tickets.raiseTo'), amount: '8.0 bb', disabled: true },
                ]}
                onSelectTicket={() => {}}
              />
            ),
            selected: (
              <OptionTickets
                showConfirm={false}
                selectedTicketId="c"
                tickets={[
                  { id: 'f', shortcut: '1', label: t('kit.tickets.fold') },
                  { id: 'c', shortcut: '2', label: t('kit.tickets.call'), amount: '2.5 bb' },
                ]}
                onSelectTicket={() => {}}
              />
            ),
            russianLong: (
              <div className={styles.inlineRow}>
                <OptionTickets
                  showConfirm={false}
                  selectedTicketId="r"
                  tickets={[
                    {
                      id: 'r',
                      shortcut: '3',
                      label: t('kit.tickets.russianLongLabel', undefined, 'ru'),
                      amount: '18.5 bb',
                    },
                  ]}
                  onSelectTicket={() => {}}
                />
              </div>
            ),
          }}
        />
      )}
    </Panel>
  );
}
