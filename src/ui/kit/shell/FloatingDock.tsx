import { navigateTo, ROOM_IDS, toggleFocusMode, type RouteId } from '../../../domain/shellState';
import { t } from '../../../i18n';
import { RouteIcon } from '../icons/Icons';
import styles from './FloatingDock.module.css';

interface FloatingDockProps {
  activeRoute: RouteId;
  focusMode: boolean;
}

export function FloatingDock({ activeRoute, focusMode }: FloatingDockProps) {
  return (
    <>
      <nav
        className={focusMode ? `${styles.dock} ${styles.dockHidden}` : styles.dock}
        aria-label={t('dock.ariaLabel')}
        aria-hidden={focusMode || undefined}
      >
        {ROOM_IDS.map((roomId) => {
          const isActive = activeRoute === roomId;
          return (
            <button
              key={roomId}
              type="button"
              className={isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
              onClick={() => navigateTo(roomId)}
              aria-current={isActive ? 'page' : undefined}
              tabIndex={focusMode ? -1 : undefined}
            >
              <RouteIcon route={roomId} size={22} />
              <span>{t(`rooms.${roomId}.nav`)}</span>
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        className={
          focusMode
            ? styles.restorePill
            : `${styles.restorePill} ${styles.restorePillHidden}`
        }
        onClick={toggleFocusMode}
        aria-hidden={!focusMode || undefined}
        tabIndex={focusMode ? undefined : -1}
      >
        {t('topbar.focusExit')}
      </button>
    </>
  );
}
