import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppearance, updateAppearance } from '../../../domain/appearance';
import { createNightsStore } from '../../../domain/nights';
import { createMemoryStudyBackend, createStudyRepository } from '../../../domain/storage';
import { NightsRoom } from './NightsRoom';

async function flush() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 10));
}

describe('NightsRoom (/nights)', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    initAppearance();
    updateAppearance({ lang: 'en', motion: 'reduced' }, { persist: false });
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    render(null, host);
    host.remove();
  });

  it('renders ledger balance gate, player sheet rebuy/correct/cash-out, and settles into morning-after summary', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createNightsStore({ repository: repo });

    await store.createNight({
      title: 'Friday Points',
      unitPreset: 'chips',
      players: [
        { displayName: 'Eli', initialBuyInInput: '200' },
        { displayName: 'Dan', initialBuyInInput: '200' },
      ],
    });

    const onRecordFullHand = vi.fn();
    const onOpenHandInReview = vi.fn();

    render(
      <NightsRoom
        store={store}
        onRecordFullHand={onRecordFullHand}
        onOpenHandInReview={onOpenHandInReview}
      />,
      host,
    );

    expect(host.textContent).toContain('Friday Points');
    expect(host.textContent).toContain('Still on the table');
    expect(host.textContent).toContain('400 pts');

    // Switch to Settle while players are still playing -> blocked
    const settleTab = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Settle'),
    );
    settleTab?.click();
    await flush();
    expect(host.textContent).toContain('Not ready to settle');

    const settleBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Settle the night'),
    ) as HTMLButtonElement | undefined;
    expect(settleBtn?.disabled).toBe(true);

    // Cash out both players via store/UI and verify settlement transfers appear
    const eliId = store.activeNightSignal.value!.session.participants[0]!.playerId;
    const danId = store.activeNightSignal.value!.session.participants[1]!.playerId;
    await store.cashOutPlayer(eliId, '270');
    await store.cashOutPlayer(danId, '130');
    await flush();

    expect(host.textContent).toContain('Dan pays Eli');
    expect(host.textContent).toContain('70 pts');

    const readySettleBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Settle the night'),
    ) as HTMLButtonElement | undefined;
    expect(readySettleBtn?.disabled).toBe(false);
    readySettleBtn?.click();
    await flush();

    expect(host.textContent).toContain('Morning-after summary');
    expect(host.textContent).toContain('Reopen night');
    store.dispose();
  });

  it('captures shorthand hands and triggers /hand and /review bridges', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createNightsStore({ repository: repo, initialPreset: 'hands' });
    const onRecordFullHand = vi.fn();
    const onOpenHandInReview = vi.fn();

    render(
      <NightsRoom
        store={store}
        onRecordFullHand={onRecordFullHand}
        onOpenHandInReview={onOpenHandInReview}
      />,
      host,
    );

    expect(host.textContent).toContain('Type a hand');
    expect(host.textContent).toContain('6 actions and 3 board cards');

    const recordBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Record full hand'),
    );
    recordBtn?.click();
    expect(onRecordFullHand).toHaveBeenCalledWith('preset-friday', 'ils');

    const reviewBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Open in Review'),
    );
    reviewBtn?.click();
    expect(onOpenHandInReview).toHaveBeenCalledWith('preset-hand-1');
    store.dispose();
  });
});
