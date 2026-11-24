import { describe, expect, it } from 'vitest';
import { getSharedEngineClient } from '../../engine-api';
import { classifyBoardTexture } from '../equity/boardTexture';
import { generatePostflopTextureDrill } from './postflopTextureDrill';

describe('postflopTextureDrill', () => {
  it('generates deterministic flop spots matching each texture filter', () => {
    const engine = getSharedEngineClient();

    const dry = generatePostflopTextureDrill({
      engine,
      seed: 101,
      tableSize: 6,
      stackDepthBb: 100,
      textureFilter: 'dry',
    });
    expect(dry.exercise.pokerState.board).toHaveLength(3);
    expect(dry.boardTextureTags).toContain('dry');
    expect(dry.exercise.legalSpec.fold.available).toBe(true);
    expect(dry.exercise.legalSpec.call.available).toBe(true);
    expect(dry.exercise.legalSpec.raise.available).toBe(true);
    expect(dry.exercise.baselineTier).toBe('unavailable');

    const wet = generatePostflopTextureDrill({
      engine,
      seed: 202,
      tableSize: 6,
      stackDepthBb: 100,
      textureFilter: 'wet',
    });
    expect(wet.boardTextureTags).toContain('connected');
    expect(
      wet.boardTextureTags.includes('two_tone') || wet.boardTextureTags.includes('monotone'),
    ).toBe(true);

    const paired = generatePostflopTextureDrill({
      engine,
      seed: 303,
      tableSize: 8,
      stackDepthBb: 50,
      textureFilter: 'paired',
    });
    expect(
      paired.boardTextureTags.includes('paired') || paired.boardTextureTags.includes('trips'),
    ).toBe(true);

    const mono = generatePostflopTextureDrill({
      engine,
      seed: 404,
      tableSize: 6,
      stackDepthBb: 100,
      textureFilter: 'monotone',
    });
    expect(classifyBoardTexture(mono.exercise.pokerState.board)).toContain('monotone');
  });
});
