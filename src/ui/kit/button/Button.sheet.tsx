import { useState } from 'preact/hooks';
import { t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Panel } from '../panel/Panel';
import { StateMatrix } from '../sheet/StateMatrix';
import styles from '../sheet/KitSheet.module.css';
import { Button } from './Button';

export function ButtonSheetEntry() {
  const [confirmed, setConfirmed] = useState(false);

  const primaryLabel = tNodes('kit.button.confirmBet', {
    amount: <PokerNotation>3.8 bb</PokerNotation>,
  });

  return (
    <Panel title={t('kit.button.sectionTitle')}>
      <StateMatrix
        states={{
          rest: (
            <div className={styles.inlineRow}>
              <Button variant="primary" confirmed={confirmed} onClick={() => setConfirmed((v) => !v)}>
                {primaryLabel}
              </Button>
              <Button variant="secondary">{t('kit.button.openHand')}</Button>
              <Button variant="danger">{t('kit.button.deleteSession')}</Button>
            </div>
          ),
          hover: (
            <div className={styles.inlineRow}>
              <Button variant="primary" forceState="hover">
                {primaryLabel}
              </Button>
              <Button variant="secondary" forceState="hover">
                {t('kit.button.openHand')}
              </Button>
              <Button variant="danger" forceState="hover">
                {t('kit.button.deleteSession')}
              </Button>
            </div>
          ),
          pressed: (
            <div className={styles.inlineRow}>
              <Button variant="primary" forceState="pressed">
                {primaryLabel}
              </Button>
              <Button variant="secondary" forceState="pressed">
                {t('kit.button.openHand')}
              </Button>
            </div>
          ),
          focus: (
            <div className={styles.inlineRow}>
              <Button variant="primary" forceState="focus">
                {primaryLabel}
              </Button>
              <Button variant="secondary" forceState="focus">
                {t('kit.button.openHand')}
              </Button>
            </div>
          ),
          disabled: (
            <div className={styles.inlineRow}>
              <Button variant="primary" disabled>
                {t('kit.button.chooseAction')}
              </Button>
              <Button variant="secondary" disabled>
                {t('kit.button.openHand')}
              </Button>
            </div>
          ),
          loading: (
            <div className={styles.inlineRow}>
              <Button variant="primary" loading>
                {primaryLabel}
              </Button>
            </div>
          ),
          russianLong: (
            <div className={styles.inlineRow}>
              <Button variant="primary">
                {tNodes(
                  'kit.button.russianLong',
                  { amount: <PokerNotation>18.5 bb</PokerNotation> },
                  undefined,
                  'ru',
                )}
              </Button>
            </div>
          ),
        }}
      />
    </Panel>
  );
}
