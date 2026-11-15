import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppearance, updateAppearance } from '../../../domain/appearance';
import { LAMP_MOODS, LAMP_SIZES, Lamp, TeacherCallout } from './Lamp';

describe('Lamp and TeacherCallout', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    window.localStorage.clear();
    initAppearance();
    vi.useFakeTimers();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    vi.useRealTimers();
    if (host.firstChild) {
      render(null, host);
    }
    host.remove();
  });

  it('renders all four sizes and eight moods with accessible role', () => {
    act(() => {
      render(
        <div>
          {LAMP_SIZES.map((s) => (
            <Lamp key={s} size={s} mood="idle" />
          ))}
          {LAMP_MOODS.map((m) => (
            <Lamp key={m} size={44} mood={m} persistCelebrating />
          ))}
        </div>,
        host,
      );
    });

    const imgs = host.querySelectorAll('[role="img"]');
    expect(imgs.length).toBe(LAMP_SIZES.length + LAMP_MOODS.length);
  });

  it('returns from celebrating to idle after burst timer', async () => {
    const onEnd = vi.fn();
    await act(async () => {
      render(<Lamp size={44} mood="celebrating" onCelebrateEnd={onEnd} />, host);
    });

    const lampEl = host.querySelector('[data-mood]');
    expect(lampEl?.getAttribute('data-mood')).toBe('celebrating');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(lampEl?.getAttribute('data-mood')).toBe('idle');
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('renders resting mood as wake button when onWake is passed', () => {
    const onWake = vi.fn();
    act(() => {
      render(<Lamp size={44} mood="resting" onWake={onWake} />, host);
    });

    const btn = host.querySelector('button');
    expect(btn).not.toBeNull();
    btn?.click();
    expect(onWake).toHaveBeenCalledTimes(1);
  });

  it('types gradually and completes immediately on click or under reduced motion', async () => {
    const onDone = vi.fn();
    const message = 'Check pot odds before calling.';
    await act(async () => {
      render(
        <TeacherCallout text={message} typingSpeed="normal" onTypingComplete={onDone} />,
        host,
      );
    });

    const paragraph = host.querySelector('p');
    expect(paragraph?.textContent).toBe('');
    expect(paragraph?.getAttribute('role')).toBe('button');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    expect((paragraph?.textContent ?? '').length).toBeGreaterThan(0);
    expect((paragraph?.textContent ?? '').length).toBeLessThan(message.length);

    await act(async () => {
      paragraph?.click();
    });
    expect(paragraph?.textContent).toBe(message);
    expect(paragraph?.getAttribute('role')).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);

    // Reduced motion reveals immediately
    await act(async () => {
      updateAppearance({ motion: 'reduced' }, { persist: false });
      render(<TeacherCallout text={message} typingSpeed="slow" />, host);
    });
    expect(host.querySelector('p')?.textContent).toBe(message);
  });

  it('honors showLamp=false and renders stern callout without Lamp SVG', () => {
    const onAction = vi.fn();
    act(() => {
      render(
        <TeacherCallout
          text="Exact price check."
          mood="stern"
          showLamp={false}
          typingSpeed="instant"
          tier={{ tier: 'exact', detail: 'price only' }}
          action={{ label: 'Review spot', onClick: onAction }}
        />,
        host,
      );
    });

    expect(host.querySelector('svg')).toBeNull();
    expect(host.textContent).toContain('Exact · price only');
    const actionBtn = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent === 'Review spot',
    );
    expect(actionBtn).toBeDefined();
    actionBtn?.click();
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
