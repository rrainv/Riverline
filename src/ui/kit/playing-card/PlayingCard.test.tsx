import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initAppearance } from '../../../domain/appearance';
import { PlayingCard, PlayingCardPair, parseCardCode } from './PlayingCard';

describe('PlayingCard (#8)', () => {
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

  it('parses card codes including 10 and Td and isolates cards as LTR', () => {
    expect(parseCardCode('10d')).toEqual({ rank: '10', suit: 'd' });
    expect(parseCardCode('ah')).toEqual({ rank: 'A', suit: 'h' });
    expect(parseCardCode('bad')).toBeNull();

    render(
      <div>
        <PlayingCard card="10h" size="mini" />
        <PlayingCard card="Ks" size="small" />
        <PlayingCard card="Qc" size="standard" />
        <PlayingCard card="Jd" size="large" />
        <PlayingCard card="2c" size="table" />
      </div>,
      host,
    );

    const cards = Array.from(host.querySelectorAll('[role="img"]'));
    expect(cards).toHaveLength(5);
    cards.forEach((c) => expect(c.getAttribute('dir')).toBe('ltr'));
    expect(cards[0]!.textContent).toContain('10');
    expect(cards[0]!.textContent).toContain('\u2665');
  });

  it('renders face, back (audit-allow), slot, struck, winning, dimmed, and pair illustration', () => {
    render(
      <div>
        <PlayingCard card="As" />
        <PlayingCard state="back" />
        <PlayingCard state="slot" />
        <PlayingCard card="Qh" struck />
        <PlayingCard card="Kc" winning />
        <PlayingCard card="7d" dimmed />
        <PlayingCardPair card="Ah" />
      </div>,
      host,
    );

    const imgs = host.querySelectorAll('[role="img"]');
    expect(imgs).toHaveLength(8);
    expect(host.querySelectorAll('[data-audit-allow="true"]').length).toBeGreaterThanOrEqual(2);
  });

  it('renders dual layers during deal, flip, and fold motion without crashing', () => {
    render(
      <div>
        <PlayingCard card="Qh" motion="deal" motionIndex={1} />
        <PlayingCard card="7c" motion="flip" motionIndex={0} />
        <PlayingCard card="2d" motion="fold" motionIndex={0} foldLane={-1} />
      </div>,
      host,
    );

    expect(host.querySelectorAll('[data-audit-allow="true"]')).toHaveLength(3);
  });
});
