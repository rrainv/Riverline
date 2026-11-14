import { useState } from 'preact/hooks';
import { t } from '../../../i18n';
import { Panel } from '../panel/Panel';
import { StateMatrix } from '../sheet/StateMatrix';
import styles from '../sheet/KitSheet.module.css';
import { Stepper } from './Stepper';

export function StepperSheetEntry() {
  const [betSize, setBetSize] = useState(3.8);
  const [phoneBuyIn, setPhoneBuyIn] = useState(100);

  return (
    <Panel title={t('kit.stepper.sectionTitle')}>
      <StateMatrix
        states={{
          rest: (
            <div className={styles.inlineRow}>
              <Stepper
                ariaLabel={t('kit.stepper.betSizeLabel')}
                label={t('kit.stepper.betSizeLabel')}
                value={betSize}
                onChange={setBetSize}
                min={1}
                max={100}
                step={0.5}
                decimals={1}
                unit="bb"
              />
              <Stepper
                ariaLabel={t('kit.stepper.buyInLabel')}
                label={t('kit.stepper.buyInLabel')}
                value={phoneBuyIn}
                onChange={setPhoneBuyIn}
                min={20}
                max={500}
                step={20}
                decimals={0}
                unit="bb"
                size="touch"
              />
            </div>
          ),
          hover: (
            <Stepper
              ariaLabel={`${t('kit.stepper.betSizeLabel')} (${t('kit.state.hover')})`}
              value={3.8}
              onChange={() => {}}
              decimals={1}
              unit="bb"
              forceState="hover"
              forceTarget="plus"
            />
          ),
          pressed: (
            <Stepper
              ariaLabel={`${t('kit.stepper.betSizeLabel')} (${t('kit.state.pressed')})`}
              value={3.8}
              onChange={() => {}}
              decimals={1}
              unit="bb"
              forceState="pressed"
              forceTarget="plus"
            />
          ),
          focus: (
            <Stepper
              ariaLabel={`${t('kit.stepper.betSizeLabel')} (${t('kit.state.focus')})`}
              value={3.8}
              onChange={() => {}}
              decimals={1}
              unit="bb"
              forceState="focus"
              forceTarget="minus"
            />
          ),
          disabled: (
            <Stepper
              ariaLabel={`${t('kit.stepper.betSizeLabel')} (${t('kit.state.disabled')})`}
              value={3.8}
              onChange={() => {}}
              decimals={1}
              unit="bb"
              disabled
            />
          ),
          russianLong: (
            <Stepper
              ariaLabel={t('kit.stepper.russianLongLabel', undefined, 'ru')}
              label={t('kit.stepper.russianLongLabel', undefined, 'ru')}
              value={12.5}
              onChange={() => {}}
              decimals={1}
              unit="bb"
            />
          ),
        }}
      />
    </Panel>
  );
}
