import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SHORTCUTS, initAppearance, updateAppearance } from '../../../domain/appearance';
import { createHandRecorderStore } from '../../../domain/hand';
import { resetSharedReviewStore } from '../../../domain/review';
import { activeRouteSignal, navigateTo } from '../../../domain/shellState';
import { createMemoryStudyBackend, createStudyRepository } from '../../../domain/storage';
import { createEngineClient } from '../../../engine-api';
import { HandRoom } from './HandRoom';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 40));

describe('HandRoom integration', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    window.localStorage.clear();
    initAppearance();
    resetSharedReviewStore();
    navigateTo('hand', { pushHistory: false });
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    render(null, host);
    host.remove();
    resetSharedReviewStore();
  });

  it('renders presets, flop HeatGrid, shorthand error state, terminal hand, and opens Review on save', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createHandRecorderStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
      initialPreset: 'raise',
    });

    render(<HandRoom store={store} />, host);
    await flush();

    // Default 'raise' preset shows OptionTickets + size ladder + Exact · price only badge
    expect(host.textContent).toContain('Record a hand');
    expect(host.textContent).toContain('price only');
    expect(host.textContent).toContain('Bet or raise sizes');
    expect(host.textContent).toContain('What were you thinking?');

    // Reset hand to UTG's turn -> shows 'Everyone else folds to you' shortcut
    store.resetHand();
    await flush();
    expect(host.textContent).toContain('Everyone else folds to you');

    // Switch to 'flop_grid' -> renders HeatGrid board picker
    store.applyPreset('flop_grid');
    await flush();
    expect(host.textContent).toContain('Pick 3 flop cards');
    expect(host.textContent).toContain('Deal 2/3');

    // Switch to 'typed_error' -> renders TokenInput alert for 'oops'
    store.applyPreset('typed_error');
    await flush();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Unrecognized action');

    // Switch to 'done' -> renders settled terminal hand
    store.applyPreset('done');
    await flush();
    expect(host.textContent).toContain('Hand settled');
    expect(host.textContent).toContain('Save hand');

    // Save hand via button and navigate to Review via "Open in Review"
    const saveBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save hand'),
    );
    expect(saveBtn).toBeTruthy();
    saveBtn!.click();
    await flush();
    await flush();

    const openReviewBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Open in Review'),
    );
    expect(openReviewBtn).toBeTruthy();
    openReviewBtn!.click();
    await flush();
    expect(activeRouteSignal.value).toBe('review');

    store.dispose();
    engine.dispose();
  });

  it('keeps CardPicker open after picking card 1 during showdown reveal until card 2 completes the reveal', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createHandRecorderStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
      initialPreset: 'raise',
    });

    store.selectTicket('all_in');
    expect(store.confirmTicketAction()).toBe(true);
    store.selectTicket('fold');
    expect(store.confirmTicketAction()).toBe(true);
    store.selectTicket('call');
    expect(store.confirmTicketAction()).toBe(true);
    expect(store.dealRandomPendingStreet(1)).toBe(true);
    expect(store.dealRandomPendingStreet(2)).toBe(true);
    expect(store.dealRandomPendingStreet(3)).toBe(true);
    expect(store.handSnapshotSignal.value.pokerState.phase).toBe('showdown');

    render(<HandRoom store={store} />, host);
    await flush();

    const revealBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reveal BB'),
    );
    expect(revealBtn).toBeTruthy();
    revealBtn!.click();
    await flush();

    const dialog = host.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('card 1');
    expect(dialog?.textContent).not.toContain('Close search');

    const cells1 = Array.from(dialog!.querySelectorAll<HTMLButtonElement>('[role="gridcell"]:not([aria-disabled="true"])'));
    expect(cells1.length).toBeGreaterThan(2);
    cells1[0]!.click();
    await flush();

    // Picker MUST stay open and advance to card 2
    const dialogAfterCard1 = host.querySelector('[role="dialog"]');
    expect(dialogAfterCard1).not.toBeNull();
    expect(dialogAfterCard1?.textContent).toContain('card 2');

    const cells2 = Array.from(dialogAfterCard1!.querySelectorAll<HTMLButtonElement>('[role="gridcell"]:not([aria-disabled="true"])'));
    cells2[0]!.click();
    await flush();

    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(store.handSnapshotSignal.value.pokerState.phase).toBe('terminal');
    expect(host.textContent).toContain('Hand settled');

    store.dispose();
    engine.dispose();
  });

  it('supports multiline thinking/summary notes, night return button, and Open in Equity payload', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createHandRecorderStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
      initialPreset: 'raise',
    });

    store.configureFromNight({
      nightSessionId: 'night-42',
      nightTitle: 'Friday Home Game',
      unitPreset: 'ils',
      seatCount: 8,
    });

    const onReturnToNight = vi.fn();
    const onOpenInEquity = vi.fn();

    render(
      <HandRoom
        store={store}
        onReturnToNight={onReturnToNight}
        onOpenInEquity={onOpenInEquity}
      />,
      host,
    );
    await flush();

    // Multiline textareas for both per-action thinking note and hand summary note
    const thinkingTextarea = host.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Your thinking note"]',
    );
    const handNoteTextarea = host.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Hand summary note"]',
    );
    expect(thinkingTextarea).not.toBeNull();
    expect(thinkingTextarea?.rows).toBe(2);
    expect(handNoteTextarea).not.toBeNull();
    expect(handNoteTextarea?.rows).toBe(2);

    thinkingTextarea!.value = 'Iso-raise vs limpers';
    thinkingTextarea!.dispatchEvent(new Event('input', { bubbles: true }));
    handNoteTextarea!.value = '  Good home-game dynamic\nStay disciplined  ';
    handNoteTextarea!.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();

    expect(store.activeHeroNoteSignal.value.customText).toBe('Iso-raise vs limpers');
    expect(store.handNoteSignal.value).toBe('  Good home-game dynamic\nStay disciplined  ');

    // Back to tonight's game button in header controls
    const backBtnBeforeSave = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes("Back to tonight's game"),
    );
    expect(backBtnBeforeSave).toBeTruthy();
    backBtnBeforeSave!.click();
    expect(onReturnToNight).toHaveBeenCalledWith('night-42');

    // Open in Equity button preflop without revealed villain cards
    const openEquityBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Open in Equity'),
    );
    expect(openEquityBtn).toBeTruthy();
    openEquityBtn!.click();
    expect(onOpenInEquity).toHaveBeenLastCalledWith({
      board: [],
      players: [
        { label: 'BTN', rawInput: 'AsKd', isHero: true },
        { label: 'Villain', rawInput: 'any', isHero: false },
      ],
    });

    // Advance to showdown and reveal BB cards, then test Open in Equity and post-save Back to tonight's game
    store.foldRemainingToHeroOrEnd();
    store.selectTicket('all_in');
    expect(store.confirmTicketAction()).toBe(true);
    store.selectTicket('fold');
    expect(store.confirmTicketAction()).toBe(true);
    store.selectTicket('call');
    expect(store.confirmTicketAction()).toBe(true);
    expect(store.dealRandomPendingStreet(1)).toBe(true);
    expect(store.dealRandomPendingStreet(2)).toBe(true);
    expect(store.dealRandomPendingStreet(3)).toBe(true);
    expect(store.revealOpponentHoleCards('seat-2', ['Ac', 'Kc'])).toBe(true);
    await flush();

    const openEquityShowdownBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Open in Equity'),
    );
    expect(openEquityShowdownBtn).toBeTruthy();
    openEquityShowdownBtn!.click();
    const expectedBoard = [...store.handSnapshotSignal.value.pokerState.board];
    expect(expectedBoard.length).toBe(5);
    expect(onOpenInEquity).toHaveBeenLastCalledWith({
      board: expectedBoard,
      players: [
        { label: 'BTN', rawInput: 'AsKd', isHero: true },
        { label: 'BB', rawInput: 'AcKc', isHero: false },
      ],
    });

    const saveBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save hand'),
    );
    expect(saveBtn).toBeTruthy();
    saveBtn!.click();
    await flush();
    await flush();

    const openReviewBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Open in Review'),
    );
    const backBtnAfterSave = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes("Back to tonight's game"),
    );
    expect(openReviewBtn).toBeTruthy();
    expect(backBtnAfterSave).toBeTruthy();
    expect(openReviewBtn!.parentElement).toBe(backBtnAfterSave!.parentElement);

    const savedHands = await repo.listSavedHands();
    expect(savedHands[0]?.payload.handNote).toBe('Good home-game dynamic\nStay disciplined');

    backBtnAfterSave!.click();
    expect(onReturnToNight).toHaveBeenCalledTimes(2);

    store.dispose();
    engine.dispose();
  });

  it('wires custom fold and inlineEquity shortcuts and ignores Shift+F for Fold', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createHandRecorderStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
      initialPreset: 'raise',
    });

    updateAppearance(
      {
        shortcuts: { ...DEFAULT_SHORTCUTS, fold: 'Q', inlineEquity: 'Ctrl+I' },
      },
      { persist: false },
    );

    render(<HandRoom store={store} />, host);
    await flush();

    const foldBtn = host.querySelector<HTMLButtonElement>('[data-ticket-id="fold"]')!;
    expect(foldBtn.textContent).toContain('Q');

    // Old 'f' must not select fold once rebound to 'Q'
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }));
    await flush();
    expect(store.selectedTicketSignal.value).not.toBe('fold');

    // New 'q' selects fold
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }));
    await flush();
    expect(store.selectedTicketSignal.value).toBe('fold');

    // Old 'e' must not open InlineEquityDrawer once rebound to 'Ctrl+I'
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
    await flush();
    expect(host.querySelector('[data-equity-overlay="true"]')).toBeNull();

    // 'Ctrl+I' opens InlineEquityDrawer
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'i', ctrlKey: true }));
    await flush();
    expect(host.querySelector('[data-equity-overlay="true"]')).not.toBeNull();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flush();

    // Restore defaults and confirm Shift+F does not select Fold ('F')
    store.selectTicket('call');
    updateAppearance({ shortcuts: { ...DEFAULT_SHORTCUTS } }, { persist: false });
    await flush();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', shiftKey: true }));
    await flush();
    expect(store.selectedTicketSignal.value).toBe('call');

    store.dispose();
    engine.dispose();
  });

  it('animates deal, fold, flip, and chip flights under system motion and disables them when minimalCards or reduced motion is active', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createHandRecorderStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
      initialPreset: 'raise',
    });

    updateAppearance({ motion: 'system', minimalCards: false }, { persist: false });
    render(<HandRoom store={store} />, host);
    await flush();

    // Hero goes all-in, SB folds -> SB cards get motion_fold
    store.selectTicket('all_in');
    expect(store.confirmTicketAction()).toBe(true);
    await flush();
    store.selectTicket('fold');
    expect(store.confirmTicketAction()).toBe(true);
    await flush();
    expect(host.querySelectorAll('[class*="motion_fold"]').length).toBe(2);

    // BB calls -> flop chance; dealing flop animates 3 board cards and triggers chipsToPot
    store.selectTicket('call');
    expect(store.confirmTicketAction()).toBe(true);
    await flush();
    expect(store.dealRandomPendingStreet(1)).toBe(true);
    await flush();
    expect(host.querySelectorAll('[class*="motion_deal"]').length).toBe(3);
    expect(host.querySelector('[class*="chipFlight"]')).not.toBeNull();
    expect(host.querySelector('[class*="potBump"]')).not.toBeNull();

    // Dealing turn animates only the newly dealt 4th card
    expect(store.dealRandomPendingStreet(2)).toBe(true);
    await flush();
    expect(host.querySelectorAll('[class*="motion_deal"]').length).toBe(1);

    // Deal river and reveal BB -> BB cards get motion_flip
    expect(store.dealRandomPendingStreet(3)).toBe(true);
    await flush();
    expect(store.revealOpponentHoleCards('seat-2', ['Ac', 'Kc'])).toBe(true);
    await flush();
    expect(host.querySelectorAll('[class*="motion_flip"]').length).toBe(2);

    // Repeat with minimalCards: true -> all card motion and chip flights are disabled
    updateAppearance({ motion: 'system', minimalCards: true }, { persist: false });
    store.applyPreset('raise');
    await flush();
    store.selectTicket('all_in');
    expect(store.confirmTicketAction()).toBe(true);
    store.selectTicket('fold');
    expect(store.confirmTicketAction()).toBe(true);
    await flush();
    expect(host.querySelectorAll('[class*="motion_fold"]').length).toBe(0);

    store.selectTicket('call');
    expect(store.confirmTicketAction()).toBe(true);
    expect(store.dealRandomPendingStreet(1)).toBe(true);
    await flush();
    expect(host.querySelectorAll('[class*="motion_deal"]').length).toBe(0);
    expect(host.querySelector('[class*="chipFlight"]')).toBeNull();
    expect(host.querySelector('[class*="potBump"]')).toBeNull();

    // Also verify motion: 'reduced' disables card motion cleanly
    updateAppearance({ motion: 'reduced', minimalCards: false }, { persist: false });
    expect(store.dealRandomPendingStreet(2)).toBe(true);
    expect(store.dealRandomPendingStreet(3)).toBe(true);
    expect(store.revealOpponentHoleCards('seat-2', ['Ac', 'Kc'])).toBe(true);
    await flush();
    expect(host.querySelectorAll('[class*="motion_deal"]').length).toBe(0);
    expect(host.querySelectorAll('[class*="motion_flip"]').length).toBe(0);

    store.dispose();
    engine.dispose();
  });

  it('toggles Table rules panel, updates default stack depth, ante mode, and cycles per-seat stack overrides', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createHandRecorderStore({
      engine,
      repository: repo,
      autoLoadSaved: false,
      initialPreset: 'raise',
    });

    render(<HandRoom store={store} />, host);
    await flush();

    // Table rules panel is closed by default
    expect(host.textContent).not.toContain('Table rules & stacks');

    const rulesToggleBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Table rules'),
    );
    expect(rulesToggleBtn).toBeTruthy();
    expect(rulesToggleBtn?.getAttribute('aria-expanded')).toBe('false');
    rulesToggleBtn!.click();
    await flush();

    expect(rulesToggleBtn?.getAttribute('aria-expanded')).toBe('true');
    expect(host.textContent).toContain('Table rules & stacks');
    expect(host.textContent).toContain('Default stack');
    expect(host.textContent).toContain('Ante');
    expect(host.textContent).toContain('Per-seat effective stacks');

    // Pick 40 bb default stack
    const stack40Btn = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '40 bb',
    );
    expect(stack40Btn).toBeTruthy();
    stack40Btn!.click();
    await flush();
    expect(store.startingStackBbSignal.value).toBe(40);

    // Pick 1 bb BB ante
    const bbAnteBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('1 bb BB ante'),
    );
    expect(bbAnteBtn).toBeTruthy();
    bbAnteBtn!.click();
    await flush();
    expect(store.anteModeSignal.value).toBe('bb_ante_1');
    expect(store.handSnapshotSignal.value.pokerState.potMilliBb).toBe(2500);

    // Cycle BTN per-seat stack override (starts at 40 bb -> cycles to 50 bb)
    const btnSeatBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('BTN: 40 bb'),
    );
    expect(btnSeatBtn).toBeTruthy();
    btnSeatBtn!.click();
    await flush();
    expect(store.seatStackOverridesBbSignal.value[0]).toBe(50);
    expect(host.textContent).toContain('BTN: 50 bb');

    // Reset seat stacks button appears and clears overrides
    const resetSeatsBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reset seat stacks'),
    );
    expect(resetSeatsBtn).toBeTruthy();
    resetSeatsBtn!.click();
    await flush();
    expect(store.seatStackOverridesBbSignal.value).toEqual({});

    store.dispose();
    engine.dispose();
  });

  it('imports a pasted hand history into shorthand tokens and applies it to the table', async () => {
    const engine = createEngineClient({ mode: 'inline' });
    const store = createHandRecorderStore({
      engine,
      repository: createStudyRepository(createMemoryStudyBackend()),
    });

    render(<HandRoom store={store} />, host);
    await flush();

    // Switch to Typed (shorthand) mode
    const typedBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Typed'),
    );
    expect(typedBtn).toBeTruthy();
    typedBtn!.click();
    await flush();

    const pasteToggle = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Paste history'),
    );
    expect(pasteToggle).toBeTruthy();
    pasteToggle!.click();
    await flush();

    const textarea = host.querySelector(
      'textarea[aria-label="Hand history text to import"]',
    ) as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();
    textarea!.value = 'BTN KsQd | utg f hj f co f btn r2.5 sb f bb c / Qh7c2h';
    textarea!.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();

    const importBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Import hand'),
    );
    expect(importBtn).toBeTruthy();
    importBtn!.click();
    await flush();

    expect(store.heroCardsSignal.value).toEqual(['Ks', 'Qd']);
    expect(store.handSnapshotSignal.value.pokerState.board).toEqual(['Qh', '7c', '2h']);

    store.dispose();
    engine.dispose();
  });
});
