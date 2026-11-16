import { describe, expect, it } from 'vitest';
import { createMemoryStudyBackend, createStudyRepository } from '../storage';
import { createNightsStore } from './nightsStore';

describe('src/domain/nights/nightsStore', () => {
  it('runs a full chips night: create, rebuy, append-only correct/restore, cash-out gate, settle, reopen', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createNightsStore({ repository: repo });

    const created = await store.createNight({
      title: 'Thursday Chips',
      unitPreset: 'chips',
      players: [
        { displayName: 'Eli', initialBuyInInput: '200' },
        { displayName: 'Dan', initialBuyInInput: '200' },
        { displayName: 'Noa', initialBuyInInput: '200' },
      ],
    });
    expect(created).not.toBeNull();
    expect(created?.session.currency.unitPreset).toBe('chips');
    expect(store.activeAccountingSignal.value?.totalInMinor).toBe(600);
    expect(store.settleReadinessSignal.value?.ok).toBe(false);

    const eliId = created!.session.participants[0]!.playerId;
    const danId = created!.session.participants[1]!.playerId;
    const noaId = created!.session.participants[2]!.playerId;

    // Rebuy for Dan (+100) then correct and restore it
    expect(await store.addRebuy(danId, 100)).toBe(true);
    expect(store.activeAccountingSignal.value?.totalInMinor).toBe(700);
    const rebuyTx = store.ledgerHistorySignal.value.find(
      (item) => item.original.playerId === danId && item.original.type === 'rebuy',
    );
    expect(rebuyTx).toBeDefined();

    expect(await store.correctLedgerEntry(rebuyTx!.original.transactionId)).toBe(true);
    expect(store.activeAccountingSignal.value?.totalInMinor).toBe(600);

    expect(await store.restoreLedgerEntry(rebuyTx!.original.transactionId)).toBe(true);
    expect(store.activeAccountingSignal.value?.totalInMinor).toBe(700);

    // Cash out Eli (350) and Dan (250) -> 100 still on table for Noa
    expect(await store.cashOutPlayer(eliId, '350')).toBe(true);
    expect(await store.cashOutPlayer(danId, '250')).toBe(true);
    expect(store.remainingOnTableMinorSignal.value).toBe(100);

    // Open Noa's sheet -> last pending player auto-fills remaining 100
    store.openPlayerSheet(noaId, 'cash');
    expect(store.cashOutDraftTextSignal.value).toBe('100');

    // Intentional imbalance blocks settlement
    expect(await store.cashOutPlayer(noaId, '90')).toBe(true);
    expect(store.settleReadinessSignal.value?.ok).toBe(false);
    if (store.settleReadinessSignal.value && !store.settleReadinessSignal.value.ok) {
      expect(store.settleReadinessSignal.value.reason).toBe('more_in_than_out');
    }

    // Update Noa cash-out to 100 -> balanced & ready!
    expect(await store.cashOutPlayer(noaId, '100')).toBe(true);
    expect(store.settleReadinessSignal.value?.ok).toBe(true);
    expect(store.settlementSignal.value?.transfers).toEqual([
      { fromPlayerId: noaId, fromName: 'Noa', toPlayerId: eliId, toName: 'Eli', amountMinor: 100 },
      { fromPlayerId: danId, fromName: 'Dan', toPlayerId: eliId, toName: 'Eli', amountMinor: 50 },
    ]);

    // Settle and verify reopen unlocks edits cleanly
    expect(await store.settleActiveNight()).toBe(true);
    expect(store.activeNightSignal.value?.session.status).toBe('completed');
    expect(store.morningSummarySignal.value?.settled).toBe(true);

    expect(await store.reopenActiveNight()).toBe(true);
    expect(store.activeNightSignal.value?.session.status).toBe('active');
    store.dispose();
  });

  it('supports ILS decimal amounts and quick shorthand hand capture linked to the night', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createNightsStore({ repository: repo });

    const created = await store.createNight({
      title: "Friday at Dan's",
      unitPreset: 'ils',
      players: [
        { displayName: 'Eli', initialBuyInInput: '200' },
        { displayName: 'Dan', initialBuyInInput: '200' },
      ],
    });
    expect(created?.session.currency.minorUnit).toBe(2);

    store.setHandShorthandInput('btn r12 sb f bb c / Qh 7c 2h');
    expect(store.shorthandPreviewSignal.value.valid).toBe(true);
    expect(store.shorthandPreviewSignal.value.actionCount).toBe(6);
    expect(store.shorthandPreviewSignal.value.boardCardCount).toBe(3);

    const savedHand = await store.saveQuickShorthandHand();
    expect(savedHand).not.toBeNull();
    expect(savedHand?.payload.unitLabel).toBe('₪');
    expect(store.activeNightSignal.value?.linkedHands).toHaveLength(1);
    expect(store.activeNightSignal.value?.linkedHands[0]?.handObjectId).toBe(savedHand!.objectId);

    const allHands = await repo.listSavedHands();
    expect(allHands).toHaveLength(1);
    store.dispose();
  });
});
