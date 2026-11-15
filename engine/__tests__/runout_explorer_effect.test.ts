import { describe, expect, it } from 'vitest';
import { exploreRunouts, groupRunouts } from '../runout-explorer';

describe('engine/runout-explorer hero effect grouping', () => {
  it('classifies flush completion, made-hand improvement, board pair, and overcards cleanly', async () => {
    const outcome = await exploreRunouts(
      {
        schemaVersion: 'equity-request/v1',
        board: ['Qh', '7c', '2h'],
        deadCards: [],
        method: 'exact',
        players: [
          { id: 'hero', cards: ['Ah', 'Kh'] },
          { id: 'v1', cards: ['Qs', 'Qc'] },
        ],
      },
      { heroId: 'hero' },
    );

    expect('rows' in outcome).toBe(true);
    if (!('rows' in outcome)) return;

    const byCard = new Map(outcome.rows.map((r) => [r.cards[0]!, r]));
    expect(byCard.get('3h')?.effectGroup).toBe('completes_flush');
    expect(byCard.get('Ac')?.effectGroup).toBe('pairs_hero');
    expect(byCard.get('Qd')?.effectGroup).toBe('pairs_board');
    expect(byCard.get('Js')?.effectGroup).toBe('adds_draw');
    expect(byCard.get('6c')?.effectGroup).toBe('blank');

    const grouped = groupRunouts(outcome.rows, 'effect');
    expect(grouped.some((g) => g.key === 'completes_flush' && g.rows.length > 0)).toBe(true);
    expect(grouped.some((g) => g.key === 'pairs_board' && g.rows.length > 0)).toBe(true);
  });
});
