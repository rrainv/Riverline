import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppearance } from '../../../domain/appearance';
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
