import type { RouteId } from '../../domain/shellState';
import { t } from '../../i18n';
import styles from './EmptyRoom.module.css';

interface EmptyRoomProps {
  route: Exclude<RouteId, 'settings'>;
}

export function EmptyRoom({ route }: EmptyRoomProps) {
  return (
    <section className={styles.container} aria-labelledby="room-heading">
      <div className={styles.panel}>
        <div className={styles.eyebrow}>{t(`rooms.${route}.nav`)}</div>
        <h1 id="room-heading" className={styles.title}>
          {t(`rooms.${route}.title`)}
        </h1>
        <p className={styles.emptyLine}>{t(`rooms.${route}.empty`)}</p>
      </div>
    </section>
  );
}
