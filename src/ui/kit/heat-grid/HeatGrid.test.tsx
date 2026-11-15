import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppearance } from '../../../domain/appearance';
import { HeatGrid, type HeatGridRow } from './HeatGrid';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const SAMPLE_ROWS: HeatGridRow[] = [
  {
    id: 'row-0',
    label: 'Pairs',
    cells: [
      { id: 'c00', label: 'A♠', ariaLabel: 'A♠', tone: 'neutral' },
      { id: 'c01', label: 'K♠', ariaLabel: 'K♠', tone: 'okHigh' },
      { id: 'c02', label: 'Q♠', ariaLabel: 'Q♠', tone: 'struck', struck: true },
    ],
  },
  {
    id: 'row-1',
    label: 'Ax suited',
    cells: [
      { id: 'c10', label: 'A♥', ariaLabel: 'A♥', tone: 'overHigh', hasBaselineTick: true },
      { id: 'c11', label: 'K♥', ariaLabel: 'K♥', tone: 'underLow' },
      { id: 'c12', label: 'Q♥', ariaLabel: 'Q♥', tone: 'neutral' },
    ],
  },
];

describe('HeatGrid', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    window.localStorage.clear();
    initAppearance();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    if (host.firstChild) {
      render(null, host);
    }
    host.remove();
  });

  it('supports arrow navigation, Enter activation, and Escape clearing', async () => {
    const onActivate = vi.fn();
    const onClear = vi.fn();

    render(
      <HeatGrid
        variant="runout"
        ariaLabel="Runout grid"
        rows={SAMPLE_ROWS}
        onActivateCell={onActivate}
        onClearActive={onClear}
        animateEntrance={false}
      />,
      host,
    );

    const cells = Array.from(host.querySelectorAll('button[role="gridcell"]')) as HTMLButtonElement[];
    expect(cells.length).toBe(6);
    expect(cells[0]!.tabIndex).toBe(0);
    expect(cells[1]!.tabIndex).toBe(-1);

    cells[0]!.focus();
    cells[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await flush();
    expect(document.activeElement).toBe(cells[1]);

    cells[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await flush();
    expect(document.activeElement).toBe(cells[4]);

    cells[4]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await flush();
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate.mock.calls[0]![0].id).toBe('c11');
    expect(cells[4]!.getAttribute('aria-selected')).toBe('true');

    cells[4]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flush();
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(cells[4]!.getAttribute('aria-selected')).toBe('false');
  });

  it('blocks activation of struck/disabled cards', () => {
    const onActivate = vi.fn();
    render(
      <HeatGrid
        variant="runout"
        ariaLabel="Runout grid"
        rows={SAMPLE_ROWS}
        onActivateCell={onActivate}
      />,
      host,
    );

    const struckBtn = host.querySelectorAll('button[role="gridcell"]')[2] as HTMLButtonElement;
    expect(struckBtn.getAttribute('aria-disabled')).toBe('true');
    struckBtn.click();
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('keeps matrix13 forced LTR even under RTL document direction', () => {
    document.documentElement.dir = 'rtl';
    render(
      <HeatGrid
        variant="matrix13"
        ariaLabel="Matrix"
        rows={[
          {
            id: 'r0',
            cells: [
              { id: 'AA', label: 'AA', ariaLabel: 'AA', matrixState: 'match' },
              { id: 'AKs', label: 'AKs', ariaLabel: 'AKs', matrixState: 'yours' },
              { id: 'AQs', label: 'AQs', ariaLabel: 'AQs', matrixState: 'baseline' },
              { id: 'AJs', label: 'AJs', ariaLabel: 'AJs', matrixState: 'unknown' },
            ],
          },
        ]}
      />,
      host,
    );

    const grid = host.querySelector('[role="grid"]');
    expect(grid?.getAttribute('dir')).toBe('ltr');
  });
});
