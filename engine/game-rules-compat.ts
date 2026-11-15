import {
  FIXED_PER_SEATED_PLAYER_LEGACY_GAME_RULES_PRESET,
  GAME_RULES_DEFINITION_SCHEMA_VERSION,
  GAME_RULES_SNAPSHOT_SOURCE_KINDS,
  NO_RAKE_CASH_GAME_RULES_PRESET,
  createGameRulesSnapshot,
  type GameRulesSnapshot,
} from './game-rules';
import { GAME_MODES, type GameMode, type PokerAnteSpec } from './schema';
import { validateGameConfiguration } from './validate';

export interface LegacyGameConfiguration {
  readonly mode: GameMode;
  readonly smallBlindMilliBb: number;
  readonly bigBlindMilliBb: number;
  readonly chipUnitMilliBb: number;
  readonly ante: PokerAnteSpec;
}

const LEGACY_GAME_KEYS = Object.freeze([
  'mode',
  'smallBlindMilliBb',
  'bigBlindMilliBb',
  'chipUnitMilliBb',
  'ante',
]);

function requireLegacyGameConfiguration(game: unknown): LegacyGameConfiguration {
  if (!game || typeof game !== 'object' || Array.isArray(game)) {
    throw new TypeError('Legacy game configuration must be an object');
  }
  const record = game as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...LEGACY_GAME_KEYS].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new RangeError(`Legacy game configuration must contain exactly: ${expected.join(', ')}`);
  }
  if (record.mode !== GAME_MODES.HOME && record.mode !== GAME_MODES.CLUBGG) {
    throw new RangeError(`Unsupported legacy game mode: ${String(record.mode)}`);
  }
  return game as LegacyGameConfiguration;
}

/**
 * Copy a PokerState v1 initialization game configuration into an immutable GameRulesSnapshot v1.
 */
export function createGameRulesSnapshotFromLegacyGameConfiguration(
  game: LegacyGameConfiguration,
  tableSize: number,
): GameRulesSnapshot {
  const validGame = requireLegacyGameConfiguration(game);
  validateGameConfiguration(validGame, tableSize);

  const preset =
    validGame.mode === GAME_MODES.CLUBGG
      ? FIXED_PER_SEATED_PLAYER_LEGACY_GAME_RULES_PRESET
      : NO_RAKE_CASH_GAME_RULES_PRESET;

  return createGameRulesSnapshot({
    source: {
      kind: GAME_RULES_SNAPSHOT_SOURCE_KINDS.LEGACY_COMPATIBILITY,
      presetId: preset.id,
      presetRevision: preset.revision,
      legacyMode: validGame.mode,
    },
    setup: { seatedPlayers: tableSize },
    definition: {
      ...preset.definition,
      schemaVersion: GAME_RULES_DEFINITION_SCHEMA_VERSION,
      blinds: {
        smallBlindMilliBb: validGame.smallBlindMilliBb,
        bigBlindMilliBb: validGame.bigBlindMilliBb,
        chipUnitMilliBb: validGame.chipUnitMilliBb,
      },
      ante: {
        type: validGame.ante.type,
        amountMilliBb: validGame.ante.amountMilliBb,
      },
    },
  });
}
