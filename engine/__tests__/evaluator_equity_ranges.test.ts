import { describe, expect, it } from 'vitest';
import {
  EQUITY_ERROR_CODES,
  EQUITY_METHODS,
  EQUITY_REQUEST_SCHEMA_VERSION,
  EQUITY_RESULT_SCHEMA_VERSION,
  EQUITY_WORKER_MESSAGES,
  EXACT_EQUITY_COMBINATION_LIMIT,
  HAND_CATEGORIES,
  HOLDEM_COMBOS,
  HOLDEM_DECK,
  HOLDEM_RANGE_ENTRY_STATES,
  HOLDEM_RANGE_PROVENANCE_KINDS,
  HOLDEM_RANGE_UNLISTED_POLICIES,
  HOLDEM_WEIGHTED_RANGE_SCHEMA_VERSION,
  PREFLOP_HAND_CLASSES,
  WEIGHTED_EQUITY_REQUEST_VERSION,
  asWeightedEquityRequest,
  calculateEquity,
  calculateEquityExact,
  calculateEquityMonteCarlo,
  calculateWeightedEquity,
  compareHandRanks,
  conditionHoldemRange,
  createEmptyCompleteHoldemRange,
  createEquityHandAnalysisProjection,
  createEquityWorkerMessageHandler,
  createExactEnteredHandOutcomeFacts,
  createFullyUnknownHoldemRange,
  createHoldemRangeProvenanceSource,
  createHoldemWeightedRangeFromEntries,
  createHoldemWeightedRangeFromHandClassWeights,
  createNormalizedHoldemDistribution,
  createRangeAnalysisFacts,
  createRangeAnalysisRequest,
  deriveBoardStructureFacts,
  deserializeHoldemWeightedRange,
  estimateEquityCombinations,
  evaluateAvailableCards,
  evaluateFive,
  evaluateSeven,
  evaluateSevenScore,
  exploreRunouts,
  getHoldemComboById,
  getHoldemComboForCards,
  getHoldemCombosForHandClass,
  groupRunouts,
  holdemComboIdForCards,
  inspectHoldemWeightedRange,
  multiplyHoldemRangeByActionFrequencies,
  orderBestFiveForPresentation,
  projectHoldemRangeToMatrix,
  rangeStandingFacts,
  serializeHoldemWeightedRange,
  validateEquityRequest,
  validateHoldemWeightedRange,
  withHoldemComboOverrides,
  type AbortControllerLike,
  type EquityRequestInput,
  type WeightedEquityRequestInput,
} from '../index';

function eqReq(extra: Partial<EquityRequestInput> = {}): EquityRequestInput {
  return {
    schemaVersion: EQUITY_REQUEST_SCHEMA_VERSION,
    players: [
      { id: 'hero', cards: ['As', 'Ad'] },
      { id: 'villain', cards: ['Kh', 'Kd'] },
    ],
    board: ['2c', '7d', '9h', 'Js', '3c'],
    deadCards: [],
    method: EQUITY_METHODS.AUTO,
    samples: 1000,
    seed: 123,
    ...extra,
  };
}

function deterministicMulberry(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('evaluator (5-card & 7-card, fast score equivalence)', () => {
  it('classifies all 9 categories accurately including wheel and royal flush', () => {
    const fixtures: readonly [readonly string[], string][] = [
      [['As', 'Kd', '9h', '7c', '3s'], HAND_CATEGORIES.HIGH_CARD],
      [['As', 'Ad', 'Kc', 'Qd', '2s'], HAND_CATEGORIES.ONE_PAIR],
      [['As', 'Ad', 'Kc', 'Kd', '2s'], HAND_CATEGORIES.TWO_PAIR],
      [['Qs', 'Qh', 'Qd', 'Ac', '2s'], HAND_CATEGORIES.THREE_OF_A_KIND],
      [['As', 'Kd', 'Qh', 'Jc', 'Ts'], HAND_CATEGORIES.STRAIGHT],
      [['As', '2d', '3h', '4c', '5s'], HAND_CATEGORIES.STRAIGHT],
      [['As', 'Js', '8s', '5s', '2s'], HAND_CATEGORIES.FLUSH],
      [['Ts', 'Th', 'Td', '9c', '9s'], HAND_CATEGORIES.FULL_HOUSE],
      [['8s', '8h', '8d', '8c', 'As'], HAND_CATEGORIES.FOUR_OF_A_KIND],
      [['9s', '8s', '7s', '6s', '5s'], HAND_CATEGORIES.STRAIGHT_FLUSH],
      [['As', 'Ks', 'Qs', 'Js', 'Ts'], HAND_CATEGORIES.STRAIGHT_FLUSH],
    ];
    for (const [cards, expected] of fixtures) {
      const rank = evaluateFive(cards);
      expect(rank.category).toBe(expected);
      expect(Object.isFrozen(rank)).toBe(true);
    }

    const better = evaluateFive(['As', 'Ad', 'Kc', 'Qd', '2s']);
    const worse = evaluateFive(['Ah', 'Ac', 'Jc', 'Td', '9s']);
    const tied = evaluateFive(['Ac', 'Ah', 'Ks', 'Qh', '2d']);
    expect(compareHandRanks(better, worse)).toBe(1);
    expect(compareHandRanks(worse, better)).toBe(-1);
    expect(compareHandRanks(better, tied)).toBe(0);
    expect(() => evaluateFive(['As', 'Kd', 'Qh', 'Jc'])).toThrow();
    expect(() => evaluateSeven(['AS', 'Kd', 'Qh', 'Jc', 'Ts', '9d', '8c'])).toThrow();
  });

  it('matches evaluateSevenScore exactly with evaluateSeven().score across edge categories & 500 seeded hands', () => {
    const edges: readonly (readonly string[])[] = [
      ['As', 'Kd', '9h', '7c', '3s', '2d', '4c'],
      ['As', '2d', '3h', '4c', '5s', 'Kd', 'Qh'], // wheel + kickers
      ['As', '2s', '3s', '4s', '5s', 'Kd', 'Qd'], // wheel straight flush
      ['As', 'Ks', 'Qs', 'Js', 'Ts', '9s', '2c'], // royal flush + 6th flush card
      ['7s', '7h', '7d', '2s', '2h', 'Kd', 'Kc'], // dual trips / higher full house
      ['8s', '8h', '8d', '8c', 'As', '2d', '3c'], // quads
    ];
    for (const hand of edges) {
      expect(evaluateSevenScore(hand)).toBe(evaluateSeven(hand).score);
    }

    const rand = deterministicMulberry(20261115);
    const deck = [...HOLDEM_DECK];
    for (let trial = 0; trial < 500; trial += 1) {
      for (let i = 0; i < 7; i += 1) {
        const j = i + Math.floor(rand() * (deck.length - i));
        [deck[i], deck[j]] = [deck[j]!, deck[i]!];
      }
      const hand = deck.slice(0, 7);
      expect(evaluateSevenScore(hand)).toBe(evaluateSeven(hand).score);
    }
  });
});

describe('equity engine (exact, Monte Carlo, margin95, cancellation, worker protocol)', () => {
  it('validates requests and rejects bad cards, duplicates, and impossible capacity', () => {
    expect(validateEquityRequest(eqReq({ players: [{ id: 'H', cards: ['as', 'Ad'] }, { id: 'V', cards: null }] })).ok).toBe(false);
    const dup = validateEquityRequest(eqReq({ players: [{ id: 'H', cards: ['As', 'Ad'] }, { id: 'V', cards: ['As', 'Kd'] }] }));
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.code).toBe(EQUITY_ERROR_CODES.DUPLICATE_CARD);

    const impossible = validateEquityRequest(
      eqReq({
        players: Array.from({ length: 10 }, (_, i) => ({ id: `P${i}`, cards: null })),
        board: [],
        deadCards: HOLDEM_DECK.slice(0, 28),
      }),
    );
    expect(impossible.ok).toBe(false);
    if (!impossible.ok) expect(impossible.error.code).toBe(EQUITY_ERROR_CODES.IMPOSSIBLE_DECK);
  });

  it('computes exact river/turn/flop/unknown equities with margin95 = 0 and 3-way ties', () => {
    const river = calculateEquityExact(eqReq());
    expect('trials' in river).toBe(true);
    if ('trials' in river) {
      expect(river.schemaVersion).toBe(EQUITY_RESULT_SCHEMA_VERSION);
      expect(river.method).toBe(EQUITY_METHODS.EXACT);
      expect(river.trials).toBe(1);
      expect(river.players.map((p) => p.equity)).toEqual([1, 0]);
      expect(river.players.every((p) => p.margin95 === 0)).toBe(true);
    }

    const flop = calculateEquityExact(eqReq({ board: ['2c', '7d', '9h'] }));
    expect('trials' in flop).toBe(true);
    if ('trials' in flop) expect(flop.trials).toBe(990);

    const threeWayTie = calculateEquityExact(
      eqReq({
        players: [
          { id: 'P0', cards: ['2c', '3d'] },
          { id: 'P1', cards: ['4c', '5d'] },
          { id: 'P2', cards: ['6c', '7d'] },
        ],
        board: ['As', 'Ks', 'Qs', 'Js', 'Ts'],
      }),
    );
    expect('trials' in threeWayTie).toBe(true);
    if ('trials' in threeWayTie) {
      expect(threeWayTie.players.map((p) => p.ties)).toEqual([1, 1, 1]);
      for (const p of threeWayTie.players) expect(p.equity).toBeCloseTo(1 / 3, 12);
    }

    const tooLarge = calculateEquityExact(
      eqReq({
        players: [{ id: 'hero', cards: ['As', 'Ad'] }, { id: 'villain', cards: null }],
        board: [],
        method: EQUITY_METHODS.EXACT,
      }),
    );
    expect('error' in tooLarge).toBe(true);
    if ('error' in tooLarge) expect(tooLarge.error.code).toBe(EQUITY_ERROR_CODES.EXACT_LIMIT_EXCEEDED);
  });

  it('computes reproducible seeded Monte Carlo with non-zero margin95, dead-card exclusion, and 10 players', () => {
    const req = eqReq({
      players: [{ id: 'hero', cards: ['As', 'Kd'] }, { id: 'villain', cards: null }],
      board: ['2c', '7d', '9h'],
      method: EQUITY_METHODS.MONTE_CARLO,
      samples: 2000,
      seed: 77,
    });
    const first = calculateEquityMonteCarlo(req);
    const second = calculateEquityMonteCarlo(structuredClone(req));
    const diffSeed = calculateEquityMonteCarlo({ ...req, seed: 78 });
    expect(first).toEqual(second);
    expect('trials' in first).toBe(true);
    expect('trials' in diffSeed).toBe(true);
    if ('trials' in first && 'trials' in diffSeed) {
      expect(first.players).not.toEqual(diffSeed.players);
      expect(first.players[0]!.margin95).toBeGreaterThan(0);
      expect(first.players[0]!.margin95).toBeLessThan(0.05);
    }

    // 10-player MC
    const tenPlayer = calculateEquityMonteCarlo(
      eqReq({
        players: [
          { id: 'P0', cards: ['As', 'Ad'] },
          ...Array.from({ length: 9 }, (_, i) => ({ id: `P${i + 1}`, cards: null })),
        ],
        board: [],
        method: EQUITY_METHODS.MONTE_CARLO,
        samples: 500,
        seed: 99,
      }),
    );
    expect('trials' in tenPlayer).toBe(true);
    if ('trials' in tenPlayer) {
      expect(tenPlayer.players).toHaveLength(10);
      expect(tenPlayer.players.reduce((s, p) => s + p.equity, 0)).toBeCloseTo(1, 10);
    }

    // Auto picks exact when <= EXACT_EQUITY_COMBINATION_LIMIT and MC otherwise
    const largeEst = estimateEquityCombinations(
      eqReq({ players: [{ id: 'h', cards: ['As', 'Ad'] }, { id: 'v', cards: null }], board: [] }),
    );
    expect(largeEst.ok).toBe(true);
    if (largeEst.ok) {
      expect(largeEst.exactFeasible).toBe(false);
      expect(BigInt(largeEst.combinationsText) > BigInt(EXACT_EQUITY_COMBINATION_LIMIT)).toBe(true);
    }
  });

  it('supports async progress, AbortController cancellation, and worker message handler', async () => {
    const signalState = { aborted: false };
    const abort: AbortControllerLike = {
      signal: signalState,
      abort() {
        signalState.aborted = true;
      },
    };
    const progress: number[] = [];
    const cancelled = await calculateEquity(
      eqReq({ board: [], method: EQUITY_METHODS.MONTE_CARLO, samples: 1000 }),
      {
        signal: abort.signal,
        batchSize: 50,
        yieldControl: async () => {},
        onProgress(snap) {
          progress.push(snap.completed);
          if (snap.completed >= 100) abort.abort();
        },
      },
    );
    expect('error' in cancelled).toBe(true);
    if ('error' in cancelled) expect(cancelled.error.code).toBe(EQUITY_ERROR_CODES.ABORTED);
    expect(progress).toEqual([0, 50, 100]);

    const outbound: { type?: string; requestId?: string; result?: Record<string, unknown> }[] = [];
    const handler = createEquityWorkerMessageHandler({
      postMessage(msg) {
        outbound.push(msg as { type?: string; requestId?: string; result?: Record<string, unknown> });
      },
    });
    await handler({
      type: EQUITY_WORKER_MESSAGES.CALCULATE,
      requestId: 'req-1',
      request: eqReq({ board: ['2c', '7d', '9h', 'Js'] }),
    });
    expect(outbound[0]?.type).toBe(EQUITY_WORKER_MESSAGES.PROGRESS);
    const last = outbound.at(-1);
    expect(last?.type).toBe(EQUITY_WORKER_MESSAGES.RESULT);
    expect(last?.requestId).toBe('req-1');
    expect(last?.result?.schemaVersion).toBe(EQUITY_RESULT_SCHEMA_VERSION);
  });
});

describe('HoldemWeightedRange, four distinct range-math values, and weighted joint equity', () => {
  it('Step 7 regression: keeps inclusion weight, action probability, conditioned reach, and uncertainty distinct', () => {
    const empty = createEmptyCompleteHoldemRange({ rangeId: 'empty' });
    const unknown = createFullyUnknownHoldemRange({ rangeId: 'unknown' });
    const emptyFacts = inspectHoldemWeightedRange(empty);
    const unknownFacts = inspectHoldemWeightedRange(unknown);
    expect(emptyFacts.complete).toBe(true);
    expect(emptyFacts.emptyComplete).toBe(true);
    expect(unknownFacts.complete).toBe(false);
    expect(unknownFacts.fullyUnknown).toBe(true);
    expect(unknown.entries[0]?.state).toBe(HOLDEM_RANGE_ENTRY_STATES.UNKNOWN);
    expect(Object.hasOwn(unknown.entries[0]!, 'weight')).toBe(false);

    // 1. Inclusion weight (non-normalized prior mass across physical combos: 6 + 4*0.5 + 12*0.25 = 11)
    const directSrc = createHoldemRangeProvenanceSource({
      id: 'personal-direct',
      kind: HOLDEM_RANGE_PROVENANCE_KINDS.PERSONAL_DIRECT,
      sourceId: 'obs-1',
    });
    const prior = createHoldemWeightedRangeFromHandClassWeights({
      rangeId: 'rfi-prior',
      handClassWeights: {
        AA: { weight: 1, provenanceId: directSrc.id },
        AKs: { weight: 0.5, provenanceId: directSrc.id },
        AKo: { weight: 0.25, provenanceId: directSrc.id },
      },
      unlistedState: HOLDEM_RANGE_UNLISTED_POLICIES.KNOWN_ZERO,
      provenanceSources: [directSrc],
    });
    expect(prior.schemaVersion).toBe(HOLDEM_WEIGHTED_RANGE_SCHEMA_VERSION);
    expect(inspectHoldemWeightedRange(prior).totalKnownWeight).toBe(11);

    // 2. Action probability multiplied onto prior produces conditioned reach, NOT overwriting unknown with 0
    const freqRange = createHoldemWeightedRangeFromHandClassWeights({
      rangeId: 'call-freq',
      handClassWeights: { AA: 0.5, AKs: 1 },
      unlistedState: HOLDEM_RANGE_UNLISTED_POLICIES.UNKNOWN,
    });
    const conditionedReach = multiplyHoldemRangeByActionFrequencies(prior, freqRange);
    const aaCombos = getHoldemCombosForHandClass('AA');
    const akoCombos = getHoldemCombosForHandClass('AKo');
    // AA: inclusion 1 * action freq 0.5 = 0.5 reach
    const aaEntry = conditionedReach.entries.find((e) => e.comboId === aaCombos[0]!.id);
    expect(aaEntry?.state).toBe(HOLDEM_RANGE_ENTRY_STATES.KNOWN);
    if (aaEntry?.state === HOLDEM_RANGE_ENTRY_STATES.KNOWN) expect(aaEntry.weight).toBe(0.5);
    // AKo: action freq unknown -> prior known weight cannot invent 0 or known frequency -> stays unknown!
    const akoEntry = conditionedReach.entries.find((e) => e.comboId === akoCombos[0]!.id);
    expect(akoEntry?.state).toBe(HOLDEM_RANGE_ENTRY_STATES.UNKNOWN);

    // 3. Blocker conditioning lowers eligible mass (6 AA -> 3 AA when As removed), distinct from normalization (sum = 1)
    const afterAs = conditionHoldemRange(prior, ['As']);
    expect(afterAs.facts.blockedCombos).toBe(51);
    expect(afterAs.facts.eligibleCombos).toBe(1275);
    expect(afterAs.facts.totalEligibleWeight).toBeLessThan(afterAs.facts.totalKnownWeightBefore);

    const completeAA = createHoldemWeightedRangeFromHandClassWeights({
      handClassWeights: { AA: 1 },
      unlistedState: HOLDEM_RANGE_UNLISTED_POLICIES.KNOWN_ZERO,
    });
    const dist = createNormalizedHoldemDistribution(completeAA, { blockers: ['As'] });
    expect(dist.totalEligibleWeight).toBe(3);
    expect(dist.probabilityTotal).toBeCloseTo(1, 12);
    expect(() => createNormalizedHoldemDistribution(unknown)).toThrow(/incomplete/i);
    expect(() => createNormalizedHoldemDistribution(empty)).toThrow(/zero-mass/i);

    // 4. Uncertainty & serialization roundtrip + matrix 169-cell projection
    expect(PREFLOP_HAND_CLASSES).toHaveLength(169);
    expect(HOLDEM_COMBOS).toHaveLength(1326);
    expect(holdemComboIdForCards(['Ah', 'Kh'])).toBe(holdemComboIdForCards(['Kh', 'Ah']));
    expect(getHoldemComboForCards(['Ah', 'Kh'])).toBe(getHoldemComboById(holdemComboIdForCards(['Ah', 'Kh'])));
    const matrix = projectHoldemRangeToMatrix(prior);
    expect(matrix.cells).toHaveLength(169);
    const json = serializeHoldemWeightedRange(prior);
    expect(deserializeHoldemWeightedRange(json)).toEqual(prior);
    expect(validateHoldemWeightedRange(prior)).toBeTruthy();

    // Unknown + 0 stays unknown under multiplyHoldemRangeByActionFrequencies
    const zeroFreq = createHoldemWeightedRangeFromHandClassWeights({
      handClassWeights: { AA: 0 },
      unlistedState: HOLDEM_RANGE_UNLISTED_POLICIES.UNKNOWN,
    });
    const partialWithZero = multiplyHoldemRangeByActionFrequencies(unknown, zeroFreq);
    const stillUnknown = partialWithZero.entries.find((e) => e.comboId === aaCombos[0]!.id);
    expect(stillUnknown?.state).toBe(HOLDEM_RANGE_ENTRY_STATES.UNKNOWN);
  });

  it('Step 7 regression: weighted joint sampling rejects colliding card sets without sequential bias', async () => {
    const rangeA = createHoldemWeightedRangeFromEntries({
      entries: [
        { comboId: holdemComboIdForCards(['As', 'Ah']), state: 'known', weight: 1, provenanceId: null },
        { comboId: holdemComboIdForCards(['Ks', 'Kh']), state: 'known', weight: 1, provenanceId: null },
      ],
      unlistedState: HOLDEM_RANGE_UNLISTED_POLICIES.KNOWN_ZERO,
    });
    const rangeB = createHoldemWeightedRangeFromEntries({
      entries: [
        { comboId: holdemComboIdForCards(['As', 'Qd']), state: 'known', weight: 1, provenanceId: null },
        { comboId: holdemComboIdForCards(['Jc', 'Jd']), state: 'known', weight: 1, provenanceId: null },
      ],
      unlistedState: HOLDEM_RANGE_UNLISTED_POLICIES.KNOWN_ZERO,
    });
    const req: WeightedEquityRequestInput = {
      schemaVersion: WEIGHTED_EQUITY_REQUEST_VERSION,
      players: [
        {
          id: 'A',
          kind: 'range',
          range: rangeA,
          sourceRole: 'user_supplied',
          sourceId: 'range-a',
          weightSemantics: 'relative_combo_likelihood',
        },
        {
          id: 'B',
          kind: 'range',
          range: rangeB,
          sourceRole: 'user_supplied',
          sourceId: 'range-b',
          weightSemantics: 'relative_combo_likelihood',
        },
      ],
      board: ['2c', '3d', '4h', '5s', '9c'],
      deadCards: [],
      method: 'auto',
      seed: 37,
      samples: 12_000,
    };
    const exact = await calculateWeightedEquity(req);
    expect(exact.status).toBe('exact');
    if (exact.status === 'exact') {
      expect(exact.trials).toBe(3);
      expect(exact.players[0]!.equity).toBeCloseTo(2 / 3, 12);
      expect(exact.metadata.jointCompatibilityProbability).toBeCloseTo(0.75, 12);
      expect(exact.players.every((p) => p.margin95 === 0)).toBe(true);
    }

    // Swapping player order gives symmetric Monte Carlo convergence (no sequential conditional bias!)
    const mcForward = await calculateWeightedEquity({ ...req, method: 'monte_carlo' });
    const mcSwapped = await calculateWeightedEquity({
      ...req,
      method: 'monte_carlo',
      players: [...req.players].reverse(),
    });
    expect(mcForward.status).toBe('estimated');
    expect(mcSwapped.status).toBe('estimated');
    if (mcForward.status === 'estimated' && mcSwapped.status === 'estimated') {
      expect(mcForward.method).toBe('monte_carlo');
      expect(mcForward.players[0]!.equity).toBeCloseTo(2 / 3, 1);
      expect(mcSwapped.players[1]!.equity).toBeCloseTo(mcForward.players[0]!.equity, 1);
      expect(mcForward.players[0]!.margin95).toBeGreaterThan(0);
    }

    // Partial range refuses normalized equity unless partialPolicy === 'known_only'
    const partialB = createHoldemWeightedRangeFromHandClassWeights({
      handClassWeights: { JJ: 0.25 },
      unlistedState: HOLDEM_RANGE_UNLISTED_POLICIES.UNKNOWN,
    });
    const rangePlayerB = {
      id: 'B',
      kind: 'range' as const,
      range: partialB,
      sourceRole: 'user_supplied' as const,
      sourceId: 'range-b-partial',
      weightSemantics: 'relative_combo_likelihood' as const,
    };
    const refusal = await calculateWeightedEquity({
      ...req,
      players: [req.players[0]!, rangePlayerB],
    });
    expect(refusal.status).toBe('partial');
    expect(refusal.players).toHaveLength(0);

    const partialKnownOnly = await calculateWeightedEquity({
      ...req,
      partialPolicy: 'known_only',
      players: [req.players[0]!, rangePlayerB],
    });
    expect(partialKnownOnly.status).toBe('partial');
    expect(partialKnownOnly.conditionalOnKnownMass).toBe(true);
    expect(partialKnownOnly.players.length).toBe(2);

    // Blocking every unresolved combo allows mathematically complete eligible normalization
    const partialAsQdOnly = withHoldemComboOverrides(
      createHoldemWeightedRangeFromEntries({
        entries: [{ comboId: holdemComboIdForCards(['Jc', 'Jd']), state: 'known', weight: 1, provenanceId: null }],
        unlistedState: HOLDEM_RANGE_UNLISTED_POLICIES.KNOWN_ZERO,
      }),
      [{ comboId: holdemComboIdForCards(['As', 'Qd']), state: 'unknown', provenanceId: null }],
    );
    const completeAfterBlockers = await calculateWeightedEquity({
      ...req,
      players: [
        { id: 'A', kind: 'exact', cards: ['As', 'Ah'] },
        {
          id: 'B',
          kind: 'range',
          range: partialAsQdOnly,
          sourceRole: 'user_supplied',
          sourceId: 'range-b-blocked',
          weightSemantics: 'relative_combo_likelihood',
        },
      ],
    });
    expect(completeAfterBlockers.status).toBe('exact');
  });
});

describe('runout explorer, range analysis, and equity hand analysis', () => {
  it('explores legal runouts, strips recipe and per-coverage provenance from sub-rows, and groups outcomes', async () => {
    const input = asWeightedEquityRequest({
      schemaVersion: EQUITY_REQUEST_SCHEMA_VERSION,
      board: ['Jh', '8h', '7s'],
      deadCards: [],
      players: [
        { id: 'hero', cards: ['Th', '9h'] },
        { id: 'villain', cards: ['As', 'Ad'] },
      ],
      method: EQUITY_METHODS.AUTO,
      samples: 100,
      seed: 1,
    });
    const res = await exploreRunouts(input, { sequences: [['Qh'], ['Qh', '2c']], samples: 10 });
    expect('rows' in res).toBe(true);
    if ('rows' in res) {
      expect(res.rows).toHaveLength(2);
      expect(res.rows[0]!.resultingHand?.category).toBe(HAND_CATEGORIES.STRAIGHT_FLUSH);
      expect(res.rows[0]!.enteredStanding).toBe('leading');
      expect(res.rows[1]!.equity).toBe(1);
      expect(Object.hasOwn(res.rows[0]!.result, 'recipe')).toBe(false);
      expect(groupRunouts(res.rows, 'category')).toHaveLength(1);
    }

    const illegal = await exploreRunouts(input, { sequences: [['Th']] });
    expect('reason' in illegal).toBe(true);
    if ('reason' in illegal) expect(illegal.reason).toBe('illegal_runout');
  });

  it('computes range standing facts, board structure, range analysis, and hand analysis projections', () => {
    const board = deriveBoardStructureFacts(['Qh', '7c', '2h']);
    expect(board.paired).toBe(false);
    expect(board.suitTexture).toBe('two_tone');
    expect(evaluateAvailableCards(['As', 'Ah', 'Qh', '7c', '2h']).category).toBe(
      HAND_CATEGORIES.ONE_PAIR,
    );

    const request = createRangeAnalysisRequest({
      heroCards: ['Ah', 'Kh'],
      board: ['Qh', '7c', '2h'],
      deadCards: [],
      ranges: {
        villain: {
          key: 'villain',
          role: 'opponent',
          subjectId: 'V',
          label: 'Villain',
          range: createHoldemWeightedRangeFromHandClassWeights({
            handClassWeights: { QQ: 1, AKo: 1 },
            unlistedState: HOLDEM_RANGE_UNLISTED_POLICIES.KNOWN_ZERO,
          }),
          source: { kind: 'manual', label: 'V', sourceId: null, sourceSchemaVersion: null },
        },
      },
    });
    const facts = createRangeAnalysisFacts(request as unknown as Record<string, unknown>);
    expect(facts.exactHand.draws?.drawOuts.flush.count).toBeGreaterThanOrEqual(8);

    const standing = rangeStandingFacts(
      asWeightedEquityRequest({
        schemaVersion: EQUITY_REQUEST_SCHEMA_VERSION,
        board: ['Qh', '7c', '2h'],
        deadCards: [],
        method: 'auto',
        samples: 100,
        seed: 1,
        players: [
          { id: 'hero', cards: ['As', 'Ah'] },
          { id: 'villain', cards: ['7s', '2c'] },
        ],
      }) as unknown as Parameters<typeof rangeStandingFacts>[0],
    );
    expect(standing).toBeNull(); // opponent is not a range

    const projection = createEquityHandAnalysisProjection({
      players: [
        { id: 'hero', cards: ['Ah', 'Kh'] },
        { id: 'villain', cards: ['Qs', 'Qc'] },
      ],
      board: ['Qh', '7c', '2h'],
    });
    expect(projection.players).toHaveLength(2);
    expect(projection.players[1]!.bestFivePresentationCards).toHaveLength(5);
    expect(orderBestFiveForPresentation(evaluateFive(['2c', '2d', 'As', 'Ks', 'Qh']))).toEqual([
      '2c',
      '2d',
      'As',
      'Ks',
      'Qh',
    ]);
    const entered = createExactEnteredHandOutcomeFacts({
      players: [
        { id: 'hero', cards: ['Ah', 'Kh'] },
        { id: 'villain', cards: ['Qs', 'Qc'] },
      ],
      board: ['Qh', '7c', '2h'],
    });
    expect(entered.available).toBe(true);
  });
});
