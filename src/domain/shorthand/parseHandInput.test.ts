import { describe, expect, it } from 'vitest';
import { createEngineClient } from '../../engine-api';
import { buildRangeMatrixMask, parsePlayerHandInput } from './index';

describe('src/domain/shorthand single grammar parser', () => {
  const engine = createEngineClient({ mode: 'inline' });

  it('parses exact cards in compact, lowercase, spaced, unicode, and 10 notation', () => {
    const r1 = parsePlayerHandInput('Th9h', { engine });
    expect(r1).toEqual({
      ok: true,
      kind: 'exact',
      canonical: 'Th9h',
      cards: ['Th', '9h'],
      eligibleCombos: 1,
      removedCombos: 0,
    });

    const r2 = parsePlayerHandInput('t♥ 9♥', { engine });
    expect(r2).toEqual(r1);

    const r3 = parsePlayerHandInput('10s 9d', { engine });
    expect(r3.ok && r3.kind === 'exact' ? r3.cards : null).toEqual(['Ts', '9d']);
  });

  it('parses any, ?, and random against dead cards', () => {
    const r = parsePlayerHandInput('any', { engine, deadCards: ['Ah', 'Kh', 'Qh', '7c', '2h'] });
    expect(r).toEqual({
      ok: true,
      kind: 'any',
      canonical: 'any',
      eligibleCombos: (47 * 46) / 2,
      removedCombos: 1326 - (47 * 46) / 2,
    });

    const q = parsePlayerHandInput('?', { engine });
    expect(q.ok && q.kind === 'any' ? q.eligibleCombos : 0).toBe(1326);
  });

  it('parses ranges QQ+, AKs, 22-77, A5s-A2s with exact combo removal', () => {
    const r = parsePlayerHandInput('QQ+, AKs', {
      engine,
      deadCards: ['Qh', '7c', '2h'],
    });
    expect(r.ok).toBe(true);
    if (!r.ok || r.kind !== 'range') throw new Error('expected range');
    // QQ(6) + KK(6) + AA(6) + AKs(4) = 22 before blockers.
    // Qh blocks 3 combos of QQ; Ah/Kh untouched -> 19 eligible, 3 removed.
    expect(r.totalCombosBefore).toBe(22);
    expect(r.eligibleCombos).toBe(19);
    expect(r.removedCombos).toBe(3);
    expect([...r.handClasses]).toEqual(['QQ', 'KK', 'AA', 'AKs']);

    const low = parsePlayerHandInput('22-77, A5s-A2s', { engine });
    expect(low.ok).toBe(true);
    if (!low.ok || low.kind !== 'range') throw new Error('expected range');
    // 6 pairs * 6 = 36, + 4 suited wheel aces * 4 = 16 => 52 combos
    expect(low.totalCombosBefore).toBe(52);
    expect(low.eligibleCombos).toBe(52);
    expect(low.removedCombos).toBe(0);

    const matrix = buildRangeMatrixMask(low.handClasses);
    expect(matrix).toHaveLength(13);
    expect(matrix[0]![12]).toBe(true); // A2s row 0 ('A'), col 12 ('2')
    expect(matrix[12]![12]).toBe(true); // 22 row 12, col 12
    expect(matrix[0]![0]).toBe(false); // AA

    const pair = parsePlayerHandInput('JJ', { engine });
    expect(pair.ok && pair.kind === 'range' ? pair.eligibleCombos : 0).toBe(6);

    const broadway = parsePlayerHandInput('AK', { engine });
    expect(broadway.ok && broadway.kind === 'range' ? broadway.eligibleCombos : 0).toBe(16);
  });

  it('returns named errors for card conflicts, incomplete hands, bad ranks, and zero combos', () => {
    expect(parsePlayerHandInput('', { engine })).toEqual({ ok: false, errorCode: 'empty' });
    expect(parsePlayerHandInput('Ah', { engine })).toEqual({
      ok: false,
      errorCode: 'incomplete_hand',
      detail: 'Ah',
    });
    expect(parsePlayerHandInput('AhAh', { engine })).toEqual({
      ok: false,
      errorCode: 'duplicate_in_hand',
      detail: 'Ah',
    });
    expect(
      parsePlayerHandInput('QhKd', { engine, deadCards: ['Qh'] }),
    ).toEqual({
      ok: false,
      errorCode: 'card_in_play',
      detail: 'Qh',
    });
    expect(parsePlayerHandInput('1hKd', { engine })).toEqual({
      ok: false,
      errorCode: 'invalid_rank',
      detail: '1h',
    });
    expect(
      parsePlayerHandInput('QQ', { engine, deadCards: ['Qs', 'Qh', 'Qd', 'Qc'] }),
    ).toEqual({
      ok: false,
      errorCode: 'zero_combos',
      detail: 'QQ',
    });
    expect(parsePlayerHandInput('foo99', { engine })).toEqual({
      ok: false,
      errorCode: 'invalid_range',
      detail: 'foo99',
    });
  });

  it('parses top X% preflop ranges (top 15%, top10%, 100%, composite) and rejects out-of-bounds %', () => {
    const top15 = parsePlayerHandInput('top 15%', { engine });
    expect(top15.ok).toBe(true);
    if (!top15.ok || top15.kind !== 'range') throw new Error('expected range');
    expect(top15.canonical).toBe('top 15%');
    expect(top15.handClasses.has('AA')).toBe(true);
    expect(top15.handClasses.has('AKs')).toBe(true);
    expect(top15.totalCombosBefore).toBeGreaterThanOrEqual(195);
    expect(top15.totalCombosBefore).toBeLessThanOrEqual(215);

    const top10 = parsePlayerHandInput('top10%', { engine });
    expect(top10.ok).toBe(true);
    if (!top10.ok || top10.kind !== 'range') throw new Error('expected range');
    expect(top10.totalCombosBefore).toBeGreaterThanOrEqual(130);
    expect(top10.totalCombosBefore).toBeLessThanOrEqual(148);

    const all100 = parsePlayerHandInput('100%', { engine });
    expect(all100.ok && all100.kind === 'range' ? all100.totalCombosBefore : 0).toBe(1326);

    const combo = parsePlayerHandInput('top 5%, 22-55', { engine });
    expect(combo.ok).toBe(true);
    if (!combo.ok || combo.kind !== 'range') throw new Error('expected range');
    expect(combo.handClasses.has('AA')).toBe(true);
    expect(combo.handClasses.has('22')).toBe(true);

    expect(parsePlayerHandInput('top 0%', { engine })).toMatchObject({
      ok: false,
      errorCode: 'invalid_range',
    });
    expect(parsePlayerHandInput('top 120%', { engine })).toMatchObject({
      ok: false,
      errorCode: 'invalid_range',
    });
  });
});
