import {
  createStrategyContext,
  HOLDEM_DECK,
  POKER_ACTION_SCHEMA_VERSION,
  positionsForTableSize,
  type EngineClient,
  type PokerState,
  type StrategyStackDepthBb,
  type StrategyTableSize,
  type TrainingDrillExercise,
} from '../../engine-api';
import { classifyBoardTexture, type BoardTextureTagId } from '../equity/boardTexture';

export type PostflopTextureFilter = 'any' | 'dry' | 'wet' | 'paired' | 'monotone';

export const POSTFLOP_VILLAIN_RANGE = '22+, A2s+, K9s+, Q9s+, J9s+, T9s, ATo+, KJo+';

const TEXTURE_CYCLE: readonly Exclude<PostflopTextureFilter, 'any'>[] = [
  'dry',
  'wet',
  'paired',
  'monotone',
];

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function matchesTextureFilter(
  tags: readonly BoardTextureTagId[],
  target: Exclude<PostflopTextureFilter, 'any'>,
): boolean {
  switch (target) {
    case 'dry':
      return tags.includes('dry');
    case 'wet':
      return tags.includes('connected') && (tags.includes('two_tone') || tags.includes('monotone'));
    case 'paired':
      return tags.includes('paired') || tags.includes('trips');
    case 'monotone':
      return tags.includes('monotone');
  }
}

function formatHandClassFromCards(c0: string, c1: string): string {
  const order = '23456789TJQKA';
  const r0 = c0[0]!.toUpperCase();
  const r1 = c1[0]!.toUpperCase();
  const s0 = c0[1]!.toLowerCase();
  const s1 = c1[1]!.toLowerCase();
  if (r0 === r1) return `${r0}${r1}`;
  const i0 = order.indexOf(r0);
  const i1 = order.indexOf(r1);
  const hi = i0 >= i1 ? r0 : r1;
  const lo = i0 >= i1 ? r1 : r0;
  return `${hi}${lo}${s0 === s1 ? 's' : 'o'}`;
}

function pickRandomDistinctCards(
  pool: readonly string[],
  count: number,
  rand: () => number,
): string[] {
  const copy = [...pool];
  const picked: string[] = [];
  for (let i = 0; i < count && copy.length > 0; i += 1) {
    const idx = Math.floor(rand() * copy.length);
    picked.push(copy.splice(idx, 1)[0]!);
  }
  return picked;
}

export interface PostflopTextureDrillResult {
  readonly exercise: TrainingDrillExercise;
  readonly boardTextureTags: readonly BoardTextureTagId[];
  readonly matchedFilter: Exclude<PostflopTextureFilter, 'any'>;
  readonly villainRange: string;
}

export function generatePostflopTextureDrill(options: {
  readonly engine: EngineClient;
  readonly seed: number;
  readonly tableSize: StrategyTableSize;
  readonly stackDepthBb: StrategyStackDepthBb;
  readonly textureFilter: PostflopTextureFilter;
}): PostflopTextureDrillResult {
  const { engine, seed, tableSize, stackDepthBb, textureFilter } = options;
  const rand = mulberry32(seed);
  const resolvedFilter: Exclude<PostflopTextureFilter, 'any'> =
    textureFilter === 'any'
      ? TEXTURE_CYCLE[Math.abs(seed) % TEXTURE_CYCLE.length]!
      : textureFilter;

  const heroCardsList = pickRandomDistinctCards(HOLDEM_DECK, 2, rand);
  const heroCards: readonly [string, string] = [heroCardsList[0]!, heroCardsList[1]!];
  const remainingDeck = HOLDEM_DECK.filter((c) => c !== heroCards[0] && c !== heroCards[1]);

  let flop: string[] = pickRandomDistinctCards(remainingDeck, 3, rand);
  let tags = classifyBoardTexture(flop);
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (matchesTextureFilter(tags, resolvedFilter)) break;
    flop = pickRandomDistinctCards(remainingDeck, 3, rand);
    tags = classifyBoardTexture(flop);
  }

  const positions = positionsForTableSize(tableSize);
  const heroPos = 'BTN';
  const openerPos = 'CO';
  const heroIdx = positions.indexOf(heroPos);
  const openerIdx = positions.indexOf(openerPos);
  const buttonSeat = heroIdx >= 0 ? heroIdx : 0;

  const rulesRes = engine.sync.createGameRulesSnapshot({
    source: { kind: 'direct' },
    setup: { seatedPlayers: tableSize },
    definition: {
      schemaVersion: 'game-rules-definition/v2',
      variant: 'no_limit_texas_holdem',
      format: 'cash',
      tableSize: { minimumSeated: 2, maximumSeated: 10 },
      blinds: { smallBlindMilliBb: 500, bigBlindMilliBb: 1000, chipUnitMilliBb: 100 },
      ante: { type: 'none', amountMilliBb: 0 },
      straddle: { type: 'none' },
      collectionPolicy: { type: 'none' },
      recordedSettlementPolicy: { type: 'source_recorded_rake', rakeModel: 'unknown' },
    },
  });
  if (!rulesRes.ok) throw new Error(rulesRes.error.message);

  const startingStackMilliBb = stackDepthBb * 1000;
  const players = positions.map((pos, seat) => ({
    playerId: pos === heroPos ? 'hero' : `seat-${pos.toLowerCase()}`,
    seat,
    startingStackMilliBb,
  }));

  const exerciseId = `postflop-drill-${seed}-${tableSize}-${stackDepthBb}-${resolvedFilter}`;
  const initRes = engine.sync.initializeRecordedHand({
    handId: exerciseId,
    rulesSnapshot: rulesRes.data,
    buttonSeat,
    players,
  });
  if (!initRes.ok) throw new Error(initRes.error.message);

  const otherIds = players.filter((p) => p.playerId !== 'hero').map((p) => p.playerId);
  const dealHoleRes = engine.sync.applyChance(initRes.data, {
    type: 'deal_hole',
    cardsByPlayer: { hero: [...heroCards] },
    hiddenPlayerIds: otherIds,
  });
  if (!dealHoleRes.ok) throw new Error(dealHoleRes.error.message);

  let state: PokerState = dealHoleRes.data;
  const act = (type: 'fold' | 'check' | 'call' | 'bet' | 'raise', amountToMilliBb: number | null = null) => {
    const actorId = state.actingPlayerId;
    if (!actorId) throw new Error('Missing acting player during postflop drill setup');
    const res = engine.sync.applyAction(state, {
      schemaVersion: POKER_ACTION_SCHEMA_VERSION,
      playerId: actorId,
      type,
      amountToMilliBb,
    });
    if (!res.ok) throw new Error(res.error.message);
    state = res.data;
  };

  for (let i = 0; i < positions.length; i += 1) {
    if (i === openerIdx) {
      act('raise', 2500);
    } else if (i === heroIdx) {
      act('call');
    } else {
      act('fold');
    }
  }

  const dealFlopRes = engine.sync.applyChance(state, {
    type: 'deal_flop',
    cards: flop,
  });
  if (!dealFlopRes.ok) throw new Error(dealFlopRes.error.message);
  state = dealFlopRes.data;

  const cbetFractions = [0.33, 0.5, 0.75] as const;
  const chosenFrac = cbetFractions[Math.floor(rand() * cbetFractions.length) % cbetFractions.length]!;
  const rawCbetMilliBb = Math.round((state.potMilliBb * chosenFrac) / 100) * 100;
  const cbetMilliBb = Math.max(1000, rawCbetMilliBb);
  act('bet', cbetMilliBb);

  if (state.actingPlayerId !== 'hero') {
    throw new Error(`Expected hero to act on flop, got ${state.actingPlayerId}`);
  }

  const legalRes = engine.sync.legalActions(state);
  if (!legalRes.ok) throw new Error(legalRes.error.message);
  const legalSpec = legalRes.data;

  const econRes = engine.sync.actorCallEconomics(state, 'hero');
  if (!econRes.ok) throw new Error(econRes.error.message);
  const callEconomics = econRes.data;

  const toCallBb = roundTenth(callEconomics.callCommitmentMilliBb / 1000);
  const potBeforeActionBb = roundTenth(state.potMilliBb / 1000);
  const potAfterCallBb = roundTenth(callEconomics.actorContestablePotAfterCallMilliBb / 1000);
  const requiredEquityPct =
    callEconomics.requiredRawEquity !== null
      ? roundTenth(callEconomics.requiredRawEquity * 100)
      : 0;

  const raisePresetsBb: number[] = [];
  if (legalSpec.raise.available && legalSpec.raise.minToMilliBb !== null && legalSpec.raise.maxToMilliBb !== null) {
    const minBb = roundTenth(legalSpec.raise.minToMilliBb / 1000);
    const maxBb = roundTenth(legalSpec.raise.maxToMilliBb / 1000);
    const candidates = [
      roundTenth((cbetMilliBb / 1000) * 2.5),
      roundTenth((cbetMilliBb / 1000) * 3.5),
      maxBb,
    ];
    for (const c of candidates) {
      const clamped = Math.max(minBb, Math.min(maxBb, c));
      if (!raisePresetsBb.includes(clamped)) raisePresetsBb.push(clamped);
    }
  }

  const exercise: TrainingDrillExercise = {
    exerciseId,
    seed,
    tableSize,
    stackDepthBb,
    decisionFamily: 'preflop_facing_open',
    heroPosition: heroPos,
    openerPosition: openerPos,
    openerBetBb: roundTenth(cbetMilliBb / 1000),
    playersBehind: 0,
    heroCards,
    handClass: formatHandClassFromCards(heroCards[0], heroCards[1]),
    familyId: null,
    pokerState: state,
    legalSpec,
    callEconomics,
    toCallBb,
    potBeforeActionBb,
    potAfterCallBb,
    requiredEquityPct,
    raisePresetsBb,
    baselineMix: [],
    baselineTier: 'unavailable',
    strategyContext: createStrategyContext({
      tableSize,
      stackDepthBb,
      decisionFamily: 'preflop_facing_open',
      position: heroPos,
    }),
    reasonKind: 'spot_practice',
  };

  return {
    exercise,
    boardTextureTags: tags,
    matchedFilter: resolvedFilter,
    villainRange: POSTFLOP_VILLAIN_RANGE,
  };
}
