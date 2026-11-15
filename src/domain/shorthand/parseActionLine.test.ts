import { describe, expect, it } from 'vitest';
import {
  parseActionShorthandToken,
  tokenizeActionShorthandLine,
  validateActionShorthandToken,
} from './parseActionLine';

describe('parseActionLine shorthand grammar', () => {
  it('parses basic action tokens case-insensitively', () => {
    expect(parseActionShorthandToken('f')).toEqual({ ok: true, kind: 'fold', canonical: 'f' });
    expect(parseActionShorthandToken('FOLD')).toEqual({ ok: true, kind: 'fold', canonical: 'f' });
    expect(parseActionShorthandToken('x')).toEqual({ ok: true, kind: 'check', canonical: 'x' });
    expect(parseActionShorthandToken('K')).toEqual({ ok: true, kind: 'check', canonical: 'x' });
    expect(parseActionShorthandToken('c')).toEqual({ ok: true, kind: 'call', canonical: 'c' });
    expect(parseActionShorthandToken('ai')).toEqual({ ok: true, kind: 'all_in', canonical: 'allin' });
    expect(parseActionShorthandToken('jam')).toEqual({ ok: true, kind: 'all_in', canonical: 'allin' });
    expect(parseActionShorthandToken('/')).toEqual({ ok: true, kind: 'street_sep', canonical: '/' });
  });

  it('parses bet and raise sizes with optional approximate markers', () => {
    expect(parseActionShorthandToken('r2.5')).toEqual({
      ok: true,
      kind: 'raise',
      amountMilliBb: 2500,
      approximate: false,
      canonical: 'r2.5',
    });
    expect(parseActionShorthandToken('b~12')).toEqual({
      ok: true,
      kind: 'bet',
      amountMilliBb: 12000,
      approximate: true,
      canonical: 'b~12',
    });
    expect(parseActionShorthandToken('~r8.5')).toEqual({
      ok: true,
      kind: 'raise',
      amountMilliBb: 8500,
      approximate: true,
      canonical: 'r~8.5',
    });
  });

  it('normalizes suit glyphs and 10 ranks in board card tokens', () => {
    expect(parseActionShorthandToken('Q♥7♣2♥')).toEqual({
      ok: true,
      kind: 'board_cards',
      cards: ['Qh', '7c', '2h'],
      canonical: 'Qh7c2h',
    });
    expect(parseActionShorthandToken('10s')).toEqual({
      ok: true,
      kind: 'board_cards',
      cards: ['Ts'],
      canonical: 'Ts',
    });
  });

  it('rejects malformed amounts, duplicate cards, and unknown tokens cleanly', () => {
    expect(parseActionShorthandToken('r-5')).toMatchObject({ ok: false, errorCode: 'invalid_amount' });
    expect(parseActionShorthandToken('b')).toMatchObject({ ok: false, errorCode: 'invalid_amount' });
    expect(parseActionShorthandToken('AhAh')).toMatchObject({ ok: false, errorCode: 'duplicate_card' });
    expect(parseActionShorthandToken('oops')).toMatchObject({ ok: false, errorCode: 'invalid_token' });

    expect(validateActionShorthandToken('r0')).toEqual({
      valid: false,
      reasonKey: 'recorder.shorthand.errAmount',
      detail: 'r0',
    });
    expect(validateActionShorthandToken('AhAh')).toEqual({
      valid: false,
      reasonKey: 'recorder.shorthand.errCard',
      detail: 'Ah',
    });
    expect(validateActionShorthandToken('oops')).toEqual({
      valid: false,
      reasonKey: 'recorder.shorthand.errToken',
      detail: 'oops',
    });
  });

  it('tokenizes lines including tight slashes', () => {
    expect(tokenizeActionShorthandLine('f f r2.5 f c/Qh7c2h/Kd')).toEqual([
      'f',
      'f',
      'r2.5',
      'f',
      'c',
      '/',
      'Qh7c2h',
      '/',
      'Kd',
    ]);
  });
});
