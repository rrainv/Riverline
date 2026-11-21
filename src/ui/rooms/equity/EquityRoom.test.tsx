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

  it('renders Can I call? price strip, Blocker X-Ray when range villain exists, and Runout volatility shape on flop', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createEquityStore({ engine, repository: repo, autoCompute: false });

    await store.recompute();
    render(<EquityRoom store={store} />, host);
    await flush();

    // 1. "Can I call?" price strip defaults (pot 12, bet 6, stack 40):
    // required equity = 6 / (12 + 12) = 25.0%, SPR = 34 / 24 = 1.42, MDF = 18 / 24 = 75.0%
    expect(host.textContent).toContain('Can I call? (Pot price & commitment)');
    expect(host.textContent).toContain('25.0%');
    expect(host.textContent).toContain('1.42');
    expect(host.textContent).toContain('75.0%');
    expect(host.textContent).toContain('clears the');

    // Increase bet to call via Stepper (+) and verify price strip updates
    const betIncBtn = host.querySelector(
      'button[aria-label="Bet to call (bb): Increase"]',
    ) as HTMLButtonElement | null;
    expect(betIncBtn).not.toBeNull();
    betIncBtn!.click();
    await flush();
    // With bet = 6.5, pot = 12, stack = 40: required equity = 6.5 / 25 = 26.0%
    expect(host.textContent).toContain('26.0%');

    // 2. Runout volatility shape strip on the flop
    expect(host.textContent).toContain('Runout volatility shape');
    expect(host.textContent).toMatch(/Upgrades \(\+5%\+\): \d+/);
    expect(host.textContent).toMatch(/Bricks \(within 5%\): \d+/);
    expect(host.textContent).toMatch(/Dangers \(-5%\+\): \d+/);

    // 3. Blocker X-Ray appears when a range villain (QQ+) is added against Hero's exact cards (AhKh)
    expect(host.textContent).not.toContain('Blocker X-Ray (Card removal)');
    expect(store.addPlayer('QQ+')).toBe(true);
    await store.recompute();
    await flush();

    expect(host.textContent).toContain('Blocker X-Ray (Card removal)');
    expect(host.textContent).toContain('Your hole cards remove 95 combos (1176 → 1081 eligible).');
    expect(host.textContent).toContain('AA (-3)');
    expect(host.textContent).toContain('KK (-3)');

    store.dispose();
    engine.dispose();
  }, 15000);

  it('allows removing Hero when 3+ players exist, editing any row via 13x13 matrix, and selective randomizer keeps', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createEquityStore({
      engine,
      repository: repo,
      autoCompute: false,
    });
    await store.recompute();

    render(<EquityRoom store={store} />, host);
    await flush();

    // Add a 3rd player so remove buttons appear on all rows including Hero
    expect(store.addPlayer('Th9h')).toBe(true);
    await store.recompute();
    await flush();

    const removeHeroBtn = host.querySelector(
      'button[aria-label="Remove Hero"]',
    ) as HTMLButtonElement | null;
    expect(removeHeroBtn).not.toBeNull();
    removeHeroBtn!.click();
    await flush();
    expect(store.playersSignal.value).toHaveLength(2);
    expect(store.playersSignal.value[0]!.isHero).toBe(true);
    expect(store.playersSignal.value[0]!.canonical).toBe('QsQc');

    // Open row editor for Hero and toggle AA via 13x13 matrix
    const editHeroBtn = host.querySelector(
      'button[aria-label="Edit hand or range for Hero"]',
    ) as HTMLButtonElement | null;
    expect(editHeroBtn).not.toBeNull();
    editHeroBtn!.click();
    await flush();

    const aaCell = Array.from(host.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'AA',
    );
    expect(aaCell).toBeDefined();
    aaCell!.click();
    await flush();
    expect(store.playersSignal.value[0]!.inputKind).toBe('range');
    expect(store.playersSignal.value[0]!.canonical).toContain('AA');

    // Test selective randomizer via Randomize ▾ dropdown menu
    expect(store.updatePlayerInput(store.playersSignal.value[0]!.id, 'AsKd')).toBe(true);
    const randomMenuBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Randomize ▾'),
    );
    expect(randomMenuBtn).toBeDefined();
    randomMenuBtn!.click();
    await flush();

    const keepHeroBtn = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Keep Hero',
    );
    expect(keepHeroBtn).toBeDefined();
    keepHeroBtn!.click();
    await flush();

    const dealMatchupBtn = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Deal random matchup',
    );
    expect(dealMatchupBtn).toBeDefined();
    dealMatchupBtn!.click();
    await flush();
    expect(store.playersSignal.value[0]!.canonical).toBe('AsKd');

    // Open menu again and randomize only villain hands -> Hero remains AsKd
    randomMenuBtn!.click();
    await flush();
    const randVillainsBtn = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Randomize villain hands',
    );
    expect(randVillainsBtn).toBeDefined();
    randVillainsBtn!.click();
    await flush();
    expect(store.playersSignal.value[0]!.canonical).toBe('AsKd');
    expect(store.playersSignal.value[1]!.inputKind).toBe('exact');

    store.dispose();
    engine.dispose();
  }, 15000);
});
