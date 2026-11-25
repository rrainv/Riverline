import type { TrainingStore } from '../../../domain/training';
import { t } from '../../../i18n';
import { HeadsUpDuelView } from './HeadsUpDuelView';
import { HandReadingDrillView } from './HandReadingDrillView';
import { LimpLabView } from './LimpLabView';
import { QuickDrillView } from './QuickDrillView';
import { SixMaxOrbitView } from './SixMaxOrbitView';
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
          {activeView === 'hub' && <p className={styles.roomSubtitle}>{t('training.subtitle')}</p>}
        </div>
      </header>

      {activeView === 'hub' ? (
        <TrainingHubView store={store} />
      ) : activeView === 'duel' ? (
        <HeadsUpDuelView store={store} onOpenReview={onOpenReview} />
      ) : activeView === 'orbit' ? (
        <SixMaxOrbitView store={store} onOpenReview={onOpenReview} />
      ) : activeView === 'limp_lab' ? (
        <LimpLabView store={store} />
      ) : activeView === 'hand_reading' ? (
        <HandReadingDrillView />
      ) : activeView === 'leak_lab' ? (
        <QuickDrillView store={store} isLeakLab />
      ) : (
        <QuickDrillView store={store} />
      )}
    </div>
  );
}
