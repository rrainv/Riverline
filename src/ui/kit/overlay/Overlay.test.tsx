import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppearance } from '../../../domain/appearance';
import {
  activeRouteSignal,
  closePalette,
  openPalette,
  paletteOpenSignal,
} from '../../../domain/shellState';
import { CommandPalette, type CommandPaletteItem } from './CommandPalette';
import { Dialog, PhoneSheet, Toast, Tooltip } from './Overlay';

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe('Overlay (#17)', () => {
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

  it('requires exact type-to-confirm phrase before enabling destructive confirm button', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <Dialog
        open
        onClose={onClose}
        title="Delete session"
        confirmPhrase="Friday-100bb"
        confirmLabel="Delete permanently"
        onConfirm={onConfirm}
      />,
      host,
    );
    await flush();

    const buttons = Array.from(host.querySelectorAll('button'));
    const confirmBtn = buttons.find((b) => b.textContent?.includes('Delete permanently'))!;
    expect(confirmBtn.disabled).toBe(true);

    const input = host.querySelector('input')!;
    input.value = 'Friday-100bb';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await flush();

    const updatedConfirmBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Delete permanently'),
    )!;
    expect(updatedConfirmBtn.disabled).toBe(false);
    updatedConfirmBtn.click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('closes only the topmost overlay on Escape and returns focus on close', async () => {
    const closeOuter = vi.fn();
    const closeInner = vi.fn();
    const trigger = document.createElement('button');
    host.appendChild(trigger);
    trigger.focus();

    render(
      <div>
        <Dialog open onClose={closeOuter} title="Outer" returnFocusTo={trigger} />
        <PhoneSheet open onClose={closeInner} title="Inner">
          <p>Sheet content</p>
        </PhoneSheet>
      </div>,
      host,
    );
    await flush();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();

    render(
      <div>
        <Dialog open={false} onClose={closeOuter} title="Outer" returnFocusTo={trigger} />
        <PhoneSheet open={false} onClose={closeInner} title="Inner">
          <p>Sheet content</p>
        </PhoneSheet>
      </div>,
      host,
    );
    await flush();
    expect(document.activeElement).toBe(trigger);
  });

  it('renders Tooltip and Toast with action', () => {
    const onAction = vi.fn();
    render(
      <div>
        <Tooltip content="Tip body" defaultOpen>
          <button type="button">Trigger</button>
        </Tooltip>
        <Toast open message="Saved" actionLabel="Undo" onAction={onAction} />
      </div>,
      host,
    );

    expect(host.querySelector('[role="tooltip"]')?.textContent).toBe('Tip body');
    const undoBtn = Array.from(host.querySelectorAll('button')).find((b) => b.textContent === 'Undo')!;
    undoBtn.click();
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('CommandPalette', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    initAppearance();
    activeRouteSignal.value = 'home';
    closePalette();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    render(null, host);
    host.remove();
    closePalette();
    activeRouteSignal.value = 'home';
  });

  it('filters grouped extraItems, skips empty groups, navigates across groups with arrows, and selects with Enter', async () => {
    const onSelectHand = vi.fn();
    const onSelectConcept = vi.fn();
    const onSelectNight = vi.fn();
    const extraItems: CommandPaletteItem[] = [
      {
        id: 'hand-1',
        group: 'hands',
        label: 'Friday KQo spot',
        hint: 'Review',
        searchIndex: 'friday kqo spot review',
        iconRoute: 'review',
        onSelect: onSelectHand,
      },
      {
        id: 'concept-1',
        group: 'concepts',
        label: 'Pot odds',
        hint: 'Learn',
        searchIndex: 'pot odds equity price',
        iconRoute: 'learn',
        onSelect: onSelectConcept,
      },
      {
        id: 'night-1',
        group: 'nights',
        label: 'Friday Home Game',
        hint: 'Nights',
        searchIndex: 'friday home game session',
        iconRoute: 'nights',
        onSelect: onSelectNight,
      },
    ];

    openPalette();
    render(
      <CommandPalette open={paletteOpenSignal.value} activeRoute="home" extraItems={extraItems} />,
      host,
    );
    await flush();

    // All 4 non-empty groups render initially
    const initialGroups = Array.from(host.querySelectorAll('[role="group"]'));
    expect(initialGroups).toHaveLength(4);
    expect(host.textContent).toContain('Rooms');
    expect(host.textContent).toContain('Saved hands & notes');
    expect(host.textContent).toContain('Learn concepts');
    expect(host.textContent).toContain('Game nights');

    // Filter to items matching "friday" (only hands + nights match; rooms + concepts are skipped)
    const input = host.querySelector('input')!;
    input.value = 'friday';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await flush();

    const filteredGroups = Array.from(host.querySelectorAll('[role="group"]'));
    expect(filteredGroups).toHaveLength(2);
    expect(host.textContent).not.toContain('Learn concepts');

    const options = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="option"]'));
    expect(options).toHaveLength(2);
    expect(options[0]!.getAttribute('aria-selected')).toBe('true');
    expect(options[1]!.getAttribute('aria-selected')).toBe('false');

    // ArrowDown moves selection across the group boundary to the second item
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await flush();

    const updatedOptions = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="option"]'));
    expect(updatedOptions[0]!.getAttribute('aria-selected')).toBe('false');
    expect(updatedOptions[1]!.getAttribute('aria-selected')).toBe('true');

    // ArrowUp moves back, ArrowDown moves forward again, Enter selects and closes palette
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await flush();
    expect(
      host.querySelectorAll<HTMLButtonElement>('[role="option"]')[0]!.getAttribute('aria-selected'),
    ).toBe('true');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await flush();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await flush();

    expect(onSelectNight).toHaveBeenCalledTimes(1);
    expect(onSelectHand).not.toHaveBeenCalled();
    expect(onSelectConcept).not.toHaveBeenCalled();
    expect(paletteOpenSignal.value).toBe(false);
  });

  it('selects grouped extraItems on click and closes palette unless inlinePreview is true', async () => {
    const onSelectConcept = vi.fn();
    const extraItems: CommandPaletteItem[] = [
      {
        id: 'concept-2',
        group: 'concepts',
        label: 'Required equity',
        hint: 'Learn',
        searchIndex: 'required equity break-even',
        onSelect: onSelectConcept,
      },
    ];

    openPalette();
    render(
      <CommandPalette
        open
        activeRoute="learn"
        initialQuery="required"
        extraItems={extraItems}
      />,
      host,
    );
    await flush();

    const option = host.querySelector<HTMLButtonElement>('[role="option"]')!;
    expect(option.textContent).toContain('Required equity');
    option.click();
    await flush();

    expect(onSelectConcept).toHaveBeenCalledTimes(1);
    expect(paletteOpenSignal.value).toBe(false);

    // In inlinePreview mode, clicking an option invokes onSelect without closing paletteOpenSignal
    openPalette();
    render(
      <CommandPalette
        open
        inlinePreview
        activeRoute="kit"
        initialQuery="required"
        extraItems={extraItems}
      />,
      host,
    );
    await flush();

    host.querySelector<HTMLButtonElement>('[role="option"]')!.click();
    await flush();

    expect(onSelectConcept).toHaveBeenCalledTimes(2);
    expect(paletteOpenSignal.value).toBe(true);
  });
});
