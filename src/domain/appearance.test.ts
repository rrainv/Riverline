import { beforeEach, describe, expect, it } from 'vitest';
import {
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE,
  initAppearance,
  THEME_IDS,
  updateAppearance,
} from './appearance';

describe('appearance state and localStorage persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-pace');
    document.documentElement.removeAttribute('data-motion');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  it('initializes with defaults and syncs root DOM attributes', () => {
    const prefs = initAppearance();
    expect(prefs).toEqual(DEFAULT_APPEARANCE);
    expect(document.documentElement.dataset.theme).toBe('midnight');
    expect(document.documentElement.dataset.pace).toBe('normal');
    expect(document.documentElement.dataset.motion).toBeUndefined();
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
    });

    const stored = JSON.parse(window.localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? '{}');
    expect(stored).toEqual({
      theme: 'paper',
      pace: 'calm',
      motion: 'reduced',
      lang: 'he',
      showLamp: false,
      teacherTypingSpeed: 'fast',
    });

    expect(document.documentElement.dataset.theme).toBe('paper');
    expect(document.documentElement.dataset.pace).toBe('calm');
    expect(document.documentElement.dataset.motion).toBe('reduced');
    expect(document.documentElement.lang).toBe('he');
    expect(document.documentElement.dir).toBe('rtl');

    // Reset DOM and re-initialize from storage
    updateAppearance(DEFAULT_APPEARANCE, { persist: false });
    const restored = initAppearance();
    expect(restored).toEqual(stored);
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.dataset.theme).toBe('paper');
  });

  it('defaults showLamp and teacherTypingSpeed when restoring older stored records', () => {
    window.localStorage.setItem(
      APPEARANCE_STORAGE_KEY,
      JSON.stringify({ theme: 'felt', pace: 'fast', motion: 'system', lang: 'ru' }),
    );
    expect(initAppearance()).toEqual({
      theme: 'felt',
      pace: 'fast',
      motion: 'system',
      lang: 'ru',
      showLamp: true,
      teacherTypingSpeed: 'normal',
    });
  });

  it('supports all seven themes and clears data-motion when returning to system', () => {
    for (const theme of THEME_IDS) {
      updateAppearance({ theme });
      expect(document.documentElement.dataset.theme).toBe(theme);
    }

    updateAppearance({ motion: 'reduced' });
    expect(document.documentElement.dataset.motion).toBe('reduced');
    updateAppearance({ motion: 'system' });
    expect(document.documentElement.dataset.motion).toBeUndefined();
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
