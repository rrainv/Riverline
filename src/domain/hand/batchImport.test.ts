import { describe, expect, it } from 'vitest';
import { parseBatchHandHistory, splitMultiHandHistory } from './handHistoryParser';

const TWO_HANDS = `PokerStars Hand #1001: Hold'em No Limit ($0.50/$1.00 USD)
Table 'Alpha' 6-max Seat #1 is the button
Seat 1: Hero ($100 in chips)
Seat 2: Villain ($100 in chips)
Hero: posts small blind $0.50
Villain: posts big blind $1.00
*** HOLE CARDS ***
Dealt to Hero [As Kd]
Hero: raises $1.50 to $2.00
Villain: folds
*** SUMMARY ***

PokerStars Hand #1002: Hold'em No Limit ($0.50/$1.00 USD)
Table 'Beta' 6-max Seat #1 is the button
Seat 1: Hero ($100 in chips)
Seat 2: Villain ($100 in chips)
Hero: posts small blind $0.50
Villain: posts big blind $1.00
*** HOLE CARDS ***
Dealt to Hero [Qh Qd]
Hero: raises $2.00 to $2.50
Villain: calls $1.50
*** SUMMARY ***`;

describe('handHistoryParser batch import', () => {
  it('splits multi-hand dumps and parses each hand cleanly', () => {
    const chunks = splitMultiHandHistory(TWO_HANDS);
    expect(chunks).toHaveLength(2);

    const parsed = parseBatchHandHistory(TWO_HANDS);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.ok).toBe(true);
    expect(parsed[1]?.ok).toBe(true);
    if (parsed[0]?.ok) {
      expect(parsed[0].heroCards).toEqual(['As', 'Kd']);
    }
    if (parsed[1]?.ok) {
      expect(parsed[1].heroCards).toEqual(['Qh', 'Qd']);
    }
  });
});
