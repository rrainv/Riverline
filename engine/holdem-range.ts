import { assertCardArray, assertUniqueKnownCards } from './cards';
import { cloneData, deepFreeze } from './freeze';
import { isPreflopHandClass, PREFLOP_HAND_CLASSES } from './hand-class';
import {
  assertHoldemComboId,
  compareHoldemCards,
  getHoldemComboById,
  getHoldemCombosForHandClass,
  HOLDEM_COMBOS,
} from './holdem-combos';

export const HOLDEM_WEIGHTED_RANGE_SCHEMA_VERSION = 'holdem-weighted-range/v1';
export const HOLDEM_RANGE_PROVENANCE_SCHEMA_VERSION = 'holdem-range-provenance/v1';
export const HOLDEM_RANGE_INSPECTION_SCHEMA_VERSION = 'holdem-range-inspection/v1';
export const HOLDEM_CONDITIONED_RANGE_SCHEMA_VERSION = 'holdem-conditioned-range/v1';
export const HOLDEM_COMBO_DISTRIBUTION_SCHEMA_VERSION = 'holdem-combo-distribution/v1';
export const HOLDEM_RANGE_MATRIX_PROJECTION_SCHEMA_VERSION = 'holdem-range-matrix-projection/v1';
export const HOLDEM_RANGE_GAME = 'holdem';

export const HOLDEM_RANGE_ENTRY_STATES = Object.freeze({
  KNOWN: 'known',
  UNKNOWN: 'unknown',
} as const);

export type HoldemRangeEntryState =
  (typeof HOLDEM_RANGE_ENTRY_STATES)[keyof typeof HOLDEM_RANGE_ENTRY_STATES];

export const HOLDEM_RANGE_UNLISTED_POLICIES = Object.freeze({
  UNKNOWN: 'unknown',
  KNOWN_ZERO: 'known_zero',
} as const);

export type HoldemRangeUnlistedPolicy =
  (typeof HOLDEM_RANGE_UNLISTED_POLICIES)[keyof typeof HOLDEM_RANGE_UNLISTED_POLICIES];

export const HOLDEM_RANGE_PROVENANCE_KINDS = Object.freeze({
  MANUAL: 'manual',
  IMPORTED: 'imported',
  PERSONAL_DIRECT: 'personal_direct',
  PERSONAL_INFERRED: 'personal_inferred',
  STRATEGY_PROVIDER: 'strategy_provider',
  SOLVER_REFERENCE: 'solver_reference',
  DERIVED_FILTER: 'derived_filter',
  EXTERNAL: 'external',
} as const);

export interface HoldemRangeProvenanceSource {
  readonly id: string;
  readonly kind: string;
  readonly sourceId: string | null;
  readonly sourceSchemaVersion: string | null;
  readonly createdAt: string | null;
  readonly parentRangeId: string | null;
  readonly operation: string | null;
}

export interface HoldemRangeKnownEntry {
  readonly comboId: string;
  readonly state: 'known';
  readonly weight: number;
  readonly provenanceId: string | null;
}

export interface HoldemRangeUnknownEntry {
  readonly comboId: string;
  readonly state: 'unknown';
  readonly provenanceId: string | null;
}

export type HoldemRangeEntry = HoldemRangeKnownEntry | HoldemRangeUnknownEntry;

export interface HoldemWeightedRange {
  readonly schemaVersion: typeof HOLDEM_WEIGHTED_RANGE_SCHEMA_VERSION;
  readonly game: typeof HOLDEM_RANGE_GAME;
  readonly rangeId: string | null;
  readonly provenance: {
    readonly schemaVersion: typeof HOLDEM_RANGE_PROVENANCE_SCHEMA_VERSION;
    readonly sources: readonly HoldemRangeProvenanceSource[];
  };
  readonly entries: readonly HoldemRangeEntry[];
}

export interface HoldemRangeCoverageFacts {
  readonly totalCombos: number;
  readonly knownCombos: number;
  readonly unknownCombos: number;
  readonly knownZeroCombos: number;
  readonly positiveWeightCombos: number;
  readonly coverageRatio: number;
  readonly totalKnownWeight: number;
  readonly complete: boolean;
  readonly fullyUnknown: boolean;
  readonly emptyComplete: boolean;
}

export interface HoldemRangeInspection extends HoldemRangeCoverageFacts {
  readonly schemaVersion: typeof HOLDEM_RANGE_INSPECTION_SCHEMA_VERSION;
  readonly game: typeof HOLDEM_RANGE_GAME;
  readonly rangeId: string | null;
  readonly state: 'complete' | 'partial';
}

export interface HoldemConditionedRange {
  readonly schemaVersion: typeof HOLDEM_CONDITIONED_RANGE_SCHEMA_VERSION;
  readonly game: typeof HOLDEM_RANGE_GAME;
  readonly sourceRangeId: string | null;
  readonly blockers: readonly string[];
  readonly provenance: HoldemWeightedRange['provenance'];
  readonly derivationProvenance: HoldemRangeProvenanceSource;
  readonly eligibleEntries: readonly HoldemRangeEntry[];
  readonly blockedEntries: readonly HoldemRangeEntry[];
  readonly facts: {
    readonly totalCombosBefore: number;
    readonly knownCombosBefore: number;
    readonly unknownCombosBefore: number;
    readonly coverageRatioBefore: number;
    readonly totalKnownWeightBefore: number;
    readonly completeBefore: boolean;
    readonly eligibleCombos: number;
    readonly blockedCombos: number;
    readonly knownEligibleCombos: number;
    readonly unknownEligibleCombos: number;
    readonly eligibleCoverageRatio: number;
    readonly totalEligibleWeight: number;
    readonly blockedKnownWeight: number;
    readonly completeAfterConditioning: boolean;
  };
}

export interface HoldemComboDistributionEntry {
  readonly comboId: string;
  readonly weight: number;
  readonly probability: number;
  readonly provenanceId: string | null;
}

export interface HoldemComboDistribution {
  readonly schemaVersion: typeof HOLDEM_COMBO_DISTRIBUTION_SCHEMA_VERSION;
  readonly game: typeof HOLDEM_RANGE_GAME;
  readonly sourceRangeId: string | null;
  readonly blockers: readonly string[];
  readonly totalEligibleWeight: number;
  readonly probabilityTotal: number;
  readonly provenance: HoldemWeightedRange['provenance'];
  readonly derivationProvenance: HoldemRangeProvenanceSource;
  readonly entries: readonly HoldemComboDistributionEntry[];
}

export interface HoldemMatrixCell {
  readonly handClass: string;
  readonly kind: 'pair' | 'suited' | 'offsuit';
  readonly row: number;
  readonly column: number;
  readonly physicalComboCount: number;
  readonly knownComboCount: number;
  readonly unknownComboCount: number;
  readonly knownCoverageFraction: number;
  readonly totalKnownWeight: number;
  readonly derivedAverageKnownWeight: number | null;
  readonly derivedUniformWeight: number | null;
  readonly complete: boolean;
  readonly state: 'complete' | 'partial';
  readonly hasIntraClassVariation: boolean;
  readonly comboEntries: readonly HoldemRangeEntry[];
}

export interface HoldemMatrixComposition {
  readonly classCount: number;
  readonly physicalComboCount: number;
  readonly knownComboCount: number;
  readonly unknownComboCount: number;
  readonly totalKnownWeight: number;
}

export interface HoldemRangeMatrixProjection {
  readonly schemaVersion: typeof HOLDEM_RANGE_MATRIX_PROJECTION_SCHEMA_VERSION;
  readonly game: typeof HOLDEM_RANGE_GAME;
  readonly sourceRangeId: string | null;
  readonly inspection: HoldemRangeInspection;
  readonly facts: {
    readonly totalCells: number;
    readonly pairCells: number;
    readonly suitedCells: number;
    readonly offsuitCells: number;
  };
  readonly composition: {
    readonly pair: HoldemMatrixComposition;
    readonly suited: HoldemMatrixComposition;
    readonly offsuit: HoldemMatrixComposition;
  };
  readonly cells: readonly HoldemMatrixCell[];
}

const RANGE_KEYS = Object.freeze(['schemaVersion', 'game', 'rangeId', 'provenance', 'entries']);
const PROVENANCE_KEYS = Object.freeze(['schemaVersion', 'sources']);
const PROVENANCE_SOURCE_KEYS = Object.freeze([
  'id',
  'kind',
  'sourceId',
  'sourceSchemaVersion',
  'createdAt',
  'parentRangeId',
  'operation',
]);
const KNOWN_ENTRY_KEYS = Object.freeze(['comboId', 'state', 'weight', 'provenanceId']);
const UNKNOWN_ENTRY_KEYS = Object.freeze(['comboId', 'state', 'provenanceId']);
const PROVENANCE_KIND_PATTERN = /^[a-z][a-z0-9_.-]*$/;

function compareStableStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requirePlainObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new RangeError(`${label} must contain exactly: ${wanted.join(', ')}`);
  }
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a non-empty string`);
  return value;
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null;
  return requireString(value, label);
}

function normalizeTimestamp(value: unknown, label: string): string | null {
  if (value === null) return null;
  const raw = requireString(value, label);
  const milliseconds = Date.parse(raw);
  if (!Number.isFinite(milliseconds)) throw new TypeError(`${label} must be an ISO timestamp or null`);
  return new Date(milliseconds).toISOString();
}

function requireCanonicalTimestamp(value: unknown, label: string): string | null {
  const normalized = normalizeTimestamp(value, label);
  if (normalized !== value) throw new RangeError(`${label} must use canonical ISO formatting`);
  return normalized;
}

function requireNullableProvenanceId(
  value: unknown,
  sourceIds: ReadonlySet<string>,
  label = 'provenanceId',
): string | null {
  if (value === null) return null;
  const id = requireString(value, label);
  if (!sourceIds.has(id)) throw new RangeError(`${label} must reference range provenance`);
  return id;
}

function requireWeight(value: unknown, label = 'weight'): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be finite and within [0, 1]`);
  }
  return value;
}

function sumWeights(entries: readonly HoldemRangeEntry[]): number {
  let sum = 0;
  let correction = 0;
  for (const entry of entries) {
    if (entry.state !== HOLDEM_RANGE_ENTRY_STATES.KNOWN) continue;
    const adjusted = entry.weight - correction;
    const next = sum + adjusted;
    correction = next - sum - adjusted;
    sum = next;
  }
  return sum;
}

function coverageFacts(entries: readonly HoldemRangeEntry[]): HoldemRangeCoverageFacts {
  const knownCombos = entries.filter((entry) => entry.state === HOLDEM_RANGE_ENTRY_STATES.KNOWN).length;
  const unknownCombos = entries.length - knownCombos;
  const totalKnownWeight = sumWeights(entries);
  return {
    totalCombos: entries.length,
    knownCombos,
    unknownCombos,
    knownZeroCombos: entries.filter(
      (entry) => entry.state === HOLDEM_RANGE_ENTRY_STATES.KNOWN && entry.weight === 0,
    ).length,
    positiveWeightCombos: entries.filter(
      (entry) => entry.state === HOLDEM_RANGE_ENTRY_STATES.KNOWN && entry.weight > 0,
    ).length,
    coverageRatio: entries.length === 0 ? 1 : knownCombos / entries.length,
    totalKnownWeight,
    complete: unknownCombos === 0,
    fullyUnknown: entries.length > 0 && knownCombos === 0,
    emptyComplete: unknownCombos === 0 && totalKnownWeight === 0,
  };
}

export interface ProvenanceSourceInput {
  readonly id?: unknown;
  readonly kind?: unknown;
  readonly sourceId?: unknown;
  readonly sourceSchemaVersion?: unknown;
  readonly createdAt?: unknown;
  readonly parentRangeId?: unknown;
  readonly operation?: unknown;
}

export function createHoldemRangeProvenanceSource(
  input: ProvenanceSourceInput = {},
): HoldemRangeProvenanceSource {
  const source: HoldemRangeProvenanceSource = {
    id: requireString(input.id, 'provenance source id'),
    kind: requireString(input.kind, 'provenance source kind'),
    sourceId: nullableString(input.sourceId ?? null, 'provenance source sourceId'),
    sourceSchemaVersion: nullableString(
      input.sourceSchemaVersion ?? null,
      'provenance source sourceSchemaVersion',
    ),
    createdAt: normalizeTimestamp(input.createdAt ?? null, 'provenance source createdAt'),
    parentRangeId: nullableString(input.parentRangeId ?? null, 'provenance source parentRangeId'),
    operation: nullableString(input.operation ?? null, 'provenance source operation'),
  };
  validateHoldemRangeProvenanceSource(source);
  return deepFreeze(source);
}

export function validateHoldemRangeProvenanceSource(
  source: unknown,
): HoldemRangeProvenanceSource {
  const obj = requirePlainObject(source, 'Holdem range provenance source');
  requireExactKeys(obj, PROVENANCE_SOURCE_KEYS, 'Holdem range provenance source');
  requireString(obj.id, 'provenance source id');
  const kind = requireString(obj.kind, 'provenance source kind');
  if (!PROVENANCE_KIND_PATTERN.test(kind)) {
    throw new RangeError('provenance source kind must be a lowercase extensible discriminator');
  }
  nullableString(obj.sourceId, 'provenance source sourceId');
  nullableString(obj.sourceSchemaVersion, 'provenance source sourceSchemaVersion');
  requireCanonicalTimestamp(obj.createdAt, 'provenance source createdAt');
  nullableString(obj.parentRangeId, 'provenance source parentRangeId');
  nullableString(obj.operation, 'provenance source operation');
  return obj as unknown as HoldemRangeProvenanceSource;
}

function normalizeProvenanceSources(sources: unknown): HoldemRangeProvenanceSource[] {
  if (!Array.isArray(sources)) throw new TypeError('provenanceSources must be an array');
  const normalized = sources.map((source) =>
    createHoldemRangeProvenanceSource(source as ProvenanceSourceInput),
  );
  if (new Set(normalized.map((source) => source.id)).size !== normalized.length) {
    throw new RangeError('Holdem range provenance source IDs must be unique');
  }
  return normalized.sort((left, right) => compareStableStrings(left.id, right.id));
}

function validateProvenance(provenance: unknown): Set<string> {
  const obj = requirePlainObject(provenance, 'Holdem range provenance');
  requireExactKeys(obj, PROVENANCE_KEYS, 'Holdem range provenance');
  if (obj.schemaVersion !== HOLDEM_RANGE_PROVENANCE_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${HOLDEM_RANGE_PROVENANCE_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(obj.sources)) throw new TypeError('provenance.sources must be an array');
  const ids = new Set<string>();
  let priorId: string | null = null;
  for (const rawSource of obj.sources) {
    const source = validateHoldemRangeProvenanceSource(rawSource);
    if (ids.has(source.id)) throw new RangeError('Holdem range provenance source IDs must be unique');
    if (priorId !== null && compareStableStrings(priorId, source.id) >= 0) {
      throw new RangeError('Holdem range provenance sources must use deterministic ID order');
    }
    ids.add(source.id);
    priorId = source.id;
  }
  return ids;
}

export interface RawHoldemRangeEntryInput {
  readonly comboId: unknown;
  readonly state: unknown;
  readonly weight?: unknown;
  readonly provenanceId?: unknown;
}

function normalizedEntry(rawEntry: unknown): HoldemRangeEntry {
  const obj = requirePlainObject(rawEntry, 'Holdem range entry');
  const comboId = assertHoldemComboId(obj.comboId);
  const provenanceId = (obj.provenanceId === undefined ? null : obj.provenanceId) as string | null;
  if (obj.state === HOLDEM_RANGE_ENTRY_STATES.KNOWN) {
    if (!Object.hasOwn(obj, 'weight')) throw new RangeError('A known combo entry requires weight');
    return {
      comboId,
      state: HOLDEM_RANGE_ENTRY_STATES.KNOWN,
      weight: requireWeight(obj.weight),
      provenanceId,
    };
  }
  if (obj.state === HOLDEM_RANGE_ENTRY_STATES.UNKNOWN) {
    if (Object.hasOwn(obj, 'weight')) throw new RangeError('An unknown combo entry must not assert weight');
    return {
      comboId,
      state: HOLDEM_RANGE_ENTRY_STATES.UNKNOWN,
      provenanceId,
    };
  }
  throw new RangeError('Holdem range entry state must be known or unknown');
}

function validateRangeEntry(
  entry: unknown,
  sourceIds: ReadonlySet<string>,
  label: string,
): HoldemRangeEntry {
  const obj = requirePlainObject(entry, label);
  if (obj.state === HOLDEM_RANGE_ENTRY_STATES.KNOWN) {
    requireExactKeys(obj, KNOWN_ENTRY_KEYS, label);
    requireWeight(obj.weight, `${label}.weight`);
  } else if (obj.state === HOLDEM_RANGE_ENTRY_STATES.UNKNOWN) {
    requireExactKeys(obj, UNKNOWN_ENTRY_KEYS, label);
  } else {
    throw new RangeError(`${label}.state must be known or unknown`);
  }
  assertHoldemComboId(obj.comboId, `${label}.comboId`);
  requireNullableProvenanceId(obj.provenanceId, sourceIds, `${label}.provenanceId`);
  return obj as unknown as HoldemRangeEntry;
}

function requireRangeId(rangeId: unknown): string | null {
  return rangeId === null ? null : requireString(rangeId, 'rangeId');
}

function requireUnlistedPolicy(policy: unknown): HoldemRangeUnlistedPolicy {
  if (
    policy !== HOLDEM_RANGE_UNLISTED_POLICIES.UNKNOWN &&
    policy !== HOLDEM_RANGE_UNLISTED_POLICIES.KNOWN_ZERO
  ) {
    throw new RangeError('unlistedState must be unknown or known_zero');
  }
  return policy;
}

export interface CreateHoldemRangeFromEntriesOptions {
  readonly rangeId?: string | null;
  readonly entries?: readonly RawHoldemRangeEntryInput[];
  readonly provenanceSources?: readonly ProvenanceSourceInput[];
  readonly unlistedState?: HoldemRangeUnlistedPolicy;
  readonly unlistedProvenanceId?: string | null;
}

export function createHoldemWeightedRangeFromEntries(
  options: CreateHoldemRangeFromEntriesOptions = {},
): HoldemWeightedRange {
  const {
    rangeId = null,
    entries = [],
    provenanceSources = [],
    unlistedState = HOLDEM_RANGE_UNLISTED_POLICIES.UNKNOWN,
    unlistedProvenanceId = null,
  } = options;
  if (!Array.isArray(entries)) throw new TypeError('entries must be an array');
  requireUnlistedPolicy(unlistedState);
  const sources = normalizeProvenanceSources(provenanceSources);
  const sourceIds = new Set(sources.map((source) => source.id));
  requireNullableProvenanceId(unlistedProvenanceId, sourceIds, 'unlistedProvenanceId');

  const supplied = new Map<string, HoldemRangeEntry>();
  for (const rawEntry of entries) {
    const entry = normalizedEntry(rawEntry);
    if (supplied.has(entry.comboId)) throw new RangeError(`Duplicate combo entry: ${entry.comboId}`);
    requireNullableProvenanceId(entry.provenanceId, sourceIds);
    supplied.set(entry.comboId, entry);
  }

  const orderedEntries: HoldemRangeEntry[] = HOLDEM_COMBOS.map((combo) => {
    const existing = supplied.get(combo.id);
    if (existing) return existing;
    if (unlistedState === HOLDEM_RANGE_UNLISTED_POLICIES.KNOWN_ZERO) {
      return {
        comboId: combo.id,
        state: HOLDEM_RANGE_ENTRY_STATES.KNOWN,
        weight: 0,
        provenanceId: unlistedProvenanceId,
      };
    }
    return {
      comboId: combo.id,
      state: HOLDEM_RANGE_ENTRY_STATES.UNKNOWN,
      provenanceId: unlistedProvenanceId,
    };
  });

  const range: HoldemWeightedRange = {
    schemaVersion: HOLDEM_WEIGHTED_RANGE_SCHEMA_VERSION,
    game: HOLDEM_RANGE_GAME,
    rangeId: requireRangeId(rangeId),
    provenance: {
      schemaVersion: HOLDEM_RANGE_PROVENANCE_SCHEMA_VERSION,
      sources: sources.map(cloneData),
    },
    entries: orderedEntries,
  };
  validateHoldemWeightedRange(range);
  return deepFreeze(range);
}

export function createEmptyCompleteHoldemRange(
  options: Omit<CreateHoldemRangeFromEntriesOptions, 'entries' | 'unlistedState'> = {},
): HoldemWeightedRange {
  return createHoldemWeightedRangeFromEntries({
    ...options,
    entries: [],
    unlistedState: HOLDEM_RANGE_UNLISTED_POLICIES.KNOWN_ZERO,
  });
}

export function createFullyUnknownHoldemRange(
  options: Omit<CreateHoldemRangeFromEntriesOptions, 'entries' | 'unlistedState'> = {},
): HoldemWeightedRange {
  return createHoldemWeightedRangeFromEntries({
    ...options,
    entries: [],
    unlistedState: HOLDEM_RANGE_UNLISTED_POLICIES.UNKNOWN,
  });
}

export type HandClassWeightValue =
  | number
  | { readonly weight: number; readonly provenanceId?: string | null };

export type HandClassWeightsInput =
  | ReadonlyMap<string, HandClassWeightValue>
  | readonly { readonly handClass: string; readonly weight: number; readonly provenanceId?: string | null }[]
  | Readonly<Record<string, HandClassWeightValue>>;

function classWeightRecords(
  handClassWeights: unknown,
): Array<{ handClass: unknown; value: unknown }> {
  if (handClassWeights instanceof Map) {
    return [...handClassWeights].map(([handClass, value]) => ({ handClass, value }));
  }
  if (Array.isArray(handClassWeights)) {
    return handClassWeights.map((record) => {
      const obj = requirePlainObject(record, 'handClassWeights entry');
      return { handClass: obj.handClass, value: obj };
    });
  }
  const obj = requirePlainObject(handClassWeights, 'handClassWeights');
  return Object.entries(obj).map(([handClass, value]) => ({ handClass, value }));
}

function normalizedClassWeight(record: { handClass: unknown; value: unknown }): {
  handClass: string;
  weight: number;
  provenanceId: string | null;
} {
  if (typeof record.handClass !== 'string' || !isPreflopHandClass(record.handClass)) {
    throw new RangeError(`Unsupported preflop hand class: ${String(record.handClass)}`);
  }
  if (typeof record.value === 'number') {
    return { handClass: record.handClass, weight: requireWeight(record.value), provenanceId: null };
  }
  const obj = requirePlainObject(record.value, `handClassWeights.${record.handClass}`);
  const weight = requireWeight(obj.weight, `handClassWeights.${record.handClass}.weight`);
  const provenanceId = (obj.provenanceId === undefined ? null : obj.provenanceId) as string | null;
  return { handClass: record.handClass, weight, provenanceId };
}

export interface CreateHoldemRangeFromHandClassWeightsOptions {
  readonly rangeId?: string | null;
  readonly handClassWeights?: HandClassWeightsInput;
  readonly provenanceSources?: readonly ProvenanceSourceInput[];
  readonly unlistedState?: HoldemRangeUnlistedPolicy;
  readonly unlistedProvenanceId?: string | null;
}

export function createHoldemWeightedRangeFromHandClassWeights(
  options: CreateHoldemRangeFromHandClassWeightsOptions = {},
): HoldemWeightedRange {
  const {
    rangeId = null,
    handClassWeights = {},
    provenanceSources = [],
    unlistedState = HOLDEM_RANGE_UNLISTED_POLICIES.UNKNOWN,
    unlistedProvenanceId = null,
  } = options;
  requireUnlistedPolicy(unlistedState);
  const records = classWeightRecords(handClassWeights).map(normalizedClassWeight);
  if (new Set(records.map((record) => record.handClass)).size !== records.length) {
    throw new RangeError('handClassWeights must not repeat a hand class');
  }
  const byClass = new Map(records.map((record) => [record.handClass, record]));
  const entries: RawHoldemRangeEntryInput[] = [];
  for (const handClass of PREFLOP_HAND_CLASSES) {
    const record = byClass.get(handClass);
    if (!record) continue;
    for (const combo of getHoldemCombosForHandClass(handClass)) {
      entries.push({
        comboId: combo.id,
        state: HOLDEM_RANGE_ENTRY_STATES.KNOWN,
        weight: record.weight,
        provenanceId: record.provenanceId,
      });
    }
  }
  return createHoldemWeightedRangeFromEntries({
    rangeId,
    entries,
    provenanceSources,
    unlistedState,
    unlistedProvenanceId,
  });
}

export function withHoldemComboOverrides(
  range: HoldemWeightedRange,
  overrides: readonly RawHoldemRangeEntryInput[],
  options: { readonly provenanceSources?: readonly ProvenanceSourceInput[] | null } = {},
): HoldemWeightedRange {
  validateHoldemWeightedRange(range);
  if (!Array.isArray(overrides)) throw new TypeError('overrides must be an array');
  const nextSources = options.provenanceSources ?? range.provenance.sources;
  const byCombo = new Map<string, HoldemRangeEntry>(
    range.entries.map((entry) => [entry.comboId, cloneData(entry)]),
  );
  const seen = new Set<string>();
  for (const rawOverride of overrides) {
    const override = normalizedEntry(rawOverride);
    if (seen.has(override.comboId)) throw new RangeError(`Duplicate combo override: ${override.comboId}`);
    seen.add(override.comboId);
    byCombo.set(override.comboId, override);
  }
  return createHoldemWeightedRangeFromEntries({
    rangeId: range.rangeId,
    entries: HOLDEM_COMBOS.map((combo) => byCombo.get(combo.id)!),
    provenanceSources: nextSources,
  });
}

export function validateHoldemWeightedRange(range: unknown): HoldemWeightedRange {
  const obj = requirePlainObject(range, 'HoldemWeightedRange');
  requireExactKeys(obj, RANGE_KEYS, 'HoldemWeightedRange');
  if (obj.schemaVersion !== HOLDEM_WEIGHTED_RANGE_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${HOLDEM_WEIGHTED_RANGE_SCHEMA_VERSION}`);
  }
  if (obj.game !== HOLDEM_RANGE_GAME) throw new RangeError(`HoldemWeightedRange.game must be ${HOLDEM_RANGE_GAME}`);
  requireRangeId(obj.rangeId);
  const sourceIds = validateProvenance(obj.provenance);
  if (!Array.isArray(obj.entries) || obj.entries.length !== HOLDEM_COMBOS.length) {
    throw new RangeError(`HoldemWeightedRange requires exactly ${HOLDEM_COMBOS.length} combo entries`);
  }
  const seen = new Set<string>();
  for (let index = 0; index < obj.entries.length; index += 1) {
    const entry = validateRangeEntry(obj.entries[index], sourceIds, `entries[${index}]`);
    if (seen.has(entry.comboId)) throw new RangeError(`Duplicate combo entry: ${entry.comboId}`);
    seen.add(entry.comboId);
    if (entry.comboId !== HOLDEM_COMBOS[index]!.id) {
      throw new RangeError('HoldemWeightedRange entries must use canonical deterministic combo order');
    }
  }
  return obj as unknown as HoldemWeightedRange;
}

export function inspectHoldemWeightedRange(range: HoldemWeightedRange): HoldemRangeInspection {
  validateHoldemWeightedRange(range);
  const facts = coverageFacts(range.entries);
  return deepFreeze({
    schemaVersion: HOLDEM_RANGE_INSPECTION_SCHEMA_VERSION,
    game: HOLDEM_RANGE_GAME,
    rangeId: range.rangeId,
    state: facts.complete ? 'complete' : 'partial',
    ...facts,
  });
}

export function conditionHoldemRange(
  range: HoldemWeightedRange,
  blockerCards: readonly string[] = [],
): HoldemConditionedRange {
  validateHoldemWeightedRange(range);
  assertCardArray(blockerCards, 'blockerCards');
  assertUniqueKnownCards([{ label: 'blockerCards', cards: blockerCards }]);
  const blockers = [...blockerCards].sort(compareHoldemCards);
  const blockerSet = new Set(blockers);
  const eligibleEntries: HoldemRangeEntry[] = [];
  const blockedEntries: HoldemRangeEntry[] = [];
  for (const sourceEntry of range.entries) {
    const entry = cloneData(sourceEntry);
    const combo = getHoldemComboById(entry.comboId);
    const target = combo.cards.some((card) => blockerSet.has(card))
      ? blockedEntries
      : eligibleEntries;
    target.push(entry);
  }
  const before = coverageFacts(range.entries);
  const after = coverageFacts(eligibleEntries);
  const blockedKnownWeight = sumWeights(blockedEntries);
  const result: HoldemConditionedRange = {
    schemaVersion: HOLDEM_CONDITIONED_RANGE_SCHEMA_VERSION,
    game: HOLDEM_RANGE_GAME,
    sourceRangeId: range.rangeId,
    blockers,
    provenance: cloneData(range.provenance),
    derivationProvenance: createHoldemRangeProvenanceSource({
      id: 'blocker-conditioning',
      kind: HOLDEM_RANGE_PROVENANCE_KINDS.DERIVED_FILTER,
      sourceId: range.rangeId,
      sourceSchemaVersion: HOLDEM_WEIGHTED_RANGE_SCHEMA_VERSION,
      parentRangeId: range.rangeId,
      operation: 'blocker_conditioning',
    }),
    eligibleEntries,
    blockedEntries,
    facts: {
      totalCombosBefore: before.totalCombos,
      knownCombosBefore: before.knownCombos,
      unknownCombosBefore: before.unknownCombos,
      coverageRatioBefore: before.coverageRatio,
      totalKnownWeightBefore: before.totalKnownWeight,
      completeBefore: before.complete,
      eligibleCombos: after.totalCombos,
      blockedCombos: blockedEntries.length,
      knownEligibleCombos: after.knownCombos,
      unknownEligibleCombos: after.unknownCombos,
      eligibleCoverageRatio: after.coverageRatio,
      totalEligibleWeight: after.totalKnownWeight,
      blockedKnownWeight,
      completeAfterConditioning: after.complete,
    },
  };
  return deepFreeze(result);
}

export function createNormalizedHoldemDistribution(
  range: HoldemWeightedRange,
  options: { readonly blockers?: readonly string[] } = {},
): HoldemComboDistribution {
  const blockers = options.blockers ?? [];
  const inspection = inspectHoldemWeightedRange(range);
  if (!inspection.complete) {
    throw new RangeError('Cannot normalize an incomplete Holdem range without an explicit policy');
  }
  const conditioned = conditionHoldemRange(range, blockers);
  const totalEligibleWeight = conditioned.facts.totalEligibleWeight;
  if (!(totalEligibleWeight > 0)) {
    throw new RangeError('Cannot normalize a zero-mass Holdem range');
  }
  const entries: HoldemComboDistributionEntry[] = conditioned.eligibleEntries.map((entry) => {
    const weight = entry.state === HOLDEM_RANGE_ENTRY_STATES.KNOWN ? entry.weight : 0;
    return {
      comboId: entry.comboId,
      weight,
      probability: weight / totalEligibleWeight,
      provenanceId: entry.provenanceId,
    };
  });
  return deepFreeze({
    schemaVersion: HOLDEM_COMBO_DISTRIBUTION_SCHEMA_VERSION,
    game: HOLDEM_RANGE_GAME,
    sourceRangeId: range.rangeId,
    blockers: [...conditioned.blockers],
    totalEligibleWeight,
    probabilityTotal: entries.reduce((sum, entry) => sum + entry.probability, 0),
    provenance: cloneData(conditioned.provenance),
    derivationProvenance: cloneData(conditioned.derivationProvenance),
    entries,
  });
}

function handClassKind(handClass: string): 'pair' | 'suited' | 'offsuit' {
  if (handClass.length === 2) return 'pair';
  return handClass.endsWith('s') ? 'suited' : 'offsuit';
}

function matrixCellFor(
  rangeEntries: ReadonlyMap<string, HoldemRangeEntry>,
  handClass: string,
  index: number,
): HoldemMatrixCell {
  const comboEntries = getHoldemCombosForHandClass(handClass).map(
    (combo) => cloneData(rangeEntries.get(combo.id)!),
  );
  const knownEntries = comboEntries.filter(
    (entry): entry is HoldemRangeKnownEntry => entry.state === HOLDEM_RANGE_ENTRY_STATES.KNOWN,
  );
  const unknownComboCount = comboEntries.length - knownEntries.length;
  const knownWeights = knownEntries.map((entry) => entry.weight);
  const distinctKnownWeights = new Set(knownWeights);
  const complete = unknownComboCount === 0;
  const totalKnownWeight = sumWeights(knownEntries);
  return {
    handClass,
    kind: handClassKind(handClass),
    row: Math.floor(index / 13),
    column: index % 13,
    physicalComboCount: comboEntries.length,
    knownComboCount: knownEntries.length,
    unknownComboCount,
    knownCoverageFraction: knownEntries.length / comboEntries.length,
    totalKnownWeight,
    derivedAverageKnownWeight: knownEntries.length === 0
      ? null
      : totalKnownWeight / knownEntries.length,
    derivedUniformWeight: complete && distinctKnownWeights.size === 1 ? (knownWeights[0] ?? null) : null,
    complete,
    state: complete ? 'complete' : 'partial',
    hasIntraClassVariation: distinctKnownWeights.size > 1
      || (knownEntries.length > 0 && unknownComboCount > 0),
    comboEntries,
  };
}

function compositionFor(
  cells: readonly HoldemMatrixCell[],
  kind: 'pair' | 'suited' | 'offsuit',
): HoldemMatrixComposition {
  const matching = cells.filter((cell) => cell.kind === kind);
  return {
    classCount: matching.length,
    physicalComboCount: matching.reduce((sum, cell) => sum + cell.physicalComboCount, 0),
    knownComboCount: matching.reduce((sum, cell) => sum + cell.knownComboCount, 0),
    unknownComboCount: matching.reduce((sum, cell) => sum + cell.unknownComboCount, 0),
    totalKnownWeight: matching.reduce((sum, cell) => sum + cell.totalKnownWeight, 0),
  };
}

export function projectHoldemRangeToMatrix(
  range: HoldemWeightedRange,
): HoldemRangeMatrixProjection {
  validateHoldemWeightedRange(range);
  const byCombo = new Map(range.entries.map((entry) => [entry.comboId, entry]));
  const cells = PREFLOP_HAND_CLASSES.map(
    (handClass, index) => matrixCellFor(byCombo, handClass, index),
  );
  return deepFreeze({
    schemaVersion: HOLDEM_RANGE_MATRIX_PROJECTION_SCHEMA_VERSION,
    game: HOLDEM_RANGE_GAME,
    sourceRangeId: range.rangeId,
    inspection: inspectHoldemWeightedRange(range),
    facts: {
      totalCells: cells.length,
      pairCells: cells.filter((cell) => cell.kind === 'pair').length,
      suitedCells: cells.filter((cell) => cell.kind === 'suited').length,
      offsuitCells: cells.filter((cell) => cell.kind === 'offsuit').length,
    },
    composition: {
      pair: compositionFor(cells, 'pair'),
      suited: compositionFor(cells, 'suited'),
      offsuit: compositionFor(cells, 'offsuit'),
    },
    cells,
  });
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (!value || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new RangeError('Holdem range JSON cannot contain non-finite numbers');
    }
    return value;
  }
  const obj = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(obj).sort().map((key) => [key, stableJsonValue(obj[key])]),
  );
}

export function serializeHoldemWeightedRange(range: HoldemWeightedRange): string {
  validateHoldemWeightedRange(range);
  return JSON.stringify(stableJsonValue(range));
}

export function deserializeHoldemWeightedRange(serialized: unknown): HoldemWeightedRange {
  if (typeof serialized !== 'string') throw new TypeError('serialized Holdem range must be a string');
  const parsed: unknown = JSON.parse(serialized);
  validateHoldemWeightedRange(parsed);
  return deepFreeze(cloneData(parsed as HoldemWeightedRange));
}
