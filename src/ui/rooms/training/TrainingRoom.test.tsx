import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SHORTCUTS, initAppearance, updateAppearance } from '../../../domain/appearance';
import { createMemoryStudyBackend, createStudyRepository } from '../../../domain/storage';
import { createTrainingStore } from '../../../domain/training';
import { TrainingRoom } from './TrainingRoom';

describe('TrainingRoom UI integration', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    window.localStorage.clear();
    initAppearance();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    render(null, host);
    host.remove();
  });

  it('renders 3-seat Hub (no Full hand dead button), runs Quick drill reveal flow, and renders Duel presets honestly', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createTrainingStore({ repository: repo, instantTimers: true });
    await store.hydrate();

    const onOpenReview = vi.fn();
    render(<TrainingRoom store={store} onOpenReview={onOpenReview} />, host);

    // Hub: 3 menu seats + no Full hand button
    const text = host.textContent ?? '';
    expect(text).toContain('Quick drill');
    expect(text).toContain('Heads-up duel');
    expect(text).toContain('Leak lab');
    expect(text).not.toContain('Full hand');
    expect(text).toContain('This week');
    expect(text).toContain('Duel opponent');
    expect(text).toContain('Balanced');
    expect(text).toContain('Pressure reg');
    expect(text).toContain('Tight');

    // Switch to drill question preset
    await store.applyPreset('drill_question');
    render(<TrainingRoom store={store} onOpenReview={onOpenReview} />, host);
    expect(host.textContent).toContain('Your Personal Strategy plan is hidden until you answer');
    expect(host.textContent).toContain('Required equity');

    // Opening Inline Equity before answering locks equity while keeping exact call price visible
    const drillEqBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Equity'),
    )!;
    drillEqBtn.click();
    await new Promise((r) => setTimeout(r, 20));
    render(<TrainingRoom store={store} onOpenReview={onOpenReview} />, host);
    const lockedOv = host.querySelector('[data-equity-overlay="true"]')!;
    expect(lockedOv.textContent).toContain('Confirm your answer first to unlock equity');
    expect(lockedOv.querySelector('[data-equity-row]')).toBeNull();

    // Confirm answer -> reveals MixBar + TeacherCallout without fake authority and unlocks Inline Equity
    store.selectDrillTicket('raise');
    store.selectDrillSize('s0');
    await store.confirmDrillAnswer();
    render(<TrainingRoom store={store} onOpenReview={onOpenReview} />, host);

    expect(host.textContent).toContain('you');
    expect(host.textContent?.toLowerCase()).not.toContain('heuristic');
    expect(host.textContent?.toLowerCase()).not.toContain('mistake');

    await new Promise((r) => setTimeout(r, 40));
    const unlockedOv = host.querySelector('[data-equity-overlay="true"]')!;
    expect(unlockedOv.textContent).not.toContain('Confirm your answer first to unlock equity');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    // Heads-up duel flop ladder preset
    await store.applyPreset('duel_flop_ladder');
    render(<TrainingRoom store={store} onOpenReview={onOpenReview} />, host);
    expect(host.textContent).toContain('Astra');
    expect(host.textContent).toContain('50%');
    expect(host.textContent).toContain('All-in');
    expect(host.textContent).toContain('Selected size:');
    expect(host.textContent).toContain('Observed Astra stats');

    // End-of-duel result preset -> save hands + open Review callback
    await store.applyPreset('duel_result');
    render(<TrainingRoom store={store} onOpenReview={onOpenReview} />, host);
    expect(host.textContent).toContain('10-hand match complete');

    const saveBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save hands to Review'),
    )!;
    saveBtn.click();
    await new Promise((r) => setTimeout(r, 20));
    expect((await repo.listSavedHands()).length).toBe(10);

    const openBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Open in Review'),
    )!;
    openBtn.click();
    expect(onOpenReview).toHaveBeenCalledTimes(1);

    store.dispose();
  });

  it('wires custom fold shortcut in Duel and disables card motion cleanly under reduced/minimal settings', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createTrainingStore({ repository: repo, instantTimers: true });
    await store.hydrate();

    updateAppearance(
      {
        motion: 'system',
        minimalCards: false,
        shortcuts: { ...DEFAULT_SHORTCUTS, fold: 'Q' },
      },
      { persist: false },
    );

    render(<TrainingRoom store={store} />, host);
    await store.applyPreset('drill_question');
    await new Promise((r) => setTimeout(r, 30));

    // Quick drill deals Hero's 2 cards with motion_deal under normal motion
    expect(host.querySelectorAll('[class*="motion_deal"]').length).toBe(2);

    // Folding in Quick drill applies motion_fold to Hero's cards
    store.selectDrillTicket('fold');
    await store.confirmDrillAnswer();
    await new Promise((r) => setTimeout(r, 30));
    expect(host.querySelectorAll('[class*="motion_fold"]').length).toBe(2);

    // Next drill under minimalCards: true disables card motion cleanly
    updateAppearance({ minimalCards: true }, { persist: false });
    await store.nextDrillSpot();
    await new Promise((r) => setTimeout(r, 30));
    expect(host.querySelectorAll('[class*="motion_deal"]').length).toBe(0);

    // Duel preflop: custom fold shortcut 'Q' selects fold, and reduced motion suppresses card motion
    updateAppearance({ minimalCards: false, motion: 'reduced' }, { persist: false });
    await store.applyPreset('duel_preflop');
    await new Promise((r) => setTimeout(r, 30));

    const foldTicket = host.querySelector<HTMLButtonElement>('[data-ticket-id="fold"]')!;
    expect(foldTicket.textContent).toContain('Q');
    expect(host.querySelectorAll('[class*="motion_deal"]').length).toBe(0);

    // Press custom fold shortcut 'q' (while Shift+Q does not trigger)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Q', shiftKey: true }));
    expect(store.duelSelectedTicketSignal.value).toBeNull();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }));
    expect(store.duelSelectedTicketSignal.value).toBe('fold');

    // Confirm fold under reduced motion -> no motion_fold
    await store.confirmDuelAction();
    await new Promise((r) => setTimeout(r, 30));
    expect(host.querySelectorAll('[class*="motion_fold"]').length).toBe(0);

    // Re-enable normal motion and start fresh duel hand -> deals Hero's 2 cards with motion_deal,
    // then advancing to flop animates the 3 flop cards and triggers chipFlight
    updateAppearance({ motion: 'system', minimalCards: false }, { persist: false });
    await store.startHeadsUpDuel(999);
    await new Promise((r) => setTimeout(r, 30));
    expect(host.querySelectorAll('[class*="motion_deal"]').length).toBe(2);

    await store.applyPreset('duel_preflop');
    await new Promise((r) => setTimeout(r, 30));
    store.selectDuelTicket('call');
    await store.confirmDuelAction();
    if (
      store.duelStateSignal.value &&
      store.duelStateSignal.value.pokerState.board.length === 0 &&
      !store.duelStateSignal.value.pokerState.terminal.isTerminal
    ) {
      store.selectDuelTicket('call');
      await store.confirmDuelAction();
    }
    await new Promise((r) => setTimeout(r, 30));
    expect(store.duelStateSignal.value?.pokerState.board.length).toBeGreaterThanOrEqual(3);
    expect(host.querySelectorAll('[class*="motion_deal"]').length).toBe(3);
    expect(host.querySelector('[class*="chipFlight"]')).not.toBeNull();

    store.dispose();
  });

  it('renders rich Duel Session Report when finishedMatch is true and switches inspected hand details', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createTrainingStore({ repository: repo, instantTimers: true });
    await store.hydrate();
    await store.applyPreset('duel_result');

    const baseState = store.duelStateSignal.value!;
    const h1 = baseState.completedHands[0]!;
    const h2 = baseState.completedHands[1]!;
    const h3 = baseState.completedHands[2]!;
    const h4 = baseState.completedHands[3]!;

    store.duelStateSignal.value = {
      ...baseState,
      finishedMatch: true,
      heroCumulativeNetBb: 18.5,
      botStats: {
        handsPlayed: 4,
        vpipHands: 3,
        pfrHands: 2,
        cbetHands: 2,
        cbetOpps: 3,
        foldToBetCount: 1,
        facingBetCount: 2,
      },
      completedHands: [
        {
          ...h1,
          handNumber: 1,
          handId: 'duel-test-h1',
          heroCards: ['As', 'Ks'],
          astraCards: ['Qd', 'Jc'],
          netBb: 2.5,
          endedAtStreet: 'preflop',
          savedPayload: {
            ...h1.savedPayload,
            shorthandLine: 'btn r2.5 bb f',
          },
        },
        {
          ...h2,
          handNumber: 2,
          handId: 'duel-test-h2',
          heroCards: ['Qh', 'Qs'],
          astraCards: ['Ac', 'Kd'],
          netBb: -12,
          endedAtStreet: 'river',
          savedPayload: {
            ...h2.savedPayload,
            pokerState: {
              ...h2.savedPayload.pokerState,
              board: ['Ah', '7c', '2d', '9s', '3h'],
            },
            shorthandLine: 'btn r2.5 bb c / Ah 7c 2d 9s 3h',
          },
        },
        {
          ...h3,
          handNumber: 3,
          handId: 'duel-test-h3',
          heroCards: ['Jh', 'Th'],
          astraCards: ['9c', '9d'],
          netBb: 29,
          endedAtStreet: 'turn',
          savedPayload: {
            ...h3.savedPayload,
            pokerState: {
              ...h3.savedPayload.pokerState,
              board: ['Kh', 'Qh', '2h', '4c'],
            },
            shorthandLine: 'btn r3 bb r9 btn c / Kh Qh 2h 4c',
          },
        },
        {
          ...h4,
          handNumber: 4,
          handId: 'duel-test-h4',
          heroCards: ['7s', '2c'],
          astraCards: ['Td', '8d'],
          netBb: -1,
          endedAtStreet: 'preflop',
          savedPayload: {
            ...h4.savedPayload,
            shorthandLine: 'btn f',
          },
        },
      ],
    };

    render(<TrainingRoom store={store} />, host);

    const text = host.textContent ?? '';
    // Match headline & variance note
    expect(text).toContain('10-hand match complete');
    expect(text).toContain(
      'Short 10-hand samples swing with card distribution. Focus on pot-odds discipline and street decisions rather than raw net bb.',
    );

    // Per-hand log strip
    expect(text).toContain('Per-hand log');
    const handButtons = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).filter((b) =>
      b.getAttribute('aria-pressed') !== null && b.textContent?.includes('#'),
    );
    expect(handButtons.length).toBe(4);
    expect(handButtons[0]?.getAttribute('aria-pressed')).toBe('true');
    expect(handButtons[0]?.textContent).toContain('#1');
    expect(handButtons[0]?.textContent).toContain('+2.5 bb');

    // Default inspected hand (#1)
    expect(host.textContent).toContain('Hand #1 detail');
    expect(host.textContent).toContain('btn r2.5 bb f');

    // Click hand #3 chip -> switches inspected hand details
    handButtons[2]!.click();
    await new Promise((r) => setTimeout(r, 20));
    render(<TrainingRoom store={store} />, host);

    expect(host.textContent).toContain('Hand #3 detail');
    expect(host.textContent).toContain('Turn');
    expect(host.textContent).toContain('btn r3 bb r9 btn c / Kh Qh 2h 4c');
    expect(host.textContent).toContain('K♥\uFE0E Q♥\uFE0E 2♥\uFE0E 4♣\uFE0E');

    // Top 3 Key Moments sorted by |netBb| descending (#3: +29 bb, #2: -12 bb, #1: +2.5 bb)
    expect(host.textContent).toContain('Key moments (largest swings)');
    const momentItems = Array.from(host.querySelectorAll('li'));
    expect(momentItems.length).toBe(3);
    expect(momentItems[0]?.textContent).toContain('Hand #3');
    expect(momentItems[0]?.textContent).toContain('+29 bb');
    expect(momentItems[1]?.textContent).toContain('Hand #2');
    expect(momentItems[1]?.textContent).toContain('-12 bb');
    expect(momentItems[2]?.textContent).toContain('Hand #1');
    expect(momentItems[2]?.textContent).toContain('+2.5 bb');

    // Observed opponent tendencies
    expect(host.textContent).toContain('Observed opponent tendencies');
    expect(host.textContent).toContain('VPIP 3/4 · PFR 2/4 · C-bet 2/3 · Fold to bet 1/2');

    store.dispose();
  });

  it('supports custom shortcuts in Quick Drill, queues missed spots for retry, and auto-flushes on view exit', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createTrainingStore({ repository: repo, instantTimers: true });
    await store.hydrate();

    updateAppearance(
      {
        shortcuts: { ...DEFAULT_SHORTCUTS, fold: 'Z', inlineEquity: 'I' },
      },
      { persist: false },
    );

    render(<TrainingRoom store={store} />, host);
    await store.applyPreset('drill_question');
    render(<TrainingRoom store={store} />, host);
    await new Promise((r) => setTimeout(r, 10));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'I' }));
    await new Promise((r) => setTimeout(r, 20));
    render(<TrainingRoom store={store} />, host);
    expect(host.querySelector('[data-equity-overlay="true"]')).not.toBeNull();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await new Promise((r) => setTimeout(r, 20));
    render(<TrainingRoom store={store} />, host);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z' }));
    expect(store.drillSelectedTicketSignal.value).toBe('fold');

    await store.confirmDrillAnswer();
    render(<TrainingRoom store={store} />, host);

    expect(store.drillSessionStatsSignal.value.answeredCount).toBe(1);
    expect(host.textContent).toContain('aligned');

    // Leaving drill to hub auto-flushes the answered spots to trainingSessions
    store.setActiveView('hub');
    await new Promise((r) => setTimeout(r, 30));
    expect((await repo.listTrainingSessions()).length).toBe(1);

    store.dispose();
  });

  it('computes honest equity fallback in Quick Drill when baseline is unavailable without queuing as missed', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createTrainingStore({ repository: repo, instantTimers: true });
    await store.hydrate();

    render(<TrainingRoom store={store} />, host);
    await store.openQuickDrill();
    await store.setDrillFilters({ tableSize: 8, stackDepthBb: 50, target: 'preflop_rfi' });
    render(<TrainingRoom store={store} />, host);

    const ex = store.drillExerciseSignal.value!;
    expect(ex.baselineTier).toBe('unavailable');
    store.selectDrillTicket(ex.legalSpec.call.available ? 'call' : 'raise');
    await store.confirmDrillAnswer();
    await new Promise((r) => setTimeout(r, 30));
    render(<TrainingRoom store={store} />, host);

    expect(store.drillEquityCheckSignal.value?.heroEquityPct).not.toBeNull();
    expect(store.missedDrillQueueSignal.value.length).toBe(0);
    expect(host.textContent).toContain('Estimated · vs random hand');
    expect(host.textContent).toContain('Hero equity');
    expect(host.textContent?.toLowerCase()).not.toContain('heuristic');
    expect(host.textContent?.toLowerCase()).not.toContain('mistake');

    store.dispose();
  });
});
