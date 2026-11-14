import { useState } from 'preact/hooks';
import { t } from '../../../i18n';
import { Panel } from '../panel/Panel';
import { StateMatrix } from '../sheet/StateMatrix';
import styles from '../sheet/KitSheet.module.css';
import { ChipButton, SegmentedControl, type SegmentOption } from './Choice';

type StreetId = 'preflop' | 'flop' | 'turn' | 'river';

export function ChoiceSheetEntry() {
  const [ipSelected, setIpSelected] = useState(false);
  const [threeBetSelected, setThreeBetSelected] = useState(true);
  const [street, setStreet] = useState<StreetId>('flop');

  const streetOptions: ReadonlyArray<SegmentOption<StreetId>> = [
    { value: 'preflop', label: t('kit.choice.streetPreflop') },
    { value: 'flop', label: t('kit.choice.streetFlop') },
    { value: 'turn', label: t('kit.choice.streetTurn') },
    { value: 'river', label: t('kit.choice.streetRiver') },
  ];

  return (
    <Panel title={t('kit.choice.sectionTitle')}>
      <StateMatrix
        states={{
          rest: (
            <div className={styles.inlineRow}>
              <ChipButton selected={ipSelected} onToggle={setIpSelected}>
                {t('kit.choice.filterInPosition')}
              </ChipButton>
              <SegmentedControl
                ariaLabel={t('kit.choice.streetAria')}
                options={streetOptions}
                value={street}
                onChange={setStreet}
              />
            </div>
          ),
          hover: (
            <div className={styles.inlineRow}>
              <ChipButton selected={false} forceState="hover">
                {t('kit.choice.filterInPosition')}
              </ChipButton>
              <SegmentedControl
                ariaLabel={`${t('kit.choice.streetAria')} (${t('kit.state.hover')})`}
                options={streetOptions}
                value="flop"
                onChange={() => {}}
                forceState="hover"
                forceStateOn="turn"
              />
            </div>
          ),
          pressed: (
            <div className={styles.inlineRow}>
              <ChipButton selected={false} forceState="pressed">
                {t('kit.choice.filterInPosition')}
              </ChipButton>
              <SegmentedControl
                ariaLabel={`${t('kit.choice.streetAria')} (${t('kit.state.pressed')})`}
                options={streetOptions}
                value="flop"
                onChange={() => {}}
                forceState="pressed"
                forceStateOn="turn"
              />
            </div>
          ),
          focus: (
            <div className={styles.inlineRow}>
              <ChipButton selected={false} forceState="focus">
                {t('kit.choice.filterInPosition')}
              </ChipButton>
              <SegmentedControl
                ariaLabel={`${t('kit.choice.streetAria')} (${t('kit.state.focus')})`}
                options={streetOptions}
                value="flop"
                onChange={() => {}}
                forceState="focus"
                forceStateOn="flop"
              />
            </div>
          ),
          disabled: (
            <div className={styles.inlineRow}>
              <ChipButton selected={false} disabled>
                {t('kit.choice.filterInPosition')}
              </ChipButton>
              <SegmentedControl
                ariaLabel={`${t('kit.choice.streetAria')} (${t('kit.state.disabled')})`}
                options={streetOptions}
                value="flop"
                onChange={() => {}}
                disabled
              />
            </div>
          ),
          selected: (
            <div className={styles.inlineRow}>
              <ChipButton selected={threeBetSelected} onToggle={setThreeBetSelected}>
                {t('kit.choice.filterThreeBet')}
              </ChipButton>
              <SegmentedControl
                ariaLabel={`${t('kit.choice.streetAria')} (${t('kit.state.selected')})`}
                options={streetOptions}
                value="turn"
                onChange={() => {}}
              />
            </div>
          ),
          russianLong: (
            <div className={styles.inlineRow}>
              <ChipButton selected>{t('kit.choice.russianLong', undefined, 'ru')}</ChipButton>
            </div>
          ),
        }}
      />
    </Panel>
  );
}
