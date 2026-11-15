import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppearance } from '../../../domain/appearance';
import { FamilyStrip, type FamilyStripItem } from './FamilyStrip';

const KINGS: FamilyStripItem[] = ['AKs', 'KQs', 'KJs', 'KTs', 'K9s', 'K8s'].map((hand) => ({
  id: hand,
  hand,
  combos: 4,
}));

describe('FamilyStrip', () => {
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

  it('computes live hand and combination totals and stays LTR', () => {
    document.documentElement.dir = 'rtl';
    render(
      <FamilyStrip
        ariaLabel="Suited kings cutoff"
        items={KINGS}
        cutoffIndex={2}
        baselineCutoffIndex={2}
      />,
      host,
    );

    const slider = host.querySelector('[role="slider"]');
    expect(slider?.getAttribute('dir')).toBe('ltr');
    expect(slider?.getAttribute('aria-valuenow')).toBe('2');
    expect(host.textContent).toContain('3 hands · 12 combos');
    expect(host.textContent).toContain('Matches baseline (KJs)');
  });

  it('updates cutoff via arrow keys, Home/Escape, End, and click', () => {
    const onChange = vi.fn();
    render(
      <FamilyStrip
        ariaLabel="Suited kings cutoff"
        items={KINGS}
        cutoffIndex={2}
        onChangeCutoff={onChange}
      />,
      host,
    );

    const slider = host.querySelector('[role="slider"]') as HTMLElement;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(3);

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(1);

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(5);

    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(-1);

    const targetCell = host.querySelector('[data-strip-index="4"]') as HTMLElement;
    targetCell.click();
    expect(onChange).toHaveBeenLastCalledWith(4);
  });

  it('ignores input when disabled', () => {
    const onChange = vi.fn();
    render(
      <FamilyStrip
        ariaLabel="Suited kings cutoff"
        items={KINGS}
        cutoffIndex={2}
        disabled
        onChangeCutoff={onChange}
      />,
      host,
    );

    const slider = host.querySelector('[role="slider"]') as HTMLElement;
    expect(slider.getAttribute('aria-disabled')).toBe('true');
    expect(slider.tabIndex).toBe(-1);
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
