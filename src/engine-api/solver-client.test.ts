import { describe, expect, it } from 'vitest';
import { expandHandClassesToComboMap } from '../../engine';
import { createSolverClient } from './solver-client';

describe('Dedicated SolverClient & Worker Runtime', () => {
  it('solves a river subgame, streams progress, inspects child nodes, and supports cancel', async () => {
    const client = createSolverClient();
    const board = ['Ks', 'Qd', '7c', '2h', '4s'] as const;
    const oopRangeByCombo = expandHandClassesToComboMap(['QQ', 'JJ', 'TT', 'AQo', 'KJs']);
    const ipRangeByCombo = expandHandClassesToComboMap(['KK', 'AA', 'AKs', 'QJs', '98s']);

    let progressSeen = 0;
    const res = await client.startRiverSolve(
      {
        spotId: 'client-river-test',
        board,
        potBb: 18,
        effectiveStackBb: 40,
        oopRangeByCombo,
        ipRangeByCombo,
        betMenu: { betPcts: [0.5, 1.0], raisePcts: [0.75], raiseCap: 1, includeAllIn: true },
      },
      {
        params: { iterations: 120 },
        onProgress() {
          progressSeen += 1;
        },
      },
    );

    expect(res.stopReason === 'converged' || res.stopReason === 'max_iterations').toBe(true);
    expect(res.rootInspection).not.toBeNull();
    expect(progressSeen).toBeGreaterThanOrEqual(0);

    const checkAction = res.rootInspection!.actions.find((a) => !a.isTerminal);
    expect(checkAction).toBeDefined();
    const child = await client.inspectNode(checkAction!.nextNodeId);
    expect(child).not.toBeNull();
    expect(child!.player).toBe(1);

    // Cooperative cancel test
    const cancelPromise = client.startRiverSolve(
      {
        spotId: 'client-cancel-test',
        board,
        potBb: 18,
        effectiveStackBb: 40,
        oopRangeByCombo,
        ipRangeByCombo,
        betMenu: { betPcts: [0.5, 1.0], raisePcts: [0.75], raiseCap: 1, includeAllIn: true },
      },
      { params: { iterations: 5000 }, targetExploitabilityPct: 0.0001 },
    );
    client.cancel();
    const cancelRes = await cancelPromise;
    expect(cancelRes.stopReason).toBe('cancelled');
  });
});
