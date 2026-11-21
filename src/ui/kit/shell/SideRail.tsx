import { toggleRail, type RouteId } from '../../../domain/shellState';
import { t } from '../../../i18n';
import { ChevronIcon, RouteIcon } from '../icons/Icons';
import styles from './SideRail.module.css';

export interface SideRailSectionItem {
  readonly id: string;
  readonly label: string;
  readonly badge?: string | number;
  readonly active: boolean;
  readonly onSelect: () => void;
}

interface SideRailProps {
  activeRoute: RouteId;
  collapsed: boolean;
  sections?: readonly SideRailSectionItem[];
}

export function SideRail({ activeRoute, collapsed, sections }: SideRailProps) {
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
        {sections && sections.length > 0 ? (
          sections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={section.active ? `${styles.item} ${styles.itemActive}` : styles.item}
              aria-current={section.active ? 'page' : undefined}
              title={collapsed ? section.label : undefined}
              onClick={section.onSelect}
            >
              <RouteIcon route={activeRoute} size={18} className={styles.itemIcon} />
              <span className={styles.label}>{section.label}</span>
              {section.badge !== undefined && (
                <span className={styles.badge}>{section.badge}</span>
              )}
            </button>
          ))
        ) : (
          <button
            type="button"
            className={`${styles.item} ${styles.itemActive}`}
            aria-current="page"
            title={collapsed ? sectionLabel : undefined}
          >
            <RouteIcon route={activeRoute} size={18} className={styles.itemIcon} />
            <span className={styles.label}>{sectionLabel}</span>
          </button>
        )}
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
