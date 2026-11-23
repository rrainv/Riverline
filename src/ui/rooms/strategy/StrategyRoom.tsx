import {
  STRATEGY_STACK_DEPTHS,
  type StrategyStackDepthBb,
  type StrategyTableSize,
} from '../../../engine-api';
import { t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import type { StrategyStore } from '../../../domain/strategy';
import { ChipButton, SegmentedControl } from '../../kit/choice/Choice';
import { CommitmentRiverView } from './CommitmentRiverView';
import { LeakMapView } from './LeakMapView';
import { PlanBuilderView } from './PlanBuilderView';
import { RangeWalkView } from './RangeWalkView';
import { SpotMapView } from './SpotMapView';
import styles from './StrategyRoom.module.css';

export interface StrategyRoomProps {
  readonly store: StrategyStore;
}

export function StrategyRoom({ store }: StrategyRoomProps) {
  const activeView = store.activeViewSignal.value;
  const tableSize = store.tableSizeSignal.value;
  const stackDepthBb = store.stackDepthBbSignal.value;

  const tableOptions: Array<{ value: `${StrategyTableSize}`; label: string }> = [
    { value: '6', label: t('strategy.rules.table6') },
    { value: '8', label: t('strategy.rules.table8') },
  ];

  return (
    <div className={styles.room}>
      <div className={styles.rulesBar}>
        <div className={styles.rulesControls}>
          <SegmentedControl
            ariaLabel={t('strategy.spotMap.eyebrow')}
            options={tableOptions}
            value={String(tableSize) as `${StrategyTableSize}`}
            onChange={(val) =>
              store.setTableSize(Number(val) as StrategyTableSize)
            }
          />
          <div className={styles.chipGroup}>
            {STRATEGY_STACK_DEPTHS.map((bb) => (
              <ChipButton
                key={bb}
                selected={stackDepthBb === bb}
                onToggle={() => store.setStackDepthBb(bb as StrategyStackDepthBb)}
              >
                <PokerNotation>{t('strategy.rules.stackBb', { bb })}</PokerNotation>
              </ChipButton>
            ))}
          </div>
        </div>
      </div>

      {activeView === 'spotMap' ? (
        <SpotMapView store={store} />
      ) : activeView === 'builder' ? (
        <PlanBuilderView store={store} />
      ) : activeView === 'commitment' ? (
        <CommitmentRiverView store={store} />
      ) : activeView === 'rangeWalk' ? (
        <RangeWalkView store={store} />
      ) : (
        <LeakMapView store={store} />
      )}
    </div>
  );
}
