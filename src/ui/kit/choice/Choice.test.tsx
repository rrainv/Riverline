import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppearance } from '../../../domain/appearance';
import { ChipButton, SegmentedControl } from './Choice';

describe('ChipButton and SegmentedControl (#5)', () => {
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

  it('toggles ChipButton aria-pressed state', () => {
    const onToggle = vi.fn();
    render(
      <ChipButton selected={false} onToggle={onToggle}>
        In position
      </ChipButton>,
      host,
    );
    const btn = host.querySelector('button')!;
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    btn.click();
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('moves SegmentedControl selection with ArrowRight / ArrowLeft and mirrors in RTL', () => {
    const onChange = vi.fn();
    const options = [
      { value: 'preflop', label: 'Preflop' },
      { value: 'flop', label: 'Flop' },
      { value: 'turn', label: 'Turn' },
    ] as const;

    render(
      <SegmentedControl
        ariaLabel="Street"
        options={options}
        value="flop"
        onChange={onChange}
      />,
      host,
    );

    const group = host.querySelector('[role="radiogroup"]')!;
    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith('turn');

    // Mirror direction for RTL
    (group as HTMLElement).style.direction = 'rtl';
    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith('preflop');
  });
});
