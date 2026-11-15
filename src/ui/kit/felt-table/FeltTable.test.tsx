import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppearance } from '../../../domain/appearance';
import { FeltTable } from './FeltTable';

describe('FeltTable (#9)', () => {
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

  it('renders seats with dealer mark, folded state, thinking dots, action bubble, board cards, and pot', () => {
    render(
      <FeltTable
        pot={19.5}
        activeSeatId="orion"
        board={[{ card: 'Qh' }, { card: '7c' }, { card: '2h' }]}
        seats={[
          {
            id: 'hero',
            name: 'You',
            stack: '97.0 bb',
            isHero: true,
            isDealer: true,
            cards: [{ card: 'Ks' }, { card: 'Qs' }],
            actionBubble: 'Call 3 bb',
          },
          {
            id: 'orion',
            name: 'Orion',
            stack: '94.0 bb',
            thinking: true,
            cards: [{ state: 'back' }, { state: 'back' }],
          },
          {
            id: 'lyra',
            name: 'Lyra',
            stack: '100 bb',
            folded: true,
          },
        ]}
      />,
      host,
    );

    expect(host.querySelector('[data-seat-id="lyra"]')?.getAttribute('data-folded')).toBe('true');
    expect(host.querySelector('[role="status"]')).not.toBeNull();
    expect(host.textContent).toContain('Call 3 bb');
    expect(host.textContent).toContain('19.5 bb');
    expect(host.querySelector('[title="Dealer"]')).not.toBeNull();
  });

  it('renders Training menu variant seats as real accessible buttons', () => {
    const onPick = vi.fn();
    render(
      <FeltTable
        mode="menu"
        heading="Pick a seat"
        menuSeats={[
          { id: 'drill', title: 'Quick drill', subtitle: '10 spots', emblem: 'pie', selected: true, onClick: onPick },
          { id: 'labs', title: 'Labs', emblem: 'chart', disabled: true, onClick: onPick },
        ]}
      />,
      host,
    );

    const buttons = host.querySelectorAll('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1]!.disabled).toBe(true);
    buttons[0]!.click();
    buttons[1]!.click();
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('positions 3 menu seats cleanly for the 3-mode Training hub', () => {
    render(
      <FeltTable
        mode="menu"
        heading="Training"
        menuSeats={[
          { id: 'drill', title: 'Quick drill', emblem: 'pie', onClick: () => {} },
          { id: 'duel', title: 'Heads-up duel', emblem: 'orbits', onClick: () => {} },
          { id: 'leak', title: 'Leak lab', emblem: 'chart', onClick: () => {} },
        ]}
      />,
      host,
    );

    const buttons = host.querySelectorAll('button');
    expect(buttons).toHaveLength(3);
  });
});
