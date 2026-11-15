import { useState } from 'preact/hooks';
import { t } from '../../../i18n';
import { Button } from '../button/Button';
import { SegmentedControl } from '../choice/Choice';
import { Panel, PanelSection } from '../panel/Panel';
import styles from '../sheet/KitSheet.module.css';
import { MixBar } from './MixBar';

type YouChoice = 'fold' | 'call' | 'r7' | 'r8' | 'r10';

const CHOICE_POS: Record<YouChoice, number> = {
  fold: 7,
  call: 32,
  r7: 58,
  r8: 77,
  r10: 94,
};

export function MixBarSheetEntry() {
  const [choice, setChoice] = useState<YouChoice>('r8');
  const [wipeKey, setWipeKey] = useState(0);

  return (
    <Panel title={t('kit.mix.sectionTitle')}>
      <PanelSection label={t('kit.mix.interactiveLabel')}>
        <div className={styles.inlineRow}>
          <SegmentedControl<YouChoice>
            ariaLabel={t('kit.mix.choosePosition')}
            value={choice}
            onChange={setChoice}
            options={[
              { value: 'fold', label: t('kit.tickets.fold') },
              { value: 'call', label: t('kit.tickets.call') },
              { value: 'r7', label: '7 bb' },
              { value: 'r8', label: '8 bb' },
              { value: 'r10', label: '10 bb' },
            ]}
          />
          <Button variant="secondary" onClick={() => setWipeKey((k) => k + 1)}>
            {t('kit.mix.replayWipe')}
          </Button>
        </div>

        <MixBar
          wipeKey={wipeKey}
          youPositionPct={CHOICE_POS[choice]}
          segments={[
            { id: 'fold', pct: 14, label: t('kit.mix.segFold'), tone: 'fold' },
            { id: 'call', pct: 36, label: t('kit.mix.segCall', { pct: '36%' }), tone: 'call' },
            { id: 'r7', pct: 16, label: '7', tone: 'raise1' },
            { id: 'r8', pct: 22, label: '8', tone: 'raise2' },
            { id: 'r10', pct: 12, label: '10', tone: 'raise3' },
          ]}
          legendGroups={[
            { id: 'lg-fold', pct: 14, label: t('kit.tickets.fold') },
            { id: 'lg-call', pct: 36, label: t('kit.tickets.call') },
            { id: 'lg-raise', pct: 50, label: t('kit.mix.raiseLegend', { pct: '50%' }), highlighted: true },
          ]}
        />
      </PanelSection>

      <PanelSection label={t('kit.mix.breakdownLabel')}>
        <MixBar
          segments={[
            { id: 'luck', pct: 34, label: t('kit.mix.segLuck'), tone: 'brass' },
            { id: 'rest', pct: 66, label: t('kit.mix.segOther'), tone: 'fold' },
          ]}
        />
      </PanelSection>
    </Panel>
  );
}
