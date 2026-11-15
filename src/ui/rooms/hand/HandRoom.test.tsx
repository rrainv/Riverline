import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initAppearance } from '../../../domain/appearance';
import { createHandRecorderStore } from '../../../domain/hand';
import { resetSharedReviewStore } from '../../../domain/review';
import { activeRouteSignal, navigateTo } from '../../../domain/shellState';
import { createMemoryStudyBackend, createStudyRepository } from '../../../domain/storage';
import { createEngineClient } from '../../../engine-api';
import { HandRoom } from './HandRoom';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 40));

describe('HandRoom integration', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    window.localStorage.clear();
    initAppearance();
    resetSharedReviewStore();
    navigateTo('hand', { pushHistory: false });
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    render(null, host);
    host.remove();
    resetSharedReviewStore();
  });

  it('renders presets, flop HeatGrid, shorthand error state, terminal hand, and opens Review on save', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createHandRecorderStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
      initialPreset: 'raise',
    });

    render(<HandRoom store={store} />, host);
    await flush();

    // Default 'raise' preset shows OptionTickets + size ladder + Exact · price only badge
    expect(host.textContent).toContain('Record a hand');
    expect(host.textContent).toContain('price only');
    expect(host.textContent).toContain('Bet or raise sizes');
    expect(host.textContent).toContain('What were you thinking?');

    // Reset hand to UTG's turn -> shows 'Everyone else folds to you' shortcut
    store.resetHand();
    await flush();
    expect(host.textContent).toContain('Everyone else folds to you');

    // Switch to 'flop_grid' -> renders HeatGrid board picker
    store.applyPreset('flop_grid');
    await flush();
    expect(host.textContent).toContain('Pick 3 flop cards');
    expect(host.textContent).toContain('Deal 2/3');

    // Switch to 'typed_error' -> renders TokenInput alert for 'oops'
    store.applyPreset('typed_error');
    await flush();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Unrecognized action');

    // Switch to 'done' -> renders settled terminal hand
    store.applyPreset('done');
    await flush();
    expect(host.textContent).toContain('Hand settled');
    expect(host.textContent).toContain('Save hand');

    // Save hand via button and navigate to Review via "Open in Review"
    const saveBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save hand'),
    );
    expect(saveBtn).toBeTruthy();
    saveBtn!.click();
    await flush();
    await flush();

    const openReviewBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Open in Review'),
    );
    expect(openReviewBtn).toBeTruthy();
    openReviewBtn!.click();
    await flush();
    expect(activeRouteSignal.value).toBe('review');

    store.dispose();
    engine.dispose();
  });
});
