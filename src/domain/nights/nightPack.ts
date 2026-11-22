import type { NightSessionRecord, SavedHandRecord } from '../storage';

export const NIGHT_PACK_SCHEMA_VERSION = 'riverline-night-pack/v1';

export interface NightPackPayload {
  readonly schemaVersion: typeof NIGHT_PACK_SCHEMA_VERSION;
  readonly exportedAt: string;
  readonly session: NightSessionRecord['session'];
  readonly transactions: NightSessionRecord['transactions'];
  readonly linkedHands: NightSessionRecord['linkedHands'];
  readonly sessionNote?: string;
  readonly hands: readonly SavedHandRecord[];
}

export function buildNightPackJson(
  night: NightSessionRecord,
  savedHandsById: Readonly<Record<string, SavedHandRecord>>,
): { readonly filename: string; readonly json: string } {
  const hands: SavedHandRecord[] = [];
  for (const ref of night.linkedHands) {
    const rec = savedHandsById[ref.handObjectId];
    if (rec) hands.push(rec);
  }
  const payload: NightPackPayload = {
    schemaVersion: NIGHT_PACK_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    session: night.session,
    transactions: night.transactions,
    linkedHands: night.linkedHands,
    ...(night.sessionNote ? { sessionNote: night.sessionNote } : {}),
    hands,
  };
  const safeSlug = night.session.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'night';
  return {
    filename: `riverline-${safeSlug}.night.json`,
    json: JSON.stringify(payload, null, 2),
  };
}

export function parseNightPackJson(
  raw: string,
): { readonly ok: true; readonly pack: NightPackPayload } | { readonly ok: false; readonly error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'invalid_json' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'invalid_pack' };
  }
  const obj = parsed as Partial<NightPackPayload>;
  if (obj.schemaVersion !== NIGHT_PACK_SCHEMA_VERSION) {
    return { ok: false, error: 'unsupported_schema_version' };
  }
  if (
    !obj.session ||
    typeof obj.session.sessionId !== 'string' ||
    typeof obj.session.title !== 'string' ||
    !Array.isArray(obj.session.participants) ||
    !Array.isArray(obj.transactions) ||
    !Array.isArray(obj.linkedHands) ||
    !Array.isArray(obj.hands)
  ) {
    return { ok: false, error: 'invalid_pack_fields' };
  }
  return { ok: true, pack: obj as NightPackPayload };
}
