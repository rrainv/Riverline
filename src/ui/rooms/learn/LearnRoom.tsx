import type { LearnStore } from '../../../domain/learn';
import type { RouteId } from '../../../domain/shellState';
import { t } from '../../../i18n';
import { LearnGlossaryView } from './LearnGlossaryView';
import { LearnPathView } from './LearnPathView';
import styles from './LearnRoom.module.css';
import { LearnWeaknessesView } from './LearnWeaknessesView';

export interface LearnRoomProps {
  readonly store: LearnStore;
  readonly onNavigateRoom: (room: RouteId) => void;
}

export function LearnRoom({ store, onNavigateRoom }: LearnRoomProps) {
  const section = store.activeSectionSignal.value;

  return (
    <div className={section === 'path' ? styles.roomCompact : styles.room}>
      <header className={section === 'path' ? styles.roomHeaderCompact : styles.roomHeader}>
        <div className={styles.headingGroup}>
          <h1 className={section === 'path' ? styles.roomTitleCompact : styles.roomTitle}>
            {t('learn.title')}
          </h1>
          {section !== 'path' && <p className={styles.roomSubtitle}>{t('learn.subtitle')}</p>}
        </div>
      </header>

      {section === 'glossary' ? (
        <LearnGlossaryView store={store} />
      ) : section === 'weaknesses' ? (
        <LearnWeaknessesView store={store} onNavigateRoom={onNavigateRoom} />
      ) : (
        <LearnPathView
          store={store}
          onDrillInTraining={() => onNavigateRoom('training')}
        />
      )}
    </div>
  );
}
