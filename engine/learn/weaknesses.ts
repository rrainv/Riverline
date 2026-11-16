import { deepFreeze } from '../freeze';
import type { LearnWeaknessSpec } from './types';

/**
 * Explicit, engine-anchored list of where Riverline's models are coarse or absent.
 * Codes trace back to the product authority taxonomy so every limit stays honest.
 */
export const LEARN_WEAKNESS_SPECS: readonly LearnWeaknessSpec[] = deepFreeze([
  {
    id: 'postflop_fallbacks',
    tier: 'estimated',
    sourceCode: 'heuristic_postflop_facing_wager_coarse',
    targetRoom: 'review',
  },
  {
    id: 'facing_3bet_4bet',
    tier: 'estimated',
    sourceCode: 'heuristic_facing_3bet_coarse',
    targetRoom: 'strategy',
  },
  {
    id: 'multiway_postflop',
    tier: 'estimated',
    sourceCode: 'heuristic_postflop_multiway_coarse',
    targetRoom: 'equity',
  },
  {
    id: 'duel_bot_model',
    tier: 'estimated',
    sourceCode: 'duel_bot_local_policy',
    targetRoom: 'training',
  },
  {
    id: 'postflop_personal_plan',
    tier: 'unavailable',
    sourceCode: 'preflop_only_personal_strategy',
    targetRoom: 'strategy',
  },
  {
    id: 'solver_and_imports',
    tier: 'unavailable',
    sourceCode: 'no_runtime_solver_or_hh_import',
    targetRoom: 'hand',
  },
]);

export function getLearnWeaknesses(): readonly LearnWeaknessSpec[] {
  return LEARN_WEAKNESS_SPECS;
}
