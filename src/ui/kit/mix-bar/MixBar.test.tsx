import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initAppearance, updateAppearance } from '../../../domain/appearance';
import { MixBar } from './MixBar';

describe('MixBar (#10)', () => {
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

  it('keeps LTR axis even when app locale is Hebrew RTL and places "you" pointer below the bar', () => {
    updateAppearance({ lang: 'he' });

    render(
      <MixBar
        youPositionPct={78}
        youLabel="אתה"
        segments={[
          { id: 'fold', pct: 14, label: 'פולד', tone: 'fold' },
          { id: 'call', pct: 36, label: 'קול 36%', tone: 'call' },
          { id: 'r8', pct: 50, label: '8', tone: 'raise2' },
        ]}
      />,
      host,
    );

    const region = host.querySelector('[role="region"]')!;
    expect(region.getAttribute('dir')).toBe('ltr');
    expect(region.textContent).toContain('אתה');
    expect(region.textContent).toContain('קול 36%');
  });

  it('updates pointer CSS variable position cleanly across raise sizes', () => {
    const { container } = { container: host };
    render(
      <MixBar
        youPositionPct={94}
        segments={[
          { id: 'call', pct: 50, label: 'Call 50%', tone: 'call' },
          { id: 'r10', pct: 50, label: 'Raise 50%', tone: 'raise2' },
        ]}
      />,
      container,
    );

    const mover = host.querySelector<HTMLElement>('[style*="--you-pos"]')!;
    expect(mover.style.getPropertyValue('--you-pos')).toBe('94');
  });
});
