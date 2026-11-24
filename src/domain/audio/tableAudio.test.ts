import { describe, expect, it } from 'vitest';
import { playTableSound } from './tableAudio';

describe('tableAudio', () => {
  it('returns false safely when soundEffects is disabled or AudioContext is unavailable', () => {
    expect(playTableSound('chip')).toBe(false);
    expect(playTableSound('confirm', true)).toBe(false);
  });
});
