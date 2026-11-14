import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppearance } from '../../../domain/appearance';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from './Button';

describe('Button (#3)', () => {
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

  it('renders primary button with committed amount inside <PokerNotation> and fires onClick', () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" onClick={onClick} confirmed>
        Confirm: bet <PokerNotation>3.8 bb</PokerNotation>
      </Button>,
      host,
    );

    const btn = host.querySelector('button')!;
    expect(btn.querySelector('bdi[dir="ltr"]')?.textContent).toBe('3.8 bb');
    expect(btn.querySelector('svg')).not.toBeNull();
    btn.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('prevents clicks when disabled or loading and applies data-state for forced sheet states', () => {
    const onClick = vi.fn();
    render(
      <div>
        <Button variant="primary" disabled onClick={onClick}>
          Disabled
        </Button>
        <Button variant="secondary" loading onClick={onClick}>
          Loading
        </Button>
        <Button variant="danger" forceState="pressed">
          Delete
        </Button>
      </div>,
      host,
    );

    const buttons = host.querySelectorAll('button');
    buttons[0]!.click();
    buttons[1]!.click();
    expect(onClick).not.toHaveBeenCalled();
    expect(buttons[1]!.getAttribute('aria-busy')).toBe('true');
    expect(buttons[2]!.getAttribute('data-state')).toBe('pressed');
  });
});
