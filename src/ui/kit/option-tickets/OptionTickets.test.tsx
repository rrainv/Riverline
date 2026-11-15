import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppearance } from '../../../domain/appearance';
import { OptionTickets } from './OptionTickets';

describe('OptionTickets (#7)', () => {
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

  it('selects tickets by click or shortcut, keeps confirm disabled until chosen, and never uses "Selected"', () => {
    const onSelect = vi.fn();
    const onConfirm = vi.fn();

    render(
      <OptionTickets
        tickets={[
          { id: 'fold', shortcut: '1', label: 'Fold' },
          { id: 'call', shortcut: '2', label: 'Call', amount: '2.5 bb' },
          { id: 'raise', shortcut: '3', label: 'Raise to', amount: '8.0 bb' },
        ]}
        onSelectTicket={onSelect}
        onConfirm={onConfirm}
      />,
      host,
    );

    expect(host.textContent?.toLowerCase()).not.toContain('selected');
    const confirmBtn = Array.from(host.querySelectorAll('button')).at(-1)!;
    expect(confirmBtn.disabled).toBe(true);

    const group = host.querySelector('[role="group"]')!;
    group.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith('call');

    const firstTicket = host.querySelector<HTMLButtonElement>('[data-ticket-id="fold"]')!;
    firstTicket.click();
    expect(onSelect).toHaveBeenCalledWith('fold');
  });

  it('draws border SVG on chosen ticket, dims others, and provides non-nested ladder adjustments + reset', () => {
    const onAdjust = vi.fn();
    const onReset = vi.fn();
    const onSelectSize = vi.fn();

    render(
      <OptionTickets
        tickets={[
          { id: 'fold', shortcut: '1', label: 'Fold' },
          { id: 'raise', shortcut: '3', label: 'Raise to', amount: '8.0 bb' },
        ]}
        selectedTicketId="raise"
        onSelectTicket={() => {}}
        sizes={[
          { id: 's0', value: 8, costDetail: 'Villain needs 5.5 bb to call', step: 0.5, min: 3, max: 20 },
        ]}
        selectedSizeId="s0"
        onSelectSize={onSelectSize}
        onAdjustSize={onAdjust}
        onResetSizes={onReset}
      />,
      host,
    );

    expect(host.querySelectorAll('svg')).toHaveLength(1);
    // Ensure buttons are not nested inside buttons
    host.querySelectorAll('button').forEach((btn) => {
      expect(btn.querySelector('button')).toBeNull();
    });

    const minusBtn = host.querySelector<HTMLButtonElement>('button[aria-label*="Decrease"]')!;
    const plusBtn = host.querySelector<HTMLButtonElement>('button[aria-label*="Increase"]')!;
    const resetBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reset'),
    )!;

    minusBtn.click();
    plusBtn.click();
    resetBtn.click();

    expect(onAdjust).toHaveBeenNthCalledWith(1, 's0', 7.5);
    expect(onAdjust).toHaveBeenNthCalledWith(2, 's0', 8.5);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
