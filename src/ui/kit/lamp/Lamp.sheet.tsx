import { useState } from 'preact/hooks';
import {
  appearanceSignal,
  TEACHER_TYPING_SPEEDS,
  updateAppearance,
  type TeacherTypingSpeed,
} from '../../../domain/appearance';
import { t } from '../../../i18n';
import { Button } from '../button/Button';
import { SegmentedControl } from '../choice/Choice';
import { Panel, PanelSection } from '../panel/Panel';
import { LAMP_MOODS, LAMP_SIZES, Lamp, TeacherCallout, type LampMood } from './Lamp';
import styles from './Lamp.module.css';

export function LampSheetEntry() {
  const prefs = appearanceSignal.value;
  const [selectedMood, setSelectedMood] = useState<LampMood>('speaking');
  const [awakeNotice, setAwakeNotice] = useState<LampMood>('resting');
  const [typeRun, setTypeRun] = useState(0);

  const speedOptions = TEACHER_TYPING_SPEEDS.map((speed) => ({
    value: speed,
    label: t(`kit.lamp.speed.${speed}`),
  }));

  const visibilityOptions = [
    { value: 'shown' as const, label: t('kit.lamp.lampVisible') },
    { value: 'hidden' as const, label: t('kit.lamp.lampHidden') },
  ];

  return (
    <Panel title={t('kit.lamp.sectionTitle')}>
      <div className={styles.threeCol}>
        <PanelSection label={t('kit.lamp.sizeLabel')}>
          <div className={styles.rowWrap}>
            {LAMP_SIZES.map((sz) => (
              <div
                key={sz}
                className={sz === 128 ? styles.specimenTileInline : styles.specimenTile}
              >
                <Lamp size={sz} mood="idle" />
                <span>{sz} px</span>
              </div>
            ))}
          </div>
        </PanelSection>

        <PanelSection label={t('kit.lamp.moodsLabel')}>
          <div className={styles.moodGrid}>
            {LAMP_MOODS.map((m) => (
              <div key={m} className={styles.specimenTile}>
                <Lamp
                  size={28}
                  mood={m === 'resting' ? awakeNotice : m}
                  persistCelebrating={m === 'celebrating'}
                  onWake={m === 'resting' ? () => setAwakeNotice('curious') : undefined}
                />
                <span>{t(`kit.lamp.mood.${m}`)}</span>
              </div>
            ))}
          </div>
        </PanelSection>

        <PanelSection label={t('kit.lamp.wakeLabel', { mood: t('kit.lamp.mood.resting') })}>
          <div className={styles.statesCompact}>
            <div className={styles.specimenTile}>
              <Lamp size={28} mood="resting" onWake={() => setAwakeNotice('idle')} />
              <span>{t('kit.state.rest')}</span>
            </div>
            <div className={styles.specimenTile}>
              <Lamp size={28} mood="resting" forceState="hover" onWake={() => {}} />
              <span>{t('kit.state.hover')}</span>
            </div>
            <div className={styles.specimenTile}>
              <Lamp size={28} mood="resting" forceState="pressed" onWake={() => {}} />
              <span>{t('kit.state.pressed')}</span>
            </div>
            <div className={styles.specimenTile}>
              <Lamp size={28} mood="resting" forceState="focus" onWake={() => {}} />
              <span>{t('kit.state.focus')}</span>
            </div>
          </div>
        </PanelSection>
      </div>

      <PanelSection label={t('kit.lamp.calloutLabel')}>
        <div className={styles.stack}>
          <div className={styles.controlsBar}>
            <SegmentedControl<TeacherTypingSpeed>
              ariaLabel={t('kit.lamp.typingSpeedLabel')}
              options={speedOptions}
              value={prefs.teacherTypingSpeed}
              onChange={(teacherTypingSpeed) => {
                updateAppearance({ teacherTypingSpeed }, { persist: false });
                setTypeRun((r) => r + 1);
              }}
            />
            <SegmentedControl<'shown' | 'hidden'>
              ariaLabel={t('kit.lamp.showLampLabel')}
              options={visibilityOptions}
              value={prefs.showLamp ? 'shown' : 'hidden'}
              onChange={(v) => updateAppearance({ showLamp: v === 'shown' }, { persist: false })}
            />
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedMood('speaking');
                setAwakeNotice('resting');
                setTypeRun((r) => r + 1);
              }}
            >
              {t('kit.lamp.replayType')}
            </Button>
          </div>

          <div className={styles.twoCol}>
            <TeacherCallout
              key={`${typeRun}-${prefs.teacherTypingSpeed}`}
              surface="well"
              mood={selectedMood}
              lampSize={44}
              text={
                prefs.showLamp ? t('kit.lamp.calloutSample') : t('kit.lamp.calloutHiddenSample')
              }
              tier={{ tier: 'exact', detail: 'price only' }}
              action={{
                label: t('kit.lamp.calloutCta'),
                variant: 'primary',
                onClick: () => setSelectedMood('approving'),
              }}
            />

            <TeacherCallout
              surface="well"
              mood="stern"
              lampSize={44}
              typingSpeed="instant"
              text={t('kit.lamp.longRussianSample')}
              tier={{ tier: 'exact' }}
            />
          </div>
        </div>
      </PanelSection>
    </Panel>
  );
}
