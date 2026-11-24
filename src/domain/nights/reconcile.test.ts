import { describe, expect, it } from 'vitest';
import { createEngineClient } from '../../engine-api';
import { createMemoryStudyBackend, createStudyRepository } from '../storage';
import { createNightsStore } from './nightsStore';

describe('nightsStore reconcileDiscrepancy', () => {
  it('reconciles cash-out imbalance via assign_player and split_even using append-only corrections', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createNightsStore({ engine, repository: repo });

    const created = await store.createNight({
      title: 'Reconcile Test',
      unitPreset: 'chips',
      players: [
        { displayName: 'Avi', initialBuyInInput: '50' },
        { displayName: 'Ben', initialBuyInInput: '50' },
      ],
    });
    expect(created).not.toBeNull();

    const night1 = store.activeNightSignal.value!;
    const aviId = night1.session.participants[0]!.playerId;
    const benId = night1.session.participants[1]!.playerId;

    // Total in = 100, cash out 60 + 30 = 90 (10 short)
    await store.cashOutPlayer(aviId, '60');
    await store.cashOutPlayer(benId, '30');
    const r1 = store.settleReadinessSignal.value;
    expect(r1?.ok).toBe(false);
    if (!r1 || r1.ok) return;
    expect(r1.reason).not.toBe('pending_cashout');

    const okAssign = await store.reconcileDiscrepancy('assign_player', aviId);
    expect(okAssign).toBe(true);
    expect(store.settleReadinessSignal.value?.ok).toBe(true);
    expect(store.activeAccountingSignal.value?.totalInMinor).toBe(
      store.activeAccountingSignal.value?.totalOutMinor,
    );

    // Create second imbalance: re-cash-out Ben to 20 (10 short again), then split_even
    await store.cashOutPlayer(benId, '20');
    const r2 = store.settleReadinessSignal.value;
    expect(r2?.ok).toBe(false);
    if (!r2 || r2.ok) return;
    expect(r2.reason).not.toBe('pending_cashout');

    const okSplit = await store.reconcileDiscrepancy('split_even');
    expect(okSplit).toBe(true);
    expect(store.settleReadinessSignal.value?.ok).toBe(true);
    expect(store.activeAccountingSignal.value?.totalInMinor).toBe(
      store.activeAccountingSignal.value?.totalOutMinor,
    );

    store.dispose();
    engine.dispose();
  });
});
