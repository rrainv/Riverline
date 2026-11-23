import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppearance, updateAppearance } from '../../../domain/appearance';
import { ensureLocaleLoaded } from '../../../i18n';
import { createHomeStore } from '../../../domain/home';
import { HomeRoom } from './HomeRoom';

async function flush() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 10));
}

function findButtonByText(root: HTMLElement, text: string): HTMLButtonElement {
  const buttons = Array.from(root.querySelectorAll('button'));
  const found = buttons.find((btn) => (btn.textContent ?? '').includes(text));
  if (!found) {
    throw new Error(`Button containing "${text}" not found`);
  }
  return found;
}

describe('HomeRoom (/)', () => {
  let host: HTMLDivElement;

  beforeAll(async () => {
    await Promise.all([ensureLocaleLoaded('ru'), ensureLocaleLoaded('he')]);
  });

  beforeEach(() => {
    initAppearance();
    updateAppearance({ lang: 'en', theme: 'midnight', motion: 'reduced' }, { persist: false });
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    render(null, host);
    host.remove();
  });

  it('renders returning coach layout with single primary button, leak snapshot, week card, and night card', async () => {
    const store = createHomeStore({
      nowFn: () => new Date('2026-11-16T20:00:00').getTime(),
    });
    store.applyPreset('returning');

    const onOpenTraining = vi.fn();
    const onOpenStrategy = vi.fn();
    const onOpenReview = vi.fn();
    const onOpenHandRecorder = vi.fn();
    const onOpenEquity = vi.fn();
    const onOpenNights = vi.fn();

    render(
      <HomeRoom
        store={store}
        onOpenTraining={onOpenTraining}
        onOpenStrategy={onOpenStrategy}
        onOpenReview={onOpenReview}
        onOpenHandRecorder={onOpenHandRecorder}
        onOpenEquity={onOpenEquity}
        onOpenNights={onOpenNights}
      />,
      host,
    );
    await flush();

    const heading = host.querySelector('h1');
    expect(heading?.textContent).toBe('Good evening.');
    expect(host.textContent).toContain("Friday at Dan's");
    expect(
      host.querySelector('[role="grid"][aria-label="Compact leak map snapshot"]'),
    ).not.toBeNull();

    findButtonByText(host, 'Training').click();
    expect(onOpenTraining).toHaveBeenCalledWith('hub');

    const expectedLeak = store.topLeakSignal.value;
    expect(expectedLeak).not.toBeNull();
    findButtonByText(host, 'Start lab').click();
    expect(onOpenTraining).toHaveBeenCalledWith('leak_lab', {
      position: expectedLeak?.position,
      familyId: expectedLeak?.familyId,
    });

    findButtonByText(host, 'Open night').click();
    expect(onOpenNights).toHaveBeenCalledWith('home-friday', 'settle');

    findButtonByText(host, 'Review hand').click();
    expect(onOpenReview).toHaveBeenCalledWith('home-preset-friday-hand');

    findButtonByText(host, 'Reopen equity matchup').click();
    expect(onOpenEquity).toHaveBeenCalledWith('home-preset-matchup-1');
  });

  it('renders honest first_visit starter without fake nights or fake leaks', async () => {
    const store = createHomeStore({
      nowFn: () => new Date('2026-11-16T09:00:00').getTime(),
    });
    store.applyPreset('first_visit');

    const onOpenHandRecorder = vi.fn();

    render(
      <HomeRoom
        store={store}
        onOpenTraining={vi.fn()}
        onOpenStrategy={vi.fn()}
        onOpenReview={vi.fn()}
        onOpenHandRecorder={onOpenHandRecorder}
        onOpenEquity={vi.fn()}
        onOpenNights={vi.fn()}
      />,
      host,
    );
    await flush();

    expect(host.querySelector('h1')?.textContent).toBe('Good morning.');
    expect(host.textContent).toContain('Start from a real hand or spot');
    expect(host.textContent).not.toContain('Last game night');

    findButtonByText(host, 'Record a hand').click();
    expect(onOpenHandRecorder).toHaveBeenCalledTimes(1);
  });

  it('switches presentation cleanly between en, ru, and he', async () => {
    const store = createHomeStore({
      nowFn: () => new Date('2026-11-16T14:00:00').getTime(),
    });
    store.applyPreset('returning');

    const props = {
      store,
      onOpenTraining: vi.fn(),
      onOpenStrategy: vi.fn(),
      onOpenReview: vi.fn(),
      onOpenHandRecorder: vi.fn(),
      onOpenEquity: vi.fn(),
      onOpenNights: vi.fn(),
    };

    render(<HomeRoom {...props} />, host);
    await flush();
    expect(host.querySelector('h1')?.textContent).toBe('Good afternoon.');

    updateAppearance({ lang: 'ru' }, { persist: false });
    render(<HomeRoom {...props} />, host);
    await flush();
    expect(host.querySelector('h1')?.textContent).toBe('Добрый день.');

    updateAppearance({ lang: 'he' }, { persist: false });
    render(<HomeRoom {...props} />, host);
    await flush();
    expect(host.querySelector('h1')?.textContent).toBe('צהריים טובים.');
  });

  it('personalizes greeting when playerName is set, renders Study momentum, and passes topTag to Review', async () => {
    updateAppearance({ lang: 'en', playerName: 'Alex', dailyStudyGoal: 10 }, { persist: false });
    const store = createHomeStore({
      nowFn: () => new Date('2026-11-16T20:00:00').getTime(),
    });
    store.applyPreset('returning');

    const onOpenReview = vi.fn();
    render(
      <HomeRoom
        store={store}
        onOpenTraining={vi.fn()}
        onOpenStrategy={vi.fn()}
        onOpenReview={onOpenReview}
        onOpenHandRecorder={vi.fn()}
        onOpenEquity={vi.fn()}
        onOpenNights={vi.fn()}
      />,
      host,
    );
    await flush();

    expect(host.querySelector('h1')?.textContent).toBe('Good evening, Alex.');
    expect(host.textContent).toContain('Study momentum');
    expect(host.textContent).toContain('Level ');

    findButtonByText(host, 'Review tagged hands').click();
    expect(onOpenReview).toHaveBeenCalledWith(undefined, 'unsure');
  });
});
