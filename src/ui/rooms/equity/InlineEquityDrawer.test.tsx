import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppearance } from '../../../domain/appearance';
import { getSharedEquityStore, resetSharedEquityStore } from '../../../domain/equity';
import { activeRouteSignal, navigateTo } from '../../../domain/shellState';
import { InlineEquityDrawer } from './InlineEquityDrawer';

async function flush(ticks = 6) {
  for (let i = 0; i < ticks; i += 1) {
    await new Promise((r) => setTimeout(r, 15));
  }
}

describe('InlineEquityDrawer', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    window.localStorage.clear();
    initAppearance();
    resetSharedEquityStore();
    navigateTo('review');
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    render(null, host);
    host.remove();
    resetSharedEquityStore();
  });

  it('supports Custom range input (top 20%) and Open in Equity bridge', async () => {
    const onClose = vi.fn();
    render(
      <InlineEquityDrawer
        open
        onToggle={() => {}}
        onClose={onClose}
        heroCards={['As', 'Kd']}
        baseBoard={['Qh', '7c', '2h']}
        defaultSource="any"
      />,
      host,
    );

    await flush();

    const customBtn = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Custom',
    );
    expect(customBtn).toBeDefined();
    customBtn!.click();
    await flush();

    const input = host.querySelector('input[type="text"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input!.value).toBe('top 20%');

    const openEquityBtn = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Open in Equity',
    );
    expect(openEquityBtn).toBeDefined();
    openEquityBtn!.click();
    await flush();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(activeRouteSignal.value).toBe('equity');
    const equityStore = getSharedEquityStore();
    expect(equityStore.boardSignal.value).toEqual(['Qh', '7c', '2h']);
    expect(equityStore.playersSignal.value[0]?.canonical).toBe('AsKd');
    expect(equityStore.playersSignal.value[1]?.canonical).toContain('top 20%');
  }, 15000);
});
