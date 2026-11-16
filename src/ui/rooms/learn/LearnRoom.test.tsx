import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppearance, updateAppearance } from '../../../domain/appearance';
import { createLearnStore } from '../../../domain/learn';
import { createMemoryStudyBackend, createStudyRepository } from '../../../domain/storage';
import { createEngineClient } from '../../../engine-api';
import { LearnRoom } from './LearnRoom';

describe('LearnRoom', () => {
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
});
