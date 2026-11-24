import {
  HOLDEM_DECK,
  LEARN_CONCEPT_IDS,
  type HomeGameCurrency,
  type HomeGameParticipant,
  type HomeGameSession,
  type HomeGameTransaction,
  type LearnConceptId,
  type StrategyEvidenceEntry,
} from '../../engine-api';
import {
  isLocaleId,
  isMotionMode,
  isPaceId,
  isTeacherTypingSpeed,
  isThemeId,
  normalizeAppearance,
  readPersistedAppearance,
  updateAppearance,
  type AppearancePreferences,
} from '../appearance';
import {
  clearCustomVillainProfiles,
  exportCustomVillainProfiles,
  importCustomVillainProfiles,
} from '../profiles/villainProfiles';
import {
  clearPostflopPlaybook,
  exportPostflopPlaybook,
  importPostflopPlaybook,
} from '../strategy/postflopPlaybook';
import { REVISIT_STORAGE_KEY, SESSION_PAD_STORAGE_KEY } from '../shellState';
import { compactSavedHandPayload, expandSavedHandPayload } from './compactHand';
import {
  SAVED_MATCHUP_SCHEMA_VERSION,
  STUDY_BUNDLE_SCHEMA_VERSION,
  STUDY_DB_NAME,
  STUDY_DB_VERSION,
  STUDY_EVENTS_STORE,
  type EquityStreet,
  type HeroDecisionNote,
  type LearnConceptUpdatedPayload,
  type LearnProgressSnapshot,
  type LearnTrainerRecordedPayload,
  type NightHandLinkedPayload,
  type NightLinkedHandRef,
  type NightSessionArchivedPayload,
  type NightSessionCreatedPayload,
  type NightSessionRecord,
  type NightSessionUpdatedPayload,
  type PersistedLearnTrainerMode,
  type SavedHandAnnotatedPayload,
  type SavedHandPayload,
  type SavedHandRecord,
  type SavedMatchupPayload,
  type SavedMatchupPlayer,
  type SavedMatchupRecord,
  type SavedObjectTagId,
  type StrategyEvidenceBatchPayload,
  type StudyEvent,
  type StudyExportBundle,
  type StudyImportResult,
  type TrainingSessionPayload,
} from './types';

export interface StudyStorageBackend {
  readAllEvents(): Promise<StudyEvent[]>;
  appendEvent(event: StudyEvent): Promise<void>;
  putManyEvents(events: readonly StudyEvent[]): Promise<void>;
  clearAllEvents?(): Promise<void>;
}

export interface StudyStorageCounts {
  readonly savedHands: number;
  readonly savedMatchups: number;
  readonly nights: number;
  readonly trainingSessions: number;
  readonly totalEvents: number;
}

const VALID_CARD_SET = new Set<string>(HOLDEM_DECK);
const VALID_STREETS = new Set<string>(['preflop', 'flop', 'turn', 'river']);
const VALID_INPUT_KINDS = new Set<string>(['exact', 'range', 'any']);
const VALID_TABLE_PRESETS = new Set<string>(['six_max_100bb', 'home_game_50bb']);
const VALID_ACTION_TYPES = new Set<string>(['fold', 'check', 'call', 'bet', 'raise', 'all_in']);
const VALID_SAVED_TAGS = new Set<string>(['review_later', 'unsure', 'study']);
const VALID_THINKING_REASONS = new Set<string>([
  'stealing',
  'value',
  'draw',
  'pot_committed',
  'bluff_catch',
]);
const VALID_LEARN_CONCEPTS = new Set<string>(LEARN_CONCEPT_IDS);
const VALID_LEARN_MODES = new Set<string>(['pot_odds', 'outs', 'equity_guess']);
const SUIT_GLYPHS: Readonly<Record<string, string>> = {
  s: '\u2660\uFE0E',
  h: '\u2665\uFE0E',
  d: '\u2666\uFE0E',
  c: '\u2663\uFE0E',
};

function formatCardSymbolsForTitle(code: string): string {
  if (code.length !== 2) return code;
  const suit = SUIT_GLYPHS[code[1]!.toLowerCase()];
  return suit ? `${code[0]!.toUpperCase()}${suit}` : code;
}

function formatPotAmountForTitle(potMilliBb: number, unitLabel: 'bb' | '₪'): string {
  const val = potMilliBb / 1000;
  const num = Number.isInteger(val) ? String(val) : Number(val.toFixed(1)).toString();
  return unitLabel === '₪' ? `₪${num}` : `${num} bb`;
}

function nextUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export type StudyStorageHealth = 'ok' | 'degraded';

let quarantinedEventCount = 0;
let storageHealthState: StudyStorageHealth = 'ok';

export function getQuarantinedEventCount(): number {
  return quarantinedEventCount;
}

export function getStudyStorageHealth(): StudyStorageHealth {
  return storageHealthState;
}

function isSortedBySeq(events: readonly StudyEvent[]): boolean {
  for (let i = 1; i < events.length; i += 1) {
    const prev = events[i - 1]!;
    const cur = events[i]!;
    if (cur.seq < prev.seq) return false;
  }
  return true;
}

function compareEventsDeterministic(a: StudyEvent, b: StudyEvent): number {
  if (a.seq !== b.seq) return a.seq - b.seq;
  const tsCmp = a.ts.localeCompare(b.ts);
  if (tsCmp !== 0) return tsCmp;
  return a.id.localeCompare(b.id);
}

function ensureSortedBySeq(events: readonly StudyEvent[]): readonly StudyEvent[] {
  const valid: StudyEvent[] = [];
  for (let i = 0; i < events.length; i += 1) {
    const evt = events[i];
    if (validateStudyEvent(evt)) {
      valid.push(evt);
    } else {
      quarantinedEventCount += 1;
    }
  }
  return valid.sort(compareEventsDeterministic);
}

function maxSeqFromSorted(events: readonly StudyEvent[]): number {
  if (events.length === 0) return 0;
  if (isSortedBySeq(events)) {
    return Math.max(0, events[events.length - 1]!.seq);
  }
  let max = 0;
  for (let i = 0; i < events.length; i += 1) {
    if (events[i]!.seq > max) max = events[i]!.seq;
  }
  return max;
}

function upsertSortedEvent(target: StudyEvent[], event: StudyEvent): void {
  const existingIdx = target.findIndex((e) => e.id === event.id);
  if (existingIdx >= 0) {
    target[existingIdx] = event;
    if (!isSortedBySeq(target)) {
      target.sort((a, b) => a.seq - b.seq);
    }
    return;
  }
  const last = target[target.length - 1];
  target.push(event);
  if (last && event.seq < last.seq) {
    target.sort((a, b) => a.seq - b.seq);
  }
}

/**
 * Wraps any backend with an ascending seq-sorted in-memory cache and coalesced reads.
 * Backends returned by this helper honor the sorted-by-seq invariant on `readAllEvents`.
 */
export function createCachingStudyBackend(
  inner: StudyStorageBackend,
  options: { readonly channelName?: string; readonly onExternalInvalidate?: () => void } = {},
): StudyStorageBackend & { invalidateCache(): void; onExternalInvalidate(fn: () => void): void } {
  let cachedEvents: StudyEvent[] | null = null;
  let inFlightRead: Promise<StudyEvent[]> | null = null;
  let cacheEpoch = 0;
  let externalInvalidateCb: (() => void) | undefined = options.onExternalInvalidate;

  let channel: BroadcastChannel | null = null;
  if (options.channelName && typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(options.channelName);
      channel.onmessage = () => {
        cacheEpoch += 1;
        cachedEvents = null;
        externalInvalidateCb?.();
      };
    } catch {
      channel = null;
    }
  }

  function invalidateCache(): void {
    cacheEpoch += 1;
    cachedEvents = null;
  }

  function onExternalInvalidate(fn: () => void): void {
    externalInvalidateCb = fn;
  }

  function notifyPeers(): void {
    if (!channel) return;
    try {
      channel.postMessage('invalidated');
    } catch {
      // Ignore BroadcastChannel post errors in restricted contexts.
    }
  }

  return {
    invalidateCache,
    onExternalInvalidate,
    async readAllEvents() {
      if (cachedEvents !== null) {
        return [...cachedEvents];
      }
      if (!inFlightRead) {
        const loadEpoch = cacheEpoch;
        inFlightRead = inner
          .readAllEvents()
          .then((list) => {
            const sorted = [...ensureSortedBySeq(list)];
            if (cacheEpoch === loadEpoch) {
              cachedEvents = sorted;
            }
            return sorted;
          })
          .finally(() => {
            inFlightRead = null;
          });
      }
      const loaded = await inFlightRead;
      return [...loaded];
    },
    async appendEvent(event) {
      await inner.appendEvent(event);
      if (cachedEvents !== null) {
        upsertSortedEvent(cachedEvents, event);
      } else {
        cacheEpoch += 1;
      }
      notifyPeers();
    },
    async putManyEvents(incoming) {
      await inner.putManyEvents(incoming);
      if (cachedEvents !== null) {
        for (const evt of incoming) {
          upsertSortedEvent(cachedEvents, evt);
        }
      } else {
        cacheEpoch += 1;
      }
      notifyPeers();
    },
    async clearAllEvents() {
      if (inner.clearAllEvents) {
        await inner.clearAllEvents();
      }
      cacheEpoch += 1;
      cachedEvents = [];
      notifyPeers();
    },
  };
}

/** Creates an isolated in-memory event log store (for unit tests and headless environments). */
export function createMemoryStudyBackend(initial: readonly StudyEvent[] = []): StudyStorageBackend {
  const events: StudyEvent[] = [...initial].sort((a, b) => a.seq - b.seq);
  return {
    async readAllEvents() {
      return [...events];
    },
    async appendEvent(event) {
      const last = events[events.length - 1];
      events.push(event);
      if (last && event.seq < last.seq) {
        events.sort((a, b) => a.seq - b.seq);
      }
    },
    async putManyEvents(incoming) {
      const seen = new Set(events.map((e) => e.id));
      let needsSort = false;
      for (const evt of incoming) {
        if (!seen.has(evt.id)) {
          const last = events[events.length - 1];
          if (last && evt.seq < last.seq) needsSort = true;
          events.push(evt);
          seen.add(evt.id);
        }
      }
      if (needsSort) {
        events.sort((a, b) => a.seq - b.seq);
      }
    },
    async clearAllEvents() {
      events.length = 0;
    },
  };
}

let cachedIdbPromise: Promise<IDBDatabase> | null = null;
const idbInvalidators = new Set<() => void>();

function applyStudyDatabaseMigrations(
  db: IDBDatabase,
  oldVersion: number,
  _newVersion: number,
): void {
  if (oldVersion < 1 && !db.objectStoreNames.contains(STUDY_EVENTS_STORE)) {
    const store = db.createObjectStore(STUDY_EVENTS_STORE, { keyPath: 'id' });
    store.createIndex('by_domain_seq', ['domain', 'seq'], { unique: false });
    store.createIndex('by_ts', 'ts', { unique: false });
  }
}

function openStudyDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (cachedIdbPromise) return cachedIdbPromise;

  cachedIdbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(STUDY_DB_NAME, STUDY_DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion ?? 0;
      const newVersion = event.newVersion ?? STUDY_DB_VERSION;
      applyStudyDatabaseMigrations(db, oldVersion, newVersion);
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        for (const invalidate of idbInvalidators) {
          invalidate();
        }
        db.close();
        cachedIdbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      cachedIdbPromise = null;
      reject(request.error ?? new Error('Failed to open IndexedDB'));
    };
  });
  return cachedIdbPromise;
}

const memoryFallback = createMemoryStudyBackend();

export function createIndexedDbStudyBackend(): StudyStorageBackend {
  if (typeof indexedDB === 'undefined') {
    return memoryFallback;
  }

  const rawIdbBackend: StudyStorageBackend = {
    async readAllEvents() {
      try {
        const db = await openStudyDatabase();
        return await new Promise<StudyEvent[]>((resolve, reject) => {
          const tx = db.transaction(STUDY_EVENTS_STORE, 'readonly');
          const store = tx.objectStore(STUDY_EVENTS_STORE);
          const req = store.getAll();
          req.onsuccess = () => {
            const list = (Array.isArray(req.result) ? req.result : []) as StudyEvent[];
            resolve([...list].sort((a, b) => a.seq - b.seq));
          };
          req.onerror = () => reject(req.error ?? new Error('Failed to read events'));
        });
      } catch {
        storageHealthState = 'degraded';
        return memoryFallback.readAllEvents();
      }
    },
    async appendEvent(event) {
      try {
        const db = await openStudyDatabase();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STUDY_EVENTS_STORE, 'readwrite');
          tx.objectStore(STUDY_EVENTS_STORE).put(event);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error ?? new Error('Failed to append event'));
        });
      } catch {
        storageHealthState = 'degraded';
        await memoryFallback.appendEvent(event);
      }
    },
    async putManyEvents(events) {
      try {
        const db = await openStudyDatabase();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STUDY_EVENTS_STORE, 'readwrite');
          const store = tx.objectStore(STUDY_EVENTS_STORE);
          for (const event of events) {
            store.put(event);
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error ?? new Error('Failed to import events'));
        });
      } catch {
        storageHealthState = 'degraded';
        await memoryFallback.putManyEvents(events);
      }
    },
    async clearAllEvents() {
      try {
        const db = await openStudyDatabase();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STUDY_EVENTS_STORE, 'readwrite');
          tx.objectStore(STUDY_EVENTS_STORE).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error ?? new Error('Failed to clear events'));
        });
      } catch {
        storageHealthState = 'degraded';
        await memoryFallback.clearAllEvents?.();
      }
    },
  };

  const cached = createCachingStudyBackend(rawIdbBackend, {
    channelName: 'riverline-study-v1-sync',
  });
  idbInvalidators.add(cached.invalidateCache);
  return cached;
}

/** Deterministic fact-only title for a saved matchup. Never adds judgement or heuristics. */
export function buildFactMatchupTitle(
  players: readonly Pick<SavedMatchupPlayer, 'rawInput'>[],
  board: readonly string[],
  selectedTurnCard?: string,
  selectedRiverCard?: string,
): string {
  const playerPart = players.map((p) => p.rawInput).join(' vs ');
  const fullBoard = [
    ...board,
    ...(selectedTurnCard && !board.includes(selectedTurnCard) ? [selectedTurnCard] : []),
    ...(selectedRiverCard && !board.includes(selectedRiverCard) ? [selectedRiverCard] : []),
  ];
  const boardPart = fullBoard.length > 0 ? fullBoard.join(' ') : 'Preflop';
  return `${playerPart} · ${boardPart}`;
}

/** Deterministic fact-only title for a saved recorded hand or spot. */
export function buildSavedHandFactTitle(payload: SavedHandPayload): string {
  const heroPart = `${payload.heroPositionLabel} ${payload.heroCards.map(formatCardSymbolsForTitle).join(' ')}`;
  const boardPart =
    payload.pokerState.board.length > 0
      ? payload.pokerState.board.map(formatCardSymbolsForTitle).join(' ')
      : payload.pokerState.street;
  const st = payload.pokerState;
  const payoutSum = st.terminal.isTerminal
    ? Object.values(st.terminal.payoutsMilliBbByPlayer).reduce((sum, n) => sum + n, 0)
    : 0;
  const contribSum = st.players.reduce((sum, p) => sum + p.totalPotContributionMilliBb, 0);
  const potMilliBb =
    st.potMilliBb > 0
      ? st.potMilliBb
      : st.recordedSettlement && st.recordedSettlement.grossPotMilliBb > 0
        ? st.recordedSettlement.grossPotMilliBb
        : payoutSum > 0
          ? payoutSum
          : contribSum;
  const potPart = formatPotAmountForTitle(potMilliBb, payload.unitLabel);
  return `${heroPart} · ${boardPart} · ${potPart}`;
}

export function deriveSavedMatchups(events: readonly StudyEvent[]): SavedMatchupRecord[] {
  const ordered = ensureSortedBySeq(events);
  const byId = new Map<string, SavedMatchupRecord>();
  for (const event of ordered) {
    if (event.domain !== 'savedObjects') continue;
    if (event.type === 'saved_matchup.created') {
      const payload = event.payload as SavedMatchupPayload;
      byId.set(event.objectId, {
        objectId: event.objectId,
        createdAt: event.ts,
        factTitle: payload.factTitle,
        payload,
      });
    } else if (event.type === 'saved_matchup.archived') {
      byId.delete(event.objectId);
    }
  }
  return [...byId.values()].reverse();
}

export function deriveSavedHands(
  events: readonly StudyEvent[],
  options: { readonly includeArchived?: boolean } = {},
): SavedHandRecord[] {
  const ordered = ensureSortedBySeq(events);
  const byId = new Map<string, SavedHandRecord>();
  for (const event of ordered) {
    if (event.domain !== 'savedObjects') continue;
    if (event.type === 'saved_hand.created') {
      const payload = expandSavedHandPayload(event.payload as SavedHandPayload);
      byId.set(event.objectId, {
        objectId: event.objectId,
        createdAt: event.ts,
        updatedAt: event.ts,
        archived: false,
        factTitle: buildSavedHandFactTitle(payload),
        tags: payload.tags ? [...payload.tags] : [],
        payload,
      });
    } else if (event.type === 'saved_hand.archived') {
      const existing = byId.get(event.objectId);
      if (existing) {
        byId.set(event.objectId, {
          ...existing,
          archived: true,
          updatedAt: event.ts,
        });
      }
    } else if (event.type === 'saved_hand.restored') {
      const existing = byId.get(event.objectId);
      if (existing) {
        byId.set(event.objectId, {
          ...existing,
          archived: false,
          updatedAt: event.ts,
        });
      }
    } else if (event.type === 'saved_hand.annotated') {
      const existing = byId.get(event.objectId);
      if (existing) {
        const patch = event.payload as SavedHandAnnotatedPayload;
        const nextNotes: HeroDecisionNote[] = patch.heroNotes
          ? patch.heroNotes.map((n) => ({ ...n }))
          : existing.payload.heroNotes.map((n) => ({ ...n }));
        const nextTags: SavedObjectTagId[] = patch.tags
          ? [...patch.tags]
          : [...existing.tags];
        const nextHandNote =
          patch.handNote !== undefined ? patch.handNote : existing.payload.handNote;
        byId.set(event.objectId, {
          ...existing,
          updatedAt: event.ts,
          tags: nextTags,
          payload: {
            ...existing.payload,
            heroNotes: nextNotes,
            tags: nextTags,
            ...(nextHandNote !== undefined ? { handNote: nextHandNote } : {}),
          },
        });
      }
    }
  }
  const records = [...byId.values()].reverse();
  return options.includeArchived ? records : records.filter((r) => !r.archived);
}

export function deriveLearnProgress(events: readonly StudyEvent[]): LearnProgressSnapshot {
  const ordered = ensureSortedBySeq(events);
  const understoodById: Partial<Record<LearnConceptId, boolean>> = {};
  const trainerAttempts: LearnTrainerRecordedPayload[] = [];
  for (const event of ordered) {
    if (event.domain !== 'savedObjects') continue;
    if (event.type === 'learn_concept.updated') {
      const payload = event.payload as LearnConceptUpdatedPayload;
      if (VALID_LEARN_CONCEPTS.has(payload.conceptId)) {
        understoodById[payload.conceptId] = Boolean(payload.understood);
      }
    } else if (event.type === 'learn_trainer.recorded') {
      const payload = event.payload as LearnTrainerRecordedPayload;
      if (VALID_LEARN_MODES.has(payload.mode)) {
        trainerAttempts.push({
          mode: payload.mode,
          spotId: payload.spotId,
          firstTryCorrect: Boolean(payload.firstTryCorrect),
          answeredAt: payload.answeredAt || event.ts,
        });
      }
    }
  }
  return { understoodById, trainerAttempts };
}

export function deriveNightSessions(
  events: readonly StudyEvent[],
  options: { readonly includeArchived?: boolean } = {},
): NightSessionRecord[] {
  const ordered = ensureSortedBySeq(events);
  const byId = new Map<
    string,
    {
      session: HomeGameSession;
      transactions: HomeGameTransaction[];
      linkedHands: NightLinkedHandRef[];
      sessionNote: string;
    }
  >();

  for (const event of ordered) {
    if (event.domain !== 'savedObjects') continue;
    if (event.type === 'night_session.created') {
      const payload = event.payload as NightSessionCreatedPayload;
      byId.set(event.objectId, {
        session: payload.session,
        transactions: [],
        linkedHands: [],
        sessionNote: '',
      });
    } else if (event.type === 'night_session.updated') {
      const existing = byId.get(event.objectId);
      if (!existing) continue;
      const patch = event.payload as NightSessionUpdatedPayload;
      byId.set(event.objectId, {
        ...existing,
        sessionNote: patch.sessionNote !== undefined ? patch.sessionNote : existing.sessionNote,
        session: {
          ...existing.session,
          title: patch.title ?? existing.session.title,
          currency: patch.currency ?? existing.session.currency,
          participants: patch.participants
            ? patch.participants.map((p) => ({ ...p }))
            : existing.session.participants,
          updatedAt: event.ts,
          revision: existing.session.revision + 1,
        },
      });
    } else if (event.type === 'night_ledger.appended') {
      const tx = event.payload as HomeGameTransaction;
      const existing = byId.get(tx.sessionId);
      if (!existing) continue;
      if (!existing.transactions.some((t) => t.transactionId === tx.transactionId)) {
        const nextRevision = existing.session.revision + 1;
        byId.set(tx.sessionId, {
          ...existing,
          transactions: [...existing.transactions, tx],
          session: {
            ...existing.session,
            updatedAt: event.ts,
            revision: nextRevision,
          },
        });
      }
    } else if (event.type === 'night_session.settled') {
      const existing = byId.get(event.objectId);
      if (!existing) continue;
      const payload = event.payload as { readonly settledAt?: string };
      const settledAt = payload.settledAt ?? event.ts;
      const nextRevision = existing.session.revision + 1;
      byId.set(event.objectId, {
        ...existing,
        session: {
          ...existing.session,
          status: 'completed',
          settledAt,
          updatedAt: event.ts,
          revision: nextRevision,
          lifecycleEvents: [
            ...existing.session.lifecycleEvents,
            { type: 'settled', at: settledAt, revision: nextRevision },
          ],
        },
      });
    } else if (event.type === 'night_session.reopened') {
      const existing = byId.get(event.objectId);
      if (!existing) continue;
      const payload = event.payload as { readonly reopenedAt?: string };
      const reopenedAt = payload.reopenedAt ?? event.ts;
      const nextRevision = existing.session.revision + 1;
      byId.set(event.objectId, {
        ...existing,
        session: {
          ...existing.session,
          status: 'active',
          settledAt: null,
          updatedAt: event.ts,
          revision: nextRevision,
          lifecycleEvents: [
            ...existing.session.lifecycleEvents,
            { type: 'reopened', at: reopenedAt, revision: nextRevision },
          ],
        },
      });
    } else if (event.type === 'night_session.archived') {
      const existing = byId.get(event.objectId);
      if (!existing) continue;
      const payload = event.payload as NightSessionArchivedPayload;
      const archived = Boolean(payload.archived);
      const nextRevision = existing.session.revision + 1;
      byId.set(event.objectId, {
        ...existing,
        session: {
          ...existing.session,
          archived,
          updatedAt: event.ts,
          revision: nextRevision,
          lifecycleEvents: [
            ...existing.session.lifecycleEvents,
            { type: archived ? 'archived' : 'restored', at: event.ts, revision: nextRevision },
          ],
        },
      });
    } else if (event.type === 'night_hand.linked') {
      const payload = event.payload as NightHandLinkedPayload;
      const existing = byId.get(payload.nightSessionId);
      if (!existing) continue;
      if (!existing.linkedHands.some((h) => h.handObjectId === payload.handObjectId)) {
        byId.set(payload.nightSessionId, {
          ...existing,
          linkedHands: [
            {
              handObjectId: payload.handObjectId,
              linkedAt: payload.linkedAt || event.ts,
              ...(payload.shorthandSummary ? { shorthandSummary: payload.shorthandSummary } : {}),
            },
            ...existing.linkedHands,
          ],
        });
      }
    }
  }

  const records: NightSessionRecord[] = [...byId.values()]
    .map((entry) => ({
      session: entry.session,
      transactions: entry.transactions,
      linkedHands: entry.linkedHands,
      ...(entry.sessionNote ? { sessionNote: entry.sessionNote } : {}),
    }))
    .reverse();
  return options.includeArchived ? records : records.filter((r) => !r.session.archived);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateSavedMatchupPayload(raw: unknown): raw is SavedMatchupPayload {
  if (!isPlainObject(raw)) return false;
  if (raw.schemaVersion !== SAVED_MATCHUP_SCHEMA_VERSION) return false;
  if (typeof raw.factTitle !== 'string' || !raw.factTitle.trim()) return false;
  if (!Array.isArray(raw.board) || ![0, 3, 4, 5].includes(raw.board.length)) return false;
  if (!raw.board.every((card) => typeof card === 'string' && VALID_CARD_SET.has(card))) return false;
  if (new Set(raw.board).size !== raw.board.length) return false;
  if (!VALID_STREETS.has(String(raw.street))) return false;
  if (
    raw.selectedTurnCard !== undefined &&
    (typeof raw.selectedTurnCard !== 'string' || !VALID_CARD_SET.has(raw.selectedTurnCard))
  ) {
    return false;
  }
  if (
    raw.selectedRiverCard !== undefined &&
    (typeof raw.selectedRiverCard !== 'string' || !VALID_CARD_SET.has(raw.selectedRiverCard))
  ) {
    return false;
  }
  if (!Array.isArray(raw.players) || raw.players.length < 2 || raw.players.length > 10) return false;
  return raw.players.every((player) => {
    if (!isPlainObject(player)) return false;
    return (
      typeof player.id === 'string' &&
      player.id.trim().length > 0 &&
      typeof player.label === 'string' &&
      player.label.trim().length > 0 &&
      typeof player.isHero === 'boolean' &&
      typeof player.rawInput === 'string' &&
      player.rawInput.trim().length > 0 &&
      VALID_INPUT_KINDS.has(String(player.inputKind))
    );
  });
}

function validateSavedHandPayload(raw: unknown): raw is SavedHandPayload {
  if (!isPlainObject(raw)) return false;
  if (typeof raw.handId !== 'string' || !raw.handId.trim()) return false;
  if (!VALID_TABLE_PRESETS.has(String(raw.tablePreset))) return false;
  if (raw.unitLabel !== 'bb' && raw.unitLabel !== '₪') return false;
  if (raw.seatCount !== 2 && raw.seatCount !== 6 && raw.seatCount !== 8) return false;
  if (typeof raw.startingStackBb !== 'number' || !Number.isFinite(raw.startingStackBb) || raw.startingStackBb <= 0) {
    return false;
  }
  if (typeof raw.heroPlayerId !== 'string' || !raw.heroPlayerId.trim()) return false;
  if (typeof raw.heroSeat !== 'number' || !Number.isInteger(raw.heroSeat) || raw.heroSeat < 0) return false;
  if (typeof raw.heroPositionLabel !== 'string' || !raw.heroPositionLabel.trim()) return false;
  if (
    !Array.isArray(raw.heroCards) ||
    raw.heroCards.length !== 2 ||
    typeof raw.heroCards[0] !== 'string' ||
    typeof raw.heroCards[1] !== 'string' ||
    !VALID_CARD_SET.has(raw.heroCards[0]) ||
    !VALID_CARD_SET.has(raw.heroCards[1]) ||
    raw.heroCards[0] === raw.heroCards[1]
  ) {
    return false;
  }
  if (!isPlainObject(raw.pokerState)) return false;
  if (
    !Array.isArray(raw.pokerState.players) ||
    !Array.isArray(raw.pokerState.board) ||
    typeof raw.pokerState.potMilliBb !== 'number'
  ) {
    return false;
  }
  if (!Array.isArray(raw.recordedActions)) return false;
  for (const act of raw.recordedActions) {
    if (!isPlainObject(act) || !VALID_ACTION_TYPES.has(String(act.type)) || !VALID_STREETS.has(String(act.street))) {
      return false;
    }
  }
  if (!Array.isArray(raw.heroNotes)) return false;
  if (typeof raw.shorthandLine !== 'string') return false;
  if (raw.savedKind !== 'completed_hand' && raw.savedKind !== 'mid_hand_spot') return false;
  if (
    raw.tags !== undefined &&
    (!Array.isArray(raw.tags) || !raw.tags.every((tag) => typeof tag === 'string' && VALID_SAVED_TAGS.has(tag)))
  ) {
    return false;
  }
  if (raw.handNote !== undefined && typeof raw.handNote !== 'string') return false;
  return true;
}

function validateSavedHandAnnotatedPayload(raw: unknown): raw is SavedHandAnnotatedPayload {
  if (!isPlainObject(raw)) return false;
  if (
    raw.tags !== undefined &&
    (!Array.isArray(raw.tags) || !raw.tags.every((tag) => typeof tag === 'string' && VALID_SAVED_TAGS.has(tag)))
  ) {
    return false;
  }
  if (raw.handNote !== undefined && typeof raw.handNote !== 'string') return false;
  if (raw.heroNotes !== undefined) {
    if (!Array.isArray(raw.heroNotes)) return false;
    for (const note of raw.heroNotes) {
      if (!isPlainObject(note)) return false;
      if (typeof note.actionSeq !== 'number' || !Number.isInteger(note.actionSeq)) return false;
      if (!VALID_STREETS.has(String(note.street))) return false;
      if (
        note.reasonChip !== undefined &&
        (typeof note.reasonChip !== 'string' || !VALID_THINKING_REASONS.has(note.reasonChip))
      ) {
        return false;
      }
      if (note.customText !== undefined && typeof note.customText !== 'string') return false;
    }
  }
  return true;
}

function validateStudyEvent(raw: unknown): raw is StudyEvent {
  if (!isPlainObject(raw)) return false;
  if (typeof raw.id !== 'string' || !raw.id.trim()) return false;
  if (typeof raw.seq !== 'number' || !Number.isInteger(raw.seq) || raw.seq < 1) return false;
  if (typeof raw.ts !== 'string' || Number.isNaN(Date.parse(raw.ts))) return false;
  if (raw.domain !== 'savedObjects') return false;
  if (typeof raw.objectId !== 'string' || !raw.objectId.trim()) return false;
  if (raw.type === 'saved_matchup.created') {
    return validateSavedMatchupPayload(raw.payload);
  }
  if (
    raw.type === 'saved_matchup.archived' ||
    raw.type === 'saved_hand.archived' ||
    raw.type === 'saved_hand.restored'
  ) {
    return isPlainObject(raw.payload);
  }
  if (raw.type === 'saved_hand.created') {
    return validateSavedHandPayload(raw.payload);
  }
  if (raw.type === 'saved_hand.annotated') {
    return validateSavedHandAnnotatedPayload(raw.payload);
  }
  if (raw.type === 'strategy_evidence.recorded') {
    if (!isPlainObject(raw.payload) || !Array.isArray(raw.payload.entries)) return false;
    return raw.payload.entries.every(
      (entry) =>
        isPlainObject(entry) &&
        typeof entry.evidenceId === 'string' &&
        typeof entry.occurredAt === 'string' &&
        typeof entry.contextKey === 'string' &&
        typeof entry.handClass === 'string' &&
        typeof entry.source === 'string' &&
        typeof entry.action === 'string',
    );
  }
  if (raw.type === 'training_session.recorded') {
    if (!isPlainObject(raw.payload)) return false;
    return (
      typeof raw.payload.sessionId === 'string' &&
      (raw.payload.mode === 'quick_drill' || raw.payload.mode === 'heads_up_duel') &&
      typeof raw.payload.completedAt === 'string' &&
      typeof raw.payload.spotsCount === 'number' &&
      typeof raw.payload.planAlignedCount === 'number' &&
      typeof raw.payload.baselineAlignedCount === 'number'
    );
  }
  if (raw.type === 'night_session.created') {
    if (!isPlainObject(raw.payload) || !isPlainObject(raw.payload.session)) return false;
    const s = raw.payload.session;
    return (
      typeof s.sessionId === 'string' &&
      typeof s.title === 'string' &&
      (s.status === 'active' || s.status === 'completed') &&
      isPlainObject(s.currency) &&
      Array.isArray(s.participants)
    );
  }
  if (raw.type === 'night_session.updated') {
    return (
      isPlainObject(raw.payload) &&
      (raw.payload.sessionNote === undefined || typeof raw.payload.sessionNote === 'string')
    );
  }
  if (raw.type === 'night_session.settled' || raw.type === 'night_session.reopened') {
    return isPlainObject(raw.payload);
  }
  if (raw.type === 'night_session.archived') {
    return isPlainObject(raw.payload) && typeof raw.payload.archived === 'boolean';
  }
  if (raw.type === 'night_ledger.appended') {
    if (!isPlainObject(raw.payload)) return false;
    const tx = raw.payload;
    return (
      typeof tx.transactionId === 'string' &&
      typeof tx.sessionId === 'string' &&
      typeof tx.playerId === 'string' &&
      typeof tx.type === 'string' &&
      typeof tx.amountMinor === 'number' &&
      Number.isSafeInteger(tx.amountMinor) &&
      tx.amountMinor > 0
    );
  }
  if (raw.type === 'night_hand.linked') {
    if (!isPlainObject(raw.payload)) return false;
    return (
      typeof raw.payload.nightSessionId === 'string' &&
      typeof raw.payload.handObjectId === 'string'
    );
  }
  if (raw.type === 'learn_concept.updated') {
    if (!isPlainObject(raw.payload)) return false;
    return (
      VALID_LEARN_CONCEPTS.has(String(raw.payload.conceptId)) &&
      typeof raw.payload.understood === 'boolean' &&
      typeof raw.payload.updatedAt === 'string'
    );
  }
  if (raw.type === 'learn_trainer.recorded') {
    if (!isPlainObject(raw.payload)) return false;
    return (
      VALID_LEARN_MODES.has(String(raw.payload.mode)) &&
      typeof raw.payload.spotId === 'string' &&
      raw.payload.spotId.trim().length > 0 &&
      typeof raw.payload.firstTryCorrect === 'boolean' &&
      typeof raw.payload.answeredAt === 'string'
    );
  }
  return false;
}

function validateBundleAppearance(raw: unknown): raw is Partial<AppearancePreferences> {
  if (!isPlainObject(raw)) return false;
  if (raw.theme !== undefined && !isThemeId(raw.theme)) return false;
  if (raw.pace !== undefined && !isPaceId(raw.pace)) return false;
  if (raw.motion !== undefined && !isMotionMode(raw.motion)) return false;
  if (raw.lang !== undefined && !isLocaleId(raw.lang)) return false;
  if (raw.showLamp !== undefined && typeof raw.showLamp !== 'boolean') return false;
  if (raw.teacherTypingSpeed !== undefined && !isTeacherTypingSpeed(raw.teacherTypingSpeed)) {
    return false;
  }
  return true;
}

export function validateAndParseStudyBundle(rawJsonOrObject: unknown):
  | { readonly ok: true; readonly bundle: StudyExportBundle }
  | {
      readonly ok: false;
      readonly errorCode: 'invalid_json' | 'unsupported_schema_version' | 'invalid_bundle' | 'invalid_event';
      readonly detail?: string;
    } {
  let parsed: unknown = rawJsonOrObject;
  if (typeof rawJsonOrObject === 'string') {
    try {
      parsed = JSON.parse(rawJsonOrObject);
    } catch (error) {
      return {
        ok: false,
        errorCode: 'invalid_json',
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }
  if (!isPlainObject(parsed)) {
    return { ok: false, errorCode: 'invalid_bundle', detail: 'Bundle must be a JSON object' };
  }
  if (parsed.schemaVersion !== STUDY_BUNDLE_SCHEMA_VERSION) {
    return {
      ok: false,
      errorCode: 'unsupported_schema_version',
      detail: String(parsed.schemaVersion ?? 'missing'),
    };
  }
  if (typeof parsed.exportedAt !== 'string' || Number.isNaN(Date.parse(parsed.exportedAt))) {
    return { ok: false, errorCode: 'invalid_bundle', detail: 'exportedAt timestamp is invalid' };
  }
  if (!Array.isArray(parsed.events)) {
    return { ok: false, errorCode: 'invalid_bundle', detail: 'events array is required' };
  }
  for (let i = 0; i < parsed.events.length; i += 1) {
    if (!validateStudyEvent(parsed.events[i])) {
      return { ok: false, errorCode: 'invalid_event', detail: `events[${i}]` };
    }
  }
  if (parsed.appearance !== undefined && !validateBundleAppearance(parsed.appearance)) {
    return { ok: false, errorCode: 'invalid_bundle', detail: 'appearance fields invalid' };
  }

  const rawProfiles = Array.isArray(parsed.villainProfiles)
    ? parsed.villainProfiles.filter(
        (p): p is { id: string; name: string; rangeText: string } =>
          isPlainObject(p) &&
          typeof p.id === 'string' &&
          typeof p.name === 'string' &&
          typeof p.rangeText === 'string' &&
          p.name.trim().length > 0 &&
          p.rangeText.trim().length > 0,
      )
    : undefined;

  const rawSessionPad = typeof parsed.sessionPad === 'string' ? parsed.sessionPad : undefined;
  const rawPlaybook = isPlainObject(parsed.postflopPlaybook) ? parsed.postflopPlaybook : undefined;

  return {
    ok: true,
    bundle: {
      schemaVersion: STUDY_BUNDLE_SCHEMA_VERSION,
      exportedAt: parsed.exportedAt,
      appearance: normalizeAppearance(parsed.appearance),
      events: parsed.events as StudyEvent[],
      ...(rawProfiles && rawProfiles.length > 0 ? { villainProfiles: rawProfiles } : {}),
      ...(rawSessionPad ? { sessionPad: rawSessionPad } : {}),
      ...(rawPlaybook ? { postflopPlaybook: rawPlaybook } : {}),
    },
  };
}

export interface StudyRepository {
  listSavedMatchups(): Promise<SavedMatchupRecord[]>;
  saveMatchup(input: {
    readonly board: readonly string[];
    readonly players: readonly SavedMatchupPlayer[];
    readonly street: EquityStreet;
    readonly selectedTurnCard?: string;
    readonly selectedRiverCard?: string;
  }): Promise<SavedMatchupRecord>;
  archiveSavedMatchup(objectId: string): Promise<void>;
  listSavedHands(options?: { readonly includeArchived?: boolean }): Promise<SavedHandRecord[]>;
  saveHand(input: SavedHandPayload): Promise<SavedHandRecord>;
  archiveSavedHand(objectId: string): Promise<void>;
  restoreSavedHand(objectId: string): Promise<void>;
  annotateSavedHand(
    objectId: string,
    patch: SavedHandAnnotatedPayload,
  ): Promise<SavedHandRecord | null>;
  listStrategyEvidence(): Promise<StrategyEvidenceEntry[]>;
  recordStrategyEvidence(entries: readonly StrategyEvidenceEntry[]): Promise<void>;
  listTrainingSessions(): Promise<TrainingSessionPayload[]>;
  recordTrainingSession(session: TrainingSessionPayload): Promise<void>;
  listNightSessions(options?: { readonly includeArchived?: boolean }): Promise<NightSessionRecord[]>;
  createNightSession(input: {
    readonly sessionId?: string;
    readonly title: string;
    readonly currency: HomeGameCurrency;
    readonly participants: readonly HomeGameParticipant[];
  }): Promise<NightSessionRecord>;
  updateNightSession(
    sessionId: string,
    patch: {
      readonly title?: string;
      readonly currency?: HomeGameCurrency;
      readonly participants?: readonly HomeGameParticipant[];
      readonly sessionNote?: string;
    },
  ): Promise<NightSessionRecord | null>;
  appendNightTransaction(
    tx: {
      readonly sessionId: string;
      readonly playerId: string;
      readonly type: HomeGameTransaction['type'];
      readonly amountMinor: number;
      readonly transactionId?: string;
      readonly createdAt?: string;
      readonly note?: string | null;
      readonly correctionOfTransactionId?: string | null;
      readonly replacementOfTransactionId?: string | null;
    },
  ): Promise<HomeGameTransaction>;
  settleNightSession(sessionId: string): Promise<NightSessionRecord | null>;
  reopenNightSession(sessionId: string): Promise<NightSessionRecord | null>;
  archiveNightSession(sessionId: string, archived: boolean): Promise<NightSessionRecord | null>;
  linkHandToNight(input: {
    readonly nightSessionId: string;
    readonly handObjectId: string;
    readonly shorthandSummary?: string;
  }): Promise<void>;
  getLearnProgress(): Promise<LearnProgressSnapshot>;
  recordLearnConcept(conceptId: LearnConceptId, understood: boolean): Promise<void>;
  recordLearnTrainerAttempt(input: {
    readonly mode: PersistedLearnTrainerMode;
    readonly spotId: string;
    readonly firstTryCorrect: boolean;
  }): Promise<void>;
  exportBundle(): Promise<StudyExportBundle>;
  importBundle(
    rawJsonOrObject: unknown,
    options?: { readonly applyAppearance?: boolean },
  ): Promise<StudyImportResult>;
  getStorageCounts(): Promise<StudyStorageCounts>;
  clearAllData(): Promise<void>;
  getStorageHealth(): StudyStorageHealth;
  subscribe(listener: () => void): () => void;
}

export const STUDY_STORAGE_WIPED_KEY = 'riverline.storage.wiped';

function setWipedFlag(wiped: boolean): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (wiped) {
      window.localStorage.setItem(STUDY_STORAGE_WIPED_KEY, '1');
    } else {
      window.localStorage.removeItem(STUDY_STORAGE_WIPED_KEY);
    }
  } catch {
    // Ignore storage quota/security errors on flag
  }
}

export function isStudyStorageWiped(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    return window.localStorage.getItem(STUDY_STORAGE_WIPED_KEY) === '1';
  } catch {
    return false;
  }
}

export function createStudyRepository(
  rawBackend: StudyStorageBackend = createIndexedDbStudyBackend(),
): StudyRepository {
  const listeners = new Set<() => void>();
  let writeChain: Promise<unknown> = Promise.resolve();
  let lastAllocatedSeq = 0;
  let projectionVersion = 0;
  interface ProjectionCache {
    version: number;
    matchups?: SavedMatchupRecord[];
    handsWithArchived?: SavedHandRecord[];
    handsActive?: SavedHandRecord[];
    evidence?: StrategyEvidenceEntry[];
    training?: TrainingSessionPayload[];
    nightsWithArchived?: NightSessionRecord[];
    nightsActive?: NightSessionRecord[];
    learn?: LearnProgressSnapshot;
  }
  let projectionCache: ProjectionCache = { version: 0 };
  if ('onExternalInvalidate' in rawBackend && typeof rawBackend.onExternalInvalidate === 'function') {
    rawBackend.onExternalInvalidate(() => {
      projectionVersion += 1;
      notifyListeners();
    });
  }

  function getProjectionCache(): ProjectionCache {
    if (projectionCache.version !== projectionVersion) {
      projectionCache = { version: projectionVersion };
    }
    return projectionCache;
  }

  function notifyListeners(): void {
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // Ignore listener errors
      }
    }
  }

  function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
    const next = writeChain.then(task, task);
    writeChain = next.catch(() => {});
    return next;
  }

  const backend: StudyStorageBackend = {
    ...rawBackend,
    async appendEvent(event: StudyEvent): Promise<void> {
      setWipedFlag(false);
      const seq = Math.max(event.seq, lastAllocatedSeq + 1);
      lastAllocatedSeq = seq;
      await rawBackend.appendEvent(seq === event.seq ? event : { ...event, seq });
      projectionVersion += 1;
      notifyListeners();
    },
    async putManyEvents(events: readonly StudyEvent[]): Promise<void> {
      setWipedFlag(false);
      await rawBackend.putManyEvents(events);
      for (const evt of events) {
        if (evt.seq > lastAllocatedSeq) lastAllocatedSeq = evt.seq;
      }
      projectionVersion += 1;
      notifyListeners();
    },
    async clearAllEvents(): Promise<void> {
      lastAllocatedSeq = 0;
      if (rawBackend.clearAllEvents) {
        await rawBackend.clearAllEvents();
      }
      projectionVersion += 1;
      notifyListeners();
    },
  };

  const repo: StudyRepository = {
    async listSavedMatchups() {
      const cache = getProjectionCache();
      if (cache.matchups) return cache.matchups;
      const events = await backend.readAllEvents();
      const result = deriveSavedMatchups(events);
      cache.matchups = result;
      return result;
    },

    async saveMatchup(input) {
      const existing = await backend.readAllEvents();
      const maxSeq = maxSeqFromSorted(existing);
      const objectId = `matchup-${nextUuid()}`;
      const ts = new Date().toISOString();
      const factTitle = buildFactMatchupTitle(
        input.players,
        input.board,
        input.selectedTurnCard,
        input.selectedRiverCard,
      );
      const payload: SavedMatchupPayload = {
        schemaVersion: SAVED_MATCHUP_SCHEMA_VERSION,
        factTitle,
        board: [...input.board],
        players: input.players.map((p) => ({ ...p })),
        street: input.street,
        ...(input.selectedTurnCard ? { selectedTurnCard: input.selectedTurnCard } : {}),
        ...(input.selectedRiverCard ? { selectedRiverCard: input.selectedRiverCard } : {}),
      };
      const event: StudyEvent = {
        id: nextUuid(),
        seq: maxSeq + 1,
        ts,
        domain: 'savedObjects',
        type: 'saved_matchup.created',
        objectId,
        payload,
      };
      await backend.appendEvent(event);
      return {
        objectId,
        createdAt: ts,
        factTitle,
        payload,
      };
    },

    async archiveSavedMatchup(objectId) {
      const existing = await backend.readAllEvents();
      const maxSeq = maxSeqFromSorted(existing);
      const event: StudyEvent = {
        id: nextUuid(),
        seq: maxSeq + 1,
        ts: new Date().toISOString(),
        domain: 'savedObjects',
        type: 'saved_matchup.archived',
        objectId,
        payload: {},
      };
      await backend.appendEvent(event);
    },

    async listSavedHands(options) {
      const includeArchived = Boolean(options?.includeArchived);
      const cache = getProjectionCache();
      if (includeArchived && cache.handsWithArchived) return cache.handsWithArchived;
      if (!includeArchived && cache.handsActive) return cache.handsActive;
      const events = await backend.readAllEvents();
      const result = deriveSavedHands(events, options);
      if (includeArchived) cache.handsWithArchived = result;
      else cache.handsActive = result;
      return result;
    },

    async saveHand(input) {
      const existing = await backend.readAllEvents();
      const maxSeq = maxSeqFromSorted(existing);
      const objectId = `hand-${nextUuid()}`;
      const ts = new Date().toISOString();
      const tags: SavedObjectTagId[] = input.tags ? [...input.tags] : [];
      const payload: SavedHandPayload = compactSavedHandPayload({
        ...input,
        heroCards: [input.heroCards[0], input.heroCards[1]],
        recordedActions: input.recordedActions.map((a) => ({ ...a })),
        heroNotes: input.heroNotes.map((n) => ({ ...n })),
        ...(tags.length > 0 ? { tags } : {}),
      });
      const event: StudyEvent = {
        id: nextUuid(),
        seq: maxSeq + 1,
        ts,
        domain: 'savedObjects',
        type: 'saved_hand.created',
        objectId,
        payload,
      };
      await backend.appendEvent(event);
      return {
        objectId,
        createdAt: ts,
        updatedAt: ts,
        archived: false,
        factTitle: buildSavedHandFactTitle(payload),
        tags,
        payload,
      };
    },

    async archiveSavedHand(objectId) {
      const existing = await backend.readAllEvents();
      const maxSeq = maxSeqFromSorted(existing);
      const event: StudyEvent = {
        id: nextUuid(),
        seq: maxSeq + 1,
        ts: new Date().toISOString(),
        domain: 'savedObjects',
        type: 'saved_hand.archived',
        objectId,
        payload: {},
      };
      await backend.appendEvent(event);
    },

    async restoreSavedHand(objectId) {
      const existing = await backend.readAllEvents();
      const maxSeq = maxSeqFromSorted(existing);
      const event: StudyEvent = {
        id: nextUuid(),
        seq: maxSeq + 1,
        ts: new Date().toISOString(),
        domain: 'savedObjects',
        type: 'saved_hand.restored',
        objectId,
        payload: {},
      };
      await backend.appendEvent(event);
    },

    async annotateSavedHand(objectId, patch) {
      const existing = await backend.readAllEvents();
      const maxSeq = maxSeqFromSorted(existing);
      const cleanPatch: SavedHandAnnotatedPayload = {
        ...(patch.tags !== undefined ? { tags: [...patch.tags] } : {}),
        ...(patch.heroNotes !== undefined
          ? { heroNotes: patch.heroNotes.map((n) => ({ ...n })) }
          : {}),
        ...(patch.handNote !== undefined ? { handNote: patch.handNote } : {}),
      };
      const event: StudyEvent = {
        id: nextUuid(),
        seq: maxSeq + 1,
        ts: new Date().toISOString(),
        domain: 'savedObjects',
        type: 'saved_hand.annotated',
        objectId,
        payload: cleanPatch,
      };
      await backend.appendEvent(event);
      const updated = deriveSavedHands([...existing, event], { includeArchived: true }).find(
        (record) => record.objectId === objectId,
      );
      return updated ?? null;
    },

    async listStrategyEvidence() {
      const cache = getProjectionCache();
      if (cache.evidence) return cache.evidence;
      const events = await backend.readAllEvents();
      const sorted = ensureSortedBySeq(events);
      const entries: StrategyEvidenceEntry[] = [];
      for (const evt of sorted) {
        if (evt.type !== 'strategy_evidence.recorded') continue;
        const payload = evt.payload as StrategyEvidenceBatchPayload;
        if (Array.isArray(payload.entries)) {
          entries.push(...payload.entries);
        }
      }
      cache.evidence = entries;
      return entries;
    },

    async recordStrategyEvidence(entries) {
      if (entries.length === 0) return;
      const existing = await backend.readAllEvents();
      const maxSeq = maxSeqFromSorted(existing);
      const event: StudyEvent = {
        id: nextUuid(),
        seq: maxSeq + 1,
        ts: new Date().toISOString(),
        domain: 'savedObjects',
        type: 'strategy_evidence.recorded',
        objectId: 'personal-strategy-v1',
        payload: { entries: entries.map((e) => ({ ...e })) },
      };
      await backend.appendEvent(event);
    },

    async listTrainingSessions() {
      const cache = getProjectionCache();
      if (cache.training) return cache.training;
      const events = await backend.readAllEvents();
      const ordered = ensureSortedBySeq(events);
      const sessions: TrainingSessionPayload[] = [];
      for (let i = ordered.length - 1; i >= 0; i -= 1) {
        const evt = ordered[i]!;
        if (evt.type !== 'training_session.recorded') continue;
        const payload = evt.payload as unknown as TrainingSessionPayload;
        if (isPlainObject(payload) && typeof payload.sessionId === 'string') {
          sessions.push(payload);
        }
      }
      cache.training = sessions;
      return sessions;
    },

    async recordTrainingSession(session) {
      const existing = await backend.readAllEvents();
      const maxSeq = maxSeqFromSorted(existing);
      const event: StudyEvent = {
        id: nextUuid(),
        seq: maxSeq + 1,
        ts: session.completedAt || new Date().toISOString(),
        domain: 'savedObjects',
        type: 'training_session.recorded',
        objectId: session.sessionId,
        payload: { ...session },
      };
      await backend.appendEvent(event);
    },

    async listNightSessions(options) {
      const includeArchived = Boolean(options?.includeArchived);
      const cache = getProjectionCache();
      if (includeArchived && cache.nightsWithArchived) return cache.nightsWithArchived;
      if (!includeArchived && cache.nightsActive) return cache.nightsActive;
      const events = await backend.readAllEvents();
      const result = deriveNightSessions(events, options);
      if (includeArchived) cache.nightsWithArchived = result;
      else cache.nightsActive = result;
      return result;
    },

    async createNightSession(input) {
      const existing = await backend.readAllEvents();
      const maxSeq = maxSeqFromSorted(existing);
      const now = new Date().toISOString();
      const sessionId = input.sessionId ?? `night-${nextUuid()}`;
      const session: HomeGameSession = {
        sessionId,
        title: input.title,
        status: 'active',
        currency: { ...input.currency },
        participants: input.participants.map((p) => ({ ...p })),
        createdAt: now,
        updatedAt: now,
        settledAt: null,
        archived: false,
        revision: 1,
        lifecycleEvents: [{ type: 'created', at: now, revision: 1 }],
      };
      const event: StudyEvent = {
        id: nextUuid(),
        seq: maxSeq + 1,
        ts: now,
        domain: 'savedObjects',
        type: 'night_session.created',
        objectId: sessionId,
        payload: { session },
      };
      await backend.appendEvent(event);
      return { session, transactions: [], linkedHands: [] };
    },

    async updateNightSession(sessionId, patch) {
      const existing = await backend.readAllEvents();
      const maxSeq = maxSeqFromSorted(existing);
      const now = new Date().toISOString();
      const cleanPatch: NightSessionUpdatedPayload = {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.currency !== undefined ? { currency: { ...patch.currency } } : {}),
        ...(patch.participants !== undefined
          ? { participants: patch.participants.map((p) => ({ ...p })) }
          : {}),
        ...(patch.sessionNote !== undefined ? { sessionNote: patch.sessionNote } : {}),
      };
      const event: StudyEvent = {
        id: nextUuid(),
        seq: maxSeq + 1,
        ts: now,
        domain: 'savedObjects',
        type: 'night_session.updated',
        objectId: sessionId,
        payload: cleanPatch,
      };
      await backend.appendEvent(event);
      return (
        deriveNightSessions([...existing, event], { includeArchived: true }).find(
          (r) => r.session.sessionId === sessionId,
        ) ?? null
      );
    },

    async appendNightTransaction(input) {
      const existing = await backend.readAllEvents();
      const maxSeq = maxSeqFromSorted(existing);
      const now = input.createdAt ?? new Date().toISOString();
      const tx: HomeGameTransaction = {
        transactionId: input.transactionId ?? `ntx-${nextUuid()}`,
        sessionId: input.sessionId,
        playerId: input.playerId,
        type: input.type,
        amountMinor: input.amountMinor,
        createdAt: now,
        note: input.note ?? null,
        correctionOfTransactionId: input.correctionOfTransactionId ?? null,
        replacementOfTransactionId: input.replacementOfTransactionId ?? null,
      };
      const event: StudyEvent = {
        id: nextUuid(),
        seq: maxSeq + 1,
        ts: now,
        domain: 'savedObjects',
        type: 'night_ledger.appended',
        objectId: tx.transactionId,
        payload: tx,
      };
      await backend.appendEvent(event);
      return tx;
    },

    async settleNightSession(sessionId) {
      const existing = await backend.readAllEvents();
      const maxSeq = maxSeqFromSorted(existing);
      const now = new Date().toISOString();
      const event: StudyEvent = {
        id: nextUuid(),
        seq: maxSeq + 1,
        ts: now,
        domain: 'savedObjects',
        type: 'night_session.settled',
        objectId: sessionId,
        payload: { settledAt: now },
      };
      await backend.appendEvent(event);
      return (
        deriveNightSessions([...existing, event], { includeArchived: true }).find(
          (r) => r.session.sessionId === sessionId,
        ) ?? null
      );
    },

    async reopenNightSession(sessionId) {
      const existing = await backend.readAllEvents();
      const maxSeq = maxSeqFromSorted(existing);
      const now = new Date().toISOString();
      const event: StudyEvent = {
        id: nextUuid(),
        seq: maxSeq + 1,
        ts: now,
        domain: 'savedObjects',
        type: 'night_session.reopened',
        objectId: sessionId,
        payload: { reopenedAt: now },
      };
      await backend.appendEvent(event);
      return (
        deriveNightSessions([...existing, event], { includeArchived: true }).find(
          (r) => r.session.sessionId === sessionId,
        ) ?? null
      );
    },

    async archiveNightSession(sessionId, archived) {
      const existing = await backend.readAllEvents();
      const maxSeq = maxSeqFromSorted(existing);
      const now = new Date().toISOString();
      const event: StudyEvent = {
        id: nextUuid(),
        seq: maxSeq + 1,
        ts: now,
        domain: 'savedObjects',
        type: 'night_session.archived',
        objectId: sessionId,
        payload: { archived },
      };
      await backend.appendEvent(event);
      return (
        deriveNightSessions([...existing, event], { includeArchived: true }).find(
          (r) => r.session.sessionId === sessionId,
        ) ?? null
      );
    },

    async linkHandToNight(input) {
      const existing = await backend.readAllEvents();
      const maxSeq = maxSeqFromSorted(existing);
      const now = new Date().toISOString();
      const event: StudyEvent = {
        id: nextUuid(),
        seq: maxSeq + 1,
        ts: now,
        domain: 'savedObjects',
        type: 'night_hand.linked',
        objectId: `${input.nightSessionId}:${input.handObjectId}`,
        payload: {
          nightSessionId: input.nightSessionId,
          handObjectId: input.handObjectId,
          ...(input.shorthandSummary ? { shorthandSummary: input.shorthandSummary } : {}),
          linkedAt: now,
        },
      };
      await backend.appendEvent(event);
    },

    async getLearnProgress() {
      const cache = getProjectionCache();
      if (cache.learn) return cache.learn;
      const events = await backend.readAllEvents();
      const result = deriveLearnProgress(events);
      cache.learn = result;
      return result;
    },

    async recordLearnConcept(conceptId, understood) {
      const existing = await backend.readAllEvents();
      const maxSeq = maxSeqFromSorted(existing);
      const now = new Date().toISOString();
      const event: StudyEvent = {
        id: nextUuid(),
        seq: maxSeq + 1,
        ts: now,
        domain: 'savedObjects',
        type: 'learn_concept.updated',
        objectId: `learn-concept-${conceptId}`,
        payload: {
          conceptId,
          understood,
          updatedAt: now,
        },
      };
      await backend.appendEvent(event);
    },

    async recordLearnTrainerAttempt(input) {
      const existing = await backend.readAllEvents();
      const maxSeq = maxSeqFromSorted(existing);
      const now = new Date().toISOString();
      const event: StudyEvent = {
        id: nextUuid(),
        seq: maxSeq + 1,
        ts: now,
        domain: 'savedObjects',
        type: 'learn_trainer.recorded',
        objectId: `learn-trainer-${input.mode}-${input.spotId}-${nextUuid()}`,
        payload: {
          mode: input.mode,
          spotId: input.spotId,
          firstTryCorrect: input.firstTryCorrect,
          answeredAt: now,
        },
      };
      await backend.appendEvent(event);
    },

    async exportBundle() {
      const events = await backend.readAllEvents();
      const villainProfiles = exportCustomVillainProfiles();
      const postflopPlaybook = exportPostflopPlaybook();
      let sessionPad: string | undefined;
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const pad = window.localStorage.getItem(SESSION_PAD_STORAGE_KEY);
          if (pad && pad.trim().length > 0) sessionPad = pad;
        } catch {
          // Ignore storage read errors
        }
      }
      return {
        schemaVersion: STUDY_BUNDLE_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        appearance: readPersistedAppearance(),
        events,
        ...(villainProfiles.length > 0 ? { villainProfiles } : {}),
        ...(sessionPad ? { sessionPad } : {}),
        ...(Object.keys(postflopPlaybook).length > 0 ? { postflopPlaybook } : {}),
      };
    },

    async importBundle(rawJsonOrObject, options = {}) {
      const validation = validateAndParseStudyBundle(rawJsonOrObject);
      if (!validation.ok) return validation;

      const existing = await backend.readAllEvents();
      const seenIds = new Set(existing.map((e) => e.id));
      let nextSeq = maxSeqFromSorted(existing);
      const toInsert: StudyEvent[] = [];
      let skippedDuplicates = 0;

      const incomingSorted = ensureSortedBySeq(validation.bundle.events);
      for (const evt of incomingSorted) {
        if (seenIds.has(evt.id)) {
          skippedDuplicates += 1;
          continue;
        }
        nextSeq += 1;
        toInsert.push({ ...evt, seq: nextSeq });
        seenIds.add(evt.id);
      }

      if (toInsert.length > 0) {
        await backend.putManyEvents(toInsert);
      }
      if (options.applyAppearance !== false) {
        updateAppearance(validation.bundle.appearance);
      }
      if (validation.bundle.villainProfiles && validation.bundle.villainProfiles.length > 0) {
        importCustomVillainProfiles(validation.bundle.villainProfiles);
      }
      if (validation.bundle.postflopPlaybook) {
        importPostflopPlaybook(validation.bundle.postflopPlaybook as Record<string, never>);
      }
      if (validation.bundle.sessionPad !== undefined && typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(SESSION_PAD_STORAGE_KEY, validation.bundle.sessionPad);
        } catch {
          // Ignore storage quota errors
        }
      }
      const finalEvents = await backend.readAllEvents();
      return {
        ok: true,
        importedCount: toInsert.length,
        skippedDuplicates,
        savedMatchups: deriveSavedMatchups(finalEvents),
        savedHands: deriveSavedHands(finalEvents),
      };
    },

    async getStorageCounts() {
      const events = await backend.readAllEvents();
      let trainingSessions = 0;
      for (const evt of events) {
        if (evt.type === 'training_session.recorded') trainingSessions += 1;
      }
      return {
        savedHands: deriveSavedHands(events).length,
        savedMatchups: deriveSavedMatchups(events).length,
        nights: deriveNightSessions(events).length,
        trainingSessions,
        totalEvents: events.length,
      };
    },

    async clearAllData() {
      setWipedFlag(true);
      clearCustomVillainProfiles();
      clearPostflopPlaybook();
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.removeItem(REVISIT_STORAGE_KEY);
          window.localStorage.removeItem(SESSION_PAD_STORAGE_KEY);
        } catch {
          // Ignore storage errors
        }
      }
      await backend.clearAllEvents?.();
    },

    getStorageHealth() {
      return storageHealthState;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return {
    ...repo,
    saveMatchup: (input) => enqueueWrite(() => repo.saveMatchup(input)),
    archiveSavedMatchup: (objectId) => enqueueWrite(() => repo.archiveSavedMatchup(objectId)),
    saveHand: (input) => enqueueWrite(() => repo.saveHand(input)),
    archiveSavedHand: (objectId) => enqueueWrite(() => repo.archiveSavedHand(objectId)),
    restoreSavedHand: (objectId) => enqueueWrite(() => repo.restoreSavedHand(objectId)),
    annotateSavedHand: (objectId, patch) => enqueueWrite(() => repo.annotateSavedHand(objectId, patch)),
    recordStrategyEvidence: (entries) => enqueueWrite(() => repo.recordStrategyEvidence(entries)),
    recordTrainingSession: (session) => enqueueWrite(() => repo.recordTrainingSession(session)),
    createNightSession: (input) => enqueueWrite(() => repo.createNightSession(input)),
    updateNightSession: (sessionId, patch) => enqueueWrite(() => repo.updateNightSession(sessionId, patch)),
    appendNightTransaction: (input) => enqueueWrite(() => repo.appendNightTransaction(input)),
    settleNightSession: (sessionId) => enqueueWrite(() => repo.settleNightSession(sessionId)),
    reopenNightSession: (sessionId) => enqueueWrite(() => repo.reopenNightSession(sessionId)),
    archiveNightSession: (sessionId, archived) => enqueueWrite(() => repo.archiveNightSession(sessionId, archived)),
    linkHandToNight: (input) => enqueueWrite(() => repo.linkHandToNight(input)),
    recordLearnConcept: (conceptId, understood) => enqueueWrite(() => repo.recordLearnConcept(conceptId, understood)),
    recordLearnTrainerAttempt: (input) => enqueueWrite(() => repo.recordLearnTrainerAttempt(input)),
    importBundle: (rawJsonOrObject, options) => enqueueWrite(() => repo.importBundle(rawJsonOrObject, options)),
    clearAllData: () => enqueueWrite(() => repo.clearAllData()),
  };
}

let defaultRepository: StudyRepository | null = null;

export function getDefaultStudyRepository(): StudyRepository {
  if (!defaultRepository) {
    defaultRepository = createStudyRepository();
  }
  return defaultRepository;
}
