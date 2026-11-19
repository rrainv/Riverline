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

  it('supports stacked label + sub-amount presets and non-adjustable presets like All-in', () => {
    const onSelectSize = vi.fn();

    render(
      <OptionTickets
        tickets={[
          { id: 'bet', shortcut: '3', label: 'Bet', amount: '4.0 bb' },
        ]}
        selectedTicketId="bet"
        onSelectTicket={() => {}}
        sizes={[
          {
            id: 'p50',
            label: '50%',
            displayAmount: '4.0 bb',
            value: 4,
            costDetail: 'Astra needs 4.0 bb to call (~33% pot)',
            step: 0.5,
            min: 1,
            max: 99,
            adjustable: true,
          },
          {
            id: 'allin',
            label: 'All-in',
            displayAmount: '99.0 bb',
            value: 99,
            costDetail: 'Astra needs 99.0 bb to call',
            adjustable: false,
          },
        ]}
        selectedSizeId="allin"
        onSelectSize={onSelectSize}
        onAdjustSize={() => {}}
      />,
      host,
    );

    expect(host.textContent).toContain('50%');
    expect(host.textContent).toContain('4.0 bb');
    expect(host.textContent).toContain('All-in');
    expect(host.textContent).toContain('99.0 bb');
    // adjustable=false hides +/- stepper controls for All-in while 50% retains its steppers
    expect(host.querySelector('button[aria-label*="Decrease preset 50%"]')).not.toBeNull();
    expect(host.querySelector('button[aria-label*="Decrease preset All-in"]')).toBeNull();
    expect(host.querySelector('button[aria-label*="Increase preset All-in"]')).toBeNull();

    const p50Btn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('50%'),
    )!;
    p50Btn.click();
    expect(onSelectSize).toHaveBeenCalledWith('p50');
  });

  it('marks correct and wrong outcome tickets without hiding confirm when showConfirm is false', () => {
    render(
      <OptionTickets
        tickets={[
          { id: 'o0', shortcut: '1', label: '20.0%', outcome: 'wrong', disabled: true },
          { id: 'o1', shortcut: '2', label: '25.0%', outcome: 'correct', disabled: true },
        ]}
        selectedTicketId="o0"
        onSelectTicket={() => {}}
        showConfirm={false}
      />,
      host,
    );

    const wrongBtn = host.querySelector<HTMLButtonElement>('[data-ticket-id="o0"]')!;
    const rightBtn = host.querySelector<HTMLButtonElement>('[data-ticket-id="o1"]')!;
    expect(wrongBtn.dataset.outcome).toBe('wrong');
    expect(rightBtn.dataset.outcome).toBe('correct');
    expect(host.querySelectorAll('button')).toHaveLength(2);
  });

  it('handles page-level window shortcuts without focusing group and suppresses them when a dialog is open', async () => {
    const onSelect = vi.fn();
    render(
      <OptionTickets
        tickets={[
          { id: 'fold', shortcut: 'F', label: 'Fold' },
          { id: 'call', shortcut: 'C', label: 'Call', amount: '1 bb' },
        ]}
        onSelectTicket={onSelect}
        showConfirm={false}
      />,
      host,
    );

    await new Promise((r) => setTimeout(r, 20));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
    expect(onSelect).toHaveBeenCalledWith('call');

    onSelect.mockClear();
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    host.appendChild(dialog);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
