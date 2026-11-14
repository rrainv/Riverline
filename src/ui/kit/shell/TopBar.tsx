import { navigateTo, openPalette, toggleFocusMode, type RouteId } from '../../../domain/shellState';
import { t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { SearchIcon, SettingsIcon } from '../icons/Icons';
import styles from './TopBar.module.css';

interface TopBarProps {
  activeRoute: RouteId;
  focusMode: boolean;
  onSearchButtonRef?: (el: HTMLButtonElement | null) => void;
}

export function TopBar({ activeRoute, focusMode, onSearchButtonRef }: TopBarProps) {
  const roomTitle = t(`rooms.${activeRoute}.title`);
  const sectionLabel =
    activeRoute === 'settings'
      ? t('rail.settingsAppearance')
      : activeRoute === 'kit'
        ? t('rail.kitSheet')
        : t('rail.overview');

  const breadcrumb = t('topbar.breadcrumb', { room: roomTitle, section: sectionLabel });
  const isSettings = activeRoute === 'settings';

  return (
    <header className={styles.topBar}>
      <button
        type="button"
        className={styles.brandBtn}
        onClick={() => navigateTo('home')}
        aria-current={activeRoute === 'home' ? 'page' : undefined}
      >
        <span className={styles.logoMark} aria-hidden="true">
          R
        </span>
        <span className={styles.brandName}>{t('app.name')}</span>
      </button>

      <div className={styles.controls}>
        <span className={styles.breadcrumbChip} title={breadcrumb}>
          {breadcrumb}
        </span>

        <button
          ref={onSearchButtonRef}
          type="button"
          className={styles.pill}
          onClick={openPalette}
          aria-label={t('topbar.searchLabel')}
        >
          <SearchIcon size={15} />
          <span>{t('topbar.searchButton')}</span>
          <PokerNotation className={styles.kbd}>Ctrl K</PokerNotation>
        </button>

        <button
          type="button"
          className={isSettings ? `${styles.pill} ${styles.pillActive}` : styles.pill}
          onClick={() => navigateTo('settings')}
          aria-current={isSettings ? 'page' : undefined}
        >
          <SettingsIcon size={15} />
          <span>{t('topbar.settings')}</span>
        </button>

        <button
          type="button"
          className={focusMode ? `${styles.pill} ${styles.pillActive}` : styles.pill}
          onClick={toggleFocusMode}
          aria-pressed={focusMode}
        >
          <span>{focusMode ? t('topbar.focusExit') : t('topbar.focusEnter')}</span>
        </button>
      </div>
    </header>
  );
}
