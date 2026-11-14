import { toggleRail, type RouteId } from '../../../domain/shellState';
import { t } from '../../../i18n';
import { ChevronIcon, RouteIcon } from '../icons/Icons';
import styles from './SideRail.module.css';

interface SideRailProps {
  activeRoute: RouteId;
  collapsed: boolean;
}

export function SideRail({ activeRoute, collapsed }: SideRailProps) {
  const sectionLabel =
    activeRoute === 'settings'
      ? t('rail.settingsAppearance')
      : activeRoute === 'kit'
        ? t('rail.kitSheet')
        : t('rail.overview');

  const toggleLabel = collapsed ? t('rail.expand') : t('rail.collapse');

  return (
    <aside
      className={collapsed ? `${styles.rail} ${styles.railCollapsed}` : styles.rail}
      aria-label={t('rail.title')}
    >
      <div className={styles.list}>
        <div className={styles.heading}>{t('rail.title')}</div>
        <button
          type="button"
          className={`${styles.item} ${styles.itemActive}`}
          aria-current="page"
          title={collapsed ? sectionLabel : undefined}
        >
          <RouteIcon route={activeRoute} size={18} className={styles.itemIcon} />
          <span className={styles.label}>{sectionLabel}</span>
        </button>
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.item}
          onClick={toggleRail}
          aria-expanded={!collapsed}
          aria-label={toggleLabel}
          title={collapsed ? toggleLabel : undefined}
        >
          <ChevronIcon size={18} className={styles.chevron} />
          <span className={styles.label}>{toggleLabel}</span>
        </button>
      </div>
    </aside>
  );
}
