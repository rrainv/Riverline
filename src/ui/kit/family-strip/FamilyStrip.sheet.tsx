import { useState } from 'preact/hooks';
import { t } from '../../../i18n';
import { Button } from '../button/Button';
import { SegmentedControl } from '../choice/Choice';
import { Panel, PanelSection } from '../panel/Panel';
import { FamilyStrip, type FamilyStripItem } from './FamilyStrip';
import styles from './FamilyStrip.module.css';

type FamilyKey = 'suitedKings' | 'pocketPairs' | 'suitedAces';

const FAMILY_DATA: Record<
  FamilyKey,
  { items: FamilyStripItem[]; defaultCutoff: number; baselineCutoff: number }
> = {
  suitedKings: {
    items: ['AKs', 'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s', 'K2s'].map(
      (hand) => ({ id: hand, hand, combos: 4 }),
    ),
    defaultCutoff: 6,
    baselineCutoff: 4,
  },
  pocketPairs: {
    items: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22'].map(
      (hand) => ({ id: hand, hand, combos: 6 }),
    ),
    defaultCutoff: 9,
    baselineCutoff: 8,
  },
  suitedAces: {
    items: ['AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s'].map(
      (hand) => ({ id: hand, hand, combos: 4 }),
    ),
    defaultCutoff: 11,
    baselineCutoff: 8,
  },
};

export function FamilyStripSheetEntry() {
  const [family, setFamily] = useState<FamilyKey>('suitedKings');
  const [cutoff, setCutoff] = useState<number>(FAMILY_DATA.suitedKings.defaultCutoff);
  const [showBaseline, setShowBaseline] = useState<boolean>(true);

  const familyOptions: Array<{ value: FamilyKey; label: string }> = [
    { value: 'suitedKings', label: t('kit.strip.family.suitedKings') },
    { value: 'pocketPairs', label: t('kit.strip.family.pocketPairs') },
    { value: 'suitedAces', label: t('kit.strip.family.suitedAces') },
  ];

  const activeData = FAMILY_DATA[family];

  return (
    <Panel title={t('kit.strip.sectionTitle')}>
      <PanelSection label={t('kit.strip.familyLabel')}>
        <div className={styles.stack}>
          <div className={styles.controlsBar}>
            <SegmentedControl<FamilyKey>
              ariaLabel={t('kit.strip.familyLabel')}
              options={familyOptions}
              value={family}
              onChange={(nextFamily) => {
                setFamily(nextFamily);
                setCutoff(FAMILY_DATA[nextFamily].defaultCutoff);
              }}
            />
            <div className={styles.actionGroup}>
              <Button
                variant={showBaseline ? 'primary' : 'secondary'}
                onClick={() => setShowBaseline((b) => !b)}
              >
                {t('kit.strip.showBaseline')}
              </Button>
              <Button variant="secondary" onClick={() => setCutoff(-1)}>
                {t('kit.strip.clearCutoff')}
              </Button>
            </div>
          </div>

          <FamilyStrip
            ariaLabel={t('kit.strip.sliderAria', { family: t(`kit.strip.family.${family}`) })}
            contextLabel={t('kit.strip.longRussianBanner')}
            items={activeData.items}
            cutoffIndex={cutoff}
            baselineCutoffIndex={showBaseline ? activeData.baselineCutoff : undefined}
            onChangeCutoff={setCutoff}
          />
        </div>
      </PanelSection>

      <PanelSection label={t('kit.strip.statesLabel')}>
        <div className={styles.statesGrid}>
          <div className={styles.stateCard}>
            <span className={styles.stateLabel}>{t('kit.state.hover')}</span>
            <FamilyStrip
              ariaLabel={t('kit.state.hover')}
              items={FAMILY_DATA.suitedAces.items.slice(0, 5)}
              cutoffIndex={3}
              baselineCutoffIndex={2}
              forceState="hover"
            />
          </div>
          <div className={styles.stateCard}>
            <span className={styles.stateLabel}>{t('kit.state.focus')}</span>
            <FamilyStrip
              ariaLabel={t('kit.state.focus')}
              items={FAMILY_DATA.suitedKings.items.slice(0, 5)}
              cutoffIndex={2}
              baselineCutoffIndex={3}
              forceState="focus"
            />
          </div>
          <div className={styles.stateCard}>
            <span className={styles.stateLabel}>{t('kit.state.disabled')}</span>
            <FamilyStrip
              ariaLabel={t('kit.state.disabled')}
              items={FAMILY_DATA.pocketPairs.items.slice(0, 5)}
              cutoffIndex={2}
              baselineCutoffIndex={3}
              disabled
            />
          </div>
        </div>
      </PanelSection>
    </Panel>
  );
}
