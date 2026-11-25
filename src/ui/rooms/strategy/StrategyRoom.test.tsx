import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initAppearance } from '../../../domain/appearance';
import { createEngineClient } from '../../../engine-api';
import { createMemoryStudyBackend, createStudyRepository } from '../../../domain/storage';
import { createStrategyStore } from '../../../domain/strategy';
import { solveGeometricFraction } from './CommitmentRiverView';
import { StrategyRoom } from './StrategyRoom';

describe('StrategyRoom', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    initAppearance();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    render(null, host);
    host.remove();
  });

  it('navigates Spot Map -> Plan Builder -> Leak Map and switches 6-max 100bb vs 8-max 50bb', async () => {
    const store = createStrategyStore({
      engine: createEngineClient({ mode: 'inline' }),
      repository: createStudyRepository(createMemoryStudyBackend()),
    });
    await store.hydrate();

    render(<StrategyRoom store={store} />, host);
    expect(host.textContent).toContain('Your spot map');

    // Switch to 8-max 50 bb
    const eightMaxRadio = Array.from(host.querySelectorAll('[role="radio"]')).find((el) =>
      el.textContent?.includes('8-max'),
    ) as HTMLElement | undefined;
    expect(eightMaxRadio).toBeTruthy();
    eightMaxRadio?.click();

    const btn50 = Array.from(host.querySelectorAll('button')).find((el) =>
      el.textContent?.includes('50 bb'),
    );
    expect(btn50).toBeTruthy();
    btn50?.click();
    await Promise.resolve();
    expect(host.textContent).toContain('UTG+1');

    // Switch back to 6-max 100 bb and open builder
    const sixMaxRadio = Array.from(host.querySelectorAll('[role="radio"]')).find((el) =>
      el.textContent?.includes('6-max'),
    ) as HTMLElement | undefined;
    sixMaxRadio?.click();
    const btn100 = Array.from(host.querySelectorAll('button')).find((el) =>
      el.textContent?.includes('100 bb'),
    );
    btn100?.click();

    const continueBtn = Array.from(host.querySelectorAll('button')).find((el) =>
      el.textContent?.includes('Continue'),
    );
    expect(continueBtn).toBeTruthy();
    continueBtn?.click();
    await Promise.resolve();
    expect(host.textContent).toContain('13×13 plan matrix');

    // Switch to Leak Map
    store.setActiveView('leakMap');
    await Promise.resolve();
    render(<StrategyRoom store={store} />, host);
    expect(host.textContent).toContain('Where your plan differs from the baseline');

    // Switch to Commitment River
    store.setActiveView('commitment');
    await Promise.resolve();
    render(<StrategyRoom store={store} />, host);
    expect(host.textContent).toContain('30-100 bb stack flow & commitment planner');
    expect(host.textContent).toContain('Heads-up raised (5.5 bb)');
    expect(host.textContent).toContain('Bluff fold need');
    expect(solveGeometricFraction(4, 2)).toBeCloseTo(1, 5);
    expect(solveGeometricFraction(13, 3)).toBeCloseTo(1, 5);

    const geo3Btn = Array.from(host.querySelectorAll('button')).find((el) =>
      el.textContent?.includes('3-street'),
    );
    expect(geo3Btn).toBeTruthy();
    geo3Btn?.click();
    await Promise.resolve();
    expect(host.textContent).toContain('Geometric all-in');

    // Switch to Range Walk
    store.setActiveView('rangeWalk');
    await Promise.resolve();
    render(<StrategyRoom store={store} />, host);
    expect(host.textContent).toContain('Range walk across streets');
    expect(host.textContent).toContain('Two Pair+');
    expect(host.textContent).toContain('Keeping');
  });
});
