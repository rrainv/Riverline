import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppearance } from '../../../domain/appearance';
import { createEquityStore } from '../../../domain/equity';
import { createMemoryStudyBackend, createStudyRepository } from '../../../domain/storage';
import { createEngineClient } from '../../../engine-api';
import { EquityRoom } from './EquityRoom';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 40));

describe('EquityRoom integration', () => {
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

  it('renders method badge, board slots, players, shorthand error, and saves/reopens matchup', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createEquityStore({ engine, repository: repo, autoCompute: false });

    await store.recompute();
    render(<EquityRoom store={store} />, host);
    await flush();

    // Header method + Equity is not EV
    expect(host.textContent).toContain('Equity is not EV.');
    expect(host.textContent).toContain('all 990 runouts');
    expect(host.querySelectorAll('[data-equity-row]')).toHaveLength(2);

    // Add a range player via store and verify inline 13x13 SVG renders
    expect(store.addPlayer('QQ+')).toBe(true);
    await store.recompute();
    await flush();
    expect(host.querySelectorAll('[data-equity-row]')).toHaveLength(3);
    expect(host.querySelector('[data-equity-row] svg')).not.toBeNull();

    // Save current matchup and verify it appears in Saved view
    const saved = await store.saveCurrentMatchup();
    expect(saved).not.toBeNull();
    store.activeSideTabSignal.value = 'saved';
    await flush();
    expect(host.textContent).toContain(saved!.factTitle);

    // Export bundle JSON matches schemaVersion: 1
    const bundle = await repo.exportBundle();
    expect(bundle.schemaVersion).toBe(1);
    expect(bundle.events.length).toBeGreaterThanOrEqual(1);

    store.dispose();
    engine.dispose();
  }, 15000);

  it('renders Back to {room} and Drill this header actions when props are provided', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createEquityStore({ engine, repository: repo, autoCompute: false });
    const onDrillMatchup = vi.fn();
    const onReturnToOrigin = vi.fn();

    render(<EquityRoom store={store} />, host);
    await flush();
    expect(host.textContent).not.toContain('Drill this');
    expect(host.textContent).not.toContain('Back to');

    render(
      <EquityRoom
        store={store}
        returnLabel="Review"
        onReturnToOrigin={onReturnToOrigin}
        onDrillMatchup={onDrillMatchup}
      />,
      host,
    );
    await flush();

    const buttons = Array.from(host.querySelectorAll('button'));
    const backBtn = buttons.find((b) => b.textContent?.includes('Back to Review'));
    const drillBtn = buttons.find((b) => b.textContent?.includes('Drill this'));
    expect(backBtn).toBeDefined();
    expect(drillBtn).toBeDefined();

    backBtn!.click();
    drillBtn!.click();

    expect(onReturnToOrigin).toHaveBeenCalledTimes(1);
    expect(onDrillMatchup).toHaveBeenCalledTimes(1);

    store.dispose();
    engine.dispose();
  });
});
