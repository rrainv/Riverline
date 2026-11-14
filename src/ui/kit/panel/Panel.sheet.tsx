import { t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { StateMatrix } from '../sheet/StateMatrix';
import styles from '../sheet/KitSheet.module.css';
import { Panel, PanelSection } from './Panel';

export function PanelSheetEntry() {
  return (
    <section className={styles.specimenBlock} aria-label={t('kit.panel.sectionTitle')}>
      <StateMatrix
        title={t('kit.panel.sectionTitle')}
        states={{
          rest: (
            <Panel
              as="div"
              label={t('kit.panel.sampleLabel')}
              title={<PokerNotation>{t('kit.panel.sampleTitle')}</PokerNotation>}
              tier={{
                tier: 'exact',
                detail: t('tier.detail.priceOnly'),
              }}
            >
              <PanelSection label={t('kit.panel.subGroupLabel')}>
                <div>{t('kit.panel.subGroupBody')}</div>
              </PanelSection>
            </Panel>
          ),
          loading: (
            <Panel
              as="div"
              label={t('kit.panel.sampleLabel')}
              title={<PokerNotation>{t('kit.panel.sampleTitle')}</PokerNotation>}
              loading
            />
          ),
          empty: (
            <Panel
              as="div"
              label={t('kit.panel.sampleLabel')}
              title={<PokerNotation>{t('kit.panel.sampleTitle')}</PokerNotation>}
              tier={{ tier: 'unavailable' }}
              empty={t('kit.panel.emptyText')}
            />
          ),
          russianLong: (
            <Panel
              as="div"
              label={t('kit.panel.sampleLabel', undefined, 'ru')}
              title={t('kit.panel.russianLongTitle', undefined, 'ru')}
              tier={{
                tier: 'estimated',
                source: t('tier.source.baseline', undefined, 'ru'),
              }}
            />
          ),
        }}
      />
    </section>
  );
}
