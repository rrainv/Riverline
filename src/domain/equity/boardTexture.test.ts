import { describe, expect, it } from 'vitest';
import { classifyBoardTexture } from './boardTexture';

describe('classifyBoardTexture', () => {
  it('returns empty array for incomplete boards', () => {
    expect(classifyBoardTexture([])).toEqual([]);
    expect(classifyBoardTexture(['Ah', 'Kd'])).toEqual([]);
  });

  it('classifies monotone, two-tone, rainbow, paired, connected, broadway, low, and dry flops', () => {
    expect(classifyBoardTexture(['Ah', 'Kh', '2h'])).toEqual(['monotone', 'broadway']);
    expect(classifyBoardTexture(['Qh', '7c', '2h'])).toEqual(['two_tone']);
    expect(classifyBoardTexture(['Js', 'Tc', '8d'])).toEqual(['rainbow', 'connected', 'broadway']);
    expect(classifyBoardTexture(['Kc', '7d', '2s'])).toEqual(['rainbow', 'dry']);
    expect(classifyBoardTexture(['7s', '7h', '2d'])).toEqual(['rainbow', 'paired', 'low']);
    expect(classifyBoardTexture(['As', '4d', '2c'])).toEqual(['rainbow', 'connected']);
  });
});
