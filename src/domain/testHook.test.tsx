import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { APPEARANCE_STORAGE_KEY, initAppearance } from './appearance';
import {
  activeRouteSignal,
  focusModeSignal,
  paletteOpenSignal,
  railCollapsedSignal,
  settingsSectionSignal,
} from './shellState';
import { applyQueryOverrides, installTestHook } from './testHook';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('URL query params, __riverlineTest hook, and shell behaviour', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
    initAppearance();
    activeRouteSignal.value = 'home';
    railCollapsedSignal.value = false;
    focusModeSignal.value = false;
    paletteOpenSignal.value = false;
    settingsSectionSignal.value = 'appearance';

    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    if (host.firstChild) {
      render(null, host);
    }
    host.remove();
  });

  it('applies full URL query overrides ephemerally without clobbering localStorage', () => {
    applyQueryOverrides(
      '?room=equity&theme=daylight&lang=he&pace=calm&motion=reduced&rail=collapsed&focus=1&palette=1',
      '/training',
    );
    const hook = installTestHook();
    expect(hook.getState()).toEqual({
      room: 'equity',
      theme: 'daylight',
      lang: 'he',
      pace: 'calm',
      motion: 'reduced',
      railCollapsed: true,
      focusMode: true,
      paletteOpen: true,
      dir: 'rtl',
    });
    expect(document.documentElement.dataset.theme).toBe('daylight');
    expect(document.documentElement.dataset.pace).toBe('calm');
    expect(document.documentElement.dataset.motion).toBe('reduced');
    expect(document.documentElement.lang).toBe('he');
    expect(document.documentElement.dir).toBe('rtl');
    expect(window.localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBeNull();
  });

  it('resolves /kit pathname and switches every state deterministically via __riverlineTest.setState', async () => {
    applyQueryOverrides('', '/kit');
    const hook = installTestHook();
    expect(hook.getState().room).toBe('kit');

    render(<App />, host);
    expect(host.querySelector('h1')?.textContent).toBe('Component kit');

    hook.setState({
      room: 'review',
      theme: 'slate',
      lang: 'ru',
      pace: 'fast',
      motion: 'reduced',
      railCollapsed: true,
      focusMode: false,
      paletteOpen: false,
    });
    await flush();

    expect(document.documentElement.dataset.theme).toBe('slate');
    expect(document.documentElement.dataset.pace).toBe('fast');
    expect(document.documentElement.dataset.motion).toBe('reduced');
    expect(document.documentElement.dir).toBe('ltr');
    expect(host.querySelector('h1')?.textContent).toBe('Разбор раздачи');
  });

  it('drives Settings Appearance controls, rail collapse, focus mode, and Ctrl+K / Escape palette', async () => {
    installTestHook();
    render(<App />, host);

    // Open Settings via top bar button
    const settingsBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Settings'),
    );
    expect(settingsBtn).toBeDefined();
    settingsBtn?.click();
    await flush();
    expect(host.querySelector('h1')?.textContent).toBe('Appearance for this device');

    // Pick Paper theme and switch to Language section to pick Hebrew interactively (should persist)
    const paperBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Paper'),
    );
    paperBtn?.click();
    await flush();
    expect(document.documentElement.dataset.theme).toBe('paper');

    const languageTab = host.querySelector('#settings-tab-language') as HTMLButtonElement | null;
    expect(languageTab).not.toBeNull();
    languageTab?.click();
    await flush();

    const hebrewBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('עברית'),
    );
    hebrewBtn?.click();
    await flush();
    expect(document.documentElement.dir).toBe('rtl');
    expect(window.localStorage.getItem(APPEARANCE_STORAGE_KEY)).toContain('"theme":"paper"');
    expect(window.localStorage.getItem(APPEARANCE_STORAGE_KEY)).toContain('"lang":"he"');

    // Toggle rail collapse
    const collapseBtn = host.querySelector('aside button[aria-expanded]');
    expect(collapseBtn?.getAttribute('aria-expanded')).toBe('true');
    (collapseBtn as HTMLButtonElement | null)?.click();
    await flush();
    expect(collapseBtn?.getAttribute('aria-expanded')).toBe('false');

    // Toggle focus mode hides rail and shows restore dock pill
    const focusBtn = host.querySelector('header button[aria-pressed]') as HTMLButtonElement | null;
    expect(focusBtn?.getAttribute('aria-pressed')).toBe('false');
    focusBtn?.click();
    await flush();
    expect(host.querySelector('aside')).toBeNull();
    expect(focusBtn?.getAttribute('aria-pressed')).toBe('true');

    // Open palette with Ctrl+K and close with Escape
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    await flush();
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flush();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(focusBtn?.getAttribute('aria-pressed')).toBe('true');

    // Second Escape exits focus mode and restores side rail
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flush();
    expect(focusBtn?.getAttribute('aria-pressed')).toBe('false');
    expect(host.querySelector('aside')).not.toBeNull();
  });

  it('switches equityPreset via __riverlineTest hook and resets cleanly', async () => {
    const hook = installTestHook();
    render(<App />, host);

    hook.setState({ room: 'equity', equityPreset: 'players_3' });
    await flush();
    expect(hook.getState().equityPreset).toBe('players_3');
    expect(host.querySelectorAll('[data-equity-row]')).toHaveLength(3);

    hook.setState({ equityPreset: 'error' });
    await flush();
    expect(host.querySelector('[role="alert"]')?.textContent).toBeTruthy();

    hook.reset();
    await flush();
    expect(hook.getState().room).toBe('home');
    expect(hook.getState().equityPreset).toBeUndefined();
  });
});
