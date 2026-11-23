import {
  appearanceSignal,
  DAILY_STUDY_GOALS,
  TEACHER_VOICE_IDS,
  updateAppearance,
} from '../../../domain/appearance';
import { formatNumber, t } from '../../../i18n';
import { ChipButton } from '../../kit/choice/Choice';
import { TextField } from '../../kit/input/TextField';
import { TeacherCallout } from '../../kit/lamp/Lamp';
import { Panel } from '../../kit/panel/Panel';
import { cx } from '../../kit/state';
import styles from '../SettingsRoom.module.css';

export function SettingsTeacherSection() {
  const prefs = appearanceSignal.value;
  const sampleText =
    prefs.teacherVoice === 'gentle'
      ? t('settings.teacher.voiceGentleSample')
      : t('settings.teacher.voiceBluntSample');

  return (
    <div className={styles.grid}>
      <Panel as="div">
        <div className={styles.sectionFirst}>
          <div className={styles.sectionLabel}>{t('settings.profile.heading')}</div>
          <TextField
            value={prefs.playerName}
            ariaLabel={t('settings.profile.nameLabel')}
            placeholder={t('settings.profile.namePlaceholder')}
            ltrInput={false}
            onValueChange={(next) => updateAppearance({ playerName: next.slice(0, 24) })}
          />
          <div className={styles.fieldLabel}>{t('settings.profile.goalLabel')}</div>
          <div
            className={styles.chipRow}
            role="group"
            aria-label={t('settings.profile.goalLabel')}
          >
            {DAILY_STUDY_GOALS.map((goal) => (
              <ChipButton
                key={goal}
                selected={prefs.dailyStudyGoal === goal}
                onToggle={() => updateAppearance({ dailyStudyGoal: goal })}
              >
                {t('settings.profile.goalOption', { count: formatNumber(goal) })}
              </ChipButton>
            ))}
          </div>
          <p className={styles.hint}>{t('settings.profile.goalHint')}</p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('settings.teacher.showLamp')}</div>
          <div className={styles.toggleRow}>
            <button
              type="button"
              aria-pressed={prefs.showLamp}
              className={cx(styles.toggleBtn, prefs.showLamp && styles.toggleBtnActive)}
              onClick={() => updateAppearance({ showLamp: !prefs.showLamp })}
            >
              <span>{t('settings.teacher.showLamp')}</span>
              <span
                className={cx(styles.toggleTrack, prefs.showLamp && styles.toggleTrackActive)}
                aria-hidden="true"
              >
                <span className={styles.toggleThumb} />
              </span>
            </button>
          </div>
          <p className={styles.hint}>{t('settings.teacher.showLampHint')}</p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('settings.teacher.askBeforeVerdict')}</div>
          <div className={styles.toggleRow}>
            <button
              type="button"
              aria-pressed={prefs.askBeforeVerdict}
              className={cx(
                styles.toggleBtn,
                prefs.askBeforeVerdict && styles.toggleBtnActive,
              )}
              onClick={() => updateAppearance({ askBeforeVerdict: !prefs.askBeforeVerdict })}
            >
              <span>{t('settings.teacher.askBeforeVerdict')}</span>
              <span
                className={cx(
                  styles.toggleTrack,
                  prefs.askBeforeVerdict && styles.toggleTrackActive,
                )}
                aria-hidden="true"
              >
                <span className={styles.toggleThumb} />
              </span>
            </button>
          </div>
          <p className={styles.hint}>{t('settings.teacher.askBeforeVerdictHint')}</p>
        </div>
      </Panel>

      <Panel as="div">
        <div className={styles.sectionFirst}>
          <div className={styles.sectionLabel}>{t('settings.teacher.voiceLabel')}</div>
          <div
            className={styles.chipRow}
            role="group"
            aria-label={t('settings.teacher.voiceLabel')}
          >
            {TEACHER_VOICE_IDS.map((voiceId) => (
              <ChipButton
                key={voiceId}
                selected={prefs.teacherVoice === voiceId}
                onToggle={() => updateAppearance({ teacherVoice: voiceId })}
              >
                {voiceId === 'blunt'
                  ? t('settings.teacher.voiceBlunt')
                  : t('settings.teacher.voiceGentle')}
              </ChipButton>
            ))}
          </div>

          <TeacherCallout
            key={prefs.teacherVoice}
            surface="well"
            text={sampleText}
            typingSpeed="instant"
            showLamp={prefs.showLamp}
          />

          <p className={styles.hint}>{t('settings.teacher.voiceNote')}</p>
        </div>
      </Panel>
    </div>
  );
}
