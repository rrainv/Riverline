import { installEquityWorkerRuntime, type WorkerScopeLike } from '../../engine/index';

export const engineWorkerRuntime =
  typeof self !== 'undefined'
    ? installEquityWorkerRuntime(self as unknown as WorkerScopeLike)
    : null;
