import type { MessageKey } from '../../i18n/types';

/**
 * Single action-line shorthand parser & validator shared by Hand Recorder (`TokenInput`)
 * and storage replay helpers. Zero UI or theme dependencies.
 */

export type ActionShorthandErrorCode =
  | 'empty_token'
  | 'invalid_amount'
  | 'invalid_card'
  | 'duplicate_card'
  | 'invalid_token';

export type ParsedShorthandToken =
  | { readonly ok: true; readonly kind: 'fold'; readonly canonical: 'f' }
  | { readonly ok: true; readonly kind: 'check'; readonly canonical: 'x' }
  | { readonly ok: true; readonly kind: 'call'; readonly canonical: 'c' }
  | { readonly ok: true; readonly kind: 'all_in'; readonly canonical: 'allin' }
  | {
      readonly ok: true;
      readonly kind: 'bet' | 'raise';
      readonly amountMilliBb: number;
      readonly approximate: boolean;
      readonly canonical: string;
    }
  | { readonly ok: true; readonly kind: 'street_sep'; readonly canonical: '/' }
  | { readonly ok: true; readonly kind: 'board_cards'; readonly cards: readonly string[]; readonly canonical: string };

export interface ParsedShorthandTokenError {
  readonly ok: false;
  readonly errorCode: ActionShorthandErrorCode;
  readonly detail: string;
}

export type ParsedShorthandTokenResult = ParsedShorthandToken | ParsedShorthandTokenError;

const RANKS_SET = new Set(['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']);
const SUITS_SET = new Set(['s', 'h', 'd', 'c']);
const SUIT_GLYPHS: Readonly<Record<string, string>> = {
  '♠': 's',
  '♥': 'h',
  '♦': 'd',
  '♣': 'c',
};

function normalizeTokenText(raw: string): string {
  let out = raw.trim();
  for (const [glyph, ascii] of Object.entries(SUIT_GLYPHS)) {
    out = out.split(glyph).join(ascii);
  }
  out = out.replace(/10([shdcSHDC])/g, 'T$1');
  return out;
}

function parseSingleCard(pair: string): string | null {
  if (pair.length !== 2) return null;
  const rank = pair[0]!.toUpperCase();
  const suit = pair[1]!.toLowerCase();
  if (!RANKS_SET.has(rank) || !SUITS_SET.has(suit)) return null;
  return `${rank}${suit}`;
}

function formatShorthandAmount(amountMilliBb: number): string {
  const units = amountMilliBb / 1000;
  return Number.isInteger(units) ? String(units) : String(Number(units.toFixed(1)));
}

export function parseActionShorthandToken(rawToken: string): ParsedShorthandTokenResult {
  const normalized = normalizeTokenText(rawToken);
  if (!normalized) {
    return { ok: false, errorCode: 'empty_token', detail: rawToken };
  }

  if (normalized === '/') {
    return { ok: true, kind: 'street_sep', canonical: '/' };
  }

  const lower = normalized.toLowerCase();
  if (lower === 'f' || lower === 'fold') {
    return { ok: true, kind: 'fold', canonical: 'f' };
  }
  if (lower === 'x' || lower === 'k' || lower === 'check') {
    return { ok: true, kind: 'check', canonical: 'x' };
  }
  if (lower === 'c' || lower === 'call') {
    return { ok: true, kind: 'call', canonical: 'c' };
  }
  if (lower === 'allin' || lower === 'all-in' || lower === 'ai' || lower === 'jam') {
    return { ok: true, kind: 'all_in', canonical: 'allin' };
  }

  // Bet or raise with optional ~ approximate marker: b12, r2.5, r~8, ~r8, b12~, etc.
  const aggroMatch = /^(~?)([br])(~?)([+-]?\d*(?:\.\d+)?)(~?)$/i.exec(normalized);
  if (aggroMatch && aggroMatch[4]) {
    const [, leadTilde, verbRaw, midTilde, numText, tailTilde] = aggroMatch;
    const approximate = Boolean(leadTilde || midTilde || tailTilde);
    const num = Number(numText);
    if (!Number.isFinite(num) || num <= 0) {
      return { ok: false, errorCode: 'invalid_amount', detail: rawToken };
    }
    const amountMilliBb = Math.round(num * 1000);
    if (!Number.isSafeInteger(amountMilliBb) || amountMilliBb <= 0) {
      return { ok: false, errorCode: 'invalid_amount', detail: rawToken };
    }
    const verb = verbRaw!.toLowerCase() as 'b' | 'r';
    const canonical = `${verb}${approximate ? '~' : ''}${formatShorthandAmount(amountMilliBb)}`;
    return {
      ok: true,
      kind: verb === 'b' ? 'bet' : 'raise',
      amountMilliBb,
      approximate,
      canonical,
    };
  }

  // Malformed b/r without positive numeric amount, e.g. "b", "r0", "r-5", "rabc"
  if (/^~?[br]/i.test(normalized) && !/^([2-9tjqka])([shdc])/i.test(normalized)) {
    return { ok: false, errorCode: 'invalid_amount', detail: rawToken };
  }

  // Single or compact glued board cards (1 to 5 cards, e.g. "Qh", "Qh7c2h")
  const compactCards = normalized.replace(/,/g, '');
  if (compactCards.length >= 2 && compactCards.length <= 10 && compactCards.length % 2 === 0) {
    let looksCardLike = true;
    for (let i = 0; i < compactCards.length; i += 2) {
      const rankChar = compactCards[i]!.toUpperCase();
      const suitChar = compactCards[i + 1]!.toLowerCase();
      if (!RANKS_SET.has(rankChar) && !SUITS_SET.has(suitChar)) {
        looksCardLike = false;
        break;
      }
    }
    if (looksCardLike) {
      const cards: string[] = [];
      for (let i = 0; i < compactCards.length; i += 2) {
        const parsed = parseSingleCard(compactCards.slice(i, i + 2));
        if (!parsed) {
          return { ok: false, errorCode: 'invalid_card', detail: rawToken };
        }
        if (cards.includes(parsed)) {
          return { ok: false, errorCode: 'duplicate_card', detail: parsed };
        }
        cards.push(parsed);
      }
      return {
        ok: true,
        kind: 'board_cards',
        cards,
        canonical: cards.join(''),
      };
    }
  }

  return { ok: false, errorCode: 'invalid_token', detail: rawToken };
}

export function validateActionShorthandToken(rawToken: string): {
  readonly valid: boolean;
  readonly reasonKey?: MessageKey;
  readonly detail?: string;
} {
  const res = parseActionShorthandToken(rawToken);
  if (res.ok) return { valid: true };
  if (res.errorCode === 'invalid_amount') {
    return { valid: false, reasonKey: 'recorder.shorthand.errAmount', detail: res.detail };
  }
  if (res.errorCode === 'invalid_card' || res.errorCode === 'duplicate_card') {
    return { valid: false, reasonKey: 'recorder.shorthand.errCard', detail: res.detail };
  }
  return { valid: false, reasonKey: 'recorder.shorthand.errToken', detail: res.detail };
}

export function tokenizeActionShorthandLine(rawLine: string): readonly string[] {
  return rawLine
    .replace(/\//g, ' / ')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
