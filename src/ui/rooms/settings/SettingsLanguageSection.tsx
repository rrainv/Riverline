import { appearanceSignal, LOCALE_IDS, updateAppearance } from '../../../domain/appearance';
import { t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Panel } from '../../kit/panel/Panel';
import { cx } from '../../kit/state';
import styles from '../SettingsRoom.module.css';

export function SettingsLanguageSection() {
  const prefs = appearanceSignal.value;

  return (
    <Panel as="div">
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
              className={cx(styles.langCard, active && styles.langCardActive)}
              onClick={() => updateAppearance({ lang: localeId })}
            >
              <span className={styles.langName}>{t(`settings.language.${localeId}`)}</span>
              <PokerNotation className={styles.langCode}>{localeId.toUpperCase()}</PokerNotation>
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
    </Panel>
  );
}
