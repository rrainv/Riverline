import { t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Panel } from '../panel/Panel';
import { StateMatrix } from '../sheet/StateMatrix';
import styles from '../sheet/KitSheet.module.css';
import { Chip, Kbd, TierBadge } from './Chip';

export function ChipSheetEntry() {
  return (
    <Panel
      title={t('kit.chip.sectionTitle')}
      tier={{
        tier: 'exact',
        detail: t('tier.detail.allRunouts', { count: 990 }),
      }}
    >
      <StateMatrix
        states={{
          rest: (
            <div className={styles.inlineRow}>
              <TierBadge tier="exact" detail={t('tier.detail.allRunouts', { count: 990 })} />
              <TierBadge tier="exact" detail={t('tier.detail.priceOnly')} />
              <TierBadge tier="verified" />
              <TierBadge tier="estimated" source={t('tier.source.baseline')} />
              <Chip>{t('kit.chip.sampleData')}</Chip>
              <Chip>{t('kit.chip.watching', { count: 4 })}</Chip>
              <Kbd>
                <PokerNotation>Ctrl K</PokerNotation>
              </Kbd>
            </div>
          ),
          empty: (
            <div className={styles.inlineRow}>
              <TierBadge tier="unavailable" />
            </div>
          ),
          russianLong: (
            <div className={styles.inlineRow}>
              <Chip>{t('kit.chip.russianLong', undefined, 'ru')}</Chip>
            </div>
          ),
        }}
      />
    </Panel>
  );
}
