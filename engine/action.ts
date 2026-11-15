import { assertMilliBbAlignment } from './amounts';
import {
  ACTION_TYPES,
  POKER_ACTION_SCHEMA_VERSION,
  type ActionType,
  type PokerAction,
} from './schema';

const ACTION_TYPE_VALUES: readonly string[] = Object.freeze(Object.values(ACTION_TYPES));
const SIZED_ACTIONS = new Set<string>([ACTION_TYPES.BET, ACTION_TYPES.RAISE]);

export function validateAction(action: unknown, chipUnitMilliBb: number): PokerAction {
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    throw new TypeError('Action must be an object');
  }
  const candidate = action as Record<string, unknown>;
  if (candidate.schemaVersion !== POKER_ACTION_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${POKER_ACTION_SCHEMA_VERSION}`);
  }
  const keys = Object.keys(candidate).sort();
  const expectedKeys = ['amountToMilliBb', 'playerId', 'schemaVersion', 'type'];
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    throw new RangeError(
      'Action v1 must contain exactly schemaVersion, playerId, type, and amountToMilliBb',
    );
  }
  if (typeof candidate.playerId !== 'string' || !candidate.playerId.trim()) {
    throw new TypeError('action.playerId is required');
  }
  if (typeof candidate.type !== 'string' || !ACTION_TYPE_VALUES.includes(candidate.type)) {
    throw new RangeError('Unsupported action type');
  }
  if (!Object.hasOwn(candidate, 'amountToMilliBb')) {
    throw new TypeError('action.amountToMilliBb is required');
  }

  if (SIZED_ACTIONS.has(candidate.type)) {
    const amount = assertMilliBbAlignment(
      candidate.amountToMilliBb,
      chipUnitMilliBb,
      'action.amountToMilliBb',
    );
    if (amount <= 0) throw new RangeError('action.amountToMilliBb must be positive');
  } else if (candidate.amountToMilliBb !== null) {
    throw new RangeError(`${candidate.type} must use amountToMilliBb: null`);
  }
  return candidate as unknown as PokerAction;
}

export function createAction(
  playerId: string,
  type: ActionType,
  amountToMilliBb: number | null = null,
): PokerAction {
  return Object.freeze({
    schemaVersion: POKER_ACTION_SCHEMA_VERSION,
    playerId,
    type,
    amountToMilliBb,
  });
}
