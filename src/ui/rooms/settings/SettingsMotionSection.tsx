import { useState } from 'preact/hooks';
import {
  appearanceSignal,
  MOTION_MODES,
  PACE_IDS,
  TEACHER_TYPING_SPEEDS,
  updateAppearance,
} from '../../../domain/appearance';
import { playTableSound } from '../../../domain/audio/tableAudio';
import { t } from '../../../i18n';
import { Button } from '../../kit/button/Button';
import { ChipButton } from '../../kit/choice/Choice';
import { TeacherCallout } from '../../kit/lamp/Lamp';
import { Panel } from '../../kit/panel/Panel';
import { cx } from '../../kit/state';
import styles from '../SettingsRoom.module.css';

export function SettingsMotionSection() {
  const prefs = appearanceSignal.value;
  const [replayKey, setReplayKey] = useState(0);

  return (
    <div className={styles.grid}>
      <Panel as="div">
        <div className={styles.sectionFirst}>
          <div className={styles.sectionLabel}>{t('settings.pace.label')}</div>
          <div className={styles.chipRow} role="group" aria-label={t('settings.pace.label')}>
            {PACE_IDS.map((paceId) => (
              <ChipButton
                key={paceId}
                selected={prefs.pace === paceId}
                onToggle={() => updateAppearance({ pace: paceId })}
              >
                {t(`settings.pace.${paceId}`)}
              </ChipButton>
            ))}
          </div>
          <p className={styles.hint}>{t('settings.pace.hint')}</p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('settings.motion.label')}</div>
          <div className={styles.chipRow} role="group" aria-label={t('settings.motion.label')}>
            {MOTION_MODES.map((motionMode) => (
              <ChipButton
                key={motionMode}
                selected={prefs.motion === motionMode}
                onToggle={() => updateAppearance({ motion: motionMode })}
              >
                {t(`settings.motion.${motionMode}`)}
              </ChipButton>
            ))}
          </div>
          <p className={styles.hint}>{t('settings.motion.hint')}</p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('settings.minimalCards.label')}</div>
          <div className={styles.toggleRow}>
            <button
              type="button"
              aria-pressed={prefs.minimalCards}
              className={cx(styles.toggleBtn, prefs.minimalCards && styles.toggleBtnActive)}
              onClick={() => updateAppearance({ minimalCards: !prefs.minimalCards })}
            >
              <span>{t('settings.minimalCards.label')}</span>
              <span
                className={cx(
                  styles.toggleTrack,
                  prefs.minimalCards && styles.toggleTrackActive,
                )}
                aria-hidden="true"
              >
                <span className={styles.toggleThumb} />
              </span>
            </button>
          </div>
          <p className={styles.hint}>{t('settings.minimalCards.hint')}</p>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeaderRow}>
            <div className={styles.sectionLabel}>{t('settings.sound.label')}</div>
            <Button variant="secondary" onClick={() => playTableSound('chip', true)}>
              {t('settings.sound.testBtn')}
            </Button>
          </div>
          <div className={styles.toggleRow}>
            <button
              type="button"
              aria-pressed={prefs.soundEffects}
              className={cx(styles.toggleBtn, prefs.soundEffects && styles.toggleBtnActive)}
              onClick={() => updateAppearance({ soundEffects: !prefs.soundEffects })}
            >
              <span>{t('settings.sound.label')}</span>
              <span
                className={cx(
                  styles.toggleTrack,
                  prefs.soundEffects && styles.toggleTrackActive,
                )}
                aria-hidden="true"
              >
                <span className={styles.toggleThumb} />
              </span>
            </button>
          </div>
          <p className={styles.hint}>{t('settings.sound.hint')}</p>
        </div>
      </Panel>

      <Panel as="div">
        <div className={styles.sectionFirst}>
          <div className={styles.sectionHeaderRow}>
            <div className={styles.sectionLabel}>{t('settings.typing.label')}</div>
            <Button variant="secondary" onClick={() => setReplayKey((k) => k + 1)}>
              {t('settings.typing.replay')}
            </Button>
          </div>

          <p className={styles.hint}>{t('settings.typing.hint')}</p>

          <div className={styles.chipRow} role="group" aria-label={t('settings.typing.label')}>
            {TEACHER_TYPING_SPEEDS.map((speed) => (
              <ChipButton
                key={speed}
                selected={prefs.teacherTypingSpeed === speed}
                onToggle={() => {
                  updateAppearance({ teacherTypingSpeed: speed });
                  setReplayKey((k) => k + 1);
                }}
              >
                {t(`settings.typing.${speed}`)}
              </ChipButton>
            ))}
          </div>

          <TeacherCallout
            key={`${replayKey}-${prefs.teacherTypingSpeed}`}
            surface="well"
            text={t('settings.typing.sample')}
            typingSpeed={prefs.teacherTypingSpeed}
            showLamp={prefs.showLamp}
          />
        </div>
      </Panel>
    </div>
  );
}
