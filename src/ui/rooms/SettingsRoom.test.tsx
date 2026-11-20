import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appearanceSignal,
  DEFAULT_CUSTOM_THEME,
  DEFAULT_SHORTCUTS,
  initAppearance,
  SHORTCUT_ACTION_IDS,
  THEME_IDS,
} from '../../domain/appearance';
import { settingsSectionSignal } from '../../domain/shellState';
import {
  createMemoryStudyBackend,
  createStudyRepository,
  type StudyRepository,
} from '../../domain/storage';
import { HOME_GAME_CURRENCY_PRESETS } from '../../engine-api';
import { SettingsRoom } from './SettingsRoom';

async function flush() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 15));
}

function findButtonByText(root: HTMLElement, text: string): HTMLButtonElement {
  const buttons = Array.from(root.querySelectorAll('button'));
  const found = buttons.find((btn) => (btn.textContent ?? '').includes(text));
  if (!found) {
    throw new Error(`Button containing "${text}" not found`);
  }
  return found;
}

function findButtonByAriaLabel(root: HTMLElement, text: string): HTMLButtonElement {
  const buttons = Array.from(root.querySelectorAll('button'));
  const found = buttons.find((btn) => (btn.getAttribute('aria-label') ?? '').includes(text));
  if (!found) {
    throw new Error(`Button with aria-label containing "${text}" not found`);
  }
  return found;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function createSeededRepository(): Promise<StudyRepository> {
  const repo = createStudyRepository(createMemoryStudyBackend());
  await repo.saveHand({
    handId: 'hand-seed-1',
    tablePreset: 'six_max_100bb',
    unitLabel: 'bb',
    seatCount: 6,
    startingStackBb: 100,
    heroPlayerId: 'hero',
    heroSeat: 5,
    heroPositionLabel: 'BTN',
    heroCards: ['Ah', 'Kh'],
    pokerState: {
      schemaVersion: 'poker-state/v3',
      handId: 'hand-seed-1',
      rulesSnapshot: {
        schemaVersion: 'game-rules-snapshot/v1',
        preset: 'home_6max_100bb',
        smallBlindMilliBb: 500,
        bigBlindMilliBb: 1000,
        chipUnitMilliBb: 100,
        ante: { type: 'none', amountMilliBb: 0 },
        rake: { type: 'none' },
        seatCount: 6,
        buttonSeat: 0,
      },
      buttonSeat: 0,
      phase: 'terminal',
      street: 'river',
      board: ['Qh', '7c', '2h', '4c', '9s'],
      potMilliBb: 200_000,
      currentBetMilliBb: 0,
      lastFullRaiseIncrementMilliBb: 1000,
      actingPlayerId: null,
      players: [],
      pots: [],
      actionHistory: [],
      terminal: { isTerminal: true, reason: 'showdown', winners: [], payoutsMilliBbByPlayer: {} },
      recordedSettlement: null,
    } as never,
    recordedActions: [],
    heroNotes: [],
    shorthandLine: 'BTN AhKh',
    savedKind: 'mid_hand_spot',
  });
  await repo.saveMatchup({
    board: ['Qs', '7c', '2h'],
    street: 'flop',
    players: [
      { id: 'p1', label: 'Hero', isHero: true, rawInput: 'AhKh', inputKind: 'exact' },
      { id: 'p2', label: 'Villain', isHero: false, rawInput: 'QQ', inputKind: 'range' },
    ],
  });
  await repo.createNightSession({
    title: 'Friday Game',
    currency: HOME_GAME_CURRENCY_PRESETS.ils,
    participants: [],
  });
  await repo.recordTrainingSession({
    sessionId: 'tr-1',
    mode: 'quick_drill',
    completedAt: '2026-11-20T20:00:00.000Z',
    spotsCount: 5,
    planAlignedCount: 4,
    baselineAlignedCount: 4,
  });
  return repo;
}

describe('SettingsRoom (7 locked sections)', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    window.localStorage.clear();
    settingsSectionSignal.value = 'appearance';
    initAppearance();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    render(null, host);
    host.remove();
    vi.restoreAllMocks();
  });

  it('switches cleanly between all 7 sections via tab strip and activeSection prop', async () => {
    render(<SettingsRoom />, host);
    await flush();

    const tabs = Array.from(host.querySelectorAll('[role="tab"]'));
    expect(tabs).toHaveLength(7);
    expect(tabs.map((el) => el.textContent)).toEqual([
      'Appearance',
      'Table & motion',
      'Teacher',
      'Language',
      'Shortcuts',
      'Data',
      'About & legal',
    ]);

    findButtonByText(host, 'About & legal').click();
    await flush();
    expect(settingsSectionSignal.value).toBe('about');
    expect(host.textContent).toContain('Third-party licences');

    render(<SettingsRoom activeSection="teacher" />, host);
    await flush();
    expect(host.textContent).toContain('Show the Lamp');
  });

  it('renders Appearance controls, custom palette contrast warning (< 4.5:1), and card preview', async () => {
    render(<SettingsRoom activeSection="appearance" />, host);
    await flush();

    // All 7 theme swatch bars keep data-audit-allow="theme-swatch"
    const swatches = host.querySelectorAll('[data-audit-allow="theme-swatch"]');
    expect(swatches.length).toBe(THEME_IDS.length);

    findButtonByText(host, 'Paper').click();
    await flush();
    expect(appearanceSignal.value.theme).toBe('paper');
    expect(document.documentElement.dataset.theme).toBe('paper');

    findButtonByText(host, 'Coral').click();
    await flush();
    expect(appearanceSignal.value.accentPreset).toBe('coral');
    expect(document.documentElement.dataset.accent).toBe('coral');

    findButtonByText(host, 'Round (26 px)').click();
    findButtonByText(host, '700').click();
    const cardFaceGroup = host.querySelector('[role="group"][aria-label="Card face"]')!;
    findButtonByText(cardFaceGroup as HTMLElement, 'Slate').click();
    const cardBackGroup = host.querySelector('[role="group"][aria-label="Card back"]')!;
    findButtonByText(cardBackGroup as HTMLElement, 'Brass').click();
    await flush();

    expect(appearanceSignal.value.cornerStyle).toBe('round');
    expect(appearanceSignal.value.headingWeight).toBe('700');
    expect(appearanceSignal.value.cardFace).toBe('slate');
    expect(appearanceSignal.value.cardBack).toBe('brass');
    expect(document.documentElement.dataset.corners).toBe('round');
    expect(document.documentElement.dataset.headWeight).toBe('700');
    expect(document.documentElement.dataset.cardFace).toBe('slate');
    expect(document.documentElement.dataset.cardBack).toBe('brass');

    // Live two-card preview shows face-up Ah and face-down back
    expect(host.querySelector('[data-card-state="face"]')).not.toBeNull();
    expect(host.querySelector('[data-card-state="back"]')).not.toBeNull();

    // Custom palette toggle & low contrast warning
    findButtonByText(host, 'Enable custom colours').click();
    await flush();
    expect(appearanceSignal.value.customTheme.enabled).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe(DEFAULT_CUSTOM_THEME.bg);

    const bgInput = host.querySelector('input[aria-label="Background"]') as HTMLInputElement;
    const textInput = host.querySelector('input[aria-label="Primary text"]') as HTMLInputElement;
    setInputValue(bgInput, '#222222');
    setInputValue(textInput, '#555555');
    await flush();

    expect(host.textContent).toContain('Low readability: text contrast is below 4.5:1');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Low readability');

    findButtonByText(host, 'Reset palette').click();
    await flush();
    expect(appearanceSignal.value.customTheme.bg).toBe(DEFAULT_CUSTOM_THEME.bg);
    expect(appearanceSignal.value.customTheme.text).toBe(DEFAULT_CUSTOM_THEME.text);
    expect(host.textContent).toContain('Contrast meets the 4.5:1 readability target.');
  });

  it('updates Motion & Table controls, minimal card animations, and typing speed preview', async () => {
    render(<SettingsRoom activeSection="motion" />, host);
    await flush();

    findButtonByText(host, 'Calm').click();
    findButtonByText(host, 'Reduced').click();
    const minimalBtn = findButtonByText(host, 'Minimal card animation');
    expect(minimalBtn.getAttribute('aria-pressed')).toBe('false');
    minimalBtn.click();
    findButtonByText(host, 'Instant').click();
    await flush();

    expect(appearanceSignal.value.pace).toBe('calm');
    expect(appearanceSignal.value.motion).toBe('reduced');
    expect(appearanceSignal.value.minimalCards).toBe(true);
    expect(appearanceSignal.value.teacherTypingSpeed).toBe('instant');
    expect(document.documentElement.dataset.cards).toBe('minimal');
    expect(minimalBtn.getAttribute('aria-pressed')).toBe('true');

    expect(host.textContent).toContain('You needed 31.0% to call on price');
    findButtonByText(host, 'Replay sample').click();
    await flush();
    expect(host.textContent).toContain('You needed 31.0% to call on price');
  });

  it('updates Teacher Lamp, voice sample preview, and ask-before-verdict toggles', async () => {
    render(<SettingsRoom activeSection="teacher" />, host);
    await flush();

    expect(host.textContent).toContain('Mistake on price: needed 45.0%, held 26.4%.');
    expect(host.textContent).toContain('Both voices keep the exact same numbers');

    findButtonByText(host, 'Gentle').click();
    await flush();
    expect(appearanceSignal.value.teacherVoice).toBe('gentle');
    expect(host.textContent).toContain('Price check: this call needed 45.0% and had 26.4%');

    const showLampBtn = findButtonByText(host, 'Show the Lamp');
    expect(showLampBtn.getAttribute('aria-pressed')).toBe('true');
    showLampBtn.click();
    await flush();
    expect(appearanceSignal.value.showLamp).toBe(false);
    expect(showLampBtn.getAttribute('aria-pressed')).toBe('false');

    const askBtn = findButtonByText(host, 'Ask thinking before verdict');
    expect(askBtn.getAttribute('aria-pressed')).toBe('true');
    askBtn.click();
    await flush();
    expect(appearanceSignal.value.askBeforeVerdict).toBe(false);
    expect(askBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('switches Language across EN, RU, and HE RTL with isolated poker notation', async () => {
    render(<SettingsRoom activeSection="language" />, host);
    await flush();

    findButtonByText(host, 'Русский').click();
    await flush();
    expect(appearanceSignal.value.lang).toBe('ru');
    expect(document.documentElement.lang).toBe('ru');
    expect(document.documentElement.dir).toBe('ltr');
    expect(host.textContent).toContain('рейз до');

    findButtonByText(host, 'עברית').click();
    await flush();
    expect(appearanceSignal.value.lang).toBe('he');
    expect(document.documentElement.lang).toBe('he');
    expect(document.documentElement.dir).toBe('rtl');
    expect(host.textContent).toContain('רייז ל-');
    expect(host.querySelectorAll('bdi[dir="ltr"]').length).toBeGreaterThanOrEqual(3);
  });

  it('supports keyboard shortcut rebinding, Escape cancel, clash block, and reset defaults', async () => {
    render(<SettingsRoom activeSection="shortcuts" />, host);
    await flush();

    for (const actionId of SHORTCUT_ACTION_IDS) {
      expect(host.textContent).toContain(DEFAULT_SHORTCUTS[actionId]);
    }

    // Start rebinding Fold and cancel with Escape
    findButtonByAriaLabel(host, 'Rebind: Fold action ticket').click();
    await flush();
    expect(host.textContent).toContain('Press keys...');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flush();
    expect(host.textContent).not.toContain('Press keys...');
    expect(appearanceSignal.value.shortcuts.fold).toBe('F');

    // Clash detection: try assigning 'c' (bound to call) to fold
    findButtonByAriaLabel(host, 'Rebind: Fold action ticket').click();
    await flush();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
    await flush();

    expect(host.textContent).toContain('Already assigned to "Call / Check action ticket"');
    expect(appearanceSignal.value.shortcuts.fold).toBe('F');

    // Rebind fold cleanly to 'x'
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    await flush();
    expect(appearanceSignal.value.shortcuts.fold).toBe('X');
    expect(host.textContent).not.toContain('Press keys...');

    // Reset defaults
    findButtonByText(host, 'Reset defaults').click();
    await flush();
    expect(appearanceSignal.value.shortcuts).toEqual(DEFAULT_SHORTCUTS);
  });

  it('renders Data counts, exports JSON, imports JSON, requests persistence, and wipes via confirmPhrase dialog', async () => {
    const repo = await createSeededRepository();

    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock-backup');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const originalStorageDescriptor = Object.getOwnPropertyDescriptor(navigator, 'storage');
    const persistMock = vi.fn(async () => true);
    const persistedMock = vi.fn(async () => false);
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        persisted: persistedMock,
        persist: persistMock,
      },
    });

    try {
      render(<SettingsRoom activeSection="data" repository={repo} />, host);
      await flush();

      const exactValues = Array.from(host.querySelectorAll('[data-exact-value]')).map((el) =>
        el.getAttribute('data-exact-value'),
      );
      expect(exactValues).toEqual(['1', '1', '1', '1']);

      // Request persistent storage
      findButtonByText(host, 'Request persistent storage').click();
      await flush();
      expect(persistMock).toHaveBeenCalledTimes(1);
      expect(host.textContent).toContain('Persistent storage is active.');

      // Export JSON
      findButtonByText(host, 'Export backup JSON').click();
      await flush();
      expect(host.textContent).toContain('Backup downloaded with 4 events.');

      // Capture exported bundle text for later import test
      const exportedBundle = await repo.exportBundle();
      const exportedJson = JSON.stringify(exportedBundle);

      // Wipe via confirmPhrase Dialog
      findButtonByText(host, 'Delete all data').click();
      await flush();

      const dialog = document.body.querySelector('[role="dialog"]')!;
      expect(dialog).not.toBeNull();
      const eraseBtn = findButtonByText(dialog as HTMLElement, 'Erase everything');
      expect(eraseBtn.disabled).toBe(true);

      const confirmInput = dialog.querySelector('input[type="text"]') as HTMLInputElement;
      setInputValue(confirmInput, 'DELETE RIVERLINE DATA');
      await flush();
      expect(eraseBtn.disabled).toBe(false);

      eraseBtn.click();
      await flush();

      expect(host.textContent).toContain('All local study events have been erased.');
      const wipedValues = Array.from(host.querySelectorAll('[data-exact-value]')).map((el) =>
        el.getAttribute('data-exact-value'),
      );
      expect(wipedValues).toEqual(['0', '0', '0', '0']);

      // Import JSON back cleanly
      const fileInput = host.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File([exportedJson], 'backup.json', { type: 'application/json' });
      Object.defineProperty(file, 'text', { value: async () => exportedJson });
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();

      expect(host.textContent).toContain('Imported 4 events (0 duplicates skipped).');
      const restoredValues = Array.from(host.querySelectorAll('[data-exact-value]')).map((el) =>
        el.getAttribute('data-exact-value'),
      );
      expect(restoredValues).toEqual(['1', '1', '1', '1']);

      // Invalid JSON file displays import error alert
      const badFile = new File(['{broken'], 'bad.json', { type: 'application/json' });
      Object.defineProperty(badFile, 'text', { value: async () => '{broken' });
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [badFile] });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      expect(host.textContent).toContain('Could not import file');
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      if (originalStorageDescriptor) {
        Object.defineProperty(navigator, 'storage', originalStorageDescriptor);
      } else {
        delete (navigator as { storage?: unknown }).storage;
      }
      initAppearance();
    }
  });

  it('renders About & legal notices and the complete third-party licences table', async () => {
    render(<SettingsRoom activeSection="about" />, host);
    await flush();

    expect(host.textContent).toContain('Study-only notice (18+)');
    expect(host.textContent).toContain('Real-time assistance policy');
    expect(host.textContent).toContain('Sound effects status');
    expect(host.textContent).toContain('Third-party licences');

    const expectedPackages = [
      'preact@10.29.8',
      '@preact/signals@2.11.4',
      '@fontsource-variable/inter@5.3.0',
      '@fontsource-variable/rubik@5.3.0',
      'vite@6.4.6',
      '@preact/preset-vite@2.10.6',
      'typescript@5.9.3',
      'vitest@3.2.7',
      'jsdom@26.1.0',
      'playwright@1.65.1',
    ];
    for (const pkg of expectedPackages) {
      expect(host.textContent).toContain(pkg);
    }
  });
});
