import type { TrainingStore } from '../../../domain/training';
import { t } from '../../../i18n';
import { HeadsUpDuelView } from './HeadsUpDuelView';
import { QuickDrillView } from './QuickDrillView';
import { TrainingHubView } from './TrainingHubView';
import styles from './TrainingRoom.module.css';

export interface TrainingRoomProps {
  readonly store: TrainingStore;
  readonly onOpenReview?: () => void;
}

export function TrainingRoom({ store, onOpenReview }: TrainingRoomProps) {
  const activeView = store.activeViewSignal.value;

  return (
    <div className={styles.room}>
      <header className={styles.roomHeader}>
        <div className={styles.headingGroup}>
          <h1 className={styles.roomTitle}>{t('training.title')}</h1>
          <p className={styles.roomSubtitle}>{t('training.subtitle')}</p>
        </div>
      </header>

      {activeView === 'hub' ? (
        <TrainingHubView store={store} />
      ) : activeView === 'duel' ? (
        <HeadsUpDuelView store={store} onOpenReview={onOpenReview} />
      ) : activeView === 'leak_lab' ? (
        <QuickDrillView store={store} isLeakLab />
      ) : (
        <QuickDrillView store={store} />
      )}
    </div>
  );
}
