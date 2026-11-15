import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppearance } from '../../../domain/appearance';
import { HistoryRail, StreetStrip } from './HistoryRail';

describe('HistoryRail and StreetStrip (#12)', () => {
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

  it('groups rows by street, marks current step, and calls onSelectRow', () => {
    const onSelect = vi.fn();
    render(
      <HistoryRail
        currentRowId="f1"
        onSelectRow={onSelect}
        groups={[
          {
            id: 'pre',
            streetLabel: 'Preflop',
            potLabel: '1.5 bb',
            rows: [{ id: 'p1', actor: 'Hero', isHero: true, action: 'Raise to 8 bb', tag: '3-bet' }],
          },
          {
            id: 'flop',
            streetLabel: 'Flop',
            potLabel: '17.5 bb',
            rows: [{ id: 'f1', actor: 'Astra', action: 'Check' }],
          },
        ]}
      />,
      host,
    );

    const currentBtn = host.querySelector<HTMLButtonElement>('[data-history-row="f1"]')!;
    expect(currentBtn.getAttribute('aria-current')).toBe('step');
    expect(host.textContent).toContain('3-bet');
    host.querySelector<HTMLButtonElement>('[data-history-row="p1"]')!.click();
    expect(onSelect).toHaveBeenCalledWith('p1');
  });

  it('renders horizontal street strip with street, board cards, result, pot, and SPR', () => {
    const onSelectStreet = vi.fn();
    render(
      <StreetStrip
        currentStreetId="flop"
        onSelectStreet={onSelectStreet}
        streets={[
          { id: 'preflop', streetLabel: 'Preflop', result: 'Raised to 8.0 bb', pot: '17.5 bb', spr: '5.2' },
          {
            id: 'flop',
            streetLabel: 'Flop',
            cards: ['Qh', '7c', '2h'],
            result: 'Bet 6.0 bb',
            pot: '29.5 bb',
            spr: '2.9',
          },
          { id: 'river', streetLabel: 'River', result: 'Folded earlier', pot: '29.5 bb', spr: '2.9', disabled: true },
        ]}
      />,
      host,
    );

    expect(host.querySelector('[data-street-id="flop"]')?.getAttribute('aria-current')).toBe('step');
    expect(host.textContent).toContain('SPR');
    expect(host.textContent).toContain('29.5 bb');
    expect(host.querySelectorAll('[role="img"]')).toHaveLength(3);

    host.querySelector<HTMLButtonElement>('[data-street-id="preflop"]')!.click();
    host.querySelector<HTMLButtonElement>('[data-street-id="river"]')!.click();
    expect(onSelectStreet).toHaveBeenCalledTimes(1);
    expect(onSelectStreet).toHaveBeenCalledWith('preflop');
  });
});
