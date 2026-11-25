import {
  createRiverSolverSession,
  createTurnSolverSession,
  estimateSubgameMemoryBytes,
  inspectRiverNode,
  MAX_SOLVER_MEMORY_BYTES,
  type DcfrParams,
  type RiverSolverSession,
  type RiverSubgameSpec,
  type SolvedNodeInspection,
  type SolvedRootActionSummary,
  type TurnSubgameSpec,
} from '../../engine';

export type SolverWorkerRequest =
  | {
      readonly type: 'solver/start';
      readonly requestId: string;
      readonly street: 'river';
      readonly spec: RiverSubgameSpec;
      readonly params?: Partial<DcfrParams>;
      readonly targetExploitabilityPct?: number;
    }
  | {
      readonly type: 'solver/start';
      readonly requestId: string;
      readonly street: 'turn';
      readonly spec: TurnSubgameSpec;
      readonly params?: Partial<DcfrParams>;
    }
  | {
      readonly type: 'solver/inspect';
      readonly requestId: string;
      readonly nodeId: number;
    }
  | {
      readonly type: 'solver/cancel';
      readonly requestId: string;
    };

export type SolverWorkerResponse =
  | {
      readonly type: 'solver/progress';
      readonly requestId: string;
      readonly iteration: number;
      readonly maxIterations: number;
      readonly elapsedMs: number;
      readonly exploitabilityPctPot: number | null;
      readonly rootInspection: SolvedNodeInspection | null;
    }
  | {
      readonly type: 'solver/result';
      readonly requestId: string;
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
  | {
      readonly type: 'solver/inspect_result';
      readonly requestId: string;
      readonly inspection: SolvedNodeInspection | null;
    }
  | {
      readonly type: 'solver/error';
      readonly requestId: string;
      readonly code: 'over_memory' | 'bad_spec' | 'internal';
      readonly message: string;
    };

export function createSolverWorkerRuntime(post: (msg: SolverWorkerResponse) => void) {
  let activeRequestId: string | null = null;
  let cancelledRequestId: string | null = null;
  let activeRiverSession: RiverSolverSession | null = null;

  function handleMessage(msg: SolverWorkerRequest): void {
    if (msg.type === 'solver/cancel') {
      if (activeRequestId === msg.requestId) {
        cancelledRequestId = msg.requestId;
      }
      return;
    }

    if (msg.type === 'solver/inspect') {
      if (!activeRiverSession) {
        post({ type: 'solver/inspect_result', requestId: msg.requestId, inspection: null });
        return;
      }
      try {
        const inspection = inspectRiverNode(activeRiverSession.getInternalState(), msg.nodeId);
        post({ type: 'solver/inspect_result', requestId: msg.requestId, inspection });
      } catch {
        post({ type: 'solver/inspect_result', requestId: msg.requestId, inspection: null });
      }
      return;
    }

    // solver/start
    activeRequestId = msg.requestId;
    cancelledRequestId = null;
    activeRiverSession = null;

    const startMs = Date.now();
    try {
      if (msg.street === 'river') {
        const mem = estimateSubgameMemoryBytes({
          potBb: msg.spec.potBb,
          effectiveStackBb: msg.spec.effectiveStackBb,
          oopRangeByCombo: msg.spec.oopRangeByCombo,
          ipRangeByCombo: msg.spec.ipRangeByCombo,
          betMenu: msg.spec.betMenu,
          riverCardCount: 1,
        });
        if (mem > MAX_SOLVER_MEMORY_BYTES) {
          post({
            type: 'solver/error',
            requestId: msg.requestId,
            code: 'over_memory',
            message: `Estimated memory ${Math.round(mem / (1024 * 1024))} MiB exceeds 256 MiB cap`,
          });
          return;
        }
        const params: DcfrParams = {
          alpha: msg.params?.alpha ?? 1.5,
          beta: msg.params?.beta ?? 0,
          gamma: msg.params?.gamma ?? 2,
          iterations: msg.params?.iterations ?? 300,
        };
        const targetExploit = msg.targetExploitabilityPct ?? 0.25;
        const session = createRiverSolverSession(msg.spec, params);
        activeRiverSession = session;

        const runChunk = () => {
          if (activeRequestId !== msg.requestId) return;
          if (cancelledRequestId === msg.requestId) {
            const internal = session.getInternalState();
            const br = session.computeExploitability();
            post({
              type: 'solver/result',
              requestId: msg.requestId,
              stopReason: 'cancelled',
              iteration: session.getIteration(),
              elapsedMs: Date.now() - startMs,
              oopEvBb: Math.round(br.oopEvBb * 1000) / 1000,
              ipEvBb: Math.round(br.ipEvBb * 1000) / 1000,
              exploitabilityPctPot: Math.round(br.exploitabilityPctPot * 1000) / 1000,
              rootInspection: inspectRiverNode(internal, 0),
            });
            return;
          }

          const chunkStart = Date.now();
          while (session.getIteration() < params.iterations && Date.now() - chunkStart < 12) {
            session.stepIterations(10);
          }

          const internal = session.getInternalState();
          const br = session.computeExploitability();
          const exploitPct = Math.round(br.exploitabilityPctPot * 1000) / 1000;
          const rootInspection = inspectRiverNode(internal, 0);

          if (session.getIteration() >= params.iterations || exploitPct <= targetExploit) {
            post({
              type: 'solver/result',
              requestId: msg.requestId,
              stopReason: exploitPct <= targetExploit ? 'converged' : 'max_iterations',
              iteration: session.getIteration(),
              elapsedMs: Date.now() - startMs,
              oopEvBb: Math.round(br.oopEvBb * 1000) / 1000,
              ipEvBb: Math.round(br.ipEvBb * 1000) / 1000,
              exploitabilityPctPot: exploitPct,
              rootInspection,
            });
            return;
          }

          post({
            type: 'solver/progress',
            requestId: msg.requestId,
            iteration: session.getIteration(),
            maxIterations: params.iterations,
            elapsedMs: Date.now() - startMs,
            exploitabilityPctPot: exploitPct,
            rootInspection,
          });
          setTimeout(runChunk, 0);
        };

        setTimeout(runChunk, 0);
      } else {
        const params: DcfrParams = {
          alpha: msg.params?.alpha ?? 1.5,
          beta: msg.params?.beta ?? 0,
          gamma: msg.params?.gamma ?? 2,
          iterations: msg.params?.iterations ?? 60,
        };
        const session = createTurnSolverSession(msg.spec, params);

        const runTurnChunk = () => {
          if (activeRequestId !== msg.requestId) return;
          if (cancelledRequestId === msg.requestId) {
            const sum = session.getSummary();
            post({
              type: 'solver/result',
              requestId: msg.requestId,
              stopReason: 'cancelled',
              iteration: session.getIteration(),
              elapsedMs: Date.now() - startMs,
              oopEvBb: sum.oopEvBb,
              ipEvBb: sum.ipEvBb,
              exploitabilityPctPot: sum.exploitabilityPctPot,
              rootInspection: null,
              turnRootActions: sum.turnRootActions,
              riverCardsEvaluated: sum.riverCardsEvaluated,
            });
            return;
          }

          const chunkStart = Date.now();
          while (session.getIteration() < params.iterations && Date.now() - chunkStart < 12) {
            session.stepIterations(5);
          }

          const sum = session.getSummary();
          if (session.getIteration() >= params.iterations) {
            post({
              type: 'solver/result',
              requestId: msg.requestId,
              stopReason: 'max_iterations',
              iteration: session.getIteration(),
              elapsedMs: Date.now() - startMs,
              oopEvBb: sum.oopEvBb,
              ipEvBb: sum.ipEvBb,
              exploitabilityPctPot: sum.exploitabilityPctPot,
              rootInspection: null,
              turnRootActions: sum.turnRootActions,
              riverCardsEvaluated: sum.riverCardsEvaluated,
            });
            return;
          }

          post({
            type: 'solver/progress',
            requestId: msg.requestId,
            iteration: session.getIteration(),
            maxIterations: params.iterations,
            elapsedMs: Date.now() - startMs,
            exploitabilityPctPot: sum.exploitabilityPctPot,
            rootInspection: null,
          });
          setTimeout(runTurnChunk, 0);
        };

        setTimeout(runTurnChunk, 0);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = message.startsWith('over_memory') ? 'over_memory' : 'bad_spec';
      post({ type: 'solver/error', requestId: msg.requestId, code, message });
    }
  }

  return { handleMessage };
}

if (typeof self !== 'undefined' && typeof (self as unknown as { postMessage?: unknown }).postMessage === 'function') {
  const runtime = createSolverWorkerRuntime((msg) => {
    (self as unknown as { postMessage: (m: SolverWorkerResponse) => void }).postMessage(msg);
  });
  self.onmessage = (event: MessageEvent<SolverWorkerRequest>) => {
    runtime.handleMessage(event.data);
  };
}
