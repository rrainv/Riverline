import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppearance } from '../../../domain/appearance';
import { Stepper } from './Stepper';

describe('Stepper (#18)', () => {
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

  it('increments and decrements within bounds and disables buttons at min/max', () => {
    const onChange = vi.fn();
    render(
      <Stepper
        ariaLabel="Bet size"
        value={3.5}
        onChange={onChange}
        min={3.5}
        max={4.0}
        step={0.5}
        decimals={1}
        unit="bb"
        size="touch"
      />,
      host,
    );

    const buttons = host.querySelectorAll('button');
    const minus = buttons[0]!;
    const plus = buttons[1]!;

    expect(minus.disabled).toBe(true);
    expect(plus.disabled).toBe(false);
    expect(host.querySelector('output bdi[dir="ltr"]')?.textContent).toBe('3.5 bb');

    plus.click();
    expect(onChange).toHaveBeenCalledWith(4.0);
  });

  it('supports prefix unit placement for currency steppers', () => {
    const onChange = vi.fn();
    render(
      <Stepper
        ariaLabel="Rebuy"
        value={100}
        onChange={onChange}
        min={50}
        step={50}
        decimals={0}
        unit="₪"
        unitPosition="prefix"
      />,
      host,
    );

    expect(host.querySelector('output bdi[dir="ltr"]')?.textContent).toBe('₪100');
  });
});
