import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppearance, updateAppearance } from '../../../domain/appearance';
import {
  createHandRecorderStore,
  getSharedHandRecorderStore,
  resetSharedHandRecorderStore,
} from '../../../domain/hand';
import { createReviewStore } from '../../../domain/review';
import { activeRouteSignal, navigateTo } from '../../../domain/shellState';
import { createMemoryStudyBackend, createStudyRepository } from '../../../domain/storage';
import { createEngineClient } from '../../../engine-api';
import { ReviewRoom } from './ReviewRoom';

async function waitUntil(predicate: () => boolean, timeoutMs = 1500): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) break;
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
}

describe('ReviewRoom integration', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    window.localStorage.clear();
    initAppearance();
    resetSharedHandRecorderStore();
    navigateTo('review', { pushHistory: false });
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    render(null, host);
    host.remove();
    resetSharedHandRecorderStore();
  });

  it('renders Friday showdown Decisions vs luck (both EV metrics), counterfactual ranges, and Saved library', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createReviewStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
    });

    render(<ReviewRoom store={store} />, host);
    await waitUntil(
      () =>
        !store.decisionEvaluationSignal.value.isLoading &&
        !store.decisionsVsLuckSignal.value.isLoading,
    );
    const decisiveDecisionIndex = store.selectedDecisionIndexSignal.value;

    const text = host.textContent ?? '';
    expect(text).toContain('Hand review');
    expect(text).toContain('45.0%');
    expect(text).toContain('25.6%');
    expect(text).toContain('Behind the price against the revealed hand (hindsight)');
    // Explicitly shows both callVsFoldEvBb and handEvBb plus runoutLuckBb and actualNetBb
    expect(text).toContain('Call vs fold EV');
    expect(text).toContain('-38.8');
    expect(text).toContain('Total hand EV');
    expect(text).toContain('-48.8');
    expect(text).toContain('Runout luck');
    expect(text).toContain('-51.2');
    expect(text).toContain('Actual net result');

    // Toggle counterfactual villain range -> Loose updates tier to Estimated without changing luck
    const looseBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Loose'),
    );
    expect(looseBtn).toBeTruthy();
    looseBtn!.click();
    await waitUntil(() => !store.decisionEvaluationSignal.value.isLoading);

    const afterCounterfactualText = host.textContent ?? '';
    expect(afterCounterfactualText).toContain('Estimated');
    expect(afterCounterfactualText).toContain('opponent assumption');
    expect(afterCounterfactualText).not.toContain('Behind the price against the revealed hand (hindsight)');
    // Decisions vs luck preserves exact known-cards numbers
    expect(afterCounterfactualText).toContain('-38.8');
    expect(afterCounterfactualText).toContain('-48.8');

    // Step to Decision 1 (voluntary preflop open) in showed-hand mode -> never shows Call mistake
    store.setCounterfactualRange('showed');
    const dec1Btn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Decision 1'),
    );
    expect(dec1Btn).toBeTruthy();
    dec1Btn!.click();
    await waitUntil(() => !store.decisionEvaluationSignal.value.isLoading);
    expect(host.textContent).not.toContain('Behind the price against the revealed hand (hindsight)');

    store.selectDecision(decisiveDecisionIndex);
    await waitUntil(
      () =>
        store.selectedDecisionIndexSignal.value === decisiveDecisionIndex &&
        !store.decisionEvaluationSignal.value.isLoading,
    );

    // Open Inline Equity Overlay via 'e', verify exact figure, pin to decision note, and close on Escape
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
    await waitUntil(() => {
      const ov = host.querySelector('[data-equity-overlay="true"]');
      return Boolean(ov && (ov.textContent ?? '').includes('25.6%'));
    });
    const overlayEl = host.querySelector('[data-equity-overlay="true"]')!;
    expect(overlayEl.textContent).toContain('Inline equity');
    expect(overlayEl.textContent).toContain('Equity is not EV.');

    const pinBtn = Array.from(overlayEl.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Pin to decision note'),
    )!;
    pinBtn.click();
    await waitUntil(() => (store.activeHeroNoteSignal.value?.customText ?? '').includes('25.6%'));
    expect(store.activeHeroNoteSignal.value?.customText).toContain('25.6%');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await waitUntil(() => host.querySelector('[data-equity-overlay="true"]') === null);

    // Open Saved library tab -> filter spots, archive/restore, and Edit in Hand
    store.setActiveSideTab('saved');
    await waitUntil(() => (host.textContent ?? '').includes('Saved library'));
    expect(host.textContent).toContain('Saved library');

    const spotsBtn = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Spots',
    );
    expect(spotsBtn).toBeTruthy();
    spotsBtn!.click();
    await waitUntil(() => store.filteredSavedItemsSignal.value.length === 1);
    expect(host.textContent).toContain('Mid-hand spot');

    const editBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Edit in Hand'),
    );
    expect(editBtn).toBeTruthy();
    editBtn!.click();
    await waitUntil(() => activeRouteSignal.value === 'hand');
    expect(activeRouteSignal.value).toBe('hand');
    expect(getSharedHandRecorderStore().handSnapshotSignal.value.recordedActions.length).toBeGreaterThan(0);

    store.dispose();
    engine.dispose();
  });

  it('supports multiline thinking + hand summary notes, decision Open in Equity / Drill this, and Saved library sticky inspector', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const recorder = createHandRecorderStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
      initialPreset: 'raise',
    });
    expect(recorder.confirmTicketAction()).toBe(true);
    const saved1 = await recorder.saveCurrentHand();
    await repo.annotateSavedHand(saved1.objectId, { handNote: 'Saved spot takeaway lotus' });
    recorder.dispose();

    const recorder2 = createHandRecorderStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
      initialPreset: 'raise',
    });
    expect(recorder2.confirmTicketAction()).toBe(true);
    const saved2 = await recorder2.saveCurrentHand();
    await repo.annotateSavedHand(saved2.objectId, { handNote: 'Second hand takeaway orchid' });
    recorder2.dispose();

    const store = createReviewStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
    });
    await store.refreshSavedLibrary();

    const onOpenInEquity = vi.fn();
    const onDrillDecision = vi.fn();

    render(
      <ReviewRoom
        store={store}
        onOpenInEquity={onOpenInEquity}
        onDrillDecision={onDrillDecision}
      />,
      host,
    );

    await waitUntil(
      () =>
        !store.decisionEvaluationSignal.value.isLoading &&
        !store.decisionsVsLuckSignal.value.isLoading,
    );

    // Decision thinking note and Hand summary note are multiline textareas
    const thinkingTextarea = host.querySelector(
      'textarea[aria-label="Your thinking note"]',
    ) as HTMLTextAreaElement | null;
    const summaryTextarea = host.querySelector(
      'textarea[aria-label="Hand summary note"]',
    ) as HTMLTextAreaElement | null;
    expect(thinkingTextarea).toBeTruthy();
    expect(summaryTextarea).toBeTruthy();
    expect(thinkingTextarea?.rows).toBe(2);
    expect(summaryTextarea?.rows).toBe(2);

    // Typing a hand summary note persists to active record
    summaryTextarea!.value = 'Check-call flop vs polarized shove? Note token zebra.';
    summaryTextarea!.dispatchEvent(new Event('input', { bubbles: true }));
    await waitUntil(() =>
      (store.activeRecordSignal.value.payload.handNote ?? '').includes('zebra'),
    );
    expect(store.activeRecordSignal.value.payload.handNote).toContain('zebra');

    // Decision panel "Open in Equity" and "Drill this"
    const openEquityBtn = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Open in Equity',
    );
    const drillBtn = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Drill this',
    );
    expect(openEquityBtn).toBeTruthy();
    expect(drillBtn).toBeTruthy();

    openEquityBtn!.click();
    expect(onOpenInEquity).toHaveBeenCalledTimes(1);
    expect(onOpenInEquity).toHaveBeenCalledWith(
      expect.objectContaining({
        board: ['Qh', '7c', '2h'],
        players: [
          { label: 'BTN', rawInput: 'AhKh', isHero: true },
          { label: 'BB', rawInput: 'QsQc', isHero: false },
        ],
        potBeforeBetBb: 110,
        betToCallBb: 90,
        remainingStackBb: 90,
      }),
    );

    drillBtn!.click();
    expect(onDrillDecision).toHaveBeenCalledTimes(1);
    expect(onDrillDecision).toHaveBeenCalledWith({
      position: 'BTN',
      heroCards: ['Ah', 'Kh'],
    });

    // Switch to counterfactual range and verify Open in Equity sends canonical range
    const tightBtn = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Tight',
    );
    expect(tightBtn).toBeTruthy();
    tightBtn!.click();
    await waitUntil(
      () =>
        store.decisionEvaluationSignal.value.mode === 'tight' &&
        !store.decisionEvaluationSignal.value.isLoading &&
        Boolean(
          Array.from(host.querySelectorAll('button')).find(
            (b) => b.textContent?.trim() === 'Open in Equity',
          ),
        ),
    );
    const liveOpenEquityBtn = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Open in Equity',
    );
    expect(liveOpenEquityBtn).toBeTruthy();
    liveOpenEquityBtn!.click();
    expect(onOpenInEquity).toHaveBeenCalledTimes(2);
    expect(onOpenInEquity.mock.calls[1]?.[0]).toEqual({
      board: ['Qh', '7c', '2h'],
      players: [
        { label: 'BTN', rawInput: 'AhKh', isHero: true },
        {
          label: 'BB',
          rawInput: store.decisionEvaluationSignal.value.villainRangeSpec?.canonical,
          isHero: false,
        },
      ],
      potBeforeBetBb: 110,
      betToCallBb: 90,
      remainingStackBb: 90,
    });

    // Open Saved library tab (starter hand was active for decision tests, repo hands populate Saved library)
    store.setActiveSideTab('saved');
    await waitUntil(() => Boolean(host.querySelector('aside')));

    // Critical DOM rule: zero nested buttons
    expect(host.querySelectorAll('button button').length).toBe(0);

    const inspector = host.querySelector('aside')!;
    expect(inspector.textContent).toContain('Selected hand');
    expect(inspector.textContent).toContain('Shorthand');
    expect(inspector.querySelector('[role="region"]')).toBeTruthy();

    // Two items in list: select the unselected card and confirm inspector updates
    const articles = Array.from(host.querySelectorAll('article'));
    expect(articles).toHaveLength(2);
    const unselectedBtn = articles
      .map((a) => a.querySelector('button[aria-pressed]') as HTMLButtonElement | null)
      .find((b) => b?.getAttribute('aria-pressed') === 'false');
    expect(unselectedBtn).toBeTruthy();
    const firstNoteText = inspector.textContent ?? '';
    const expectedAfterSelect = firstNoteText.includes('lotus')
      ? 'Second hand takeaway orchid'
      : 'Saved spot takeaway lotus';
    unselectedBtn!.click();
    await waitUntil(() => unselectedBtn!.getAttribute('aria-pressed') === 'true');
    expect(inspector.textContent).toContain(expectedAfterSelect);

    // Open in Equity from inspector
    const inspectorEquityBtn = Array.from(inspector.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Open in Equity',
    );
    expect(inspectorEquityBtn).toBeTruthy();
    inspectorEquityBtn!.click();
    expect(onOpenInEquity).toHaveBeenCalledTimes(3);

    // Search by handNote text in Saved library
    const searchInput = host.querySelector(
      'input[aria-label="Search saved library"]',
    ) as HTMLInputElement | null;
    expect(searchInput).toBeTruthy();
    searchInput!.value = 'orchid';
    searchInput!.dispatchEvent(new Event('input', { bubbles: true }));
    await waitUntil(() => store.filteredSavedItemsSignal.value.length === 1);
    expect(inspector.textContent).toContain('Second hand takeaway orchid');

    // Primary "Open in Review" from inspector switches back to review tab
    const inspectorReviewBtn = Array.from(inspector.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Open in Review',
    );
    expect(inspectorReviewBtn).toBeTruthy();
    inspectorReviewBtn!.click();
    await waitUntil(() => store.activeSideTabSignal.value === 'review');
    expect(store.activeSideTabSignal.value).toBe('review');

    store.dispose();
    engine.dispose();
  });

  it('honors askBeforeVerdict and teacherVoice gentle framing with identical percentages', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());

    // 1. Starter Friday hand has a thinking note; teacherVoice='gentle' preserves exact 45.0% and 25.6%
    updateAppearance(
      {
        teacherVoice: 'gentle',
        teacherTypingSpeed: 'instant',
        askBeforeVerdict: true,
      },
      { persist: false },
    );

    const store = createReviewStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
    });

    render(<ReviewRoom store={store} />, host);
    await waitUntil(
      () =>
        !store.decisionEvaluationSignal.value.isLoading &&
        !store.decisionsVsLuckSignal.value.isLoading,
    );

    expect(host.textContent).toContain('Exact');
    expect(host.textContent).toContain('Behind the price against the revealed hand (hindsight)');
    expect(host.textContent).toContain(
      'Price check: you needed 45.0% and had 25.6%. Folding saves chips long term.',
    );

    // 2. Record a hand WITHOUT thinking notes where Hero makes a mathematically sound showdown call
    const recorder = createHandRecorderStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
      initialPreset: 'raise',
    });
    // Hero raises 3.0 bb, SB folds, BB calls
    expect(recorder.confirmTicketAction()).toBe(true);
    recorder.selectTicket('fold');
    expect(recorder.confirmTicketAction()).toBe(true);
    recorder.selectTicket('call');
    expect(recorder.confirmTicketAction()).toBe(true);
    // Deal flop Ah Ac 2s (Hero holds As Kd -> trip aces vs BB Kc Kd)
    recorder.togglePendingBoardCard('Ah');
    recorder.togglePendingBoardCard('Ac');
    recorder.togglePendingBoardCard('2s');
    expect(recorder.commitPendingBoardCards()).toBe(true);
    // BB shoves all-in, Hero calls
    recorder.selectTicket('all_in');
    expect(recorder.confirmTicketAction()).toBe(true);
    recorder.selectTicket('call');
    expect(recorder.confirmTicketAction()).toBe(true);
    // Deal turn/river and reveal BB Qc Qd
    expect(recorder.dealRandomPendingStreet(2)).toBe(true);
    expect(recorder.dealRandomPendingStreet(3)).toBe(true);
    expect(recorder.revealOpponentHoleCards('seat-2', ['Qc', 'Qd'])).toBe(true);
    const savedGoodCall = await recorder.saveCurrentHand();
    recorder.dispose();

    // With askBeforeVerdict: true (default) and no thinking note, verdict is gated until Hero records thinking
    store.openSavedHand(savedGoodCall);
    await waitUntil(
      () =>
        !store.decisionEvaluationSignal.value.isLoading &&
        store.decisionEvaluationSignal.value.heroEquityPct !== null,
    );
    expect(host.textContent).not.toContain('Right price:');
    expect(host.textContent).not.toContain('clears the');

    // Turning askBeforeVerdict to false immediately reveals the verdict without clicking a thinking reason
    updateAppearance({ askBeforeVerdict: false }, { persist: false });
    await waitUntil(() => (host.textContent ?? '').includes('call threshold.'));
    const neededPct = store.decisionEvaluationSignal.value.requiredEquityPct!.toFixed(1);
    const heroPct = store.decisionEvaluationSignal.value.heroEquityPct!.toFixed(1);
    expect(host.textContent).toContain(
      `Right price: ${heroPct}% clears the ${neededPct}% call threshold.`,
    );

    // Turning askBeforeVerdict back to true gates again until Hero picks a thinking reason chip
    updateAppearance({ askBeforeVerdict: true }, { persist: false });
    await waitUntil(() => !(host.textContent ?? '').includes('Right price:'));
    const potCommittedBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Pot committed'),
    );
    expect(potCommittedBtn).toBeTruthy();
    potCommittedBtn!.click();
    await waitUntil(() => (host.textContent ?? '').includes('call threshold.'));
    expect(host.textContent).toContain(
      `Right price: ${heroPct}% clears the ${neededPct}% call threshold.`,
    );

    store.dispose();
    engine.dispose();
  });

  it('animates replay table cards when advancing forward and disables card motion under reduced/minimal settings', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createReviewStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
    });

    updateAppearance({ motion: 'system', minimalCards: false }, { persist: false });
    store.jumpToFrame(0);
    store.toggleFeltExpanded();

    render(<ReviewRoom store={store} />, host);
    await waitUntil(() => Boolean(host.querySelector('[role="region"]')));

    // Advance straight to Flop street -> board cards animate deal and chipsToPot triggers
    store.selectStreet('flop');
    await waitUntil(() => host.querySelectorAll('[class*="motion_deal"]').length > 0);
    expect(host.querySelectorAll('[class*="motion_deal"]').length).toBe(3);
    expect(host.querySelector('[class*="chipFlight"]')).not.toBeNull();

    // Advance to Turn then River -> only the newly dealt card on each street animates deal
    store.selectStreet('turn');
    await waitUntil(() => host.querySelectorAll('[class*="motion_deal"]').length === 1);
    store.selectStreet('river');
    await waitUntil(
      () =>
        store.currentPokerStateSignal.value.board.length === 5 &&
        host.querySelectorAll('[class*="motion_deal"]').length === 1,
    );

    // Next frame reveals villain cards -> motion_flip
    store.stepFrame(1);
    await waitUntil(() => host.querySelectorAll('[class*="motion_flip"]').length === 2);

    // Minimal cards disables all card motion cleanly
    updateAppearance({ minimalCards: true }, { persist: false });
    store.selectStreet('preflop');
    await waitUntil(() => host.querySelectorAll('[class*="motion_deal"]').length === 0);
    store.selectStreet('flop');
    await new Promise((r) => setTimeout(r, 30));
    expect(host.querySelectorAll('[class*="motion_deal"]').length).toBe(0);
    expect(host.querySelector('[class*="chipFlight"]')).toBeNull();

    store.dispose();
    engine.dispose();
  });

  it('renders What were you thinking? Assumption Mirror with Watching counts and filters Saved Library hands by reason chip', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());

    const recorder1 = createHandRecorderStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
      initialPreset: 'raise',
    });
    expect(recorder1.confirmTicketAction()).toBe(true);
    const savedValue = await recorder1.saveCurrentHand();
    await repo.annotateSavedHand(savedValue.objectId, {
      handNote: 'Value barrel hand note alpha',
      heroNotes: [
        {
          actionSeq: 1,
          street: 'preflop',
          reasonChip: 'value',
          customText: 'Value raising strong broadway',
        },
      ],
    });
    recorder1.dispose();

    const recorder2 = createHandRecorderStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
      initialPreset: 'raise',
    });
    expect(recorder2.confirmTicketAction()).toBe(true);
    const savedBluffCatch = await recorder2.saveCurrentHand();
    await repo.annotateSavedHand(savedBluffCatch.objectId, {
      handNote: 'Bluff catch hand note beta',
      heroNotes: [
        {
          actionSeq: 1,
          street: 'preflop',
          reasonChip: 'bluff_catch',
          customText: 'Defending vs wide line',
        },
      ],
    });
    recorder2.dispose();

    const store = createReviewStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
    });
    await store.refreshSavedLibrary();
    store.setActiveSideTab('saved');

    render(<ReviewRoom store={store} />, host);
    await waitUntil(() => (host.textContent ?? '').includes('What were you thinking? (Assumption mirror)'));

    const text = host.textContent ?? '';
    expect(text).toContain('What were you thinking? (Assumption mirror)');
    expect(text).toContain('All reasons');
    expect(text).toContain('Watching · n = 1');
    expect(text).toContain('Watching · n = 0');
    expect(host.querySelectorAll('article')).toHaveLength(2);

    // Filter by 'Value bet or raise'
    const valueChip = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Value bet or raise'),
    );
    expect(valueChip).toBeTruthy();
    valueChip!.click();
    await waitUntil(() => host.querySelectorAll('article').length === 1);
    expect(host.querySelector('aside')?.textContent).toContain('Value barrel hand note alpha');

    // Filter by 'Bluff catching'
    const bluffCatchChip = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Bluff catching'),
    );
    expect(bluffCatchChip).toBeTruthy();
    bluffCatchChip!.click();
    await waitUntil(() =>
      Boolean(host.querySelector('aside')?.textContent?.includes('Bluff catch hand note beta')),
    );
    expect(host.querySelectorAll('article')).toHaveLength(1);

    // Clicking the active reason chip again resets to 'All reasons'
    bluffCatchChip!.click();
    await waitUntil(() => host.querySelectorAll('article').length === 2);
    expect(host.querySelectorAll('article')).toHaveLength(2);

    // Filter by final street and pot type chips
    const preflopChip = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Preflop',
    );
    expect(preflopChip).toBeTruthy();
    preflopChip!.click();
    await waitUntil(() => host.querySelectorAll('article').length === 0);
    preflopChip!.click();
    await waitUntil(() => host.querySelectorAll('article').length === 2);

    const srpChip = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Single-raised',
    );
    expect(srpChip).toBeTruthy();
    srpChip!.click();
    await waitUntil(() => host.querySelectorAll('article').length === 2);

    store.dispose();
    engine.dispose();
  });

  it('toggles What-if branches (dual fold/call responses) and Same-spot echo in Review', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createReviewStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
    });
    await waitUntil(() => !store.decisionEvaluationSignal.value.isLoading);

    render(<ReviewRoom store={store} />, host);
    await waitUntil(() =>
      Boolean(
        Array.from(host.querySelectorAll('button')).find(
          (b) => b.textContent?.trim() === 'What if & Echo',
        ),
      ),
    );

    const toggleBtn = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'What if & Echo',
    )!;
    toggleBtn.click();
    await waitUntil(() => (host.textContent ?? '').includes('What-if branches (price only)'));

    const text = host.textContent ?? '';
    expect(text).toContain('If you fold:');
    expect(text).toContain('If villain folds to');
    expect(text).toContain('If villain calls');
    expect(text).toContain('Same-spot echo');
    expect(text).toContain('Watching · n = 0 saved hands');

    // Switch raise fraction to Pot
    const potBtn = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Pot',
    )!;
    potBtn.click();
    await waitUntil(() => potBtn.getAttribute('aria-pressed') === 'true');
    expect(potBtn.getAttribute('aria-pressed')).toBe('true');

    // Toggle Shareable Hand Card and test privacy toggles
    const shareBtn = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Share hand',
    )!;
    expect(shareBtn).toBeTruthy();
    shareBtn.click();
    await waitUntil(() => (host.textContent ?? '').includes('Shareable hand card (local only)'));
    const preText = host.querySelector('pre')?.textContent ?? '';
    expect(preText).toContain('Riverline');
    expect(preText).toContain('BTN');

    const posToggle = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Show positions',
    )!;
    posToggle.click();
    await waitUntil(() => !(host.querySelector('pre')?.textContent ?? '').includes('BTN'));

    store.dispose();
    engine.dispose();
  });
});
