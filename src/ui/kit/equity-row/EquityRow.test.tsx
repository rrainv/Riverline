import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppearance } from '../../../domain/appearance';
import { EquityList, EquityRow } from './EquityRow';

describe('EquityRow (#11)', () => {
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

  it('renders who, cards/range/unknown, bar with previous-street tick, single equity %, right-now fact, expand & remove', () => {
    const onExpand = vi.fn();
    const onRemove = vi.fn();

    render(
      <EquityList rowKeys={['hero', 'range', 'unknown']}>
        <EquityRow
          id="hero"
          who="Hero"
          whoMeta="BTN"
          isHero
          cards={[{ card: 'Ah' }, { card: 'Kh' }]}
          equityPct={62.4}
          previousEquityPct={54.0}
          deltaPct={8.4}
          rightNow="Nut flush draw"
          density="roomy"
          expanded
          onToggleExpand={onExpand}
          expandedContent="All 990 turn and river combinations"
          onRemove={onRemove}
        />
        <EquityRow
          id="range"
          who="Astra"
          rangeLabel="QQ+, AK"
          equityPct={26.8}
          density="dense"
          rightNow="Overpair possible"
        />
        <EquityRow
          id="unknown"
          who="Orion"
          equityPct={10.8}
          density="compact"
          rightNow="Unknown hand"
        />
      </EquityList>,
      host,
    );

    expect(host.querySelectorAll('[data-equity-row]')).toHaveLength(3);
    expect(host.textContent).toContain('62.4%');
    expect(host.textContent).toContain('+8.4%');
    expect(host.textContent).toContain('QQ+, AK');
    expect(host.textContent).toContain('All 990 turn and river combinations');
    expect(host.querySelector('[style*="--prev-pct"]')).not.toBeNull();
    // Face-down cards for unknown opponent
    expect(host.querySelectorAll('[data-equity-row="unknown"] [data-audit-allow="true"]')).toHaveLength(2);

    const buttons = host.querySelectorAll<HTMLButtonElement>('[data-equity-row="hero"] button');
    buttons[0]!.click();
    buttons[1]!.click();
    expect(onExpand).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
