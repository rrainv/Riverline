import { assertMilliBbAlignment, assertPositiveMilliBb } from './amounts';
import { deepFreeze } from './freeze';
import { ANTE_TYPES, POKER_VARIANT, type AnteType } from './schema';

export const GAME_RULES_DEFINITION_SCHEMA_VERSION = 'game-rules-definition/v1' as const;
export const GAME_RULES_DEFINITION_V2_SCHEMA_VERSION = 'game-rules-definition/v2' as const;
export const GAME_RULES_SNAPSHOT_V2_SCHEMA_VERSION = 'game-rules-snapshot/v2' as const;
export const GAME_RULES_PRESET_SCHEMA_VERSION = 'game-rules-preset/v1' as const;
export const GAME_RULES_SNAPSHOT_SCHEMA_VERSION = 'game-rules-snapshot/v1' as const;
export const GAME_RULES_SEMANTIC_FINGERPRINT_PREFIX = 'game-rules-semantic/v1:' as const;

export const GAME_RULES_VARIANTS = Object.freeze({
  NO_LIMIT_TEXAS_HOLDEM: POKER_VARIANT,
} as const);

export const GAME_RULES_FORMATS = Object.freeze({
  CASH: 'cash',
  LEGACY_UNSPECIFIED: 'legacy_unspecified',
} as const);

export const GAME_RULES_STRADDLE_TYPES = Object.freeze({
  NONE: 'none',
} as const);

export const GAME_RULES_COLLECTION_TYPES = Object.freeze({
  NONE: 'none',
  FIXED_PER_SEATED_PLAYER: 'fixed_per_seated_player',
} as const);

export const GAME_RULES_COLLECTION_TIMINGS = Object.freeze({
  HAND_START_BEFORE_ANTES_AND_BLINDS: 'hand_start_before_antes_and_blinds',
} as const);

export const GAME_RULES_COLLECTION_BASES = Object.freeze({
  SEATED_PLAYERS: 'seated_players',
} as const);

export const GAME_RULES_COLLECTION_DESTINATIONS = Object.freeze({
  OUTSIDE_CONTESTABLE_POT: 'outside_contestable_pot',
} as const);

export const GAME_RULES_COLLECTION_ROUNDING = Object.freeze({
  NONE: 'none',
} as const);

export const GAME_RULES_COLLECTION_SHORTFALL_POLICIES = Object.freeze({
  REJECT_HAND: 'reject_hand',
} as const);

export const GAME_RULES_PRESET_ORIGIN_KINDS = Object.freeze({
  RIVERLINE_BUILTIN: 'riverline_builtin',
  USER_DEFINED: 'user_defined',
  EXTERNAL: 'external',
} as const);

export const GAME_RULES_PRESET_STATES = Object.freeze({
  ACTIVE: 'active',
  DEPRECATED: 'deprecated',
} as const);

export const GAME_RULES_SNAPSHOT_SOURCE_KINDS = Object.freeze({
  DIRECT: 'direct',
  PRESET: 'preset',
  LEGACY_COMPATIBILITY: 'legacy_compatibility',
} as const);

export interface GameRulesTableSize {
  readonly minimumSeated: number;
  readonly maximumSeated: number;
}

export interface GameRulesBlinds {
  readonly smallBlindMilliBb: number;
  readonly bigBlindMilliBb: number;
  readonly chipUnitMilliBb: number;
}

export interface GameRulesAnte {
  readonly type: AnteType;
  readonly amountMilliBb: number;
}

export interface GameRulesStraddle {
  readonly type: (typeof GAME_RULES_STRADDLE_TYPES)[keyof typeof GAME_RULES_STRADDLE_TYPES];
}

export type GameRulesCollectionPolicy =
  | { readonly type: typeof GAME_RULES_COLLECTION_TYPES.NONE }
  | {
      readonly type: typeof GAME_RULES_COLLECTION_TYPES.FIXED_PER_SEATED_PLAYER;
      readonly amountMilliBb: number;
      readonly timing: (typeof GAME_RULES_COLLECTION_TIMINGS)[keyof typeof GAME_RULES_COLLECTION_TIMINGS];
      readonly basis: (typeof GAME_RULES_COLLECTION_BASES)[keyof typeof GAME_RULES_COLLECTION_BASES];
      readonly destination: (typeof GAME_RULES_COLLECTION_DESTINATIONS)[keyof typeof GAME_RULES_COLLECTION_DESTINATIONS];
      readonly rounding: (typeof GAME_RULES_COLLECTION_ROUNDING)[keyof typeof GAME_RULES_COLLECTION_ROUNDING];
      readonly shortfallPolicy: (typeof GAME_RULES_COLLECTION_SHORTFALL_POLICIES)[keyof typeof GAME_RULES_COLLECTION_SHORTFALL_POLICIES];
    };

export interface GameRulesRecordedSettlementPolicy {
  readonly type: 'source_recorded_rake';
  readonly rakeModel: 'unknown';
}

export interface GameRulesDefinition {
  readonly schemaVersion:
    | typeof GAME_RULES_DEFINITION_SCHEMA_VERSION
    | typeof GAME_RULES_DEFINITION_V2_SCHEMA_VERSION;
  readonly variant: (typeof GAME_RULES_VARIANTS)[keyof typeof GAME_RULES_VARIANTS];
  readonly format: (typeof GAME_RULES_FORMATS)[keyof typeof GAME_RULES_FORMATS];
  readonly tableSize: GameRulesTableSize;
  readonly blinds: GameRulesBlinds;
  readonly ante: GameRulesAnte;
  readonly straddle: GameRulesStraddle;
  readonly collectionPolicy: GameRulesCollectionPolicy;
  readonly recordedSettlementPolicy?: GameRulesRecordedSettlementPolicy;
}

export type GameRulesPresetOrigin =
  | { readonly kind: typeof GAME_RULES_PRESET_ORIGIN_KINDS.RIVERLINE_BUILTIN }
  | { readonly kind: typeof GAME_RULES_PRESET_ORIGIN_KINDS.USER_DEFINED }
  | { readonly kind: typeof GAME_RULES_PRESET_ORIGIN_KINDS.EXTERNAL; readonly operator: string };

export interface GameRulesSetup {
  readonly seatedPlayers: number;
}

export interface GameRulesPreset {
  readonly schemaVersion: typeof GAME_RULES_PRESET_SCHEMA_VERSION;
  readonly id: string;
  readonly revision: number;
  readonly origin: GameRulesPresetOrigin;
  readonly displayName: string;
  readonly description: string;
  readonly state: (typeof GAME_RULES_PRESET_STATES)[keyof typeof GAME_RULES_PRESET_STATES];
  readonly setupDefaults: GameRulesSetup;
  readonly definition: GameRulesDefinition;
}

export type GameRulesSnapshotSource =
  | { readonly kind: typeof GAME_RULES_SNAPSHOT_SOURCE_KINDS.DIRECT }
  | {
      readonly kind: typeof GAME_RULES_SNAPSHOT_SOURCE_KINDS.PRESET;
      readonly presetId: string;
      readonly presetRevision: number;
    }
  | {
      readonly kind: typeof GAME_RULES_SNAPSHOT_SOURCE_KINDS.LEGACY_COMPATIBILITY;
      readonly presetId: string;
      readonly presetRevision: number;
      readonly legacyMode: 'home' | 'clubgg';
    };

export interface GameRulesSnapshotInput {
  readonly source: GameRulesSnapshotSource;
  readonly setup: GameRulesSetup;
  readonly definition: GameRulesDefinition;
}

export interface GameRulesSnapshot {
  readonly schemaVersion:
    | typeof GAME_RULES_SNAPSHOT_SCHEMA_VERSION
    | typeof GAME_RULES_SNAPSHOT_V2_SCHEMA_VERSION;
  readonly source: GameRulesSnapshotSource;
  readonly setup: GameRulesSetup;
  readonly semanticFingerprint: string;
  readonly definition: GameRulesDefinition;
}

const DEFINITION_KEYS = Object.freeze([
  'schemaVersion',
  'variant',
  'format',
  'tableSize',
  'blinds',
  'ante',
  'straddle',
  'collectionPolicy',
]);
const TABLE_SIZE_KEYS = Object.freeze(['minimumSeated', 'maximumSeated']);
const BLINDS_KEYS = Object.freeze(['smallBlindMilliBb', 'bigBlindMilliBb', 'chipUnitMilliBb']);
const ANTE_KEYS = Object.freeze(['type', 'amountMilliBb']);
const STRADDLE_KEYS = Object.freeze(['type']);
const NO_COLLECTION_KEYS = Object.freeze(['type']);
const FIXED_COLLECTION_KEYS = Object.freeze([
  'type',
  'amountMilliBb',
  'timing',
  'basis',
  'destination',
  'rounding',
  'shortfallPolicy',
]);
const PRESET_KEYS = Object.freeze([
  'schemaVersion',
  'id',
  'revision',
  'origin',
  'displayName',
  'description',
  'state',
  'setupDefaults',
  'definition',
]);
const SETUP_KEYS = Object.freeze(['seatedPlayers']);
const SNAPSHOT_KEYS = Object.freeze([
  'schemaVersion',
  'source',
  'setup',
  'semanticFingerprint',
  'definition',
]);
const SNAPSHOT_INPUT_KEYS = Object.freeze(['source', 'setup', 'definition']);
const DIRECT_SOURCE_KEYS = Object.freeze(['kind']);
const PRESET_SOURCE_KEYS = Object.freeze(['kind', 'presetId', 'presetRevision']);
const LEGACY_SOURCE_KEYS = Object.freeze(['kind', 'presetId', 'presetRevision', 'legacyMode']);
const BUILTIN_ORIGIN_KEYS = Object.freeze(['kind']);
const USER_DEFINED_ORIGIN_KEYS = Object.freeze(['kind']);
const EXTERNAL_ORIGIN_KEYS = Object.freeze(['kind', 'operator']);
const PRESET_ID_PATTERN = /^[a-z0-9][a-z0-9:._-]{0,127}$/;

function requirePlainObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new RangeError(`${label} must contain exactly: ${wanted.join(', ')}`);
  }
}

function requireEnum<T extends string>(
  value: unknown,
  vocabulary: Readonly<Record<string, T>>,
  label: string,
): T {
  const values: readonly string[] = Object.values(vocabulary);
  if (typeof value !== 'string' || !values.includes(value)) {
    throw new RangeError(`Unsupported ${label}: ${String(value)}`);
  }
  return value as T;
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string`);
  return value;
}

function requirePositiveInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
  return value;
}

function normalizePresetId(value: unknown, label = 'GameRulesPreset.id'): string {
  const id = requireNonEmptyString(value, label);
  if (!PRESET_ID_PATTERN.test(id)) {
    throw new RangeError(`${label} must use a stable lowercase identifier`);
  }
  return id;
}

function normalizeTableSize(tableSize: unknown): GameRulesTableSize {
  const obj = requirePlainObject(tableSize, 'GameRulesDefinition.tableSize');
  requireExactKeys(obj, TABLE_SIZE_KEYS, 'GameRulesDefinition.tableSize');
  const minimumSeated = obj.minimumSeated;
  const maximumSeated = obj.maximumSeated;
  if (
    typeof minimumSeated !== 'number' ||
    typeof maximumSeated !== 'number' ||
    !Number.isInteger(minimumSeated) ||
    !Number.isInteger(maximumSeated) ||
    minimumSeated < 2 ||
    maximumSeated > 10 ||
    minimumSeated > maximumSeated
  ) {
    throw new RangeError(
      'GameRulesDefinition.tableSize must stay within 2 through 10 with minimumSeated <= maximumSeated',
    );
  }
  return { minimumSeated, maximumSeated };
}

function normalizeBlinds(blinds: unknown): GameRulesBlinds {
  const obj = requirePlainObject(blinds, 'GameRulesDefinition.blinds');
  requireExactKeys(obj, BLINDS_KEYS, 'GameRulesDefinition.blinds');
  const chipUnitMilliBb = assertPositiveMilliBb(
    obj.chipUnitMilliBb,
    'GameRulesDefinition.blinds.chipUnitMilliBb',
  );
  const smallBlindMilliBb = assertPositiveMilliBb(
    obj.smallBlindMilliBb,
    'GameRulesDefinition.blinds.smallBlindMilliBb',
  );
  const bigBlindMilliBb = assertPositiveMilliBb(
    obj.bigBlindMilliBb,
    'GameRulesDefinition.blinds.bigBlindMilliBb',
  );
  if (bigBlindMilliBb !== 1000) {
    throw new RangeError('GameRulesDefinition.blinds.bigBlindMilliBb must equal 1000 in v1');
  }
  if (smallBlindMilliBb > bigBlindMilliBb) {
    throw new RangeError('GameRulesDefinition.blinds.smallBlindMilliBb cannot exceed the big blind');
  }
  assertMilliBbAlignment(
    smallBlindMilliBb,
    chipUnitMilliBb,
    'GameRulesDefinition.blinds.smallBlindMilliBb',
  );
  assertMilliBbAlignment(
    bigBlindMilliBb,
    chipUnitMilliBb,
    'GameRulesDefinition.blinds.bigBlindMilliBb',
  );
  return { smallBlindMilliBb, bigBlindMilliBb, chipUnitMilliBb };
}

function normalizeAnte(ante: unknown, chipUnitMilliBb: number): GameRulesAnte {
  const obj = requirePlainObject(ante, 'GameRulesDefinition.ante');
  requireExactKeys(obj, ANTE_KEYS, 'GameRulesDefinition.ante');
  const type = requireEnum(obj.type, ANTE_TYPES, 'ante type');
  const amountMilliBb = assertMilliBbAlignment(
    obj.amountMilliBb,
    chipUnitMilliBb,
    'GameRulesDefinition.ante.amountMilliBb',
  );
  if (type === ANTE_TYPES.NONE && amountMilliBb !== 0) {
    throw new RangeError('A none ante must use amountMilliBb 0');
  }
  if (type !== ANTE_TYPES.NONE && amountMilliBb === 0) {
    throw new RangeError('An enabled ante must use a positive amountMilliBb');
  }
  return { type, amountMilliBb };
}

function normalizeStraddle(straddle: unknown): GameRulesStraddle {
  const obj = requirePlainObject(straddle, 'GameRulesDefinition.straddle');
  requireExactKeys(obj, STRADDLE_KEYS, 'GameRulesDefinition.straddle');
  const type = requireEnum(obj.type, GAME_RULES_STRADDLE_TYPES, 'straddle type');
  return { type };
}

function normalizeCollectionPolicy(
  collectionPolicy: unknown,
  chipUnitMilliBb: number,
): GameRulesCollectionPolicy {
  const obj = requirePlainObject(collectionPolicy, 'GameRulesDefinition.collectionPolicy');
  const type = requireEnum(obj.type, GAME_RULES_COLLECTION_TYPES, 'collection policy type');
  if (type === GAME_RULES_COLLECTION_TYPES.NONE) {
    requireExactKeys(obj, NO_COLLECTION_KEYS, 'GameRulesDefinition.collectionPolicy none policy');
    return { type };
  }

  requireExactKeys(obj, FIXED_COLLECTION_KEYS, 'GameRulesDefinition.collectionPolicy fixed policy');
  const amountMilliBb = assertPositiveMilliBb(
    obj.amountMilliBb,
    'GameRulesDefinition.collectionPolicy.amountMilliBb',
  );
  assertMilliBbAlignment(
    amountMilliBb,
    chipUnitMilliBb,
    'GameRulesDefinition.collectionPolicy.amountMilliBb',
  );
  const timing = requireEnum(obj.timing, GAME_RULES_COLLECTION_TIMINGS, 'collection timing');
  const basis = requireEnum(obj.basis, GAME_RULES_COLLECTION_BASES, 'collection basis');
  const destination = requireEnum(
    obj.destination,
    GAME_RULES_COLLECTION_DESTINATIONS,
    'collection destination',
  );
  const rounding = requireEnum(obj.rounding, GAME_RULES_COLLECTION_ROUNDING, 'collection rounding');
  const shortfallPolicy = requireEnum(
    obj.shortfallPolicy,
    GAME_RULES_COLLECTION_SHORTFALL_POLICIES,
    'collection shortfall policy',
  );
  return {
    type,
    amountMilliBb,
    timing,
    basis,
    destination,
    rounding,
    shortfallPolicy,
  };
}

function normalizeDefinition(definition: unknown): GameRulesDefinition {
  const obj = requirePlainObject(definition, 'GameRulesDefinition');
  const recorded = obj.schemaVersion === GAME_RULES_DEFINITION_V2_SCHEMA_VERSION;
  requireExactKeys(
    obj,
    recorded ? [...DEFINITION_KEYS, 'recordedSettlementPolicy'] : DEFINITION_KEYS,
    'GameRulesDefinition',
  );
  if (!recorded && obj.schemaVersion !== GAME_RULES_DEFINITION_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${GAME_RULES_DEFINITION_SCHEMA_VERSION}`);
  }
  const variant = requireEnum(obj.variant, GAME_RULES_VARIANTS, 'game rules variant');
  const format = requireEnum(obj.format, GAME_RULES_FORMATS, 'game rules format');
  const tableSize = normalizeTableSize(obj.tableSize);
  const blinds = normalizeBlinds(obj.blinds);
  const ante = normalizeAnte(obj.ante, blinds.chipUnitMilliBb);
  const straddle = normalizeStraddle(obj.straddle);
  const collectionPolicy = normalizeCollectionPolicy(obj.collectionPolicy, blinds.chipUnitMilliBb);

  if (recorded) {
    const policy = requirePlainObject(obj.recordedSettlementPolicy, 'recordedSettlementPolicy');
    requireExactKeys(policy, ['type', 'rakeModel'], 'recordedSettlementPolicy');
    if (
      policy.type !== 'source_recorded_rake' ||
      policy.rakeModel !== 'unknown' ||
      collectionPolicy.type !== 'none' ||
      format !== 'cash'
    ) {
      throw new RangeError(
        'Recorded settlement requires cash, no start collection, and unknown source-recorded rake model',
      );
    }
  }
  const schemaVersion = recorded
    ? GAME_RULES_DEFINITION_V2_SCHEMA_VERSION
    : GAME_RULES_DEFINITION_SCHEMA_VERSION;
  return {
    schemaVersion,
    variant,
    format,
    tableSize,
    blinds,
    ante,
    straddle,
    collectionPolicy,
    ...(recorded
      ? {
          recordedSettlementPolicy: {
            type: 'source_recorded_rake' as const,
            rakeModel: 'unknown' as const,
          },
        }
      : {}),
  };
}

export function validateGameRulesDefinition(definition: unknown): GameRulesDefinition {
  return deepFreeze(normalizeDefinition(definition));
}

export function createGameRulesDefinition(definition: GameRulesDefinition): GameRulesDefinition {
  return validateGameRulesDefinition(definition);
}

export function serializeGameRulesSemantics(definition: unknown): string {
  return JSON.stringify(normalizeDefinition(definition));
}

export function parseGameRulesSemanticSerialization(serialized: unknown): GameRulesDefinition {
  if (typeof serialized !== 'string' || !serialized) {
    throw new TypeError('Game rules semantic serialization must be a non-empty string');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new TypeError(`Invalid game rules semantic serialization: ${message}`);
  }
  return validateGameRulesDefinition(parsed);
}

export function getGameRulesSemanticFingerprint(definition: unknown): string {
  const schemaVersion =
    definition && typeof definition === 'object'
      ? (definition as { schemaVersion?: unknown }).schemaVersion
      : undefined;
  const prefix =
    schemaVersion === GAME_RULES_DEFINITION_V2_SCHEMA_VERSION
      ? 'game-rules-semantic/v2:'
      : GAME_RULES_SEMANTIC_FINGERPRINT_PREFIX;
  return `${prefix}${serializeGameRulesSemantics(definition)}`;
}

function normalizePresetOrigin(origin: unknown): GameRulesPresetOrigin {
  const obj = requirePlainObject(origin, 'GameRulesPreset.origin');
  const kind = requireEnum(obj.kind, GAME_RULES_PRESET_ORIGIN_KINDS, 'preset origin kind');
  if (kind === GAME_RULES_PRESET_ORIGIN_KINDS.RIVERLINE_BUILTIN) {
    requireExactKeys(obj, BUILTIN_ORIGIN_KEYS, 'GameRulesPreset.origin riverline_builtin');
    return { kind };
  }
  if (kind === GAME_RULES_PRESET_ORIGIN_KINDS.USER_DEFINED) {
    requireExactKeys(obj, USER_DEFINED_ORIGIN_KEYS, 'GameRulesPreset.origin user_defined');
    return { kind };
  }
  requireExactKeys(obj, EXTERNAL_ORIGIN_KEYS, 'GameRulesPreset.origin external');
  return {
    kind,
    operator: requireNonEmptyString(obj.operator, 'GameRulesPreset.origin.operator'),
  };
}

function normalizeSetup(
  setup: unknown,
  tableSize: GameRulesTableSize,
  label: string,
): GameRulesSetup {
  const obj = requirePlainObject(setup, label);
  requireExactKeys(obj, SETUP_KEYS, label);
  const seatedPlayers = obj.seatedPlayers;
  if (
    typeof seatedPlayers !== 'number' ||
    !Number.isInteger(seatedPlayers) ||
    seatedPlayers < tableSize.minimumSeated ||
    seatedPlayers > tableSize.maximumSeated
  ) {
    throw new RangeError(`${label}.seatedPlayers must fit the definition table-size policy`);
  }
  return { seatedPlayers };
}

function normalizePreset(preset: unknown): GameRulesPreset {
  const obj = requirePlainObject(preset, 'GameRulesPreset');
  requireExactKeys(obj, PRESET_KEYS, 'GameRulesPreset');
  if (obj.schemaVersion !== GAME_RULES_PRESET_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${GAME_RULES_PRESET_SCHEMA_VERSION}`);
  }
  const definition = normalizeDefinition(obj.definition);
  if (definition.schemaVersion !== GAME_RULES_DEFINITION_SCHEMA_VERSION) {
    throw new RangeError('GameRulesPreset v1 requires a v1 definition');
  }
  return {
    schemaVersion: GAME_RULES_PRESET_SCHEMA_VERSION,
    id: normalizePresetId(obj.id),
    revision: requirePositiveInteger(obj.revision, 'GameRulesPreset.revision'),
    origin: normalizePresetOrigin(obj.origin),
    displayName: requireNonEmptyString(obj.displayName, 'GameRulesPreset.displayName'),
    description: requireString(obj.description, 'GameRulesPreset.description'),
    state: requireEnum(obj.state, GAME_RULES_PRESET_STATES, 'preset state'),
    setupDefaults: normalizeSetup(obj.setupDefaults, definition.tableSize, 'GameRulesPreset.setupDefaults'),
    definition,
  };
}

export function validateGameRulesPreset(preset: unknown): GameRulesPreset {
  return deepFreeze(normalizePreset(preset));
}

export function createGameRulesPreset(preset: GameRulesPreset): GameRulesPreset {
  return validateGameRulesPreset(preset);
}

export function validateGameRulesPresetSet(presets: unknown): readonly GameRulesPreset[] {
  if (!Array.isArray(presets)) throw new TypeError('GameRulesPreset set must be an array');
  const normalized = presets.map(validateGameRulesPreset);
  const ids = new Set<string>();
  for (const preset of normalized) {
    if (ids.has(preset.id)) throw new RangeError(`Duplicate GameRulesPreset id: ${preset.id}`);
    ids.add(preset.id);
  }
  return deepFreeze(normalized);
}

function normalizeSnapshotSource(source: unknown): GameRulesSnapshotSource {
  const obj = requirePlainObject(source, 'GameRulesSnapshot.source');
  const kind = requireEnum(obj.kind, GAME_RULES_SNAPSHOT_SOURCE_KINDS, 'snapshot source kind');
  if (kind === GAME_RULES_SNAPSHOT_SOURCE_KINDS.DIRECT) {
    requireExactKeys(obj, DIRECT_SOURCE_KEYS, 'GameRulesSnapshot.source direct');
    return { kind };
  }
  if (kind === GAME_RULES_SNAPSHOT_SOURCE_KINDS.PRESET) {
    requireExactKeys(obj, PRESET_SOURCE_KEYS, 'GameRulesSnapshot.source preset');
    return {
      kind,
      presetId: normalizePresetId(obj.presetId, 'GameRulesSnapshot.source.presetId'),
      presetRevision: requirePositiveInteger(
        obj.presetRevision,
        'GameRulesSnapshot.source.presetRevision',
      ),
    };
  }
  requireExactKeys(obj, LEGACY_SOURCE_KEYS, 'GameRulesSnapshot.source legacy_compatibility');
  if (obj.legacyMode !== 'home' && obj.legacyMode !== 'clubgg') {
    throw new RangeError(`Unsupported legacy game mode: ${String(obj.legacyMode)}`);
  }
  return {
    kind,
    presetId: normalizePresetId(obj.presetId, 'GameRulesSnapshot.source.presetId'),
    presetRevision: requirePositiveInteger(
      obj.presetRevision,
      'GameRulesSnapshot.source.presetRevision',
    ),
    legacyMode: obj.legacyMode,
  };
}

export function createGameRulesSnapshot(input: GameRulesSnapshotInput): GameRulesSnapshot {
  const obj = requirePlainObject(input, 'GameRulesSnapshot input');
  requireExactKeys(obj, SNAPSHOT_INPUT_KEYS, 'GameRulesSnapshot input');
  const definition = normalizeDefinition(obj.definition);
  const snapshot: GameRulesSnapshot = {
    schemaVersion:
      definition.schemaVersion === GAME_RULES_DEFINITION_V2_SCHEMA_VERSION
        ? GAME_RULES_SNAPSHOT_V2_SCHEMA_VERSION
        : GAME_RULES_SNAPSHOT_SCHEMA_VERSION,
    source: normalizeSnapshotSource(obj.source),
    setup: normalizeSetup(obj.setup, definition.tableSize, 'GameRulesSnapshot.setup'),
    semanticFingerprint: getGameRulesSemanticFingerprint(definition),
    definition,
  };
  return deepFreeze(snapshot);
}

export function validateGameRulesSnapshot(snapshot: unknown): GameRulesSnapshot {
  const obj = requirePlainObject(snapshot, 'GameRulesSnapshot');
  requireExactKeys(obj, SNAPSHOT_KEYS, 'GameRulesSnapshot');
  if (
    obj.schemaVersion !== GAME_RULES_SNAPSHOT_SCHEMA_VERSION &&
    obj.schemaVersion !== GAME_RULES_SNAPSHOT_V2_SCHEMA_VERSION
  ) {
    throw new TypeError(`Expected ${GAME_RULES_SNAPSHOT_SCHEMA_VERSION}`);
  }
  const definition = normalizeDefinition(obj.definition);
  if (
    (obj.schemaVersion === GAME_RULES_SNAPSHOT_V2_SCHEMA_VERSION) !==
    (definition.schemaVersion === GAME_RULES_DEFINITION_V2_SCHEMA_VERSION)
  ) {
    throw new RangeError('GameRulesSnapshot and definition versions must match');
  }
  const expectedFingerprint = getGameRulesSemanticFingerprint(definition);
  if (obj.semanticFingerprint !== expectedFingerprint) {
    throw new RangeError('GameRulesSnapshot semanticFingerprint does not match its definition');
  }
  return deepFreeze({
    schemaVersion:
      definition.schemaVersion === GAME_RULES_DEFINITION_V2_SCHEMA_VERSION
        ? GAME_RULES_SNAPSHOT_V2_SCHEMA_VERSION
        : GAME_RULES_SNAPSHOT_SCHEMA_VERSION,
    source: normalizeSnapshotSource(obj.source),
    setup: normalizeSetup(obj.setup, definition.tableSize, 'GameRulesSnapshot.setup'),
    semanticFingerprint: expectedFingerprint,
    definition,
  });
}

const DEFAULT_BLINDS: GameRulesBlinds = Object.freeze({
  smallBlindMilliBb: 500,
  bigBlindMilliBb: 1000,
  chipUnitMilliBb: 100,
});
const DEFAULT_ANTE: GameRulesAnte = Object.freeze({ type: ANTE_TYPES.NONE, amountMilliBb: 0 });
const NO_STRADDLE: GameRulesStraddle = Object.freeze({ type: GAME_RULES_STRADDLE_TYPES.NONE });

export const NO_RAKE_CASH_GAME_RULES_PRESET: GameRulesPreset = createGameRulesPreset({
  schemaVersion: GAME_RULES_PRESET_SCHEMA_VERSION,
  id: 'riverline:builtin:no-rake-cash',
  revision: 1,
  origin: { kind: GAME_RULES_PRESET_ORIGIN_KINDS.RIVERLINE_BUILTIN },
  displayName: 'No-rake cash',
  description: "No-limit Hold'em with no collection.",
  state: GAME_RULES_PRESET_STATES.ACTIVE,
  setupDefaults: { seatedPlayers: 6 },
  definition: {
    schemaVersion: GAME_RULES_DEFINITION_SCHEMA_VERSION,
    variant: GAME_RULES_VARIANTS.NO_LIMIT_TEXAS_HOLDEM,
    format: GAME_RULES_FORMATS.CASH,
    tableSize: { minimumSeated: 2, maximumSeated: 10 },
    blinds: DEFAULT_BLINDS,
    ante: DEFAULT_ANTE,
    straddle: NO_STRADDLE,
    collectionPolicy: { type: GAME_RULES_COLLECTION_TYPES.NONE },
  },
});

export const FIXED_PER_SEATED_PLAYER_LEGACY_GAME_RULES_PRESET: GameRulesPreset = createGameRulesPreset({
  schemaVersion: GAME_RULES_PRESET_SCHEMA_VERSION,
  id: 'riverline:builtin:fixed-per-seated-player-100-millibb',
  revision: 1,
  origin: { kind: GAME_RULES_PRESET_ORIGIN_KINDS.RIVERLINE_BUILTIN },
  displayName: 'Fixed collection per seated player',
  description: 'Legacy-compatible 100 milliBB collection outside the contestable pot.',
  state: GAME_RULES_PRESET_STATES.ACTIVE,
  setupDefaults: { seatedPlayers: 8 },
  definition: {
    schemaVersion: GAME_RULES_DEFINITION_SCHEMA_VERSION,
    variant: GAME_RULES_VARIANTS.NO_LIMIT_TEXAS_HOLDEM,
    format: GAME_RULES_FORMATS.LEGACY_UNSPECIFIED,
    tableSize: { minimumSeated: 7, maximumSeated: 10 },
    blinds: DEFAULT_BLINDS,
    ante: DEFAULT_ANTE,
    straddle: NO_STRADDLE,
    collectionPolicy: {
      type: GAME_RULES_COLLECTION_TYPES.FIXED_PER_SEATED_PLAYER,
      amountMilliBb: 100,
      timing: GAME_RULES_COLLECTION_TIMINGS.HAND_START_BEFORE_ANTES_AND_BLINDS,
      basis: GAME_RULES_COLLECTION_BASES.SEATED_PLAYERS,
      destination: GAME_RULES_COLLECTION_DESTINATIONS.OUTSIDE_CONTESTABLE_POT,
      rounding: GAME_RULES_COLLECTION_ROUNDING.NONE,
      shortfallPolicy: GAME_RULES_COLLECTION_SHORTFALL_POLICIES.REJECT_HAND,
    },
  },
});

export const BUILT_IN_GAME_RULES_PRESETS: readonly GameRulesPreset[] = validateGameRulesPresetSet([
  NO_RAKE_CASH_GAME_RULES_PRESET,
  FIXED_PER_SEATED_PLAYER_LEGACY_GAME_RULES_PRESET,
]);
