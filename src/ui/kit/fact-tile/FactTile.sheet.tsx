import { useState } from 'preact/hooks';
import { t } from '../../../i18n';
import { Button } from '../button/Button';
import { Panel } from '../panel/Panel';
import { StateMatrix } from '../sheet/StateMatrix';
import styles from '../sheet/KitSheet.module.css';
import { FactTile, FactTileRow } from './FactTile';

export function FactTileSheetEntry() {
  const [equityTarget, setEquityTarget] = useState(25.6);

  return (
    <Panel title={t('kit.factTile.sectionTitle')}>
      <StateMatrix
        states={{
          rest: (
            <div className={styles.stack}>
              <FactTileRow>
                <FactTile
                  label={t('kit.factTile.heroEquity')}
                  value={equityTarget}
                  decimals={1}
                  unit="%"
                  tier="exact"
                />
                <FactTile
                  label={t('kit.factTile.potSize')}
                  value={11.5}
                  decimals={1}
                  unit="bb"
                  note={t('kit.factTile.sampleNote')}
                />
              </FactTileRow>
              <div className={styles.inlineRow}>
                <Button
                  variant="secondary"
                  onClick={() => setEquityTarget((prev) => (prev === 25.6 ? 64.2 : 25.6))}
                >
                  {t('kit.factTile.updateDemo')}
                </Button>
              </div>
            </div>
          ),
          loading: (
            <FactTile
              label={t('kit.factTile.heroEquity')}
              value={25.6}
              decimals={1}
              unit="%"
              loading
            />
          ),
          empty: (
            <FactTile
              label={t('kit.factTile.heroEquity')}
              value={null}
              tier="unavailable"
            />
          ),
          russianLong: (
            <FactTile
              label={t('kit.factTile.russianLongLabel', undefined, 'ru')}
              value={24.8}
              decimals={1}
              unit="%"
              note={t('kit.factTile.russianLongNote', undefined, 'ru')}
            />
          ),
        }}
      />
    </Panel>
  );
}
