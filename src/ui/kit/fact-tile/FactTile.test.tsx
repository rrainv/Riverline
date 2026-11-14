import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initAppearance } from '../../../domain/appearance';
import { FactTile } from './FactTile';

describe('FactTile (#13)', () => {
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

  it('renders tabular number inside <PokerNotation>, updates to exact value, and shows Unavailable when null', () => {
    render(<FactTile label="Hero equity" value={25.6} decimals={1} unit="%" tier="exact" instant />, host);
    expect(host.querySelector('bdi[dir="ltr"]')?.textContent).toBe('25.6%');
    expect(host.querySelector('[data-exact-value="25.6"]')).not.toBeNull();

    render(<FactTile label="Hero equity" value={64.2} decimals={1} unit="%" tier="exact" instant />, host);
    expect(host.querySelector('bdi[dir="ltr"]')?.textContent).toBe('64.2%');

    render(<FactTile label="Hero equity" value={null} />, host);
    expect(host.textContent).toContain('Unavailable');
  });
});
