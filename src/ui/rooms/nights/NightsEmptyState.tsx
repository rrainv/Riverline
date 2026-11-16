import { t } from '../../../i18n';
import type { NightsStore } from '../../../domain/nights';
import { Button } from '../../kit/button/Button';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import { PlayingCardPair } from '../../kit/playing-card/PlayingCard';
import styles from './NightsRoom.module.css';

interface NightsEmptyStateProps {
  readonly store: NightsStore;
}

/**
 * Shared honest empty state for Game Night tabs when no night is open.
 */
export function NightsEmptyState({ store }: NightsEmptyStateProps) {
  const pastCount = store.sessionsSignal.value.length;

  return (
    <Panel>
      <div className={styles.emptyHero}>
        <div className={styles.emptyArt} aria-hidden="true">
          <PlayingCardPair card="Ah" size="large" />
        </div>

        <div className={styles.emptyCopy}>
          <span className={styles.sectionHeadingAccent}>{t('nights.title')}</span>
          <h2 className={styles.emptyTitle}>{t('nights.ledger.noNightTitle')}</h2>
          <p className={styles.emptyBody}>{t('nights.ledger.noNightBody')}</p>
        </div>

        <div className={styles.emptyActions}>
          <Button variant="primary" onClick={() => store.setCreateModalOpen(true)}>
            {t('nights.actions.newNight')}
          </Button>
          {pastCount > 0 && (
            <Button variant="secondary" onClick={() => store.setActiveTab('past')}>
              {t('nights.rail.past')}
            </Button>
          )}
        </div>
      </div>

      <PanelSection>
        <div className={styles.emptyGuideGrid}>
          <div className={styles.emptyGuideCard}>
            <strong className={styles.emptyGuideTitle}>{t('nights.empty.stepBuyInsTitle')}</strong>
            <p className={styles.emptyGuideBody}>{t('nights.empty.stepBuyInsBody')}</p>
          </div>
          <div className={styles.emptyGuideCard}>
            <strong className={styles.emptyGuideTitle}>{t('nights.empty.stepSettleTitle')}</strong>
            <p className={styles.emptyGuideBody}>{t('nights.empty.stepSettleBody')}</p>
          </div>
          <div className={styles.emptyGuideCard}>
            <strong className={styles.emptyGuideTitle}>{t('nights.empty.stepHandsTitle')}</strong>
            <p className={styles.emptyGuideBody}>{t('nights.empty.stepHandsBody')}</p>
          </div>
        </div>
      </PanelSection>
    </Panel>
  );
}
