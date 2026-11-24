import { describe, expect, it } from 'vitest';
import { createEngineClient } from '../../engine-api';
import { createHandRecorderStore } from '../hand';
import { createMemoryStudyBackend, createStudyRepository, type SavedHandRecord } from '../storage';
import { computeMyPlayReport } from './myPlayAnalytics';
import { STARTER_FRIDAY_OBJECT_ID, STARTER_SPOT_OBJECT_ID } from './reviewHelpers';

async function recordSampleHand(heroRaise = true): Promise<SavedHandRecord> {
  const engine = createEngineClient({ mode: 'inline' });
  const repo = createStudyRepository(createMemoryStudyBackend());
  const recorder = createHandRecorderStore({
    engine,
    repository: repo,
    autoLoadSaved: false,
    initialPreset: 'raise',
  });

  // 'raise' preset folds UTG, HJ, CO to Hero BTN and selects raise
  if (!heroRaise) {
    recorder.selectTicket('call');
  }
  recorder.confirmTicketAction();

  // Fold SB, fold BB (or check BB)
  for (let i = 0; i < 2; i += 1) {
    const state = recorder.handSnapshotSignal.value.pokerState;
    if (state.terminal.isTerminal) break;
    recorder.selectTicket('fold');
    recorder.confirmTicketAction();
  }

  const record = await recorder.saveCurrentHand();
  recorder.dispose();
  engine.dispose();
  return record;
}

describe('myPlayAnalytics', () => {
  it('excludes starter and archived hands and computes positional VPIP/PFR/Net bb with Watching badge under 20 hands', async () => {
    const realRaiseHand = await recordSampleHand(true);
    const realCallHand = await recordSampleHand(false);

    const starterRecord: SavedHandRecord = {
      ...realRaiseHand,
      objectId: STARTER_FRIDAY_OBJECT_ID,
    };
    const starterSpot: SavedHandRecord = {
      ...realRaiseHand,
      objectId: STARTER_SPOT_OBJECT_ID,
    };
    const archivedRecord: SavedHandRecord = {
      ...realRaiseHand,
      objectId: 'archived-hand-1',
      archived: true,
    };

    const report = computeMyPlayReport([
      starterRecord,
      starterSpot,
      archivedRecord,
      realRaiseHand,
      realCallHand,
    ]);

    expect(report.totalHands).toBe(2);
    expect(report.isWatching).toBe(true);
    expect(report.overallVpipPct).toBe(100);
    expect(report.overallPfrPct).toBe(50);
    expect(report.overallThreeBetPct).toBe(0);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]?.position).toBe('BTN');
    expect(report.rows[0]?.handsCount).toBe(2);
    expect(report.rows[0]?.isWatching).toBe(true);
  });
});
