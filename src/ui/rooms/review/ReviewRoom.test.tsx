import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initAppearance } from '../../../domain/appearance';
import { getSharedHandRecorderStore, resetSharedHandRecorderStore } from '../../../domain/hand';
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
});
