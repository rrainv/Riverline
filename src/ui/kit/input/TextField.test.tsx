import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextField } from './TextField';

describe('TextField', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    render(null, host);
    host.remove();
  });

  it('renders live preview, named error alert, and triggers Enter submit only when enabled', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <TextField
        value="QQ+"
        onValueChange={onChange}
        onSubmit={onSubmit}
        ariaLabel="Add player"
        preview="18 combos"
        submitLabel="Add"
      />,
      host,
    );

    const input = host.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('dir')).toBe('ltr');
    expect(host.textContent).toContain('18 combos');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    render(
      <TextField
        value="AhAh"
        onValueChange={onChange}
        onSubmit={onSubmit}
        ariaLabel="Add player"
        error="Duplicate card"
        submitLabel="Add"
        submitDisabled
      />,
      host,
    );

    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Duplicate card');
    const updatedInput = host.querySelector('input') as HTMLInputElement;
    expect(updatedInput.getAttribute('aria-invalid')).toBe('true');
    updatedInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('renders a textarea in multiline mode and submits only on Ctrl/Cmd+Enter', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <TextField
        value="Line 1"
        onValueChange={onChange}
        onSubmit={onSubmit}
        ariaLabel="Session notes"
        multiline
        rows={2}
        ltrInput={false}
      />,
      host,
    );

    const textarea = host.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(host.querySelector('input')).toBeNull();
    expect(textarea.getAttribute('rows')).toBe('2');

    textarea.value = 'Line 1\nLine 2';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith('Line 1\nLine 2');

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onSubmit).toHaveBeenCalledTimes(0);

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
