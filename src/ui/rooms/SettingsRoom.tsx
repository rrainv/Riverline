import {
  appearanceSignal,
  LOCALE_IDS,
  MOTION_MODES,
  PACE_IDS,
  THEME_IDS,
  updateAppearance,
} from '../../domain/appearance';
import { t } from '../../i18n';
import { PokerNotation } from '../../i18n/PokerNotation';
import styles from './SettingsRoom.module.css';

export function SettingsRoom() {
  const prefs = appearanceSignal.value;

  return (
    <section className={styles.grid} aria-labelledby="settings-heading">
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.eyebrow}>{t('settings.eyebrow')}</div>
          <h1 id="settings-heading" className={styles.heading}>
            {t('settings.heading')}
          </h1>
          <p className={styles.subtitle}>{t('settings.subtitle')}</p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('settings.themes.label')}</div>
          <div className={styles.themeGrid} role="group" aria-label={t('settings.themes.label')}>
            {THEME_IDS.map((themeId) => {
              const active = prefs.theme === themeId;
              return (
                <button
                  key={themeId}
                  type="button"
                  aria-pressed={active}
                  className={
                    active ? `${styles.themeTile} ${styles.themeTileActive}` : styles.themeTile
                  }
                  onClick={() => updateAppearance({ theme: themeId })}
                >
                  <span className={styles.swatchBar} data-theme={themeId} aria-hidden="true">
                    <span className={styles.swatchBg} />
                    <span className={styles.swatchPanel} />
                    <span className={styles.swatchAccent} />
                  </span>
                  <span className={styles.themeName}>{t(`settings.themes.${themeId}`)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('settings.pace.label')}</div>
          <div className={styles.chipRow} role="group" aria-label={t('settings.pace.label')}>
            {PACE_IDS.map((paceId) => {
              const active = prefs.pace === paceId;
              return (
                <button
                  key={paceId}
                  type="button"
                  aria-pressed={active}
                  className={active ? `${styles.chipBtn} ${styles.chipBtnActive}` : styles.chipBtn}
                  onClick={() => updateAppearance({ pace: paceId })}
                >
                  {t(`settings.pace.${paceId}`)}
                </button>
              );
            })}
          </div>
          <p className={styles.hint}>{t('settings.pace.hint')}</p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('settings.motion.label')}</div>
          <div className={styles.chipRow} role="group" aria-label={t('settings.motion.label')}>
            {MOTION_MODES.map((motionMode) => {
              const active = prefs.motion === motionMode;
              return (
                <button
                  key={motionMode}
                  type="button"
                  aria-pressed={active}
                  className={active ? `${styles.chipBtn} ${styles.chipBtnActive}` : styles.chipBtn}
                  onClick={() => updateAppearance({ motion: motionMode })}
                >
                  {t(`settings.motion.${motionMode}`)}
                </button>
              );
            })}
          </div>
          <p className={styles.hint}>{t('settings.motion.hint')}</p>
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.eyebrow}>{t('settings.language.label')}</div>
          <p className={styles.subtitle}>{t('settings.language.hint')}</p>
        </div>

        <div className={styles.langGrid} role="group" aria-label={t('settings.language.label')}>
          {LOCALE_IDS.map((localeId) => {
            const active = prefs.lang === localeId;
            return (
              <button
                key={localeId}
                type="button"
                aria-pressed={active}
                className={active ? `${styles.langCard} ${styles.langCardActive}` : styles.langCard}
                onClick={() => updateAppearance({ lang: localeId })}
              >
                <span className={styles.langName}>{t(`settings.language.${localeId}`)}</span>
                <PokerNotation className={styles.langCode}>
                  {localeId.toUpperCase()}
                </PokerNotation>
              </button>
            );
          })}
        </div>

        <div className={styles.sampleWell}>
          {prefs.lang === 'he' ? (
            <>
              <PokerNotation>BTN</PokerNotation>
              {': רייז ל-'}
              <PokerNotation>7.5 bb</PokerNotation>
              {' עם '}
              <PokerNotation>AhKh</PokerNotation>
            </>
          ) : prefs.lang === 'ru' ? (
            <>
              <PokerNotation>BTN</PokerNotation>
              {': рейз до '}
              <PokerNotation>7.5 bb</PokerNotation>
              {' с '}
              <PokerNotation>AhKh</PokerNotation>
            </>
          ) : (
            <>
              <PokerNotation>BTN</PokerNotation>
              {': raise to '}
              <PokerNotation>7.5 bb</PokerNotation>
              {' with '}
              <PokerNotation>AhKh</PokerNotation>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
