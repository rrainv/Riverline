import { useRef } from 'preact/hooks';
import { langSignal } from '../../domain/appearance';
import {
  SETTINGS_SECTION_IDS,
  settingsSectionSignal,
  type SettingsSectionId,
} from '../../domain/shellState';
import type { StudyRepository } from '../../domain/storage';
import { t } from '../../i18n';
import { Panel } from '../kit/panel/Panel';
import { cx } from '../kit/state';
import {
  SettingsAboutSection,
  SettingsAppearanceSection,
  SettingsDataSection,
  SettingsLanguageSection,
  SettingsMotionSection,
  SettingsShortcutsSection,
  SettingsTeacherSection,
} from './settings';
import styles from './SettingsRoom.module.css';

export interface SettingsRoomProps {
  activeSection?: SettingsSectionId;
  onSectionChange?: (section: SettingsSectionId) => void;
  repository?: StudyRepository;
}

export function SettingsRoom({
  activeSection,
  onSectionChange,
  repository,
}: SettingsRoomProps) {
  void langSignal.value;
  const currentSection = activeSection ?? settingsSectionSignal.value;
  const tabRefs = useRef(new Map<SettingsSectionId, HTMLButtonElement>());

  const selectSection = (sectionId: SettingsSectionId) => {
    if (activeSection === undefined) {
      settingsSectionSignal.value = sectionId;
    }
    onSectionChange?.(sectionId);
  };

  const handleTabKeyDown = (event: KeyboardEvent, index: number) => {
    const isRtl =
      typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') {
      nextIndex = (index + (isRtl ? -1 : 1) + SETTINGS_SECTION_IDS.length) % SETTINGS_SECTION_IDS.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index + (isRtl ? 1 : -1) + SETTINGS_SECTION_IDS.length) % SETTINGS_SECTION_IDS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = SETTINGS_SECTION_IDS.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    const target = SETTINGS_SECTION_IDS[nextIndex]!;
    selectSection(target);
    tabRefs.current.get(target)?.focus();
  };

  return (
    <section className={styles.room} aria-labelledby="settings-heading">
      <Panel as="div">
        <div className={styles.headerRow}>
          <div className={styles.header}>
            <div className={styles.eyebrow}>{t('settings.eyebrow')}</div>
            <h1 id="settings-heading" className={styles.heading}>
              {t('settings.heading')}
            </h1>
            <p className={styles.subtitle}>{t('settings.subtitle')}</p>
          </div>

          <div
            className={styles.sectionTabs}
            role="tablist"
            aria-label={t('rooms.settings.title')}
          >
            {SETTINGS_SECTION_IDS.map((sectionId, index) => {
              const selected = currentSection === sectionId;
              return (
                <button
                  key={sectionId}
                  ref={(el) => {
                    if (el) tabRefs.current.set(sectionId, el);
                    else tabRefs.current.delete(sectionId);
                  }}
                  type="button"
                  role="tab"
                  id={`settings-tab-${sectionId}`}
                  aria-selected={selected}
                  aria-controls={`settings-panel-${sectionId}`}
                  className={cx(styles.sectionTab, selected && styles.sectionTabActive)}
                  onClick={() => selectSection(sectionId)}
                  onKeyDown={(e) => handleTabKeyDown(e, index)}
                >
                  {t(`settings.tab.${sectionId}`)}
                </button>
              );
            })}
          </div>
        </div>
      </Panel>

      <div
        role="tabpanel"
        id={`settings-panel-${currentSection}`}
        aria-labelledby={`settings-tab-${currentSection}`}
        className={styles.sectionBody}
      >
        {currentSection === 'appearance' ? (
          <SettingsAppearanceSection />
        ) : currentSection === 'motion' ? (
          <SettingsMotionSection />
        ) : currentSection === 'teacher' ? (
          <SettingsTeacherSection />
        ) : currentSection === 'language' ? (
          <SettingsLanguageSection />
        ) : currentSection === 'shortcuts' ? (
          <SettingsShortcutsSection />
        ) : currentSection === 'data' ? (
          <SettingsDataSection repository={repository} />
        ) : (
          <SettingsAboutSection />
        )}
      </div>
    </section>
  );
}
