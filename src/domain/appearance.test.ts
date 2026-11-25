import { beforeEach, describe, expect, it } from 'vitest';
import {
  APPEARANCE_STORAGE_KEY,
  computeContrastRatio,
  DEFAULT_APPEARANCE,
  evaluateCustomThemeContrast,
  findShortcutClash,
  formatShortcutFromEvent,
  initAppearance,
  matchesShortcutEvent,
  THEME_IDS,
  updateAppearance,
} from './appearance';

describe('appearance state and localStorage persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    const root = document.documentElement;
    root.removeAttribute('data-theme');
    root.removeAttribute('data-pace');
    root.removeAttribute('data-motion');
    root.removeAttribute('data-cards');
    root.removeAttribute('data-corners');
    root.removeAttribute('data-head-weight');
    root.removeAttribute('data-card-face');
    root.removeAttribute('data-card-back');
    root.removeAttribute('data-accent');
    root.removeAttribute('style');
    root.lang = '';
    root.dir = '';
  });

  it('initializes with defaults and syncs root DOM attributes', () => {
    const prefs = initAppearance();
    expect(prefs).toEqual(DEFAULT_APPEARANCE);
    expect(document.documentElement.dataset.theme).toBe('midnight');
    expect(document.documentElement.dataset.pace).toBe('normal');
    expect(document.documentElement.dataset.motion).toBeUndefined();
    expect(document.documentElement.dataset.cards).toBeUndefined();
    expect(document.documentElement.dataset.corners).toBe('soft');
    expect(document.documentElement.dataset.headWeight).toBe('600');
    expect(document.documentElement.dataset.cardFace).toBe('ivory');
    expect(document.documentElement.dataset.cardBack).toBeUndefined();
    expect(document.documentElement.dataset.accent).toBeUndefined();
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('persists changes under riverline.appearance.v1 and restores them on init', () => {
    updateAppearance({
      theme: 'paper',
      pace: 'calm',
      motion: 'reduced',
      lang: 'he',
      showLamp: false,
      teacherTypingSpeed: 'fast',
      minimalCards: true,
      cornerStyle: 'round',
      headingWeight: '700',
      cardFace: 'slate',
      cardBack: 'brass',
      accentPreset: 'teal',
      teacherVoice: 'gentle',
      askBeforeVerdict: false,
    });

    const stored = JSON.parse(window.localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? '{}');
    expect(stored).toMatchObject({
      theme: 'paper',
      pace: 'calm',
      motion: 'reduced',
      lang: 'he',
      showLamp: false,
      teacherTypingSpeed: 'fast',
      minimalCards: true,
      cornerStyle: 'round',
      headingWeight: '700',
      cardFace: 'slate',
      cardBack: 'brass',
      accentPreset: 'teal',
      teacherVoice: 'gentle',
      askBeforeVerdict: false,
    });

    expect(document.documentElement.dataset.theme).toBe('paper');
    expect(document.documentElement.dataset.pace).toBe('calm');
    expect(document.documentElement.dataset.motion).toBe('reduced');
    expect(document.documentElement.dataset.cards).toBe('minimal');
    expect(document.documentElement.dataset.corners).toBe('round');
    expect(document.documentElement.dataset.headWeight).toBe('700');
    expect(document.documentElement.dataset.cardFace).toBe('slate');
    expect(document.documentElement.dataset.cardBack).toBe('brass');
    expect(document.documentElement.dataset.accent).toBe('teal');
    expect(document.documentElement.lang).toBe('he');
    expect(document.documentElement.dir).toBe('rtl');

    // Reset DOM and re-initialize from storage
    updateAppearance(DEFAULT_APPEARANCE, { persist: false });
    const restored = initAppearance();
    expect(restored).toEqual(stored);
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.dataset.theme).toBe('paper');
    expect(document.documentElement.dataset.cards).toBe('minimal');
  });

  it('defaults Wave 1 and Wave 2 fields when restoring older stored records', () => {
    window.localStorage.setItem(
      APPEARANCE_STORAGE_KEY,
      JSON.stringify({ theme: 'felt', pace: 'fast', motion: 'system', lang: 'ru' }),
    );
    expect(initAppearance()).toEqual({
      ...DEFAULT_APPEARANCE,
      theme: 'felt',
      pace: 'fast',
      motion: 'system',
      lang: 'ru',
    });
  });

  it('supports all seven themes and clears data-motion and data-cards when returning to defaults', () => {
    for (const theme of THEME_IDS) {
      updateAppearance({ theme });
      expect(document.documentElement.dataset.theme).toBe(theme);
    }

    updateAppearance({ motion: 'reduced', minimalCards: true, accentPreset: 'sky' });
    expect(document.documentElement.dataset.motion).toBe('reduced');
    expect(document.documentElement.dataset.cards).toBe('minimal');
    expect(document.documentElement.dataset.accent).toBe('sky');

    updateAppearance({ motion: 'system', minimalCards: false, accentPreset: 'default' });
    expect(document.documentElement.dataset.motion).toBeUndefined();
    expect(document.documentElement.dataset.cards).toBeUndefined();
    expect(document.documentElement.dataset.accent).toBeUndefined();
  });

  it('calculates WCAG contrast for custom themes and applies/clears inline tokens', () => {
    expect(computeContrastRatio('#000000', '#ffffff')).toBe(21);
    const lowContrast = evaluateCustomThemeContrast({
      enabled: true,
      bg: '#222222',
      panel: '#2a2a2a',
      text: '#555555',
      accent: '#777777',
    });
    expect(lowContrast.passes).toBe(false);
    expect(lowContrast.textOnBg).toBeLessThan(4.5);

    updateAppearance({
      customTheme: {
        enabled: true,
        bg: '#101820',
        panel: '#182430',
        text: '#f5f7fa',
        accent: '#f0b94a',
      },
    });
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#101820');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#f0b94a');

    updateAppearance({
      customTheme: { ...DEFAULT_APPEARANCE.customTheme, enabled: false },
    });
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('');
  });

  it('detects shortcut clashes and matches normalized keyboard events accurately', () => {
    const clash = findShortcutClash(DEFAULT_APPEARANCE.shortcuts, 'fold', 'c');
    expect(clash).toBe('call');
    expect(findShortcutClash(DEFAULT_APPEARANCE.shortcuts, 'fold', 'f')).toBeNull();
    expect(findShortcutClash(DEFAULT_APPEARANCE.shortcuts, 'fold', 'x')).toBeNull();

    const shiftF = new KeyboardEvent('keydown', { key: 'F', shiftKey: true });
    expect(formatShortcutFromEvent(shiftF)).toBe('Shift+F');
    expect(matchesShortcutEvent(shiftF, 'Shift+F')).toBe(true);
    expect(matchesShortcutEvent(shiftF, 'F')).toBe(false);

    const ctrlK = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
    expect(formatShortcutFromEvent(ctrlK)).toBe('Ctrl+K');
    expect(matchesShortcutEvent(ctrlK, 'Ctrl+K')).toBe(true);

    const plainF = new KeyboardEvent('keydown', { key: 'f' });
    expect(matchesShortcutEvent(plainF, 'F')).toBe(true);
    expect(matchesShortcutEvent(plainF, 'Shift+F')).toBe(false);
  });

  it('falls back safely when stored JSON is malformed or has unknown values', () => {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, '{broken-json');
    expect(initAppearance()).toEqual(DEFAULT_APPEARANCE);

    window.localStorage.setItem(
      APPEARANCE_STORAGE_KEY,
      JSON.stringify({ theme: 'neon', pace: 'turbo', motion: 'none', lang: 'fr' }),
    );
    expect(initAppearance()).toEqual(DEFAULT_APPEARANCE);
  });
});
