import { describe, expect, it } from 'vitest';
import { createStudyRepository, createMemoryStudyBackend } from '../storage';
import { createTrainingStore, ORBIT_TOTAL_HANDS } from './index';

describe('6-Max Bot Orbit Mode', () => {
  it('rotates Hero through all 6 positions across a 6-hand orbit, keeps bot cards hidden until showdown, and saves hands to Review', async () => {
    const repository = createStudyRepository(createMemoryStudyBackend());
    const store = createTrainingStore({
      repository,
      instantTimers: true,
    });

    await store.startSixMaxOrbit(777);
    expect(store.activeViewSignal.value).toBe('orbit');

    const observedPositions: string[] = [];

    for (let handIdx = 1; handIdx <= ORBIT_TOTAL_HANDS; handIdx += 1) {
      const liveAtStart = store.orbitStateSignal.value!;
      expect(liveAtStart.handNumber).toBe(handIdx);
      expect(liveAtStart.pokerState.players).toHaveLength(6);
      observedPositions.push(liveAtStart.heroPositionLabel);

      // Before terminal showdown, bot hole cards must remain privacy-fenced in PokerState
      expect(liveAtStart.revealedCardsByPlayer).toEqual({});
      for (const p of liveAtStart.pokerState.players) {
        if (p.playerId !== 'hero') {
          expect(p.holeCards).toEqual({
            cardCount: 2,
            schemaVersion: 'poker-hidden-hole-cards/v1',
            status: 'hidden',
          });
        }
      }

      // Play Hero's turns until the hand reaches terminal state
      let safety = 0;
      while (!store.orbitStateSignal.value!.pokerState.terminal.isTerminal && safety < 24) {
        safety += 1;
        const cur = store.orbitStateSignal.value!;
        const legal = cur.legalSpec;
        if (!legal || cur.pokerState.actingPlayerId !== 'hero') break;
        if (legal.check.available) {
          store.selectOrbitTicket('check');
        } else if (legal.call.available) {
          store.selectOrbitTicket('call');
        } else if (legal.fold.available) {
          store.selectOrbitTicket('fold');
        } else if (legal.allIn.available) {
          store.selectOrbitTicket('all_in');
        }
        await store.confirmOrbitAction();
      }

      expect(store.orbitStateSignal.value!.pokerState.terminal.isTerminal).toBe(true);

      if (handIdx < ORBIT_TOTAL_HANDS) {
        await store.dealNextOrbitHand();
      }
    }

    expect(observedPositions).toEqual(['BTN', 'CO', 'HJ', 'UTG', 'BB', 'SB']);
    const finalLive = store.orbitStateSignal.value!;
    expect(finalLive.finishedOrbit).toBe(true);
    expect(finalLive.completedHands).toHaveLength(ORBIT_TOTAL_HANDS);
    expect(Object.values(finalLive.botStatsByPlayer).every((s) => s.handsPlayed === ORBIT_TOTAL_HANDS)).toBe(true);
    store.toggleOrbitReadTable();
    expect(store.orbitStateSignal.value!.readTableOpen).toBe(true);

    const savedCount = await store.saveOrbitHandsToReview();
    expect(savedCount).toBe(ORBIT_TOTAL_HANDS);

    const savedHands = await repository.listSavedHands();
    expect(savedHands).toHaveLength(ORBIT_TOTAL_HANDS);
    expect(savedHands[0]?.payload.seatCount).toBe(6);

    store.dispose();
  });
});
