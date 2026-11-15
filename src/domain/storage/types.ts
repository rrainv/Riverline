import type { AppearancePreferences } from '../appearance';

export const STUDY_DB_NAME = 'riverline-study-v1';
export const STUDY_DB_VERSION = 1;
export const STUDY_EVENTS_STORE = 'events';
export const SAVED_MATCHUP_SCHEMA_VERSION = 1;
export const STUDY_BUNDLE_SCHEMA_VERSION = 1;

export type EquityStreet = 'preflop' | 'flop' | 'turn' | 'river';

export interface SavedMatchupPlayer {
  readonly id: string;
  readonly label: string;
  readonly isHero: boolean;
  readonly rawInput: string;
  readonly inputKind: 'exact' | 'range' | 'any';
}

export interface SavedMatchupPayload {
  readonly schemaVersion: typeof SAVED_MATCHUP_SCHEMA_VERSION;
  readonly factTitle: string;
  readonly board: readonly string[];
  readonly players: readonly SavedMatchupPlayer[];
  readonly street: EquityStreet;
  readonly selectedTurnCard?: string;
  readonly selectedRiverCard?: string;
}

export type StudyEventType = 'saved_matchup.created' | 'saved_matchup.archived';

export interface StudyEvent {
  readonly id: string;
  readonly seq: number;
  readonly ts: string;
  readonly domain: 'savedObjects';
  readonly type: StudyEventType;
  readonly objectId: string;
  readonly payload: SavedMatchupPayload | { readonly reason?: string };
}

export interface SavedMatchupRecord {
  readonly objectId: string;
  readonly createdAt: string;
  readonly factTitle: string;
  readonly payload: SavedMatchupPayload;
}

export interface StudyExportBundle {
  readonly schemaVersion: typeof STUDY_BUNDLE_SCHEMA_VERSION;
  readonly exportedAt: string;
  readonly appearance: AppearancePreferences;
  readonly events: readonly StudyEvent[];
}

export type StudyImportErrorCode =
  | 'invalid_json'
  | 'unsupported_schema_version'
  | 'invalid_bundle'
  | 'invalid_event';

export type StudyImportResult =
  | {
      readonly ok: true;
      readonly importedCount: number;
      readonly skippedDuplicates: number;
      readonly savedMatchups: readonly SavedMatchupRecord[];
    }
  | {
      readonly ok: false;
      readonly errorCode: StudyImportErrorCode;
      readonly detail?: string;
    };
