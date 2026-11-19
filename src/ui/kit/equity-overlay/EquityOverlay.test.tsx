import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppearance } from '../../../domain/appearance';
import { EquityOverlay } from './EquityOverlay';

describe('EquityOverlay (#82)', () => {
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

  it('closes on Escape and close button', () => {
    const onClose = vi.fn();
    render(
      <EquityOverlay
        open
        onClose={onClose}
        tier={{ tier: 'exact', detail: '990 runouts' }}
        heroRow={{
          id: 'hero',
          who: 'Hero',
          isHero: true,
          cards: [{ card: 'Ah' }, { card: 'Kh' }],
          equityPct: 25.6,
        }}
      />,
      host,
    );

    expect(host.querySelector('[data-equity-overlay="true"]')).not.toBeNull();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    const closeBtn = host.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!;
    closeBtn.click();
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('locks equity rows in pre-answer drill mode while keeping exact price visible', () => {
    render(
      <EquityOverlay
        open
        onClose={() => {}}
        tier={{ tier: 'exact', detail: 'price only' }}
        lockedMessage="Confirm your answer first to unlock equity."
        priceFacts={{ neededPct: '33.3%', callLabel: '2.5 bb', potLabel: '7.5 bb' }}
        heroRow={{
          id: 'hero',
          who: 'Hero',
          isHero: true,
          cards: [{ card: 'As' }, { card: 'Kd' }],
          equityPct: 60.0,
        }}
      />,
      host,
    );

    expect(host.textContent).toContain('Confirm your answer first to unlock equity.');
    expect(host.textContent).toContain('33.3%');
    expect(host.textContent).toContain('Equity is not EV.');
    expect(host.querySelector('[data-equity-row]')).toBeNull();
  });

  it('handles unlocked rows, source switch, next-card click, step back, and pin note', () => {
    const onSelectSource = vi.fn();
    const onPickNextCard = vi.fn();
    const onStepBack = vi.fn();
    const onPinNote = vi.fn();

    render(
      <EquityOverlay
        open
        onClose={() => {}}
        tier={{ tier: 'exact', detail: '44 runouts' }}
        boardCards={['Ks', '8h', '4h', 'Jd']}
        canStepBack
        onStepBack={onStepBack}
        sourceOptions={[
          { id: 'showed', label: 'Revealed hand' },
          { id: 'tight', label: 'Tight' },
        ]}
        activeSourceId="showed"
        onSelectSource={onSelectSource}
        heroRow={{
          id: 'hero',
          who: 'Hero',
          isHero: true,
          cards: [{ card: 'Ad' }, { card: 'Kd' }],
          barTone: 'accent',
          equityPct: 22.7,
        }}
        villainRow={{
          id: 'villain',
          who: 'Villain',
          cards: [{ card: 'Qs' }, { card: 'Qc' }],
          barTone: 'under',
          equityPct: 77.3,
        }}
        honestyNote="Hindsight against known cards."
        runoutGridRows={[
          {
            id: 's',
            cells: [
              { id: 'As', label: 'A♠', ariaLabel: 'Ace of spades', tone: 'okHigh' },
              { id: 'Ks', label: 'K♠', ariaLabel: 'King of spades in play', tone: 'struck', struck: true, disabled: true },
            ],
          },
        ]}
        onPickNextCard={onPickNextCard}
        onPinNote={onPinNote}
      />,
      host,
    );

    expect(host.querySelectorAll('[data-equity-row]')).toHaveLength(2);
    const tightBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Tight'),
    )!;
    tightBtn.click();
    expect(onSelectSource).toHaveBeenCalledWith('tight');

    const aceCell = host.querySelector<HTMLButtonElement>('[role="gridcell"]')!;
    aceCell.click();
    expect(onPickNextCard).toHaveBeenCalledWith('As');

    const stepBackBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Back a card'),
    )!;
    stepBackBtn.click();
    expect(onStepBack).toHaveBeenCalledTimes(1);

    const pinBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Pin to decision note'),
    )!;
    pinBtn.click();
    expect(onPinNote).toHaveBeenCalledTimes(1);
  });
});
