import {
  type AbortControllerLike,
  type AbortSignalLike,
  calculateEquity,
  type CalculateEquityOptions,
  createEquityFailure,
  EQUITY_ERROR_CODES,
  type EquityOutcome,
  type EquityRequestInput,
  estimateEquityCombinations,
} from './equity';
import { deepFreeze } from './freeze';
import {
  exploreRunouts,
  type ExploreRunoutsOptions,
  rangeStandingFacts,
  type RangeStandingFacts,
  type RunoutExplorerOutcome,
} from './runout-explorer';
import type { PokerState } from './schema';
import { resolveShowdown } from './showdown';
import {
  calculateWeightedEquity,
  type CalculateWeightedEquityOptions,
  estimateWeightedEquity,
  type WeightedEquityOutcome,
  type WeightedEquityRequestInput,
} from './weighted-equity';

export const EQUITY_WORKER_MESSAGES = Object.freeze({
  CALCULATE: 'equity/calculate',
  CANCEL: 'equity/cancel',
  ENGINE_CANCEL: 'engine/cancel',
  SHOWDOWN_RESOLVE: 'showdown/resolve',
  PROGRESS: 'equity/progress',
  RESULT: 'equity/result',
} as const);

export interface WeightedEquityWithPresentation extends Readonly<Record<string, unknown>> {
  readonly presentation: {
    readonly schemaVersion: 'weighted-equity-presentation/v1';
    readonly currentStanding: RangeStandingFacts | null;
  };
}

export interface RunoutRequestEnvelope {
  readonly schemaVersion: 'runout-request/v1';
  readonly request: WeightedEquityRequestInput | EquityRequestInput;
  readonly options?: ExploreRunoutsOptions;
}

export type DispatchableEquityRequest =
  | EquityRequestInput
  | WeightedEquityRequestInput
  | RunoutRequestEnvelope;

export type DispatchEquityOptions = CalculateEquityOptions &
  CalculateWeightedEquityOptions &
  ExploreRunoutsOptions;

export type DispatchedEquityResult =
  | EquityOutcome
  | (WeightedEquityOutcome & {
      readonly presentation?: {
        readonly schemaVersion: 'weighted-equity-presentation/v1';
        readonly currentStanding: RangeStandingFacts | null;
      };
    })
  | RunoutExplorerOutcome;

export function calculateEquityRequest(
  request: DispatchableEquityRequest,
  options: DispatchEquityOptions = {},
): Promise<DispatchedEquityResult> {
  if (request && typeof request === 'object' && request.schemaVersion === 'runout-request/v1') {
    const runoutReq = request as RunoutRequestEnvelope;
    const progressCb = options.onProgress;
    return exploreRunouts(runoutReq.request, {
      ...runoutReq.options,
      ...options,
      ...(progressCb
        ? {
            onCardProgress: (completed: number, total: number) =>
              progressCb({
                completed,
                total,
                fraction: total > 0 ? completed / total : 1,
              }),
          }
        : {}),
    });
  }
  if (
    request &&
    typeof request === 'object' &&
    request.schemaVersion === 'weighted-equity-request/v1'
  ) {
    return calculateWeightedEquity(request, options).then((result) =>
      deepFreeze({
        ...result,
        presentation: {
          schemaVersion: 'weighted-equity-presentation/v1' as const,
          currentStanding:
            result.reason === null && result.players.length
              ? rangeStandingFacts(result.recipe)
              : null,
        },
      }),
    );
  }
  return calculateEquity(request, options);
}

export function estimateEquityRequest(request: unknown) {
  if (
    request &&
    typeof request === 'object' &&
    (request as { schemaVersion?: unknown }).schemaVersion === 'runout-request/v1'
  ) {
    return { ok: false as const };
  }
  if (
    request &&
    typeof request === 'object' &&
    (request as { schemaVersion?: unknown }).schemaVersion === 'weighted-equity-request/v1'
  ) {
    return estimateWeightedEquity(request);
  }
  return estimateEquityCombinations(request);
}

class PureEngineAbortController implements AbortControllerLike {
  private readonly signalState: { aborted: boolean } = { aborted: false };
  get signal(): AbortSignalLike {
    return this.signalState;
  }
  abort(): void {
    this.signalState.aborted = true;
  }
}

export interface EquityWorkerMessagePayload {
  readonly type: string;
  readonly requestId?: string | null;
  readonly request?: DispatchableEquityRequest;
  readonly options?: DispatchEquityOptions;
  readonly reportProgress?: boolean;
  readonly state?: PokerState;
}

export interface EquityWorkerMessageHandlerOptions {
  readonly postMessage: (message: unknown) => void;
  readonly calculate?: (
    request: DispatchableEquityRequest,
    options?: DispatchEquityOptions,
  ) => Promise<unknown>;
  readonly AbortControllerClass?: new () => AbortControllerLike;
}

export function createEquityWorkerMessageHandler(
  options: EquityWorkerMessageHandlerOptions,
): (eventOrData: unknown) => Promise<void> {
  if (!options || typeof options.postMessage !== 'function') {
    throw new TypeError('postMessage is required');
  }
  const {
    postMessage,
    calculate = calculateEquityRequest,
    AbortControllerClass = PureEngineAbortController,
  } = options;
  const active = new Map<string, AbortControllerLike>();

  return async function handleEquityWorkerMessage(eventOrData: unknown): Promise<void> {
    const raw =
      eventOrData && typeof eventOrData === 'object' && 'data' in eventOrData
        ? (eventOrData as { data: unknown }).data
        : eventOrData;
    if (!raw || typeof raw !== 'object') return;
    const message = raw as EquityWorkerMessagePayload;

    if (
      message.type === EQUITY_WORKER_MESSAGES.CANCEL ||
      message.type === EQUITY_WORKER_MESSAGES.ENGINE_CANCEL
    ) {
      if (typeof message.requestId === 'string') {
        active.get(message.requestId)?.abort();
      }
      return;
    }
    if (message.type === EQUITY_WORKER_MESSAGES.SHOWDOWN_RESOLVE) {
      const requestId = message.requestId;
      if (typeof requestId !== 'string' || !requestId) {
        postMessage({
          type: EQUITY_WORKER_MESSAGES.RESULT,
          requestId: requestId ?? null,
          result: createEquityFailure(
            EQUITY_ERROR_CODES.INVALID_REQUEST,
            'Worker requestId must be a non-empty string',
          ),
        });
        return;
      }
      try {
        const result = resolveShowdown(message.state as PokerState);
        postMessage({ type: EQUITY_WORKER_MESSAGES.RESULT, requestId, result });
      } catch (error) {
        postMessage({
          type: EQUITY_WORKER_MESSAGES.RESULT,
          requestId,
          result: createEquityFailure(
            EQUITY_ERROR_CODES.INTERNAL_ERROR,
            error instanceof Error ? error.message : String(error),
          ),
        });
      }
      return;
    }
    if (message.type !== EQUITY_WORKER_MESSAGES.CALCULATE) return;

    const requestId = message.requestId;
    if (typeof requestId !== 'string' || !requestId) {
      postMessage({
        type: EQUITY_WORKER_MESSAGES.RESULT,
        requestId: requestId ?? null,
        result: createEquityFailure(
          EQUITY_ERROR_CODES.INVALID_REQUEST,
          'Worker requestId must be a non-empty string',
        ),
      });
      return;
    }

    active.get(requestId)?.abort();
    const abortController = new AbortControllerClass();
    active.set(requestId, abortController);
    try {
      const shouldReportProgress = message.reportProgress !== false;
      let lastProgressAt = 0;
      const onProgress = shouldReportProgress
        ? (progress: { readonly completed: number; readonly total: number; readonly fraction?: number }) => {
            const now = Date.now();
            const isTerminal =
              progress.completed === 0 ||
              progress.fraction === 1 ||
              (progress.total > 0 && progress.completed >= progress.total);
            if (!isTerminal && now - lastProgressAt < 50) return;
            lastProgressAt = now;
            postMessage({
              type: EQUITY_WORKER_MESSAGES.PROGRESS,
              requestId,
              progress,
            });
          }
        : null;
      const result = await calculate(message.request as DispatchableEquityRequest, {
        ...(message.options ?? {}),
        signal: abortController.signal,
        ...(onProgress ? { onProgress } : { onProgress: null }),
      });
      postMessage({ type: EQUITY_WORKER_MESSAGES.RESULT, requestId, result });
    } catch (error) {
      postMessage({
        type: EQUITY_WORKER_MESSAGES.RESULT,
        requestId,
        result: createEquityFailure(
          EQUITY_ERROR_CODES.INTERNAL_ERROR,
          error instanceof Error ? error.message : String(error),
        ),
      });
    } finally {
      if (active.get(requestId) === abortController) active.delete(requestId);
    }
  };
}

export interface WorkerScopeLike {
  postMessage: (message: unknown) => void;
  onmessage: ((event: unknown) => unknown) | null;
}

export function installEquityWorkerRuntime(workerScope: WorkerScopeLike | null | undefined) {
  if (!workerScope || typeof workerScope.postMessage !== 'function') return null;
  const handler = createEquityWorkerMessageHandler({
    postMessage: (message) => workerScope.postMessage(message),
  });
  workerScope.onmessage = handler;
  return Object.freeze({ handler });
}
