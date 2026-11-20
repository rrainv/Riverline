import { describe, expect, it } from 'vitest';
import { createMemoryStudyBackend, createStudyRepository } from '../storage';
import { createEngineClient } from '../../engine-api';
import { createHandRecorderStore } from './handRecorderStore';

describe('handRecorderStore', () => {
  it('supports 6-max and home game 8-seat table presets cleanly from engine positions', () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createHandRecorderStore({ engine, repository: repo, autoLoadSaved: false });

    expect(store.tablePresetSignal.value).toBe('six_max_100bb');
    expect(store.seatCountSignal.value).toBe(6);
    expect(store.unitLabelSignal.value).toBe('bb');
    expect(store.handSnapshotSignal.value.availablePositions.map((p) => p.position)).toEqual([
      'BTN',
      'SB',
      'BB',
      'UTG',
      'HJ',
      'CO',
    ]);

    store.setTablePreset('home_game_50bb');
    store.setSeatCount(8);
    expect(store.unitLabelSignal.value).toBe('₪');
    expect(store.startingStackBbSignal.value).toBe(50);
    expect(store.handSnapshotSignal.value.availablePositions.map((p) => p.position)).toEqual([
      'BTN',
      'SB',
      'BB',
      'UTG',
      'UTG+1',
      'LJ',
      'HJ',
      'CO',
    ]);

    store.dispose();
    engine.dispose();
  });

  it('records actions with select-then-confirm, approximate sizing, flop HeatGrid, and undo', () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createHandRecorderStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
      initialPreset: 'raise',
    });

    // 'raise' preset folds UTG, HJ, CO to Hero BTN and highlights raise
    expect(store.handSnapshotSignal.value.pokerState.actingPlayerId).toBe('hero');
    expect(store.ladderOptionsSignal.value.length).toBe(3);

    store.setApproximateSize(true);
    expect(store.confirmTicketAction()).toBe(true);

    const lastHeroAction = store.handSnapshotSignal.value.recordedActions.find((a) => a.isHero);
    expect(lastHeroAction?.type).toBe('raise');
    expect(lastHeroAction?.approximate).toBe(true);

    // Fold SB, call BB -> enters deal_flop chance phase
    store.selectTicket('fold');
    expect(store.confirmTicketAction()).toBe(true);
    store.selectTicket('call');
    expect(store.confirmTicketAction()).toBe(true);
    expect(store.handSnapshotSignal.value.pokerState.phase).toBe('chance');

    // Stage 3 cards on HeatGrid and commit flop
    store.togglePendingBoardCard('Qh');
    store.togglePendingBoardCard('7c');
    store.togglePendingBoardCard('2h');
    expect(store.commitPendingBoardCards()).toBe(true);
    expect(store.handSnapshotSignal.value.pokerState.street).toBe('flop');
    expect(store.handSnapshotSignal.value.pokerState.board).toEqual(['Qh', '7c', '2h']);

    // Undo steps back to chance phase cleanly
    expect(store.stepBack()).toBe(true);
    expect(store.handSnapshotSignal.value.pokerState.phase).toBe('chance');

    store.dispose();
    engine.dispose();
  });

  it('applies valid shorthand lines and surfaces errors cleanly without mutating valid state', () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createHandRecorderStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
      initialPreset: 'raise',
    });

    store.setInputMode('shorthand');
    store.setShorthandTokens(['f', 'f', 'f', 'r2.5', 'f', 'c', '/', 'Qh7c2h']);
    expect(store.applyShorthandLine()).toBe(true);
    expect(store.handSnapshotSignal.value.pokerState.street).toBe('flop');
    expect(store.handSnapshotSignal.value.pokerState.board).toEqual(['Qh', '7c', '2h']);

    // Invalid token does not discard the existing flop state
    store.setShorthandTokens(['f', 'oops']);
    expect(store.applyShorthandLine()).toBe(false);
    expect(store.shorthandErrorSignal.value).toBe('oops');
    expect(store.handSnapshotSignal.value.pokerState.board).toEqual(['Qh', '7c', '2h']);

    store.dispose();
    engine.dispose();
  });

  it('reveals showdown cards, saves completed hands & mid-hand spots, and reloads them', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createHandRecorderStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
      initialPreset: 'raise',
    });

    // Save mid-hand spot immediately on Hero's BTN open decision
    store.toggleHeroReasonChip('stealing');
    store.setHeroCustomNote('Open light from button against tight blinds.');
    const midSpot = await store.saveCurrentHand();
    expect(midSpot.payload.savedKind).toBe('mid_hand_spot');
    expect(midSpot.payload.heroNotes[0]?.reasonChip).toBe('stealing');

    // Finish hand all-in preflop to showdown and reveal BB cards
    store.selectTicket('all_in');
    expect(store.confirmTicketAction()).toBe(true);
    store.selectTicket('fold');
    expect(store.confirmTicketAction()).toBe(true);
    store.selectTicket('call');
    expect(store.confirmTicketAction()).toBe(true);

    expect(store.handSnapshotSignal.value.pokerState.phase).toBe('chance');
    expect(store.dealRandomPendingStreet(1)).toBe(true);
    expect(store.dealRandomPendingStreet(2)).toBe(true);
    expect(store.dealRandomPendingStreet(3)).toBe(true);
    expect(store.handSnapshotSignal.value.pokerState.phase).toBe('showdown');

    expect(store.revealOpponentHoleCards('seat-2', ['Ac', 'Kc'])).toBe(true);
    expect(store.handSnapshotSignal.value.pokerState.phase).toBe('terminal');

    const completed = await store.saveCurrentHand();
    expect(completed.payload.savedKind).toBe('completed_hand');

    // Reset and reload mid-hand spot
    store.resetHand();
    expect(store.stepsSignal.value.length).toBe(0);
    store.loadSavedHand(midSpot);
    expect(store.handSnapshotSignal.value.pokerState.actingPlayerId).toBe('hero');
    expect(store.heroNotesSignal.value[0]?.reasonChip).toBe('stealing');

    // Archive and verify JSON backup roundtrip
    await store.archiveSavedHand(midSpot.objectId);
    const remaining = await store.refreshSavedHands();
    expect(remaining.map((r) => r.objectId)).toEqual([completed.objectId]);

    const bundle = await repo.exportBundle();
    const freshRepo = createStudyRepository(createMemoryStudyBackend());
    const imported = await freshRepo.importBundle(JSON.stringify(bundle));
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.savedHands.map((r) => r.objectId)).toEqual([completed.objectId]);
    }

    store.dispose();
    engine.dispose();
  });

  it('persists trimmed handNote, omits blank handNote, and configures cleanly from a Night session', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createHandRecorderStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
      initialPreset: 'raise',
    });

    // Blank/whitespace handNote is omitted from saved payload
    store.setHandNote('   \n  ');
    expect('handNote' in store.buildSavedPayload()).toBe(false);
    const withoutNote = await store.saveCurrentHand();
    expect(withoutNote.payload.handNote).toBeUndefined();

    // Non-empty handNote is trimmed in saved payload and restored on loadSavedHand
    store.setHandNote('  Button vs tight blinds.\nKeep pressure on high cards.  ');
    const withNote = await store.saveCurrentHand();
    expect(withNote.payload.handNote).toBe('Button vs tight blinds.\nKeep pressure on high cards.');

    store.resetHand();
    expect(store.handNoteSignal.value).toBe('');
    expect(store.linkedNightSessionIdSignal.value).toBeNull();
    expect(store.linkedNightTitleSignal.value).toBeNull();

    store.loadSavedHand(withNote);
    expect(store.handNoteSignal.value).toBe('Button vs tight blinds.\nKeep pressure on high cards.');
    store.loadSavedHand(withoutNote);
    expect(store.handNoteSignal.value).toBe('');

    // configureFromNight configures preset, seats, night title/id, side tab, and preserves link on seat tweaks
    store.setActiveSideTab('saved');
    store.setHandNote('Stale note');
    store.configureFromNight({
      nightSessionId: 'night-9',
      nightTitle: 'Friday Cash',
      unitPreset: 'ils',
      seatCount: 8,
    });
    expect(store.tablePresetSignal.value).toBe('home_game_50bb');
    expect(store.seatCountSignal.value).toBe(8);
    expect(store.unitLabelSignal.value).toBe('₪');
    expect(store.linkedNightSessionIdSignal.value).toBe('night-9');
    expect(store.linkedNightTitleSignal.value).toBe('Friday Cash');
    expect(store.activeSideTabSignal.value).toBe('record');
    expect(store.handNoteSignal.value).toBe('');

    store.setHeroSeatIndex(2);
    expect(store.linkedNightSessionIdSignal.value).toBe('night-9');
    expect(store.linkedNightTitleSignal.value).toBe('Friday Cash');

    store.configureFromNight({
      nightSessionId: 'night-10',
      nightTitle: 'Six Max Chips',
      unitPreset: 'chips',
      seatCount: 6,
    });
    expect(store.tablePresetSignal.value).toBe('six_max_100bb');
    expect(store.seatCountSignal.value).toBe(6);
    expect(store.linkedNightSessionIdSignal.value).toBe('night-10');

    store.resetHand();
    expect(store.linkedNightSessionIdSignal.value).toBeNull();
    expect(store.linkedNightTitleSignal.value).toBeNull();

    store.dispose();
    engine.dispose();
  });
});
