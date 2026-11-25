import type { StrategyStackDepthBb, StrategyTableSize } from '../personal-strategy/types';
import type { TrainingDrillTarget } from './types';

export interface SpotCollectionSpec {
  readonly id: 'push_fold_10bb' | 'bb_defense_25x' | 'btn_opens' | 'postflop_wet';
  readonly tableSize: StrategyTableSize;
  readonly stackDepthBb: StrategyStackDepthBb;
  readonly target: TrainingDrillTarget | 'auto';
  readonly focusPosition: string | null;
  readonly postflopWetOnly?: boolean;
}

export const SPOT_COLLECTIONS: readonly SpotCollectionSpec[] = Object.freeze([
  {
    id: 'push_fold_10bb',
    tableSize: 6,
    stackDepthBb: 30,
    target: 'preflop_rfi',
    focusPosition: 'SB',
  },
  {
    id: 'bb_defense_25x',
    tableSize: 6,
    stackDepthBb: 100,
    target: 'preflop_facing_open',
    focusPosition: 'BB',
  },
  {
    id: 'btn_opens',
    tableSize: 6,
    stackDepthBb: 100,
    target: 'preflop_rfi',
    focusPosition: 'BTN',
  },
  {
    id: 'postflop_wet',
    tableSize: 6,
    stackDepthBb: 100,
    target: 'auto',
    focusPosition: null,
    postflopWetOnly: true,
  },
]);
