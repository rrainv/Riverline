import {
  allInLuckFacts,
  applyAction,
  applyChance,
  applyPrivateReveal,
  applyRecordedSettlement,
  buildHomeGameMorningSummary,
  buildLearnConceptExample,
  calculateFewestTransfersSettlement,
  calculateHomeGameAccounting,
  chooseDuelBotAction,
  compareCallEquityToRequired,
  compareHandRanks,
  compareStrategyWithBaseline,
  conditionHoldemRange,
  createEquityHandAnalysisProjection,
  createEquityWorkerMessageHandler,
  createGameRulesSnapshot,
  createHoldemWeightedRangeFromEntries,
  createHoldemWeightedRangeFromHandClassWeights,
  createHomeGameCorrection,
  createHomeGameLedgerHistory,
  createOpponentActorInformation,
  createRangeAnalysisFacts,
  createTrainingMemoryPresentationGate,
  deriveActionSizeFacts,
  deriveActorCallEconomics,
  deriveMinimumDefenseFrequency,
  derivePotAccounting,
  deriveStackToPotRatio,
  duelCallFacts,
  EQUITY_WORKER_MESSAGES,
  estimateEquityRequest,
  evaluateAvailableCards,
  formatHomeGameAmount,
  generateTrainingDrill,
  getLearnTrainerRound,
  getLearnWeaknesses,
  getLegalActionSpec,
  gradeLearnTrainerAnswer,
  gradeTrainingAnswer,
  groupRunouts,
  HOLDEM_DECK,
  initializeHand,
  initializeHandFromGameRulesSnapshot,
  initializeRecordedHand,
  isChipConserved,
  multiplyHoldemRangeByActionFrequencies,
  parseHomeGameAmount,
  potOddsFacts,
  potOddsFromAfterCall,
  projectStrategyLeakMap,
  projectStrategyMatrix,
  projectStrategySpotMap,
  reconstructCanonicalHandReplaySource,
  resolveShowdown,
  reviewCallEvFacts,
  STRATEGY_FAMILIES,
  validateGameRulesSnapshot,
  validateHomeGameLedger,
  validateHomeGameSessionReadyToSettle,
  validatePokerState,
  type DispatchableEquityRequest,
  type DispatchedEquityResult,
  type EquityEstimateResult,
  type EquityRequestInput,
  type PokerState,
  type RunoutExplorerOutcome,
  type RunoutExplorerResult,
  type RunoutRow,
  type WeightedEquityRequestInput,
} from '../../engine/index';
import type {
  AsyncCallOptions,
  AsyncProgressUpdate,
  ComputationMethod,
  EngineAsyncApi,
  EngineChannel,
  EngineClient,
  EngineFailure,
  EngineResponse,
  EngineSuccess,
  EngineSyncApi,
  FactQualifier,
  FactTier,
  StrategyLookupResult,
  TrainingDrillResult,
  TrainingGradeResult,
  WorkerPortLike,
} from './types';

export interface CreateEngineClientOptions {
  readonly mode?: 'auto' | 'worker' | 'inline';
  readonly createWorker?: () => Worker | WorkerPortLike | null;
}

let requestSequence = 0;

function nextRequestId(prefix = 'eng'): string {
  requestSequence += 1;
  return `${prefix}-${requestSequence}`;
}

function makeFailure(
  requestId: string,
  code: string,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): EngineFailure {
  return {
    ok: false,
    requestId,
    tier: 'unavailable',
    method: 'unavailable',
    error: details ? { code, message, details } : { code, message },
  };
}

function makeSuccess<T>(
  requestId: string,
  data: T,
  options: {
    readonly tier?: Exclude<FactTier, 'unavailable'>;
    readonly qualifier?: FactQualifier;
    readonly method?: Exclude<ComputationMethod, 'unavailable'>;
  } = {},
): EngineSuccess<T> {
  return {
    ok: true,
    requestId,
    tier: options.tier ?? 'exact',
    ...(options.qualifier ? { qualifier: options.qualifier } : {}),
    method: options.method ?? 'canonical_rules',
    data,
  };
}

function runSync<T>(
  fn: () => T,
  options: {
    readonly tier?: Exclude<FactTier, 'unavailable'>;
    readonly qualifier?: FactQualifier;
    readonly method?: Exclude<ComputationMethod, 'unavailable'>;
  } = {},
): EngineResponse<T> {
  const requestId = nextRequestId('sync');
  try {
    return makeSuccess(requestId, fn(), options);
  } catch (error) {
    return makeFailure(
      requestId,
      'invalid_request',
      error instanceof Error ? error.message : String(error),
    );
  }
}

function normalizeProgress(raw: unknown): AsyncProgressUpdate {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const completed = typeof obj.completed === 'number' ? obj.completed : 0;
  const total = typeof obj.total === 'number' ? obj.total : 0;
  const fraction =
    typeof obj.fraction === 'number' ? obj.fraction : total === 0 ? 1 : completed / total;
  return { completed, total, fraction };
}

function wrapDispatchedEquity(
  requestId: string,
  raw: unknown,
): EngineResponse<DispatchedEquityResult> {
  if (!raw || typeof raw !== 'object') {
    return makeFailure(requestId, 'internal_error', 'Worker returned empty result');
  }
  const obj = raw as Record<string, unknown>;

  if (obj.ok === false && obj.error && typeof obj.error === 'object') {
    const err = obj.error as Record<string, unknown>;
    return makeFailure(
      requestId,
      typeof err.code === 'string' ? err.code : 'invalid_request',
      typeof err.message === 'string' ? err.message : 'Equity request failed',
      err.details as Readonly<Record<string, unknown>> | undefined,
    );
  }

  if (obj.schemaVersion === 'weighted-equity-result/v1') {
    if (obj.reason !== null && obj.reason !== undefined) {
      return makeFailure(requestId, String(obj.reason), String(obj.reason), {
        status: obj.status,
        coverage: obj.coverage,
      });
    }
    const exact = obj.method === 'exact';
    const partial = Boolean(obj.conditionalOnKnownMass);
    return makeSuccess(requestId, raw as DispatchedEquityResult, {
      tier: exact ? 'exact' : 'estimated',
      qualifier: partial ? 'partial_known_mass' : exact ? 'known_cards' : 'sampled',
      method: exact ? 'exact_enumeration' : 'monte_carlo',
    });
  }

  if (obj.schemaVersion === 'runout-explorer/v1') {
    const rows = Array.isArray(obj.rows) ? (obj.rows as readonly Record<string, unknown>[]) : [];
    const baseline = obj.baseline as Record<string, unknown> | undefined;
    const anyEstimated =
      baseline?.method !== 'exact' || rows.some((row) => Boolean(row.deltaEstimated));
    const partial = obj.status === 'partial';
    return makeSuccess(requestId, raw as DispatchedEquityResult, {
      tier: anyEstimated ? 'estimated' : 'exact',
      qualifier: partial ? 'partial_known_mass' : anyEstimated ? 'sampled' : 'known_cards',
      method: anyEstimated ? 'monte_carlo' : 'exact_enumeration',
    });
  }

  if (obj.status === 'unavailable') {
    return makeFailure(
      requestId,
      typeof obj.reason === 'string' ? obj.reason : 'unavailable',
      typeof obj.reason === 'string' ? obj.reason : 'Calculation unavailable',
    );
  }

  if (obj.schemaVersion === 'equity-result/v1') {
    const exact = Boolean(obj.exact);
    return makeSuccess(requestId, raw as DispatchedEquityResult, {
      tier: exact ? 'exact' : 'estimated',
      qualifier: exact ? 'known_cards' : 'sampled',
      method: exact ? 'exact_enumeration' : 'monte_carlo',
    });
  }

  return makeFailure(requestId, 'internal_error', 'Unrecognized engine response payload');
}

function defaultWorkerFactory(): Worker | WorkerPortLike | null {
  if (typeof Worker === 'undefined') return null;
  return new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
}

function serializeWorkerOptions(options: AsyncCallOptions): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  if (options.batchSize !== undefined) safe.batchSize = options.batchSize;
  if (options.exactLimit !== undefined) safe.exactLimit = options.exactLimit;
  if (options.samples !== undefined) safe.samples = options.samples;
  return safe;
}

export function createEngineClient(options: CreateEngineClientOptions = {}): EngineClient {
  const mode = options.mode ?? 'auto';
  const createWorker = options.createWorker ?? defaultWorkerFactory;

  let disposed = false;
  let workerInstance: Worker | WorkerPortLike | null = null;
  const workerPool: (Worker | WorkerPortLike)[] = [];
  let workerCrashCount = 0;
  let inlineHandler: ((eventOrData: unknown) => Promise<void>) | null = null;

  interface PendingRequest {
    readonly worker?: Worker | WorkerPortLike | null;
    readonly onProgress?: (progress: AsyncProgressUpdate) => void;
    readonly resolve: (rawResult: unknown) => void;
    readonly reject: (reason: Error) => void;
    readonly cleanupAbort?: () => void;
  }

  const pending = new Map<string, PendingRequest>();

  function terminateDeadWorker(err: Error): void {
    const dead = workerInstance;
    workerInstance = null;
    workerCrashCount += 1;
    if (dead && typeof dead.terminate === 'function') {
      try {
        dead.terminate();
      } catch {
        // Ignore terminate errors on dead worker
      }
    }
    for (const [reqId, entry] of pending.entries()) {
      pending.delete(reqId);
      entry.cleanupAbort?.();
      entry.reject(err);
    }
  }

  function handleWorkerOutput(rawEvent: unknown): void {
    const message =
      rawEvent && typeof rawEvent === 'object' && 'data' in rawEvent
        ? (rawEvent as { data: unknown }).data
        : rawEvent;
    if (!message || typeof message !== 'object') return;
    const msg = message as Record<string, unknown>;
    const requestId = typeof msg.requestId === 'string' ? msg.requestId : null;
    if (!requestId) return;
    const entry = pending.get(requestId);
    if (!entry) return;

    if (msg.type === EQUITY_WORKER_MESSAGES.PROGRESS) {
      entry.onProgress?.(normalizeProgress(msg.progress));
      return;
    }
    if (msg.type === EQUITY_WORKER_MESSAGES.RESULT) {
      pending.delete(requestId);
      entry.cleanupAbort?.();
      entry.resolve(msg.result);
    }
  }

  function ensureTransport(): {
    readonly kind: 'worker' | 'inline';
    post: (payload: unknown) => void;
  } {
    if (mode !== 'inline' && workerCrashCount < 2) {
      if (!workerInstance) {
        const candidate = createWorker();
        if (candidate) {
          candidate.onmessage = handleWorkerOutput;
          candidate.onerror = (event: { readonly message?: string }) => {
            terminateDeadWorker(new Error(event?.message || 'Engine worker failure'));
          };
          const withMsgErr = candidate as WorkerPortLike & {
            onmessageerror?: ((event: unknown) => void) | null;
          };
          if ('onmessageerror' in withMsgErr || typeof Worker !== 'undefined') {
            withMsgErr.onmessageerror = () => {
              terminateDeadWorker(new Error('Engine worker messageerror'));
            };
          }
          workerInstance = candidate;
        }
      }
      if (workerInstance) {
        return {
          kind: 'worker',
          post: (payload) => {
            try {
              workerInstance!.postMessage(payload);
            } catch (err) {
              terminateDeadWorker(err instanceof Error ? err : new Error('Worker postMessage failed'));
            }
          },
        };
      }
    }

    if (!inlineHandler) {
      inlineHandler = createEquityWorkerMessageHandler({
        postMessage: (message) => handleWorkerOutput({ data: message }),
      });
    }
    return {
      kind: 'inline',
      post: (payload) => {
        void inlineHandler!(payload);
      },
    };
  }

  const transportKind: 'worker' | 'inline' =
    mode === 'inline'
      ? 'inline'
      : mode === 'worker' || typeof Worker !== 'undefined' || options.createWorker !== undefined
        ? 'worker'
        : 'inline';

  function cancel(requestId: string): void {
    if (disposed) return;
    const targetWorker = pending.get(requestId)?.worker ?? workerInstance;
    if (targetWorker) {
      targetWorker.postMessage({ type: EQUITY_WORKER_MESSAGES.CANCEL, requestId });
    } else if (inlineHandler) {
      void inlineHandler({ type: EQUITY_WORKER_MESSAGES.CANCEL, requestId });
    }
  }

  function ensureWorkerPool(desiredSize: number): readonly (Worker | WorkerPortLike)[] {
    if (mode === 'inline' || workerCrashCount >= 2 || typeof Worker === 'undefined') {
      return [];
    }
    ensureTransport();
    if (!workerInstance) return [];
    if (workerPool.length === 0) {
      workerPool.push(workerInstance);
    }
    while (workerPool.length < desiredSize) {
      const extra = createWorker();
      if (!extra) break;
      extra.onmessage = handleWorkerOutput;
      extra.onerror = () => {
        // Pool fallback is handled by main workerInstance if needed.
      };
      workerPool.push(extra);
    }
    return workerPool;
  }

  function postWorkerRequest(
    message: Record<string, unknown>,
    callOptions: AsyncCallOptions = {},
    targetWorker?: Worker | WorkerPortLike,
  ): { readonly requestId: string; readonly promise: Promise<unknown> } {
    const requestId = callOptions.requestId ?? nextRequestId('async');
    if (disposed) {
      return {
        requestId,
        promise: Promise.reject(new Error('Engine client is disposed')),
      };
    }
    if (callOptions.signal?.aborted) {
      return {
        requestId,
        promise: Promise.resolve({
          ok: false,
          error: { code: 'aborted', message: 'Request aborted before dispatch' },
        }),
      };
    }

    const transport = targetWorker
      ? {
          kind: 'worker' as const,
          post: (payload: unknown) => targetWorker.postMessage(payload),
        }
      : ensureTransport();
    const promise = new Promise<unknown>((resolve, reject) => {
      let cleanupAbort: (() => void) | undefined;
      if (callOptions.signal) {
        const onAbort = () => cancel(requestId);
        callOptions.signal.addEventListener('abort', onAbort, { once: true });
        cleanupAbort = () => callOptions.signal?.removeEventListener('abort', onAbort);
      }

      pending.set(requestId, {
        worker: targetWorker ?? (transport.kind === 'worker' ? workerInstance : null),
        onProgress: callOptions.onProgress,
        resolve,
        reject,
        cleanupAbort,
      });

      transport.post({ ...message, requestId });
    });

    return { requestId, promise };
  }

  const sync: EngineSyncApi = {
    potOdds: (callAmountMilliBb, actorContestablePotAfterCallMilliBb) =>
      runSync(
        () => potOddsFromAfterCall(callAmountMilliBb, actorContestablePotAfterCallMilliBb),
        { qualifier: 'price_only' },
      ),
    potOddsFromPotBeforeCall: (callAmountMilliBb, potBeforeCallMilliBb) =>
      runSync(
        () => potOddsFacts(callAmountMilliBb, potBeforeCallMilliBb),
        { qualifier: 'price_only' },
      ),
    duelCallFacts: (potBeforeBetBb, betBb, startingStackBb) =>
      runSync(
        () => duelCallFacts(potBeforeBetBb, betBb, startingStackBb),
        { qualifier: 'price_only' },
      ),
    actorCallEconomics: (state, actorPlayerId) =>
      runSync(() => deriveActorCallEconomics(state, actorPlayerId), { qualifier: 'price_only' }),
    actionSizeFacts: (state, actorPlayerId, amountToMilliBb) =>
      runSync(
        () => deriveActionSizeFacts(state, actorPlayerId, amountToMilliBb),
        { qualifier: 'price_only' },
      ),
    stackToPotRatio: (context) =>
      runSync(() => deriveStackToPotRatio(context), { qualifier: 'price_only' }),
    minimumDefenseFrequency: (context) =>
      runSync(() => deriveMinimumDefenseFrequency(context), { qualifier: 'price_only' }),
    allInLuck: (input) => runSync(() => allInLuckFacts(input), { qualifier: 'known_cards' }),
    allInLuckAndEv: (input) => runSync(() => reviewCallEvFacts(input), { qualifier: 'known_cards' }),
    compareCallEquityToRequired: (input) =>
      runSync(() => compareCallEquityToRequired(input), {
        qualifier: input.isExact ? 'known_cards' : 'sampled',
      }),
    evaluateHand: (cards) => runSync(() => evaluateAvailableCards(cards), { qualifier: 'known_cards' }),
    compareHandRanks: (left, right) =>
      runSync(() => compareHandRanks(left, right), { qualifier: 'known_cards' }),
    createGameRulesSnapshot: (input) => runSync(() => createGameRulesSnapshot(input)),
    validateGameRulesSnapshot: (snapshot) => runSync(() => validateGameRulesSnapshot(snapshot)),
    initializeHand: (config) => runSync(() => initializeHand(config)),
    initializeHandFromGameRulesSnapshot: (config) =>
      runSync(() => initializeHandFromGameRulesSnapshot(config)),
    initializeRecordedHand: (config) => runSync(() => initializeRecordedHand(config)),
    legalActions: (state) => runSync(() => getLegalActionSpec(state)),
    applyAction: (state, action) => runSync(() => applyAction(state, action)),
    applyChance: (state, chance) => runSync(() => applyChance(state, chance)),
    applyPrivateReveal: (state, revealEvent) => runSync(() => applyPrivateReveal(state, revealEvent)),
    resolveShowdown: (state) => runSync(() => resolveShowdown(state), { qualifier: 'known_cards' }),
    applyRecordedSettlement: (state, evidence) =>
      runSync(() => applyRecordedSettlement(state, evidence)),
    derivePotAccounting: (state) => runSync(() => derivePotAccounting(state)),
    isChipConserved: (state) => runSync(() => isChipConserved(state)),
    validatePokerState: (state) => runSync(() => validatePokerState(state)),
    createWeightedRangeFromHandClasses: (rangeOpts) =>
      runSync(() => createHoldemWeightedRangeFromHandClassWeights(rangeOpts)),
    createWeightedRangeFromEntries: (rangeOpts) =>
      runSync(() => createHoldemWeightedRangeFromEntries(rangeOpts)),
    conditionRange: (range, deadCards = []) =>
      runSync(() => conditionHoldemRange(range, deadCards)),
    multiplyRangeByActionFrequencies: (priorRange, frequencyRange) =>
      runSync(() => multiplyHoldemRangeByActionFrequencies(priorRange, frequencyRange)),
    analyzeRange: (requestInput) => runSync(() => createRangeAnalysisFacts(requestInput)),
    projectEquityHands: (input) =>
      runSync(() => createEquityHandAnalysisProjection(input), { qualifier: 'known_cards' }),
    groupRunouts: (rows, by = 'rank') => runSync(() => groupRunouts(rows, by)),
    projectOpponentInformation: (input) =>
      runSync(() => createOpponentActorInformation(input)),
    projectReplayState: (source, stepIndex) =>
      runSync(() => {
        const reconstructed = reconstructCanonicalHandReplaySource(source);
        const frame = reconstructed.frames[stepIndex];
        if (!frame) {
          throw new RangeError(`Replay step ${stepIndex} is out of bounds`);
        }
        return frame.state;
      }),
    isHandInProgressEmbargoed: (session, gateOpts) =>
      runSync(() => createTrainingMemoryPresentationGate(session, gateOpts)),
    projectStrategyMatrix: (context, evidence) =>
      runSync(() => projectStrategyMatrix(context, evidence)),
    projectStrategySpotMap: (tableSize, stackDepthBb, evidence) =>
      runSync(() => projectStrategySpotMap(tableSize, stackDepthBb, evidence)),
    compareStrategyBaseline: (projection, familyId) =>
      runSync(() => compareStrategyWithBaseline(projection, familyId), {
        tier: 'estimated',
        method: 'heuristic_baseline',
      }),
    projectStrategyLeakMap: (tableSize, stackDepthBb, evidence) =>
      runSync(() => projectStrategyLeakMap(tableSize, stackDepthBb, evidence), {
        tier: 'estimated',
        method: 'heuristic_baseline',
      }),
    chooseDuelBotAction: (input) =>
      runSync(() => chooseDuelBotAction(input), {
        tier: 'estimated',
        method: 'heuristic_baseline',
      }),
    parseHomeGameAmount: (value, minorUnit = 0) =>
      runSync(() => parseHomeGameAmount(value, minorUnit)),
    formatHomeGameAmount: (amountMinor, currency, formatOpts) =>
      runSync(() => formatHomeGameAmount(amountMinor, currency, formatOpts)),
    validateHomeGameLedger: (session, transactions) =>
      runSync(() => validateHomeGameLedger(session, transactions)),
    calculateHomeGameAccounting: (session, transactions) =>
      runSync(() => calculateHomeGameAccounting(session, transactions)),
    validateHomeGameSessionReadyToSettle: (session, transactions) =>
      runSync(() => validateHomeGameSessionReadyToSettle(session, transactions)),
    calculateFewestTransfersSettlement: (session, transactions) =>
      runSync(() => calculateFewestTransfersSettlement(session, transactions)),
    createHomeGameCorrection: (original, transactionId, createdAt, note = null) =>
      runSync(() => createHomeGameCorrection(original, transactionId, createdAt, note)),
    createHomeGameLedgerHistory: (session, transactions) =>
      runSync(() => createHomeGameLedgerHistory(session, transactions)),
    buildHomeGameMorningSummary: (session, transactions) =>
      runSync(() => buildHomeGameMorningSummary(session, transactions)),
    buildLearnConceptExample: (conceptId) => {
      const requestId = nextRequestId('sync');
      try {
        const data = buildLearnConceptExample(conceptId);
        return makeSuccess(requestId, data, {
          tier: data.tier,
          qualifier: data.qualifier,
        });
      } catch (error) {
        return makeFailure(
          requestId,
          'invalid_request',
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    getLearnTrainerRound: (trainerMode, spotIndex) =>
      runSync(() => getLearnTrainerRound(trainerMode, spotIndex)),
    gradeLearnTrainerAnswer: (trainerMode, spotIndex, chosenOptionIndex) => {
      const requestId = nextRequestId('sync');
      try {
        const data = gradeLearnTrainerAnswer(trainerMode, spotIndex, chosenOptionIndex);
        return makeSuccess(requestId, data, {
          tier: data.tier,
          qualifier: data.qualifier,
        });
      } catch (error) {
        return makeFailure(
          requestId,
          'invalid_request',
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    getLearnWeaknesses: () => runSync(() => getLearnWeaknesses()),
  };

  const asyncApi: EngineAsyncApi = {
    estimateEquity(request, estimateOpts = {}) {
      const requestId = nextRequestId('estimate');
      try {
        const res =
          request.schemaVersion === 'weighted-equity-request/v1'
            ? estimateEquityRequest(request)
            : estimateEquityRequest({ ...request, ...estimateOpts });
        if (!('ok' in res) || !res.ok) {
          if ('error' in res) {
            return makeFailure(requestId, res.error.code, res.error.message, res.error.details);
          }
          const failObj = res as { readonly reason?: string };
          return makeFailure(requestId, failObj.reason ?? 'invalid_request', 'Invalid equity request');
        }
        return makeSuccess(requestId, res as Exclude<EquityEstimateResult, { readonly ok: false }>, {
          tier: 'exact',
          method: 'exact_enumeration',
        });
      } catch (error) {
        return makeFailure(
          requestId,
          'invalid_request',
          error instanceof Error ? error.message : String(error),
        );
      }
    },

    async calculateEquity<TReq extends DispatchableEquityRequest>(
      request: TReq,
      callOptions: AsyncCallOptions = {},
    ): Promise<EngineResponse<DispatchedEquityResult>> {
      const normalizedRequest =
        callOptions.samples !== undefined &&
        request &&
        typeof request === 'object' &&
        'schemaVersion' in request &&
        request.schemaVersion !== 'runout-request/v1' &&
        !('samples' in request && request.samples !== undefined)
          ? { ...request, samples: callOptions.samples }
          : request;
      const { requestId, promise } = postWorkerRequest(
        {
          type: EQUITY_WORKER_MESSAGES.CALCULATE,
          request: normalizedRequest,
          options: serializeWorkerOptions(callOptions),
          reportProgress: typeof callOptions.onProgress === 'function',
        },
        callOptions,
      );
      try {
        const raw = await promise;
        return wrapDispatchedEquity(requestId, raw);
      } catch (error) {
        return makeFailure(
          requestId,
          'aborted',
          error instanceof Error ? error.message : String(error),
        );
      }
    },

    async exploreRunouts(
      request: WeightedEquityRequestInput | EquityRequestInput,
      callOptions: AsyncCallOptions = {},
    ): Promise<EngineResponse<RunoutExplorerOutcome>> {
      const normalizedRequest =
        callOptions.samples !== undefined &&
        !('samples' in request && request.samples !== undefined)
          ? { ...request, samples: callOptions.samples }
          : request;

      const boardLen = normalizedRequest.board?.length ?? 0;
      const hasNonExactPlayer = normalizedRequest.players.some((p) =>
        'kind' in p ? p.kind !== 'exact' : p.cards === null,
      );
      const desiredWorkers =
        typeof navigator !== 'undefined' && navigator.hardwareConcurrency
          ? Math.min(4, Math.max(2, navigator.hardwareConcurrency - 1))
          : 2;

      if (
        transportKind === 'worker' &&
        hasNonExactPlayer &&
        (boardLen === 3 || boardLen === 4)
      ) {
        const pool = ensureWorkerPool(desiredWorkers);
        if (pool.length >= 2) {
          const fixedSet = new Set<string>([
            ...(normalizedRequest.board ?? []),
            ...(normalizedRequest.deadCards ?? []),
          ]);
          for (const player of normalizedRequest.players) {
            if ('kind' in player) {
              if (player.kind === 'exact') {
                for (const c of player.cards) fixedSet.add(c);
              }
            } else if (player.cards) {
              for (const c of player.cards) fixedSet.add(c);
            }
          }
          const candidateCards = HOLDEM_DECK.filter((c) => !fixedSet.has(c));
          const totalCards = candidateCards.length;
          if (totalCards >= pool.length) {
            const chunks: string[][] = Array.from({ length: pool.length }, () => []);
            for (let i = 0; i < totalCards; i += 1) {
              chunks[i % pool.length]!.push(candidateCards[i]!);
            }
            const parentRequestId = callOptions.requestId ?? nextRequestId('runout-pool');
            const chunkCompleted = new Array<number>(chunks.length).fill(0);

            const chunkPromises = chunks.map((chunkCards, workerIdx) => {
              const worker = pool[workerIdx]!;
              const chunkOptions = {
                ...serializeWorkerOptions(callOptions),
                sequences: chunkCards.map((c) => [c]),
              };
              const { promise } = postWorkerRequest(
                {
                  type: EQUITY_WORKER_MESSAGES.CALCULATE,
                  request: {
                    schemaVersion: 'runout-request/v1',
                    request: normalizedRequest,
                    options: chunkOptions,
                  },
                  options: chunkOptions,
                  reportProgress: typeof callOptions.onProgress === 'function',
                },
                {
                  requestId: `${parentRequestId}-w${workerIdx}`,
                  signal: callOptions.signal,
                  onProgress: (prog) => {
                    chunkCompleted[workerIdx] = prog.completed;
                    const sum = chunkCompleted.reduce((acc, n) => acc + n, 0);
                    callOptions.onProgress?.({
                      completed: sum,
                      total: totalCards,
                      fraction: totalCards > 0 ? sum / totalCards : 1,
                    });
                  },
                },
                worker,
              );
              return promise;
            });

            try {
              const rawChunks = await Promise.all(chunkPromises);
              const wrappedChunks = rawChunks.map((raw, idx) =>
                wrapDispatchedEquity(`${parentRequestId}-w${idx}`, raw),
              );
              const firstFail = wrappedChunks.find((res) => !res.ok);
              if (firstFail) {
                return firstFail as EngineResponse<RunoutExplorerOutcome>;
              }
              const rowByCard = new Map<string, RunoutRow>();
              let firstOutcome: RunoutExplorerResult | null = null;
              for (const res of wrappedChunks) {
                if (!res.ok) continue;
                const data = res.data as unknown as RunoutExplorerOutcome;
                if (!('rows' in data)) {
                  return wrapDispatchedEquity(parentRequestId, data) as EngineResponse<RunoutExplorerOutcome>;
                }
                firstOutcome ??= data;
                for (const row of data.rows) {
                  if (row.cards[0]) rowByCard.set(row.cards[0], row);
                }
              }
              if (firstOutcome) {
                const orderedRows = candidateCards
                  .map((c) => rowByCard.get(c))
                  .filter((r): r is RunoutRow => Boolean(r));
                const merged: RunoutExplorerResult = {
                  ...firstOutcome,
                  rows: orderedRows,
                  recipe: {
                    ...firstOutcome.recipe,
                    sequences: candidateCards.map((c) => [c]),
                  },
                };
                return wrapDispatchedEquity(parentRequestId, merged) as EngineResponse<RunoutExplorerOutcome>;
              }
            } catch (error) {
              return makeFailure(
                parentRequestId,
                'aborted',
                error instanceof Error ? error.message : String(error),
              );
            }
          }
        }
      }

      const response = await asyncApi.calculateEquity(
        {
          schemaVersion: 'runout-request/v1',
          request: normalizedRequest,
          options: serializeWorkerOptions(callOptions),
        },
        callOptions,
      );
      return response as EngineResponse<RunoutExplorerOutcome>;
    },

    async resolveShowdownAsync(
      state: PokerState,
      callOptions: Pick<AsyncCallOptions, 'requestId' | 'signal'> = {},
    ): Promise<EngineResponse<PokerState>> {
      const { requestId, promise } = postWorkerRequest(
        { type: EQUITY_WORKER_MESSAGES.SHOWDOWN_RESOLVE, state },
        callOptions,
      );
      try {
        const raw = await promise;
        if (
          raw &&
          typeof raw === 'object' &&
          'ok' in raw &&
          raw.ok === false &&
          'error' in raw &&
          raw.error &&
          typeof raw.error === 'object'
        ) {
          const err = raw.error as { readonly code?: string; readonly message?: string };
          return makeFailure(
            requestId,
            typeof err.code === 'string' ? err.code : 'internal_error',
            typeof err.message === 'string' ? err.message : 'Showdown resolution failed',
          );
        }
        return makeSuccess(requestId, raw as PokerState, {
          tier: 'exact',
          qualifier: 'known_cards',
          method: 'canonical_rules',
        });
      } catch (error) {
        return makeFailure(
          requestId,
          'internal_error',
          error instanceof Error ? error.message : String(error),
        );
      }
    },

    async lookupStrategy(request, callOptions = {}): Promise<EngineResponse<StrategyLookupResult>> {
      const requestId = callOptions.requestId ?? nextRequestId('strategy');
      try {
        const projection = projectStrategyMatrix(request.context, request.evidence ?? []);
        const families = request.familyId
          ? STRATEGY_FAMILIES.filter((f) => f.id === request.familyId)
          : STRATEGY_FAMILIES;
        const baselineComparisons = families.map((f) =>
          compareStrategyWithBaseline(projection, f.id),
        );
        const anyEstimated = baselineComparisons.some((b) => b.available);
        return makeSuccess(
          requestId,
          {
            tier: anyEstimated ? 'estimated' : 'unavailable',
            context: projection.context,
            projection,
            baselineComparisons,
          },
          {
            tier: anyEstimated ? 'estimated' : 'exact',
            method: anyEstimated ? 'heuristic_baseline' : 'canonical_rules',
          },
        );
      } catch (error) {
        return makeFailure(
          requestId,
          'invalid_request',
          error instanceof Error ? error.message : String(error),
        );
      }
    },

    async generateTrainingDrill(
      request = {},
      callOptions: AsyncCallOptions = {},
    ): Promise<EngineResponse<TrainingDrillResult>> {
      const requestId = callOptions.requestId ?? nextRequestId('training');
      try {
        const exercise = generateTrainingDrill(request);
        return makeSuccess(requestId, exercise, {
          tier: exercise.baselineTier === 'estimated' ? 'estimated' : 'exact',
          method:
            exercise.baselineTier === 'estimated'
              ? 'heuristic_baseline'
              : 'canonical_rules',
        });
      } catch (error) {
        return makeFailure(
          requestId,
          'invalid_request',
          error instanceof Error ? error.message : String(error),
        );
      }
    },

    async gradeTrainingAnswer(
      input,
      callOptions: AsyncCallOptions = {},
    ): Promise<EngineResponse<TrainingGradeResult>> {
      const requestId = callOptions.requestId ?? nextRequestId('grade');
      try {
        const output = gradeTrainingAnswer(input);
        return makeSuccess(requestId, output, {
          tier: output.baselineTier === 'estimated' ? 'estimated' : 'exact',
          method:
            output.baselineTier === 'estimated'
              ? 'heuristic_baseline'
              : 'canonical_rules',
        });
      } catch (error) {
        return makeFailure(
          requestId,
          'invalid_request',
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  };

  function createChannel<T>(name: string): EngineChannel<T> {
    let channelSeq = 0;
    let latestRequestId: string | null = null;
    let activeController: AbortController | null = null;

    function abortCurrent(): void {
      if (latestRequestId !== null) cancel(latestRequestId);
      if (activeController) {
        activeController.abort();
        activeController = null;
      }
    }

    return {
      name,
      async run(executor) {
        abortCurrent();
        channelSeq += 1;
        const requestId = `${name}-${channelSeq}`;
        latestRequestId = requestId;
        const controller = new AbortController();
        activeController = controller;
        const result = await executor({
          requestId,
          signal: controller.signal,
        });
        if (requestId !== latestRequestId || controller.signal.aborted) {
          return null;
        }
        if (activeController === controller) activeController = null;
        return result;
      },
      cancel: abortCurrent,
      dispose() {
        abortCurrent();
        latestRequestId = `${name}-disposed`;
      },
    };
  }

  function dispose(): void {
    disposed = true;
    for (const [reqId, entry] of pending.entries()) {
      pending.delete(reqId);
      entry.cleanupAbort?.();
      entry.reject(new Error('Engine client disposed'));
    }
    for (const poolWorker of workerPool) {
      if (poolWorker !== workerInstance && poolWorker.terminate) {
        poolWorker.terminate();
      }
    }
    workerPool.length = 0;
    if (workerInstance?.terminate) {
      workerInstance.terminate();
    }
    workerInstance = null;
    inlineHandler = null;
  }

  return {
    sync,
    async: asyncApi,
    transport: transportKind,
    cancel,
    createChannel,
    dispose,
  };
}

let sharedEngineClient: EngineClient | null = null;

/** Returns the lazily created singleton Worker-backed engine client for stores (inline fallback in Node/Vitest). */
export function getSharedEngineClient(): EngineClient {
  if (!sharedEngineClient) {
    sharedEngineClient = createEngineClient({ mode: 'auto' });
  }
  return sharedEngineClient;
}

export function resetSharedEngineClient(): void {
  if (sharedEngineClient) {
    sharedEngineClient.dispose();
    sharedEngineClient = null;
  }
}
