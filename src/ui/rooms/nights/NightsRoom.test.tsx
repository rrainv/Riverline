import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppearance, updateAppearance } from '../../../domain/appearance';
import { createNightsStore } from '../../../domain/nights';
import { createMemoryStudyBackend, createStudyRepository } from '../../../domain/storage';
import { createEngineClient } from '../../../engine-api';
import { NightsRoom } from './NightsRoom';

async function flush() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 10));
}

describe('NightsRoom (/nights)', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    initAppearance();
    updateAppearance({ lang: 'en', motion: 'reduced' }, { persist: false });
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    render(null, host);
    host.remove();
  });

  it('renders ledger balance gate, player sheet rebuy/correct/cash-out, and settles into morning-after summary', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createNightsStore({ repository: repo });

    await store.createNight({
      title: 'Friday Points',
      unitPreset: 'chips',
      players: [
        { displayName: 'Eli', initialBuyInInput: '200' },
        { displayName: 'Dan', initialBuyInInput: '200' },
      ],
    });

    const onRecordFullHand = vi.fn();
    const onOpenHandInReview = vi.fn();

    render(
      <NightsRoom
        store={store}
        onRecordFullHand={onRecordFullHand}
        onOpenHandInReview={onOpenHandInReview}
      />,
      host,
    );

    expect(host.textContent).toContain('Friday Points');
    expect(host.textContent).toContain('Still on the table');
    expect(host.textContent).toContain('400 pts');

    // Switch to Settle while players are still playing -> blocked
    const settleTab = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Settle'),
    );
    settleTab?.click();
    await flush();
    expect(host.textContent).toContain('Not ready to settle');

    const settleBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Settle the night'),
    ) as HTMLButtonElement | undefined;
    expect(settleBtn?.disabled).toBe(true);

    // Cash out both players via store/UI and verify settlement transfers appear
    const eliId = store.activeNightSignal.value!.session.participants[0]!.playerId;
    const danId = store.activeNightSignal.value!.session.participants[1]!.playerId;
    await store.cashOutPlayer(eliId, '270');
    await store.cashOutPlayer(danId, '130');
    await flush();

    expect(host.textContent).toContain('Dan pays Eli');
    expect(host.textContent).toContain('70 pts');

    const readySettleBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Settle the night'),
    ) as HTMLButtonElement | undefined;
    expect(readySettleBtn?.disabled).toBe(false);
    readySettleBtn?.click();
    await flush();

    expect(host.textContent).toContain('Morning-after summary');
    expect(host.textContent).toContain('Reopen night');
    store.dispose();
  });

  it('captures shorthand hands and triggers /hand and /review bridges', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createNightsStore({ repository: repo, initialPreset: 'hands' });
    const onRecordFullHand = vi.fn();
    const onOpenHandInReview = vi.fn();

    render(
      <NightsRoom
        store={store}
        onRecordFullHand={onRecordFullHand}
        onOpenHandInReview={onOpenHandInReview}
      />,
      host,
    );

    expect(host.textContent).toContain('Type a hand');
    expect(host.textContent).toContain('6 actions and 3 board cards');

    const recordBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Record full hand'),
    );
    recordBtn?.click();
    expect(onRecordFullHand).toHaveBeenCalledWith(
      'preset-friday',
      'ils',
      6,
      "Friday at Dan's",
      ['As', 'Kd'],
      0,
      50,
    );

    const reviewBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Open in Review'),
    );
    reviewBtn?.click();
    expect(onOpenHandInReview).toHaveBeenCalledWith('preset-hand-1');
    store.dispose();
  });

  it('logs a quick hand with custom hero cards, 8 seats, custom hero seat, 40 bb stack, and hand note', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createNightsStore({ repository: repo });

    await store.createNight({
      title: 'Friday Deep',
      unitPreset: 'ils',
      players: [
        { displayName: 'Eli', initialBuyInInput: '200' },
        { displayName: 'Dan', initialBuyInInput: '200' },
      ],
    });

    const onRecordFullHand = vi.fn();
    const onOpenHandInReview = vi.fn();

    render(
      <NightsRoom
        store={store}
        onRecordFullHand={onRecordFullHand}
        onOpenHandInReview={onOpenHandInReview}
      />,
      host,
    );

    const handsTab = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Hands'),
    );
    handsTab?.click();
    await flush();

    // Pick custom hero cards via CardPicker, ensuring twin is disabled
    const slot1Btn = host.querySelector('button[aria-label="Choose card 1"]') as HTMLButtonElement | null;
    expect(slot1Btn).not.toBeNull();
    slot1Btn?.click();
    await flush();

    const twinKd = host.querySelector(
      'button[aria-label="K♦︎ · in play"]',
    ) as HTMLButtonElement | null;
    expect(twinKd?.getAttribute('aria-disabled')).toBe('true');

    const pickQh = host.querySelector(
      'button[aria-label="Q of hearts"]',
    ) as HTMLButtonElement | null;
    expect(pickQh).not.toBeNull();
    pickQh?.click();
    await flush();

    const slot2Btn = host.querySelector('button[aria-label="Choose card 2"]') as HTMLButtonElement | null;
    slot2Btn?.click();
    await flush();

    const twinQh = host.querySelector(
      'button[aria-label="Q♥︎ · in play"]',
    ) as HTMLButtonElement | null;
    expect(twinQh?.getAttribute('aria-disabled')).toBe('true');

    const pickQs = host.querySelector(
      'button[aria-label="Q of spades"]',
    ) as HTMLButtonElement | null;
    expect(pickQs).not.toBeNull();
    pickQs?.click();
    await flush();

    // Choose 8 seats, CO seat, and 40 bb stack depth
    const seatsGroup = host.querySelector('[role="group"][aria-label="Seats"]')!;
    const seat8Chip = Array.from(seatsGroup.querySelectorAll('button')).find(
      (b) => b.textContent === '8',
    );
    seat8Chip?.click();
    await flush();

    const heroSeatGroup = host.querySelector('[role="group"][aria-label="Your seat"]')!;
    expect(heroSeatGroup.textContent).toContain('UTG+1');
    const coChip = Array.from(heroSeatGroup.querySelectorAll('button')).find(
      (b) => b.textContent === 'CO',
    );
    coChip?.click();
    await flush();
    expect(coChip?.getAttribute('aria-pressed')).toBe('true');

    const stackGroup = host.querySelector('[role="group"][aria-label="Stack depth"]')!;
    const stack40Chip = Array.from(stackGroup.querySelectorAll('button')).find(
      (b) => b.textContent === '40 bb',
    );
    stack40Chip?.click();
    await flush();
    expect(stack40Chip?.getAttribute('aria-pressed')).toBe('true');

    // Type shorthand line and hand note
    const shorthandInput = host.querySelector(
      'input[aria-label="Type a hand in shorthand"]',
    ) as HTMLInputElement;
    shorthandInput.value = 'co r12 btn f sb f bb c / 9h 4c 2d';
    shorthandInput.dispatchEvent(new Event('input', { bubbles: true }));

    const handNoteTextarea = host.querySelector(
      'textarea[aria-label="Optional note for this game-night hand"]',
    ) as HTMLTextAreaElement;
    handNoteTextarea.value = 'Villain check-called flop with gutshot';
    handNoteTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();

    const saveHandBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save hand'),
    ) as HTMLButtonElement;
    expect(saveHandBtn.disabled).toBe(false);
    saveHandBtn.click();
    await flush();

    expect(handNoteTextarea.value).toBe('');
    expect(host.textContent).toContain('Villain check-called flop with gutshot');

    const savedHands = await repo.listSavedHands();
    expect(savedHands).toHaveLength(1);
    expect(savedHands[0]!.payload.heroCards).toEqual(['Qh', 'Qs']);
    expect(savedHands[0]!.payload.seatCount).toBe(8);
    expect(savedHands[0]!.payload.heroPositionLabel).toBe('CO');
    expect(savedHands[0]!.payload.startingStackBb).toBe(40);
    expect(savedHands[0]!.payload.handNote).toBe('Villain check-called flop with gutshot');

    // Verify Record full hand forwards seatCount and nightTitle
    const fullHandBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Record full hand'),
    );
    fullHandBtn?.click();
    expect(onRecordFullHand).toHaveBeenCalledWith(
      store.activeNightSignal.value!.session.sessionId,
      'ils',
      8,
      'Friday Deep',
      ['Qh', 'Qs'],
      7,
      40,
    );
    store.dispose();
  });

  it('edits session notes on the Ledger view and disables editing when settled', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createNightsStore({ repository: repo });

    const created = await store.createNight({
      title: 'Thursday Notes',
      unitPreset: 'chips',
      players: [
        { displayName: 'Eli', initialBuyInInput: '200' },
        { displayName: 'Dan', initialBuyInInput: '200' },
      ],
    });

    render(
      <NightsRoom
        store={store}
        onRecordFullHand={vi.fn()}
        onOpenHandInReview={vi.fn()}
      />,
      host,
    );

    const notesArea = host.querySelector(
      'textarea[aria-label="Session notes for this game night"]',
    ) as HTMLTextAreaElement;
    expect(notesArea).not.toBeNull();
    expect(notesArea.disabled).toBe(false);

    notesArea.value = 'Splashy 1/2 table, Dan rebuy at 21:00';
    notesArea.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();

    expect(store.activeNightSignal.value?.sessionNote).toBe(
      'Splashy 1/2 table, Dan rebuy at 21:00',
    );
    const persisted = await repo.listNightSessions();
    expect(persisted[0]?.sessionNote).toBe('Splashy 1/2 table, Dan rebuy at 21:00');

    // Settle the night and verify textarea becomes disabled
    const eliId = created!.session.participants[0]!.playerId;
    const danId = created!.session.participants[1]!.playerId;
    await store.cashOutPlayer(eliId, '250');
    await store.cashOutPlayer(danId, '150');
    await store.settleActiveNight();
    await flush();

    const settledNotesArea = host.querySelector(
      'textarea[aria-label="Session notes for this game night"]',
    ) as HTMLTextAreaElement;
    expect(settledNotesArea.disabled).toBe(true);
    expect(settledNotesArea.value).toBe('Splashy 1/2 table, Dan rebuy at 21:00');
    store.dispose();
  });

  it('renders Morning-After Receipt v2 in Settle tab with name/amount/hand toggles and copy receipt action', async () => {
    const repo = createStudyRepository(createMemoryStudyBackend());
    const store = createNightsStore({ repository: repo });

    const created = await store.createNight({
      title: 'Sunday Receipt',
      unitPreset: 'chips',
      players: [
        { displayName: 'Eli', initialBuyInInput: '200' },
        { displayName: 'Dan', initialBuyInInput: '200' },
      ],
    });

    const eliId = created!.session.participants[0]!.playerId;
    const danId = created!.session.participants[1]!.playerId;
    await store.cashOutPlayer(eliId, '270');
    await store.cashOutPlayer(danId, '130');

    store.setHandShorthandInput('co r12 btn f sb f bb c / 9h 4c 2d');
    await store.saveQuickShorthandHand();

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(
      <NightsRoom
        store={store}
        onRecordFullHand={vi.fn()}
        onOpenHandInReview={vi.fn()}
      />,
      host,
    );

    const settleTab = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Settle'),
    );
    settleTab?.click();
    await flush();

    expect(host.textContent).toContain('Morning-after receipt');
    const pre = host.querySelector('pre')!;
    expect(pre).not.toBeNull();
    expect(pre.textContent).toContain('Sunday Receipt ·');
    expect(pre.textContent).toContain('Morning-after receipt');
    expect(pre.textContent).toContain('Dan → Eli: 70 pts');
    expect(pre.textContent).not.toContain('24.5 bb');

    // Toggle "Show names" off -> anonymizes player names
    const showNamesBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent === 'Show names',
    );
    showNamesBtn?.click();
    await flush();
    expect(pre.textContent).toContain('Player 2 → Player 1: 70 pts');
    expect(pre.textContent).not.toContain('Dan → Eli');

    // Toggle "Show amounts" off -> hides amounts
    const showAmountsBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent === 'Show amounts',
    );
    showAmountsBtn?.click();
    await flush();
    expect(pre.textContent).toContain('Player 2 → Player 1');
    expect(pre.textContent).not.toContain('70 pts');

    // Toggle "Show hands" on -> includes linked hands, then back off -> hides linked hands
    const showHandsBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent === 'Show hands',
    );
    showHandsBtn?.click();
    await flush();
    expect(pre.textContent).toContain('24.5 bb');

    showHandsBtn?.click();
    await flush();
    expect(pre.textContent).not.toContain('24.5 bb');

    // Click "Copy receipt"
    const copyBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Copy receipt'),
    );
    expect(copyBtn).toBeDefined();
    copyBtn?.click();
    await flush();

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0]?.[0]).toContain('Sunday Receipt ·');
    expect(writeText.mock.calls[0]?.[0]).toContain('Player 2 → Player 1');
    expect(host.textContent).toContain('Copied');
    store.dispose();
  });

  it('blocks receipt generation and disables Copy/Download when ledger is unbalanced', async () => {
    const store = createNightsStore({
      engine: createEngineClient({ mode: 'inline' }),
      repository: createStudyRepository(createMemoryStudyBackend()),
    });
    const created = await store.createNight({
      title: 'Off Night',
      unitPreset: 'ils',
      players: [
        { displayName: 'Eli', initialBuyInInput: '200' },
        { displayName: 'Dan', initialBuyInInput: '200' },
      ],
    });
    const active = created!;
    await store.cashOutPlayer(active.session.participants[0]!.playerId, '180');
    await store.cashOutPlayer(active.session.participants[1]!.playerId, '200');

    render(
      <NightsRoom
        store={store}
        onRecordFullHand={() => {}}
        onOpenHandInReview={() => {}}
      />,
      host,
    );
    const settleTab = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Settle'),
    );
    settleTab?.click();
    await flush();

    const pre = host.querySelector('pre')!;
    expect(pre.textContent).not.toContain('All players finished even');
    expect(pre.textContent).toContain('Not ready to settle: ₪20');

    const copyBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Copy receipt'),
    ) as HTMLButtonElement | undefined;
    const dlBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Download .txt'),
    ) as HTMLButtonElement | undefined;
    expect(copyBtn?.disabled).toBe(true);
    expect(dlBtn?.disabled).toBe(true);
    store.dispose();
  });

  it('supports Banker mode settlement routing all transfers through the selected banker and updating receipt', async () => {
    const store = createNightsStore({
      engine: createEngineClient({ mode: 'inline' }),
      repository: createStudyRepository(createMemoryStudyBackend()),
    });
    const created = await store.createNight({
      title: 'Banker Night',
      unitPreset: 'chips',
      players: [
        { displayName: 'Eli', initialBuyInInput: '100' },
        { displayName: 'Dan', initialBuyInInput: '100' },
        { displayName: 'Noa', initialBuyInInput: '100' },
      ],
    });
    const active = created!;
    await store.cashOutPlayer(active.session.participants[0]!.playerId, '220'); // Eli +120
    await store.cashOutPlayer(active.session.participants[1]!.playerId, '40');  // Dan -60
    await store.cashOutPlayer(active.session.participants[2]!.playerId, '40');  // Noa -60

    render(
      <NightsRoom
        store={store}
        onRecordFullHand={() => {}}
        onOpenHandInReview={() => {}}
      />,
      host,
    );
    const settleTab = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Settle'),
    );
    settleTab?.click();
    await flush();

    const bankerModeBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Banker mode'),
    );
    expect(bankerModeBtn).toBeTruthy();
    bankerModeBtn!.click();
    await flush();

    // Select Dan as Banker -> Dan (-60) collects 60 from Noa and pays 120 to Eli (2 transfers)
    const danBankerBtn = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Dan',
    );
    expect(danBankerBtn).toBeTruthy();
    danBankerBtn!.click();
    await flush();

    const preText = host.querySelector('pre')?.textContent ?? '';
    expect(preText).toContain('Noa → Dan');
    expect(preText).toContain('Dan → Eli');
    store.dispose();
  });

  it('allows selecting optional stakes/blinds preset when creating a Game Night', async () => {
    const store = createNightsStore({
      engine: createEngineClient({ mode: 'inline' }),
      repository: createStudyRepository(createMemoryStudyBackend()),
    });
    store.setCreateModalOpen(true);

    render(
      <NightsRoom
        store={store}
        onRecordFullHand={() => {}}
        onOpenHandInReview={() => {}}
      />,
      host,
    );
    await flush();

    const stakesBtn = Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '2/5',
    );
    expect(stakesBtn).toBeTruthy();
    stakesBtn!.click();
    await flush();

    const name1 = host.querySelector('input[aria-label="New player name 1"]') as HTMLInputElement;
    const name2 = host.querySelector('input[aria-label="New player name 2"]') as HTMLInputElement;
    name1.value = 'Eli';
    name1.dispatchEvent(new Event('input', { bubbles: true }));
    name2.value = 'Dan';
    name2.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();

    const confirmBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Start night'),
    );
    expect(confirmBtn).toBeTruthy();
    confirmBtn!.click();
    await flush();

    expect(store.activeNightSignal.value?.session.title).toContain('(2/5)');

    // Switch to Hands tab and verify Randomize ▾ dropdown replaces mislabelled "Random board"
    const handsTab = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Hands'),
    );
    handsTab?.click();
    await flush();
    expect(host.textContent).not.toContain('Random board');
    const randMenuBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Randomize ▾'),
    );
    expect(randMenuBtn).toBeTruthy();
    randMenuBtn!.click();
    await flush();
    expect(document.body.textContent).toContain('Randomize hero cards');
    expect(document.body.textContent).toContain('Randomize hero position');
    store.dispose();
  });
});
