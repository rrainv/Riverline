import { useState } from 'preact/hooks';
import { t } from '../../../i18n';
import { Button } from '../button/Button';
import { Panel, PanelSection } from '../panel/Panel';
import styles from '../sheet/KitSheet.module.css';
import { PlayingCard, PlayingCardPair, type CardMotion, type CardSize } from './PlayingCard';

const SIZES: CardSize[] = ['mini', 'small', 'standard', 'large', 'table'];

export function PlayingCardSheetEntry() {
  const [motionMode, setMotionMode] = useState<CardMotion>('deal');
  const [replayCount, setReplayCount] = useState(0);

  const replay = (nextMode: CardMotion) => {
    setMotionMode(nextMode);
    setReplayCount((c) => c + 1);
  };

  return (
    <Panel title={t('kit.card.sectionTitle')}>
      <PanelSection label={t('kit.card.sizesLabel')}>
        <div className={styles.inlineRow}>
          {SIZES.map((sz) => (
            <div key={sz} className={styles.inlineRow}>
              <PlayingCard card="Ah" size={sz} />
              <span className={styles.specimenEyebrow}>{t(`kit.card.size.${sz}`)}</span>
            </div>
          ))}
        </div>
      </PanelSection>

      <PanelSection label={t('kit.card.statesLabel')}>
        <div className={styles.inlineRow}>
          <PlayingCard card="Ks" size="standard" />
          <PlayingCard card="10d" size="standard" />
          <PlayingCard state="back" size="standard" />
          <PlayingCard state="slot" size="standard" />
          <PlayingCard card="Qc" size="standard" struck />
          <PlayingCard card="Qh" size="standard" winning />
          <PlayingCard card="2s" size="standard" dimmed />
          <PlayingCardPair card="Ah" size="standard" />
        </div>
      </PanelSection>

      <PanelSection label={t('kit.card.motionLabel')}>
        <div className={styles.inlineRow}>
          <Button variant="secondary" onClick={() => replay('deal')}>
            {t('kit.card.replayDeal')}
          </Button>
          <Button variant="secondary" onClick={() => replay('flip')}>
            {t('kit.card.replayFlip')}
          </Button>
          <Button variant="secondary" onClick={() => replay('fold')}>
            {t('kit.card.replayFold')}
          </Button>
          {replayCount > 0 ? (
            <div key={`${motionMode}-${replayCount}`} className={styles.inlineRow}>
              <PlayingCard
                card="Qh"
                size="large"
                motion={motionMode}
                motionIndex={0}
                foldLane={-1}
              />
              <PlayingCard
                card="7c"
                size="large"
                motion={motionMode}
                motionIndex={1}
                foldLane={1}
              />
              {motionMode !== 'fold' && (
                <PlayingCard
                  card="2h"
                  size="large"
                  motion={motionMode}
                  motionIndex={2}
                />
              )}
            </div>
          ) : (
            <div className={styles.inlineRow}>
              <PlayingCard card="Qh" size="large" />
              <PlayingCard card="7c" size="large" />
              <PlayingCard card="2h" size="large" />
            </div>
          )}
        </div>
      </PanelSection>
    </Panel>
  );
}
