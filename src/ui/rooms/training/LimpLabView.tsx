import { useMemo, useState } from 'preact/hooks';
import type { TrainingStore } from '../../../domain/training';
import {
  LIMP_LAB_SPOTS,
  type LimpLabAction,
} from '../../../domain/training/limpLab';
import { formatNumber, t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { Chip, TierBadge } from '../../kit/chip/Chip';
import { ChipButton } from '../../kit/choice/Choice';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import { PlayingCard } from '../../kit/playing-card/PlayingCard';
import styles from './TrainingRoom.module.css';

interface LimpLabViewProps {
  readonly store: TrainingStore;
}

export function LimpLabView({ store }: LimpLabViewProps) {
  const [limperFilter, setLimperFilter] = useState<'all' | 1 | 2 | 3>('all');
  const [spotIdx, setSpotIdx] = useState(0);
  const [chosenAction, setChosenAction] = useState<LimpLabAction | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [alignedCount, setAlignedCount] = useState(0);

  const filteredSpots = useMemo(() => {
    if (limperFilter === 'all') return LIMP_LAB_SPOTS;
    return LIMP_LAB_SPOTS.filter((s) => s.limpersCount === limperFilter);
  }, [limperFilter]);

  const spot = filteredSpots[spotIdx % filteredSpots.length] ?? LIMP_LAB_SPOTS[0]!;
  const isAligned = chosenAction === spot.recommendedAction;

  function handleAnswer(action: LimpLabAction): void {
    if (chosenAction !== null) return;
    setChosenAction(action);
    setAnsweredCount((c) => c + 1);
    if (action === spot.recommendedAction) {
      setAlignedCount((c) => c + 1);
    }
  }

  function handleNext(): void {
    setChosenAction(null);
    setSpotIdx((i) => i + 1);
  }

  return (
    <div className={styles.hubGrid}>
      <div className={styles.hubTableCol}>
        <Panel
          label={t('training.limp.eyebrow')}
          title={t('training.limp.heading')}
        >
          <div className={styles.filterGroup}>
            <Button variant="secondary" onClick={() => store.setActiveView('hub')}>
              {t('training.rail.modes')}
            </Button>
            {(['all', 1, 2, 3] as const).map((cnt) => (
              <ChipButton
                key={String(cnt)}
                selected={limperFilter === cnt}
                onToggle={() => {
                  setLimperFilter(cnt);
                  setSpotIdx(0);
                  setChosenAction(null);
                }}
              >
                {cnt === 'all'
                  ? t('training.limp.filterAll')
                  : t('training.limp.filterCount', { count: cnt })}
              </ChipButton>
            ))}
          </div>

          <PanelSection>
            <div className={styles.duelBadges}>
              <Chip>
                <PokerNotation>{`${spot.stackBb} bb`}</PokerNotation>
              </Chip>
              <Chip>
                <PokerNotation>{spot.heroPosition}</PokerNotation>
              </Chip>
              <Chip>
                {t('training.limp.facingCount', { count: spot.limpersCount })}
              </Chip>
              {answeredCount > 0 && (
                <Chip>
                  {t('training.drill.sessionProgress', {
                    aligned: formatNumber(alignedCount),
                    total: formatNumber(answeredCount),
                  })}
                </Chip>
              )}
            </div>

            <div className={styles.duelBadges} dir="ltr">
              <PlayingCard size="standard" state="face" card={spot.heroCards[0]} />
              <PlayingCard size="standard" state="face" card={spot.heroCards[1]} />
            </div>

            <div className={styles.filterGroup}>
              {(['iso_raise', 'overlimp', 'fold'] as const).map((act) => (
                <Button
                  key={act}
                  variant={chosenAction === act ? 'primary' : 'secondary'}
                  disabled={chosenAction !== null}
                  onClick={() => handleAnswer(act)}
                >
                  {act === 'iso_raise' && spot.recommendedSizeBb !== null
                    ? `${t('training.limp.action.iso_raise')} (${spot.recommendedSizeBb} bb)`
                    : t(`training.limp.action.${act}` as never)}
                </Button>
              ))}
            </div>
          </PanelSection>
        </Panel>
      </div>

      <div className={styles.column}>
        <Panel title={t('training.limp.planHeading')}>
          {chosenAction === null ? (
            <p className={styles.planBody}>{t('training.limp.prompt')}</p>
          ) : (
            <div className={styles.controlStack}>
              <div className={styles.duelBadges}>
                <TierBadge tier="estimated" detail={t('training.limp.planDetail')} />
                <Chip>
                  {isAligned ? t('training.limp.aligned') : t('training.limp.different')}
                </Chip>
              </div>
              <p className={styles.planBody}>
                {t('training.limp.recommendedLine', {
                  action: t(`training.limp.action.${spot.recommendedAction}` as never),
                  size: spot.recommendedSizeBb !== null ? ` (${spot.recommendedSizeBb} bb)` : '',
                })}
              </p>
              <p className={styles.planBody}>
                {t(`training.limp.rationale.${spot.rationaleKey}` as never)}
              </p>
              <Button variant="primary" onClick={handleNext}>
                {t('training.limp.nextBtn')}
              </Button>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
