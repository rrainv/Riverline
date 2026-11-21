import { describe, expect, it } from 'vitest';
import { parseHandHistoryText } from './handHistoryParser';

const SAMPLE_POKERSTARS_HH = `PokerStars Hand #123456: Hold'em No Limit ($0.50/$1.00 USD)
Table 'Aludra' 6-max Seat #1 is the button
Seat 1: Hero ($100 in chips)
Seat 2: SmallBlind ($100 in chips)
Seat 3: BigBlind ($100 in chips)
Seat 4: UTGPlayer ($100 in chips)
Seat 5: Hijack ($100 in chips)
Seat 6: Cutoff ($100 in chips)
SmallBlind: posts small blind $0.50
BigBlind: posts big blind $1.00
*** HOLE CARDS ***
Dealt to Hero [Ah Kd]
UTGPlayer: folds
Hijack: folds
Cutoff: folds
Hero: raises $1.50 to $2.50
SmallBlind: folds
BigBlind: calls $1.50
*** FLOP *** [Qh 7c 2h]
BigBlind: checks
Hero: bets $2.00
BigBlind: calls $2.00
*** TURN *** [Qh 7c 2h] [4s]
BigBlind: checks
Hero: checks
*** SUMMARY ***`;

describe('parseHandHistoryText', () => {
  it('parses a multi-line PokerStars hand history into seatCount, heroCards, position, and shorthand tokens', () => {
    const res = parseHandHistoryText(SAMPLE_POKERSTARS_HH);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(res.seatCount).toBe(6);
    expect(res.heroPositionLabel).toBe('BTN');
    expect(res.heroCards).toEqual(['Ah', 'Kd']);
    expect(res.tokens).toEqual([
      'utg', 'f',
      'hj', 'f',
      'co', 'f',
      'btn', 'r2.5',
      'sb', 'f',
      'bb', 'c',
      '/',
      'Qh7c2h',
      'bb', 'x',
      'btn', 'b2',
      'bb', 'c',
      '/',
      '4s',
      'bb', 'x',
      'btn', 'x',
    ]);
  });

  it('parses loose shorthand note with header position & hole cards', () => {
    const res = parseHandHistoryText('CO QsQh | utg f hj f co r2.5 btn f sb f bb c / Td7c2s');
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(res.heroPositionLabel).toBe('CO');
    expect(res.heroCards).toEqual(['Qs', 'Qh']);
    expect(res.tokens).toEqual(['utg', 'f', 'hj', 'f', 'co', 'r2.5', 'btn', 'f', 'sb', 'f', 'bb', 'c', '/', 'Td7c2s']);
  });

  it('rejects empty input with an error message', () => {
    const res = parseHandHistoryText('   ');
    expect(res.ok).toBe(false);
  });
});
