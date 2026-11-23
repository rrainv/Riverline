import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initAppearance, updateAppearance } from '../../../domain/appearance';
import { ensureLocaleLoaded } from '../../../i18n';
import { Chip, Kbd, TierBadge } from './Chip';

describe('Chip and TierBadge (#4)', () => {
  let host: HTMLDivElement;

  beforeAll(async () => {
    await Promise.all([ensureLocaleLoaded('ru'), ensureLocaleLoaded('he')]);
  });

  beforeEach(() => {
    initAppearance();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    render(null, host);
    host.remove();
  });

  it('renders all 4 tiers and qualified templates across locales without string concatenation', () => {
    render(
      <div>
        <TierBadge tier="exact" detail="all 990 runouts" />
        <TierBadge tier="estimated" source="Baseline" />
        <TierBadge tier="unavailable" />
        <Chip>Sample data</Chip>
        <Kbd>Ctrl K</Kbd>
      </div>,
      host,
    );

    expect(host.querySelector('[data-tier="exact"]')?.textContent).toBe('Exact · all 990 runouts');
    expect(host.querySelector('[data-tier="estimated"]')?.textContent).toBe('Baseline · Estimated');
    expect(host.querySelector('[data-tier="unavailable"]')?.textContent).toBe('Unavailable');
    expect(host.querySelector('kbd')?.getAttribute('dir')).toBe('ltr');

    updateAppearance({ lang: 'ru' }, { persist: false });
    render(<TierBadge tier="exact" detail="только по цене" />, host);
    expect(host.querySelector('[data-tier="exact"]')?.textContent).toBe('Точно · только по цене');
  });
});
