import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppearance, updateAppearance } from '../../../domain/appearance';
import { ensureLocaleLoaded } from '../../../i18n';
import { createLearnStore } from '../../../domain/learn';
import { bucketForEquity, EQUITY_INTUITION_SPOTS } from '../../../domain/learn/equityIntuitionSpots';
import { createMemoryStudyBackend, createStudyRepository } from '../../../domain/storage';
import { createEngineClient, EQUITY_REQUEST_SCHEMA_VERSION } from '../../../engine-api';
import { LearnRoom } from './LearnRoom';

describe('LearnRoom', () => {
  let host: HTMLDivElement;

  beforeAll(async () => {
    await Promise.all([ensureLocaleLoaded('ru'), ensureLocaleLoaded('he')]);
  });

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

  function makeStore() {
    return createLearnStore({
      engineClient: createEngineClient({ mode: 'inline' }),
      repository: createStudyRepository(createMemoryStudyBackend()),
    });
  }

  it('renders 9 concepts including Why multiway is different and opens exact worked examples', () => {
    const store = makeStore();
    render(<LearnRoom store={store} onNavigateRoom={() => {}} />, host);

    expect(host.textContent).toContain('Pot odds');
    expect(host.textContent).toContain('Why multiway is different');

    const multiwayBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Why multiway is different'),
    )!;
    multiwayBtn.click();
    render(<LearnRoom store={store} onNavigateRoom={() => {}} />, host);

    expect(host.textContent).toContain('903');
    expect(host.textContent).toContain('Drill it in Training');
  });

  it('grades pot odds and outs spots and displays first-try record honestly', async () => {
    const store = makeStore();
    render(<LearnRoom store={store} onNavigateRoom={() => {}} />, host);

    expect(host.textContent).toContain('25.0%');
    const rightBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('25.0%'),
    )!;
    rightBtn.click();
    await new Promise((r) => setTimeout(r, 0));
    render(<LearnRoom store={store} onNavigateRoom={() => {}} />, host);

    expect(host.textContent).toContain('Correct.');
    expect(host.textContent).toContain('First-try pot-odds record: 1 of 1.');

    store.setTrainerMode('outs');
    render(<LearnRoom store={store} onNavigateRoom={() => {}} />, host);
    expect(host.textContent).toContain('9 outs');
  });

  it('switches to Glossary and Where Riverline is weak cleanly in Russian and Hebrew RTL', () => {
    const store = makeStore();
    const onNavigate = vi.fn();

    store.setActiveSection('glossary');
    updateAppearance({ lang: 'ru' });
    render(<LearnRoom store={store} onNavigateRoom={onNavigate} />, host);
    expect(host.textContent).toContain('пас');
    expect(host.textContent).toContain('шансы банка');

    store.setActiveSection('weaknesses');
    updateAppearance({ lang: 'he' });
    render(<LearnRoom store={store} onNavigateRoom={onNavigate} />, host);
    expect(host.textContent).toContain('איפה Riverline חלש');
    expect(host.textContent).toContain('משוער');
    expect(host.textContent).toContain('לא זמין');
  });

  it('grades Equity estimate trainer spots and matches exact engine enumeration', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    for (const spot of EQUITY_INTUITION_SPOTS) {
      const res = await engine.async.calculateEquity({
        schemaVersion: EQUITY_REQUEST_SCHEMA_VERSION,
        board: [...spot.board],
        deadCards: [],
        method: 'exact',
        players: [
          { id: 'hero', cards: [...spot.heroCards] },
          { id: 'villain', cards: [...spot.villainCards] },
        ],
      });
      expect(res.ok && 'players' in res.data && 'trials' in res.data).toBe(true);
      if (res.ok && 'players' in res.data && 'trials' in res.data) {
        const hero = res.data.players.find((p: { id: string }) => p.id === 'hero')!;
        const pct = Math.round(hero.equity * 1000) / 10;
        expect(pct).toBe(spot.exactEquityPct);
        expect(res.data.trials).toBe(spot.trials);
        expect(bucketForEquity(pct)).toBe(spot.correctBucketIndex);
      }
    }

    const store = makeStore();
    render(<LearnRoom store={store} onNavigateRoom={() => {}} />, host);
    const eqModeRadio = Array.from(host.querySelectorAll('[role="radio"]')).find((el) =>
      el.textContent?.includes('Equity estimate'),
    ) as HTMLElement | undefined;
    expect(eqModeRadio).toBeDefined();
    eqModeRadio!.click();
    await new Promise((r) => setTimeout(r, 0));
    render(<LearnRoom store={store} onNavigateRoom={() => {}} />, host);

    expect(host.textContent).toContain('Estimate Hero equity');
    const bucketBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('20% - 35%'),
    );
    expect(bucketBtn).toBeDefined();
    bucketBtn!.click();
    await new Promise((r) => setTimeout(r, 0));
    render(<LearnRoom store={store} onNavigateRoom={() => {}} />, host);

    expect(host.textContent).toContain('Correct.');
    expect(host.textContent).toContain('25.6%');
    expect(host.textContent).toContain('Session equity estimates: 1 of 1 in the exact bucket.');
  });
});
