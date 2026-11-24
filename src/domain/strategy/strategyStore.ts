import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals';
import {
  createStrategyContext,
  decisionFamilyForSpotRow,
  defaultOpenerForSpotRow,
  getSharedEngineClient,
  getStrategyFamily,
  isSpotMapCellPossible,
  positionsForTableSize,
  strategyContextKey,
  type EngineClient,
  type StrategyActionType,
  type StrategyBaselineComparison,
  type StrategyContext,
  type StrategyEvidenceEntry,
  type StrategyFamilyId,
  type StrategyLeakMapProjection,
  type StrategyMatrixProjection,
  type StrategySpotMapProjection,
  type StrategySpotRowId,
  type StrategyStackDepthBb,
  type StrategyTableSize,
} from '../../engine-api';
import { getDefaultStudyRepository, type StudyRepository } from '../storage';

export type StrategyViewId =
  | 'spotMap'
  | 'builder'
  | 'leakMap'
  | 'commitment'
  | 'rangeWalk'
  | 'textureSubset';
export type StrategyPaintAction = 'raise' | 'call' | 'fold' | 'clear';

export interface SelectedStrategySpot {
  readonly rowId: StrategySpotRowId;
  readonly position: string;
}

export interface StrategyStoreOptions {
  readonly engine?: EngineClient;
  readonly repository?: StudyRepository;
}

export interface StrategyStore {
  readonly activeViewSignal: Signal<StrategyViewId>;
  readonly tableSizeSignal: Signal<StrategyTableSize>;
  readonly stackDepthBbSignal: Signal<StrategyStackDepthBb>;
  readonly selectedSpotSignal: Signal<SelectedStrategySpot>;
  readonly selectedFamilyIdSignal: Signal<StrategyFamilyId>;
  readonly paintActionSignal: Signal<StrategyPaintAction>;
  readonly baselineRevealedSignal: Signal<boolean>;
  readonly evidenceSignal: Signal<readonly StrategyEvidenceEntry[]>;
  readonly saveStatusSignal: Signal<'idle' | 'saved'>;
  readonly selectedLeakCellKeySignal: Signal<string | null>;

  readonly activeContextSignal: ReadonlySignal<StrategyContext>;
  readonly spotMapSignal: ReadonlySignal<StrategySpotMapProjection>;
  readonly matrixProjectionSignal: ReadonlySignal<StrategyMatrixProjection>;
  readonly baselineComparisonSignal: ReadonlySignal<StrategyBaselineComparison>;
  readonly leakMapSignal: ReadonlySignal<StrategyLeakMapProjection>;

  hydrate: () => Promise<void>;
  setActiveView: (view: StrategyViewId) => void;
  setTableSize: (tableSize: StrategyTableSize) => void;
  setStackDepthBb: (stackDepthBb: StrategyStackDepthBb) => void;
  selectSpot: (rowId: StrategySpotRowId, position: string) => void;
  openSpotInBuilder: (rowId: StrategySpotRowId, position: string) => void;
  selectFamily: (familyId: StrategyFamilyId) => void;
  setPaintAction: (action: StrategyPaintAction) => void;
  setFamilyCutoff: (cutoffIndex: number) => Promise<void>;
  clearSelectedFamily: () => Promise<void>;
  paintMatrixCell: (handClass: string) => Promise<void>;
  revealBaseline: () => void;
  resolveConflict: (
    handClass: string,
    resolution: 'keep' | 'change' | 'later',
  ) => Promise<void>;
}

function nextEvidenceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `sev-${crypto.randomUUID()}`;
  }
  return `sev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createStrategyStore(options: StrategyStoreOptions = {}): StrategyStore {
  const engine = options.engine ?? getSharedEngineClient();
  const repository = options.repository ?? getDefaultStudyRepository();

  const activeViewSignal = signal<StrategyViewId>('spotMap');
  const tableSizeSignal = signal<StrategyTableSize>(6);
  const stackDepthBbSignal = signal<StrategyStackDepthBb>(100);
  const selectedSpotSignal = signal<SelectedStrategySpot>({
    rowId: 'first_in',
    position: 'UTG',
  });
  const selectedFamilyIdSignal = signal<StrategyFamilyId>('suited_kings');
  const paintActionSignal = signal<StrategyPaintAction>('raise');
  const baselineRevealedSignal = signal<boolean>(false);
  const evidenceSignal = signal<readonly StrategyEvidenceEntry[]>([]);
  const saveStatusSignal = signal<'idle' | 'saved'>('idle');
  const selectedLeakCellKeySignal = signal<string | null>(null);

  const activeContextSignal = computed<StrategyContext>(() => {
    const spot = selectedSpotSignal.value;
    const tableSize = tableSizeSignal.value;
    const positions = positionsForTableSize(tableSize);
    const validPos = positions.includes(spot.position) ? spot.position : 'UTG';
    return createStrategyContext({
      tableSize,
      stackDepthBb: stackDepthBbSignal.value,
      decisionFamily: decisionFamilyForSpotRow(spot.rowId),
      position: validPos,
      openerPosition: defaultOpenerForSpotRow(spot.rowId),
    });
  });

  const spotMapSignal = computed<StrategySpotMapProjection>(() => {
    const res = engine.sync.projectStrategySpotMap(
      tableSizeSignal.value,
      stackDepthBbSignal.value,
      evidenceSignal.value,
    );
    if (!res.ok) {
      throw new Error(res.error.message);
    }
    return res.data;
  });

  const matrixProjectionSignal = computed<StrategyMatrixProjection>(() => {
    const res = engine.sync.projectStrategyMatrix(
      activeContextSignal.value,
      evidenceSignal.value,
    );
    if (!res.ok) {
      throw new Error(res.error.message);
    }
    return res.data;
  });

  const baselineComparisonSignal = computed<StrategyBaselineComparison>(() => {
    const res = engine.sync.compareStrategyBaseline(
      matrixProjectionSignal.value,
      selectedFamilyIdSignal.value,
    );
    if (!res.ok) {
      throw new Error(res.error.message);
    }
    return res.data;
  });

  const leakMapSignal = computed<StrategyLeakMapProjection>(() => {
    const res = engine.sync.projectStrategyLeakMap(
      tableSizeSignal.value,
      stackDepthBbSignal.value,
      evidenceSignal.value,
    );
    if (!res.ok) {
      throw new Error(res.error.message);
    }
    return res.data;
  });

  let inFlightHydrate: Promise<void> | null = null;

  async function appendEvidence(entries: readonly StrategyEvidenceEntry[]): Promise<void> {
    if (entries.length === 0) return;
    evidenceSignal.value = [...evidenceSignal.value, ...entries];
    await repository.recordStrategyEvidence(entries);
    saveStatusSignal.value = 'saved';
  }

  return {
    activeViewSignal,
    tableSizeSignal,
    stackDepthBbSignal,
    selectedSpotSignal,
    selectedFamilyIdSignal,
    paintActionSignal,
    baselineRevealedSignal,
    evidenceSignal,
    saveStatusSignal,
    selectedLeakCellKeySignal,
    activeContextSignal,
    spotMapSignal,
    matrixProjectionSignal,
    baselineComparisonSignal,
    leakMapSignal,

    async hydrate() {
      if (inFlightHydrate) return inFlightHydrate;
      inFlightHydrate = repository
        .listStrategyEvidence()
        .then((entries) => {
          evidenceSignal.value = entries;
        })
        .finally(() => {
          inFlightHydrate = null;
        });
      return inFlightHydrate;
    },

    setActiveView(view) {
      activeViewSignal.value = view;
    },

    setTableSize(tableSize) {
      tableSizeSignal.value = tableSize;
      const spot = selectedSpotSignal.value;
      if (!isSpotMapCellPossible(tableSize, spot.rowId, spot.position)) {
        selectedSpotSignal.value = { rowId: 'first_in', position: 'UTG' };
      }
      baselineRevealedSignal.value = false;
    },

    setStackDepthBb(stackDepthBb) {
      stackDepthBbSignal.value = stackDepthBb;
      baselineRevealedSignal.value = false;
    },

    selectSpot(rowId, position) {
      if (!isSpotMapCellPossible(tableSizeSignal.value, rowId, position)) return;
      selectedSpotSignal.value = { rowId, position };
      baselineRevealedSignal.value = false;
    },

    openSpotInBuilder(rowId, position) {
      if (!isSpotMapCellPossible(tableSizeSignal.value, rowId, position)) return;
      selectedSpotSignal.value = { rowId, position };
      baselineRevealedSignal.value = false;
      activeViewSignal.value = 'builder';
    },

    selectFamily(familyId) {
      selectedFamilyIdSignal.value = familyId;
      baselineRevealedSignal.value = false;
    },

    setPaintAction(action) {
      paintActionSignal.value = action;
    },

    async setFamilyCutoff(cutoffIndex) {
      const ctx = activeContextSignal.value;
      const contextKey = strategyContextKey(ctx);
      const family = getStrategyFamily(selectedFamilyIdSignal.value);
      const now = new Date().toISOString();

      const entries: StrategyEvidenceEntry[] = family.hands.map((hand, index) => ({
        evidenceId: nextEvidenceId(),
        occurredAt: now,
        contextKey,
        handClass: hand.handClass,
        source: 'calibration',
        action: index <= cutoffIndex ? 'raise' : 'fold',
      }));

      baselineRevealedSignal.value = false;
      await appendEvidence(entries);
    },

    async clearSelectedFamily() {
      const ctx = activeContextSignal.value;
      const contextKey = strategyContextKey(ctx);
      const family = getStrategyFamily(selectedFamilyIdSignal.value);
      const familyHands = new Set(family.hands.map((h) => h.handClass));
      const now = new Date().toISOString();

      const toRetract = evidenceSignal.value.filter(
        (e) =>
          e.contextKey === contextKey &&
          familyHands.has(e.handClass) &&
          !e.retracted,
      );
      if (toRetract.length === 0) return;

      const retractions: StrategyEvidenceEntry[] = toRetract.map((e) => ({
        evidenceId: nextEvidenceId(),
        occurredAt: now,
        contextKey,
        handClass: e.handClass,
        source: 'calibration',
        action: e.action,
        retracted: true,
        supersedesEvidenceId: e.evidenceId,
      }));

      baselineRevealedSignal.value = false;
      await appendEvidence(retractions);
    },

    async paintMatrixCell(handClass) {
      const ctx = activeContextSignal.value;
      const contextKey = strategyContextKey(ctx);
      const now = new Date().toISOString();
      const brush = paintActionSignal.value;

      if (brush === 'clear') {
        const toRetract = evidenceSignal.value.filter(
          (e) =>
            e.contextKey === contextKey &&
            e.handClass === handClass &&
            !e.retracted,
        );
        if (toRetract.length === 0) return;
        await appendEvidence(
          toRetract.map((e) => ({
            evidenceId: nextEvidenceId(),
            occurredAt: now,
            contextKey,
            handClass,
            source: 'matrix',
            action: e.action,
            retracted: true,
            supersedesEvidenceId: e.evidenceId,
          })),
        );
        return;
      }

      const action: StrategyActionType = brush;
      await appendEvidence([
        {
          evidenceId: nextEvidenceId(),
          occurredAt: now,
          contextKey,
          handClass,
          source: 'matrix',
          action,
        },
      ]);
    },

    revealBaseline() {
      baselineRevealedSignal.value = true;
    },

    async resolveConflict(handClass, resolution) {
      if (resolution === 'later') return;
      const ctx = activeContextSignal.value;
      const contextKey = strategyContextKey(ctx);
      const cell = matrixProjectionSignal.value.cells.find(
        (c) => c.handClass === handClass,
      );
      if (!cell) return;

      const currentAction = cell.dominantAction ?? 'raise';
      const nextAction: StrategyActionType =
        resolution === 'keep'
          ? currentAction
          : currentAction === 'fold'
            ? 'raise'
            : 'fold';

      await appendEvidence([
        {
          evidenceId: nextEvidenceId(),
          occurredAt: new Date().toISOString(),
          contextKey,
          handClass,
          source: 'conflict_resolution',
          action: nextAction,
        },
      ]);
    },
  };
}

let sharedStrategyStore: StrategyStore | null = null;

export function getSharedStrategyStore(): StrategyStore {
  if (!sharedStrategyStore) {
    sharedStrategyStore = createStrategyStore();
  }
  return sharedStrategyStore;
}

export function resetSharedStrategyStore(): void {
  sharedStrategyStore = null;
}
