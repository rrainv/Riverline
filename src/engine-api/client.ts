import {
  allInLuckFacts,
  applyAction,
  applyChance,
  applyPrivateReveal,
  applyRecordedSettlement,
  compareHandRanks,
  conditionHoldemRange,
  createEquityWorkerMessageHandler,
  createGameRulesSnapshot,
  createHoldemWeightedRangeFromEntries,
  createHoldemWeightedRangeFromHandClassWeights,
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
  getLegalActionSpec,
  initializeHand,
  initializeHandFromGameRulesSnapshot,
  initializeRecordedHand,
  isChipConserved,
  multiplyHoldemRangeByActionFrequencies,
  potOddsFacts,
  potOddsFromAfterCall,
  reconstructCanonicalHandReplaySource,
  resolveShowdown,
  reviewCallEvFacts,
  validateGameRulesSnapshot,
  validatePokerState,
  type DispatchableEquityRequest,
  type DispatchedEquityResult,
  type EquityEstimateResult,
  type EquityRequestInput,
  type PokerState,
  type RunoutExplorerOutcome,
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
  let inlineHandler: ((eventOrData: unknown) => Promise<void>) | null = null;

  interface PendingRequest {
    readonly onProgress?: (progress: AsyncProgressUpdate) => void;
    readonly resolve: (rawResult: unknown) => void;
    readonly reject: (reason: Error) => void;
    readonly cleanupAbort?: () => void;
  }

  const pending = new Map<string, PendingRequest>();

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
    if (mode !== 'inline') {
      if (!workerInstance) {
        const candidate = createWorker();
        if (candidate) {
          candidate.onmessage = handleWorkerOutput;
          candidate.onerror = (event: { readonly message?: string }) => {
            const err = new Error(event?.message || 'Engine worker failure');
            for (const [reqId, entry] of pending.entries()) {
              pending.delete(reqId);
              entry.cleanupAbort?.();
              entry.reject(err);
            }
          };
          workerInstance = candidate;
        }
      }
      if (workerInstance) {
        return {
          kind: 'worker',
          post: (payload) => workerInstance!.postMessage(payload),
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
    if (workerInstance) {
      workerInstance.postMessage({ type: EQUITY_WORKER_MESSAGES.CANCEL, requestId });
    } else if (inlineHandler) {
      void inlineHandler({ type: EQUITY_WORKER_MESSAGES.CANCEL, requestId });
    }
  }

  function postWorkerRequest(
    message: Record<string, unknown>,
    callOptions: AsyncCallOptions = {},
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

    const transport = ensureTransport();
    const promise = new Promise<unknown>((resolve, reject) => {
      let cleanupAbort: (() => void) | undefined;
      if (callOptions.signal) {
        const onAbort = () => cancel(requestId);
        callOptions.signal.addEventListener('abort', onAbort, { once: true });
        cleanupAbort = () => callOptions.signal?.removeEventListener('abort', onAbort);
      }

      pending.set(requestId, {
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

    async lookupStrategy(_context, callOptions = {}): Promise<EngineResponse<StrategyLookupResult>> {
      const requestId = callOptions.requestId ?? nextRequestId('strategy');
      return makeFailure(
        requestId,
        'deferred_to_strategy_slice',
        'Strategy baseline and provider lookup are deferred to the Strategy slice',
      );
    },

    async generateTrainingDrill(_request, callOptions = {}): Promise<EngineResponse<TrainingDrillResult>> {
      const requestId = callOptions.requestId ?? nextRequestId('training');
      return makeFailure(
        requestId,
        'deferred_to_training_slice',
        'Training drill generation is deferred to the Training slice',
      );
    },

    async gradeTrainingAnswer(_input, callOptions = {}): Promise<EngineResponse<TrainingGradeResult>> {
      const requestId = callOptions.requestId ?? nextRequestId('grade');
      return makeFailure(
        requestId,
        'deferred_to_training_slice',
        'Training answer grading is deferred to the Training slice',
      );
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
