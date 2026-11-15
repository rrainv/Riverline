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
});
