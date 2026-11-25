import {
  STRATEGY_STACK_DEPTHS,
  type StrategyFamilyId,
  type StrategyStackDepthBb,
  type StrategyTableSize,
} from '../../../engine-api';
import { activeGameSettingsSignal } from '../../../domain/gameSettings';
import { navigateTo, settingsSectionSignal } from '../../../domain/shellState';
import { t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import type { PostflopRuleTextureId, StrategyStore } from '../../../domain/strategy';
import { Button } from '../../kit/button/Button';
import { Chip } from '../../kit/chip/Chip';
import { ChipButton, SegmentedControl } from '../../kit/choice/Choice';
import { CommitmentRiverView } from './CommitmentRiverView';
import { LeakMapView } from './LeakMapView';
import { PlanBuilderView } from './PlanBuilderView';
import { PostflopSolverView } from './PostflopSolverView';
import { RangeWalkView } from './RangeWalkView';
import { SpotMapView } from './SpotMapView';
import { TextureSubsetView } from './TextureSubsetView';
import styles from './StrategyRoom.module.css';

export interface StrategyRoomProps {
  readonly store: StrategyStore;
  readonly onDrillSpot?: (spot: {
    readonly position: string;
    readonly familyId: StrategyFamilyId;
  }) => void;
  readonly onDrillTexture?: (texture: PostflopRuleTextureId) => void;
}

export function StrategyRoom({ store, onDrillSpot, onDrillTexture }: StrategyRoomProps) {
  const activeView = store.activeViewSignal.value;
  const tableSize = store.tableSizeSignal.value;
  const stackDepthBb = store.stackDepthBbSignal.value;

  const gs = activeGameSettingsSignal.value;
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
          <Chip>
            <PokerNotation>{`${gs.name} · ${gs.rakePct}%`}</PokerNotation>
          </Chip>
          <Button
            variant="secondary"
            onClick={() => {
              settingsSectionSignal.value = 'game';
              navigateTo('settings');
            }}
          >
            {t('settings.tab.game')}
          </Button>
        </div>
      </div>

      {activeView === 'spotMap' ? (
        <SpotMapView store={store} />
      ) : activeView === 'builder' ? (
        <PlanBuilderView store={store} onDrillSpot={onDrillSpot} />
      ) : activeView === 'commitment' ? (
        <CommitmentRiverView store={store} />
      ) : activeView === 'rangeWalk' ? (
        <RangeWalkView store={store} />
      ) : activeView === 'textureSubset' ? (
        <TextureSubsetView store={store} />
      ) : activeView === 'postflopLab' ? (
        <PostflopSolverView store={store} onDrillTexture={onDrillTexture} />
      ) : (
        <LeakMapView store={store} onDrillSpot={onDrillSpot} />
      )}
    </div>
  );
}
