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
    expect(savedHand?.payload.unitLabel).toBe('bb');
    expect(store.activeNightSignal.value?.linkedHands).toHaveLength(1);
    expect(store.activeNightSignal.value?.linkedHands[0]?.handObjectId).toBe(savedHand!.objectId);

    const allHands = await repo.listSavedHands();
    expect(allHands).toHaveLength(1);
    store.dispose();
  });

  it('captures quick hands with custom hero cards, 8 seats, custom hero seat, 40 bb stack, and hand note', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createNightsStore({ repository: repo });

    const ilsNight = await store.createNight({
      title: 'Friday ILS',
      unitPreset: 'ils',
      players: [
        { displayName: 'Eli', initialBuyInInput: '200' },
        { displayName: 'Dan', initialBuyInInput: '200' },
      ],
    });
    expect(store.handSeatCountSignal.value).toBe(6);
    expect(store.handStartingStackBbSignal.value).toBe(50);

    const bigChipsNight = await store.createNight({
      title: 'Saturday 8-Max',
      unitPreset: 'chips',
      players: [
        { displayName: 'P1', initialBuyInInput: '200' },
        { displayName: 'P2', initialBuyInInput: '200' },
        { displayName: 'P3', initialBuyInInput: '200' },
        { displayName: 'P4', initialBuyInInput: '200' },
        { displayName: 'P5', initialBuyInInput: '200' },
        { displayName: 'P6', initialBuyInInput: '200' },
        { displayName: 'P7', initialBuyInInput: '200' },
      ],
    });
    expect(store.handSeatCountSignal.value).toBe(8);
    expect(store.handStartingStackBbSignal.value).toBe(100);

    // Switching back updates defaults automatically when untouched
    store.selectNight(ilsNight!.session.sessionId);
    expect(store.handSeatCountSignal.value).toBe(6);
    expect(store.handStartingStackBbSignal.value).toBe(50);

    // Avoid duplicate cards across hero slots
    store.setHandHeroCard(0, 'Qh');
    store.setHandHeroCard(0, 'Kd'); // matches slot 1 -> ignored cleanly
    expect(store.handHeroCardsSignal.value).toEqual(['Qh', 'Kd']);
    store.setHandHeroCard(1, 'Qs');
    expect(store.handHeroCardsSignal.value).toEqual(['Qh', 'Qs']);

    // Seat count + hero seat clamping
    store.setHandSeatCount(8);
    const coSeat8 = store.handSeatPositionsSignal.value.find((p) => p.position === 'CO')!.seatIndex;
    expect(coSeat8).toBe(7);
    store.setHandHeroSeatIndex(coSeat8);
    expect(store.handHeroSeatIndexSignal.value).toBe(7);

    store.setHandSeatCount(6);
    expect(store.handHeroSeatIndexSignal.value).toBe(5);

    // Switch back to 8 seats, pick UTG+1, 40 bb, shorthand line, and hand note
    store.setHandSeatCount(8);
    const utg1Seat = store.handSeatPositionsSignal.value.find((p) => p.position === 'UTG+1')!.seatIndex;
    store.setHandHeroSeatIndex(utg1Seat);
    store.setHandStartingStackBb(40);
    store.setHandShorthandInput('utg+1 r12 lj f hj f co f btn f sb f bb c / 9h 4c 2d');
    store.setHandNoteDraft('  Tight regular flats out of BB  ');

    expect(store.shorthandPreviewSignal.value.valid).toBe(true);
    const saved = await store.saveQuickShorthandHand();
    expect(saved).not.toBeNull();
    expect(saved?.payload.heroCards).toEqual(['Qh', 'Qs']);
    expect(saved?.payload.seatCount).toBe(8);
    expect(saved?.payload.heroSeat).toBe(utg1Seat);
    expect(saved?.payload.heroPositionLabel).toBe('UTG+1');
    expect(saved?.payload.startingStackBb).toBe(40);
    expect(saved?.payload.handNote).toBe('Tight regular flats out of BB');
    expect(store.handNoteDraftSignal.value).toBe('');
    expect(store.handShorthandInputSignal.value).toBe('');

    // Verify persistence in a fresh hydrated store (including 8-seat auto default for bigChipsNight)
    const freshStore = createNightsStore({ repository: repo });
    freshStore.selectNight(bigChipsNight!.session.sessionId);
    await freshStore.hydrate();
    expect(freshStore.handSeatCountSignal.value).toBe(8);
    expect(freshStore.savedHandsByIdSignal.value[saved!.objectId]?.payload.handNote).toBe(
      'Tight regular flats out of BB',
    );
    expect(freshStore.savedHandsByIdSignal.value[saved!.objectId]?.payload.startingStackBb).toBe(40);
    expect(freshStore.savedHandsByIdSignal.value[saved!.objectId]?.payload.heroCards).toEqual([
      'Qh',
      'Qs',
    ]);
    store.dispose();
    freshStore.dispose();
  });

  it('persists session notes on active nights and ignores edits once settled', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createNightsStore({ repository: repo });

    const created = await store.createNight({
      title: 'Notes Night',
      unitPreset: 'chips',
      players: [
        { displayName: 'Eli', initialBuyInInput: '100' },
        { displayName: 'Dan', initialBuyInInput: '100' },
      ],
    });
    const eliId = created!.session.participants[0]!.playerId;
    const danId = created!.session.participants[1]!.playerId;

    await store.updateActiveNightNote('1/2 game, straddle allowed');
    expect(store.activeNightSignal.value?.sessionNote).toBe('1/2 game, straddle allowed');

    const freshStore = createNightsStore({ repository: repo });
    await freshStore.hydrate();
    expect(freshStore.activeNightSignal.value?.sessionNote).toBe('1/2 game, straddle allowed');
    freshStore.dispose();

    await store.cashOutPlayer(eliId, '140');
    await store.cashOutPlayer(danId, '60');
    expect(await store.settleActiveNight()).toBe(true);

    await store.updateActiveNightNote('Should be ignored when settled');
    expect(store.activeNightSignal.value?.sessionNote).toBe('1/2 game, straddle allowed');
    store.dispose();
  });
});
