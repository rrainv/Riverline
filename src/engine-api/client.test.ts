import { afterEach, describe, expect, it } from 'vitest';
import {
  createEquityWorkerMessageHandler,
  EQUITY_WORKER_MESSAGES,
} from '../../engine/index';
import { createEngineClient, type WorkerPortLike } from './index';

describe('src/engine-api client, sync/async envelopes, channels, and cancellation', () => {
  const clientsToDispose: ReturnType<typeof createEngineClient>[] = [];

  afterEach(() => {
    while (clientsToDispose.length > 0) {
      clientsToDispose.pop()?.dispose();
    }
  });

  it('returns typed sync envelopes with FactTier, qualifier, and canonical method', () => {
    const client = createEngineClient({ mode: 'inline' });
    clientsToDispose.push(client);

    expect(client.transport).toBe('inline');

    const odds = client.sync.potOdds(9000, 36_000);
    expect(odds.ok).toBe(true);
    if (!odds.ok) throw new Error('expected ok');
    expect(odds.tier).toBe('exact');
    expect(odds.qualifier).toBe('price_only');
    expect(odds.method).toBe('canonical_rules');
    expect(odds.requestId).toMatch(/^sync-/);
    expect(odds.data.requiredRawEquity).toBeCloseTo(0.25, 10);

    const duel = client.sync.duelCallFacts(5, 3.75, 97.5);
    expect(duel.ok).toBe(true);
    if (!duel.ok) throw new Error('expected ok');
    expect(duel.data.calledPotBb).toBe(12.5);
    expect(duel.data.effectiveStackBehindBb).toBe(93.75);
    expect(duel.data.spr).toBe(7.5);

    const handRank = client.sync.evaluateHand(['As', 'Ks', 'Qs', 'Js', 'Ts']);
    expect(handRank.ok).toBe(true);
    if (!handRank.ok) throw new Error('expected ok');
    expect(handRank.tier).toBe('exact');
    expect(handRank.qualifier).toBe('known_cards');
    expect(handRank.data.category).toBe('straight_flush');

    const bad = client.sync.evaluateHand(['XX']);
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error('expected error');
    expect(bad.tier).toBe('unavailable');
    expect(bad.method).toBe('unavailable');
    expect(bad.error.code).toBe('invalid_request');
  });

  it('runs exact, sampled MC, weighted, and runout calculations in inline mode with progress', async () => {
    const client = createEngineClient({ mode: 'inline' });
    clientsToDispose.push(client);

    const exact = await client.async.calculateEquity({
      schemaVersion: 'equity-request/v1',
      players: [
        { id: 'hero', cards: ['Ad', 'Kd'] },
        { id: 'villain', cards: ['Qs', 'Qc'] },
      ],
      board: ['Ks', '8h', '4h'],
    });
    expect(exact.ok).toBe(true);
    if (!exact.ok) throw new Error('expected exact result');
    expect(exact.tier).toBe('exact');
    expect(exact.qualifier).toBe('known_cards');
    expect(exact.method).toBe('exact_enumeration');
    if (!('schemaVersion' in exact.data) || exact.data.schemaVersion !== 'equity-result/v1') {
      throw new Error('wrong schema');
    }
    expect(exact.data.trials).toBe(990);
    expect(exact.data.players[0]!.equity).toBeCloseTo(903 / 990, 10);

    const progressEvents: number[] = [];
    const sampled = await client.async.calculateEquity(
      {
        schemaVersion: 'equity-request/v1',
        players: [
          { id: 'p0', cards: ['As', 'Ad'] },
          { id: 'p1', cards: ['Kh', 'Qd'] },
          { id: 'p2', cards: null },
        ],
        board: [],
        seed: 77,
      },
      {
        samples: 240,
        batchSize: 80,
        onProgress: (p) => progressEvents.push(p.completed),
      },
    );
    expect(sampled.ok).toBe(true);
    if (!sampled.ok) throw new Error('expected sampled result');
    expect(sampled.tier).toBe('estimated');
    expect(sampled.qualifier).toBe('sampled');
    expect(sampled.method).toBe('monte_carlo');
    expect(progressEvents.length).toBeGreaterThanOrEqual(1);
    if (!('schemaVersion' in sampled.data) || sampled.data.schemaVersion !== 'equity-result/v1') {
      throw new Error('wrong schema');
    }
    expect(sampled.data.trials).toBe(240);
    expect(sampled.data.players[0]!.margin95).toBeGreaterThan(0);

    const runouts = await client.async.exploreRunouts({
      schemaVersion: 'equity-request/v1',
      players: [
        { id: 'hero', cards: ['Ah', 'Kh'] },
        { id: 'villain', cards: ['Qs', 'Qc'] },
      ],
      board: ['Qh', '7c', '2h'],
    });
    expect(runouts.ok).toBe(true);
    if (!runouts.ok) throw new Error('expected runouts');
    expect(runouts.tier).toBe('exact');
    if ('rows' in runouts.data) {
      expect(runouts.data.rows).toHaveLength(45);
    } else {
      throw new Error('expected rows');
    }
  });

  it('supports worker port transport, request cancellation, AbortSignal, and error boundaries', async () => {
    const portMessages: unknown[] = [];
    let workerPort!: WorkerPortLike;
    const handler = createEquityWorkerMessageHandler({
      postMessage: (msg: unknown) => {
        workerPort.onmessage?.({ data: msg } as MessageEvent<unknown>);
      },
    });

    let terminated = false;
    workerPort = {
      onmessage: null,
      onerror: null,
      postMessage: (msg) => {
        portMessages.push(msg);
        void handler(msg);
      },
      terminate: () => {
        terminated = true;
      },
    };

    const client = createEngineClient({
      mode: 'worker',
      createWorker: () => workerPort,
    });
    clientsToDispose.push(client);
    expect(client.transport).toBe('worker');

    const res = await client.async.calculateEquity({
      schemaVersion: 'equity-request/v1',
      players: [
        { id: 'a', cards: ['Ad', 'Kd'] },
        { id: 'b', cards: ['Qs', 'Qc'] },
      ],
      board: ['Ks', '8h', '4h'],
    });
    expect(res.ok).toBe(true);
    expect(portMessages.length).toBe(1);

    // Pre-aborted AbortSignal returns unavailable/aborted without hitting worker
    const preAborted = new AbortController();
    preAborted.abort();
    const abortedRes = await client.async.calculateEquity(
      {
        schemaVersion: 'equity-request/v1',
        players: [
          { id: 'a', cards: ['Ad', 'Kd'] },
          { id: 'b', cards: ['Qs', 'Qc'] },
        ],
        board: ['Ks', '8h', '4h'],
      },
      { signal: preAborted.signal },
    );
    expect(abortedRes.ok).toBe(false);
    if (abortedRes.ok) throw new Error('expected aborted');
    expect(abortedRes.tier).toBe('unavailable');
    expect(abortedRes.error.code).toBe('aborted');

    // Manual cancel sends cancel message to worker port
    client.cancel('manual-1');
    expect(
      portMessages.some(
        (m) =>
          typeof m === 'object' &&
          m !== null &&
          (m as { type?: string }).type === EQUITY_WORKER_MESSAGES.CANCEL &&
          (m as { requestId?: string }).requestId === 'manual-1',
      ),
    ).toBe(true);

    client.dispose();
    expect(terminated).toBe(true);
  });

  it('drops stale channel responses when a newer request supersedes an in-flight call', async () => {
    const delayedResponders = new Map<string, () => void>();
    let port!: WorkerPortLike;
    port = {
      onmessage: null,
      onerror: null,
      postMessage: (raw) => {
        const msg = raw as { type?: string; requestId?: string; request?: { board?: string[] } };
        if (msg.type === EQUITY_WORKER_MESSAGES.CANCEL) return;
        const requestId = msg.requestId!;
        const isSecond = msg.request?.board?.[3] === '3d';
        delayedResponders.set(requestId, () => {
          port.onmessage?.({
            data: {
              type: EQUITY_WORKER_MESSAGES.RESULT,
              requestId,
              result: {
                schemaVersion: 'equity-result/v1',
                exact: true,
                method: 'exact',
                trials: 44,
                seed: null,
                players: [
                  { id: 'a', wins: isSecond ? 41 : 40, ties: 0, equity: (isSecond ? 41 : 40) / 44, winProbability: (isSecond ? 41 : 40) / 44, tieProbability: 0, margin95: 0 },
                  { id: 'b', wins: isSecond ? 3 : 4, ties: 0, equity: (isSecond ? 3 : 4) / 44, winProbability: (isSecond ? 3 : 4) / 44, tieProbability: 0, margin95: 0 },
                ],
              },
            },
          } as MessageEvent<unknown>);
        });
      },
    };

    const client = createEngineClient({ mode: 'worker', createWorker: () => port });
    clientsToDispose.push(client);
    const channel = client.createChannel<Awaited<ReturnType<typeof client.async.calculateEquity>> extends infer R ? R extends { ok: true; data: infer D } ? D : never : never>('equity-room');

    const p1 = channel.run((opts) =>
      client.async.calculateEquity(
        {
          schemaVersion: 'equity-request/v1',
          players: [
            { id: 'a', cards: ['Ad', 'Kd'] },
            { id: 'b', cards: ['Qs', 'Qc'] },
          ],
          board: ['Ks', '8h', '4h', '2c'],
        },
        opts,
      ),
    );
    const p2 = channel.run((opts) =>
      client.async.calculateEquity(
        {
          schemaVersion: 'equity-request/v1',
          players: [
            { id: 'a', cards: ['Ad', 'Kd'] },
            { id: 'b', cards: ['Qs', 'Qc'] },
          ],
          board: ['Ks', '8h', '4h', '3d'],
        },
        opts,
      ),
    );

    // Resolve first AFTER second was dispatched: channel must return null for p1
    delayedResponders.get('equity-room-2')?.();
    delayedResponders.get('equity-room-1')?.();

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBeNull();
    expect(r2).not.toBeNull();
    expect(r2?.ok).toBe(true);
    if (r2 && r2.ok && 'schemaVersion' in r2.data && r2.data.schemaVersion === 'equity-result/v1') {
      expect(r2.data.players[0]!.wins).toBe(41);
    }
  });

  it('resolves lookupStrategy and returns unavailable tier for deferred training async methods', async () => {
    const client = createEngineClient({ mode: 'inline' });
    clientsToDispose.push(client);

    const strategy = await client.async.lookupStrategy({
      context: {
        tableSize: 6,
        stackDepthBb: 100,
        decisionFamily: 'preflop_rfi',
        position: 'UTG',
      },
      familyId: 'suited_kings',
    });
    expect(strategy.ok).toBe(true);
    if (strategy.ok) {
      expect(strategy.tier).toBe('estimated');
      expect(strategy.data.baselineComparisons[0]?.baselineCutoffHand).toBe('KTs');
    }

    const drill = await client.async.generateTrainingDrill({
      seed: 11,
      tableSize: 6,
      stackDepthBb: 100,
      target: 'preflop_rfi',
      focusPosition: 'BTN',
    });
    expect(drill.ok).toBe(true);
    if (!drill.ok) return;
    expect(drill.tier).toBe('estimated');
    expect(drill.data.heroPosition).toBe('BTN');

    const grade = await client.async.gradeTrainingAnswer({
      exercise: drill.data,
      chosenActionType: 'raise',
      chosenAmountToBb: drill.data.raisePresetsBb[0] ?? 2.5,
    });
    expect(grade.ok).toBe(true);
    if (grade.ok) {
      expect(grade.data.grade).toBeNull();
      expect(grade.data.isMathMistake).toBe(false);
    }
  });
});
