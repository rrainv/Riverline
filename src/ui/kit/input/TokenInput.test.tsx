import { render } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initAppearance } from '../../../domain/appearance';
import { TokenInput } from './TokenInput';

describe('TokenInput (#6)', () => {
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

  it('splits typed space-separated tokens, removes on Backspace, and shows inline alert for invalid tokens', () => {
    const onTokensChange = vi.fn();
    render(
      <TokenInput
        ariaLabel="Shorthand"
        tokens={['btn', 'bad_tok']}
        onTokensChange={onTokensChange}
        validateToken={(tok) =>
          tok === 'btn' ? { valid: true } : { valid: false, reason: `Bad token: ${tok}` }
        }
      />,
      host,
    );

    const invalidChip = host.querySelector('[data-valid="false"]');
    expect(invalidChip?.textContent).toContain('bad_tok');
    const alert = host.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Bad token: bad_tok');

    const input = host.querySelector('input')!;
    input.value = 'r2.5 ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onTokensChange).toHaveBeenCalledWith(['btn', 'bad_tok', 'r2.5']);

    input.value = '';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    expect(onTokensChange).toHaveBeenLastCalledWith(['btn']);
  });
});
