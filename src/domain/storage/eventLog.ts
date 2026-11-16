import {
  HOLDEM_DECK,
  LEARN_CONCEPT_IDS,
  type HomeGameCurrency,
  type HomeGameParticipant,
  type HomeGameSession,
  type HomeGameTransaction,
  type LearnConceptId,
  type LearnTrainerMode,
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
const VALID_LEARN_MODES = new Set<string>(['pot_odds', 'outs']);
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

/** Creates an isolated in-memory event log store (for unit tests and headless environments). */
export function createMemoryStudyBackend(initial: readonly StudyEvent[] = []): StudyStorageBackend {
  const events: StudyEvent[] = [...initial];
  return {
    async readAllEvents() {
      return [...events].sort((a, b) => a.seq - b.seq);
    },
    async appendEvent(event) {
      events.push(event);
    },
    async putManyEvents(incoming) {
      const seen = new Set(events.map((e) => e.id));
      for (const evt of incoming) {
        if (!seen.has(evt.id)) {
          events.push(evt);
          seen.add(evt.id);
        }
      }
    },
  };
}

let cachedIdbPromise: Promise<IDBDatabase> | null = null;

function openStudyDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (cachedIdbPromise) return cachedIdbPromise;

  cachedIdbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(STUDY_DB_NAME, STUDY_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STUDY_EVENTS_STORE)) {
        const store = db.createObjectStore(STUDY_EVENTS_STORE, { keyPath: 'id' });
        store.createIndex('by_domain_seq', ['domain', 'seq'], { unique: false });
        store.createIndex('by_ts', 'ts', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
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

  return {
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
        await memoryFallback.putManyEvents(events);
      }
    },
  };
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
  const potPart = formatPotAmountForTitle(payload.pokerState.potMilliBb, payload.unitLabel);
  return `${heroPart} · ${boardPart} · ${potPart}`;
}

export function deriveSavedMatchups(events: readonly StudyEvent[]): SavedMatchupRecord[] {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
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
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  const byId = new Map<string, SavedHandRecord>();
  for (const event of ordered) {
    if (event.domain !== 'savedObjects') continue;
    if (event.type === 'saved_hand.created') {
      const payload = event.payload as SavedHandPayload;
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
        byId.set(event.objectId, {
          ...existing,
          updatedAt: event.ts,
          tags: nextTags,
          payload: {
            ...existing.payload,
            heroNotes: nextNotes,
            tags: nextTags,
          },
        });
      }
    }
  }
  const records = [...byId.values()].reverse();
  return options.includeArchived ? records : records.filter((r) => !r.archived);
}

export function deriveLearnProgress(events: readonly StudyEvent[]): LearnProgressSnapshot {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
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
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  const byId = new Map<
    string,
    {
      session: HomeGameSession;
      transactions: HomeGameTransaction[];
      linkedHands: NightLinkedHandRef[];
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
      });
    } else if (event.type === 'night_session.updated') {
      const existing = byId.get(event.objectId);
      if (!existing) continue;
      const patch = event.payload as NightSessionUpdatedPayload;
      byId.set(event.objectId, {
        ...existing,
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

  const records = [...byId.values()].reverse();
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
    return isPlainObject(raw.payload);
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

  return {
    ok: true,
    bundle: {
      schemaVersion: STUDY_BUNDLE_SCHEMA_VERSION,
      exportedAt: parsed.exportedAt,
      appearance: normalizeAppearance(parsed.appearance),
      events: parsed.events as StudyEvent[],
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
    readonly mode: LearnTrainerMode;
    readonly spotId: string;
    readonly firstTryCorrect: boolean;
  }): Promise<void>;
  exportBundle(): Promise<StudyExportBundle>;
  importBundle(
    rawJsonOrObject: unknown,
    options?: { readonly applyAppearance?: boolean },
  ): Promise<StudyImportResult>;
}

export function createStudyRepository(
  backend: StudyStorageBackend = createIndexedDbStudyBackend(),
): StudyRepository {
  return {
    async listSavedMatchups() {
      const events = await backend.readAllEvents();
      return deriveSavedMatchups(events);
    },

    async saveMatchup(input) {
      const existing = await backend.readAllEvents();
      const maxSeq = existing.reduce((max, e) => Math.max(max, e.seq), 0);
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
      const maxSeq = existing.reduce((max, e) => Math.max(max, e.seq), 0);
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
      const events = await backend.readAllEvents();
      return deriveSavedHands(events, options);
    },

    async saveHand(input) {
      const existing = await backend.readAllEvents();
      const maxSeq = existing.reduce((max, e) => Math.max(max, e.seq), 0);
      const objectId = `hand-${nextUuid()}`;
      const ts = new Date().toISOString();
      const tags: SavedObjectTagId[] = input.tags ? [...input.tags] : [];
      const payload: SavedHandPayload = {
        ...input,
        heroCards: [input.heroCards[0], input.heroCards[1]],
        recordedActions: input.recordedActions.map((a) => ({ ...a })),
        heroNotes: input.heroNotes.map((n) => ({ ...n })),
        ...(tags.length > 0 ? { tags } : {}),
      };
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
      const maxSeq = existing.reduce((max, e) => Math.max(max, e.seq), 0);
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
      const maxSeq = existing.reduce((max, e) => Math.max(max, e.seq), 0);
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
      const maxSeq = existing.reduce((max, e) => Math.max(max, e.seq), 0);
      const cleanPatch: SavedHandAnnotatedPayload = {
        ...(patch.tags !== undefined ? { tags: [...patch.tags] } : {}),
        ...(patch.heroNotes !== undefined
          ? { heroNotes: patch.heroNotes.map((n) => ({ ...n })) }
          : {}),
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
      const events = await backend.readAllEvents();
      const sorted = [...events].sort((a, b) => a.seq - b.seq);
      const entries: StrategyEvidenceEntry[] = [];
      for (const evt of sorted) {
        if (evt.type !== 'strategy_evidence.recorded') continue;
        const payload = evt.payload as StrategyEvidenceBatchPayload;
        if (Array.isArray(payload.entries)) {
          entries.push(...payload.entries);
        }
      }
      return entries;
    },

    async recordStrategyEvidence(entries) {
      if (entries.length === 0) return;
      const existing = await backend.readAllEvents();
      const maxSeq = existing.reduce((max, e) => Math.max(max, e.seq), 0);
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
      const events = await backend.readAllEvents();
      const sorted = [...events].sort((a, b) => b.seq - a.seq);
      const sessions: TrainingSessionPayload[] = [];
      for (const evt of sorted) {
        if (evt.type !== 'training_session.recorded') continue;
        const payload = evt.payload as unknown as TrainingSessionPayload;
        if (isPlainObject(payload) && typeof payload.sessionId === 'string') {
          sessions.push(payload);
        }
      }
      return sessions;
    },

    async recordTrainingSession(session) {
      const existing = await backend.readAllEvents();
      const maxSeq = existing.reduce((max, e) => Math.max(max, e.seq), 0);
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
      const events = await backend.readAllEvents();
      return deriveNightSessions(events, options);
    },

    async createNightSession(input) {
      const existing = await backend.readAllEvents();
      const maxSeq = existing.reduce((max, e) => Math.max(max, e.seq), 0);
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
      const maxSeq = existing.reduce((max, e) => Math.max(max, e.seq), 0);
      const now = new Date().toISOString();
      const cleanPatch: NightSessionUpdatedPayload = {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.currency !== undefined ? { currency: { ...patch.currency } } : {}),
        ...(patch.participants !== undefined
          ? { participants: patch.participants.map((p) => ({ ...p })) }
          : {}),
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
      const maxSeq = existing.reduce((max, e) => Math.max(max, e.seq), 0);
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
      const maxSeq = existing.reduce((max, e) => Math.max(max, e.seq), 0);
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
      const maxSeq = existing.reduce((max, e) => Math.max(max, e.seq), 0);
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
      const maxSeq = existing.reduce((max, e) => Math.max(max, e.seq), 0);
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
      const maxSeq = existing.reduce((max, e) => Math.max(max, e.seq), 0);
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
      const events = await backend.readAllEvents();
      return deriveLearnProgress(events);
    },

    async recordLearnConcept(conceptId, understood) {
      const existing = await backend.readAllEvents();
      const maxSeq = existing.reduce((max, e) => Math.max(max, e.seq), 0);
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
      const maxSeq = existing.reduce((max, e) => Math.max(max, e.seq), 0);
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
      return {
        schemaVersion: STUDY_BUNDLE_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        appearance: readPersistedAppearance(),
        events,
      };
    },

    async importBundle(rawJsonOrObject, options = {}) {
      const validation = validateAndParseStudyBundle(rawJsonOrObject);
      if (!validation.ok) return validation;

      const existing = await backend.readAllEvents();
      const seenIds = new Set(existing.map((e) => e.id));
      let nextSeq = existing.reduce((max, e) => Math.max(max, e.seq), 0);
      const toInsert: StudyEvent[] = [];
      let skippedDuplicates = 0;

      const incomingSorted = [...validation.bundle.events].sort((a, b) => a.seq - b.seq);
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
      const finalEvents = await backend.readAllEvents();
      return {
        ok: true,
        importedCount: toInsert.length,
        skippedDuplicates,
        savedMatchups: deriveSavedMatchups(finalEvents),
        savedHands: deriveSavedHands(finalEvents),
      };
    },
  };
}

let defaultRepository: StudyRepository | null = null;

export function getDefaultStudyRepository(): StudyRepository {
  if (!defaultRepository) {
    defaultRepository = createStudyRepository();
  }
  return defaultRepository;
}
