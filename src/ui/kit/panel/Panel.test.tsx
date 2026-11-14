import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppearance } from '../../../domain/appearance';
import { Panel, PanelSection } from './Panel';

describe('Panel (#2)', () => {
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

  it('renders micro label, title, single tier badge in header, and PanelSection divider', () => {
    render(
      <Panel
        label="Turn equity"
        title="Board Qs 7c 2h"
        titleId="turn-eq"
        tier={{ tier: 'exact', detail: 'all 990 runouts' }}
      >
        <p>Main body</p>
        <PanelSection label="Sub-section">
          <p>Sub body</p>
        </PanelSection>
      </Panel>,
      host,
    );

    const section = host.querySelector('section');
    expect(section?.getAttribute('aria-labelledby')).toBe('turn-eq');
    expect(host.querySelector('#turn-eq')?.textContent).toBe('Board Qs 7c 2h');
    const tierEl = host.querySelector('[data-tier="exact"]');
    expect(tierEl?.textContent).toContain('Exact');
    expect(tierEl?.textContent).toContain('all 990 runouts');
    expect(host.textContent).toContain('Sub-section');
  });

  it('renders loading shimmer and empty honest state', () => {
    render(<Panel title="Loading panel" loading />, host);
    expect(host.querySelector('section')?.getAttribute('aria-busy')).toBe('true');

    render(<Panel title="Empty panel" empty="Nothing recorded yet." />, host);
    expect(host.textContent).toContain('Nothing recorded yet.');
  });

  it('warns in dev when a Panel is nested inside another Panel', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <Panel title="Outer">
        <Panel title="Inner">Bad</Panel>
      </Panel>,
      host,
    );
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
