import type {
  DcfrParams,
  RiverSubgameSpec,
  SolvedNodeInspection,
  SolvedRootActionSummary,
  TurnSubgameSpec,
} from '../../engine';
import {
  createSolverWorkerRuntime,
  type SolverWorkerRequest,
  type SolverWorkerResponse,
} from './solver.worker';

export interface SolverProgressSnapshot {
  readonly iteration: number;
  readonly maxIterations: number;
  readonly elapsedMs: number;
  readonly exploitabilityPctPot: number | null;
  readonly rootInspection: SolvedNodeInspection | null;
}

export interface SolverCompletionResult {
  readonly stopReason: 'converged' | 'max_iterations' | 'cancelled';
  readonly iteration: number;
  readonly elapsedMs: number;
  readonly oopEvBb: number;
  readonly ipEvBb: number;
  readonly exploitabilityPctPot: number | null;
  readonly rootInspection: SolvedNodeInspection | null;
  readonly turnRootActions?: readonly SolvedRootActionSummary[];
  readonly riverCardsEvaluated?: number;
}

export interface SolverClient {
  startRiverSolve(
    spec: RiverSubgameSpec,
    options?: {
      readonly params?: Partial<DcfrParams>;
      readonly targetExploitabilityPct?: number;
      readonly onProgress?: (progress: SolverProgressSnapshot) => void;
    },
  ): Promise<SolverCompletionResult>;
  startTurnSolve(
    spec: TurnSubgameSpec,
    options?: {
      readonly params?: Partial<DcfrParams>;
      readonly onProgress?: (progress: SolverProgressSnapshot) => void;
    },
  ): Promise<SolverCompletionResult>;
  inspectNode(nodeId: number): Promise<SolvedNodeInspection | null>;
  cancel(): void;
  terminate(): void;
}

export function createSolverClient(): SolverClient {
  let worker: Worker | null = null;
  let inlineRuntime: ReturnType<typeof createSolverWorkerRuntime> | null = null;
  let seq = 0;
  let activeRunId: string | null = null;
  let activeResolve: ((res: SolverCompletionResult) => void) | null = null;
  let activeReject: ((err: Error) => void) | null = null;
  let activeProgressCb: ((p: SolverProgressSnapshot) => void) | undefined;
  const inspectResolvers = new Map<string, (ins: SolvedNodeInspection | null) => void>();

  function onMessage(msg: SolverWorkerResponse): void {
    if (msg.type === 'solver/inspect_result') {
      const res = inspectResolvers.get(msg.requestId);
      if (res) {
        inspectResolvers.delete(msg.requestId);
        res(msg.inspection);
      }
      return;
    }

    if (msg.requestId !== activeRunId) return;

    if (msg.type === 'solver/progress') {
      activeProgressCb?.({
        iteration: msg.iteration,
        maxIterations: msg.maxIterations,
        elapsedMs: msg.elapsedMs,
        exploitabilityPctPot: msg.exploitabilityPctPot,
        rootInspection: msg.rootInspection,
      });
      return;
    }

    if (msg.type === 'solver/result') {
      const resolve = activeResolve;
      activeRunId = null;
      activeResolve = null;
      activeReject = null;
      activeProgressCb = undefined;
      resolve?.({
        stopReason: msg.stopReason,
        iteration: msg.iteration,
        elapsedMs: msg.elapsedMs,
        oopEvBb: msg.oopEvBb,
        ipEvBb: msg.ipEvBb,
        exploitabilityPctPot: msg.exploitabilityPctPot,
        rootInspection: msg.rootInspection,
        turnRootActions: msg.turnRootActions,
        riverCardsEvaluated: msg.riverCardsEvaluated,
      });
      return;
    }

    if (msg.type === 'solver/error') {
      const reject = activeReject;
      activeRunId = null;
      activeResolve = null;
      activeReject = null;
      activeProgressCb = undefined;
      reject?.(new Error(`${msg.code}: ${msg.message}`));
    }
  }

  function dispatch(req: SolverWorkerRequest): void {
    if (typeof Worker !== 'undefined') {
      if (!worker) {
        worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<SolverWorkerResponse>) => onMessage(event.data);
      }
      worker.postMessage(req);
      return;
    }
    if (!inlineRuntime) {
      inlineRuntime = createSolverWorkerRuntime((msg) => onMessage(msg));
    }
    inlineRuntime.handleMessage(req);
  }

  function startSolve(
    reqWithoutId:
      | Omit<Extract<SolverWorkerRequest, { type: 'solver/start'; street: 'river' }>, 'requestId'>
      | Omit<Extract<SolverWorkerRequest, { type: 'solver/start'; street: 'turn' }>, 'requestId'>,
    onProgress?: (progress: SolverProgressSnapshot) => void,
  ): Promise<SolverCompletionResult> {
    if (activeRunId) {
      dispatch({ type: 'solver/cancel', requestId: activeRunId });
    }
    seq += 1;
    const requestId = `solve-${seq}`;
    activeRunId = requestId;
    activeProgressCb = onProgress;
    return new Promise<SolverCompletionResult>((resolve, reject) => {
      activeResolve = resolve;
      activeReject = reject;
      dispatch({ ...reqWithoutId, requestId } as SolverWorkerRequest);
    });
  }

  return {
    startRiverSolve(spec, options) {
      return startSolve(
        {
          type: 'solver/start',
          street: 'river',
          spec,
          params: options?.params,
          targetExploitabilityPct: options?.targetExploitabilityPct,
        },
        options?.onProgress,
      );
    },
    startTurnSolve(spec, options) {
      return startSolve(
        {
          type: 'solver/start',
          street: 'turn',
          spec,
          params: options?.params,
        },
        options?.onProgress,
      );
    },
    inspectNode(nodeId) {
      seq += 1;
      const requestId = `inspect-${seq}`;
      return new Promise<SolvedNodeInspection | null>((resolve) => {
        inspectResolvers.set(requestId, resolve);
        dispatch({ type: 'solver/inspect', requestId, nodeId });
      });
    },
    cancel() {
      if (activeRunId) {
        dispatch({ type: 'solver/cancel', requestId: activeRunId });
      }
    },
    terminate() {
      if (worker) {
        worker.terminate();
        worker = null;
      }
      activeRunId = null;
      activeResolve = null;
      activeReject = null;
    },
  };
}

let sharedSolverClient: SolverClient | null = null;

export function getSharedSolverClient(): SolverClient {
  if (!sharedSolverClient) {
    sharedSolverClient = createSolverClient();
  }
  return sharedSolverClient;
}
