import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { cx, type ForcedState } from '../state';
import styles from './TokenInput.module.css';

export interface TokenValidationResult {
  valid: boolean;
  /** Optional translated explanation when the token is invalid. */
  reason?: ComponentChildren;
}

export interface TokenInputProps {
  /** Committed shorthand tokens. */
  tokens: ReadonlyArray<string>;
  onTokensChange?: (next: string[]) => void;
  /** Draft text currently being typed before space/Enter commits a token. */
  draft?: string;
  onDraftChange?: (next: string) => void;
  /** Called when the user presses Enter to apply the full line. */
  onSubmitLine?: () => void;
  /**
   * Caller-supplied validator (for example from engine/ in F3/F4, or a fixture map on /kit).
   * The UI component never implements a second shorthand grammar.
   */
  validateToken?: (token: string) => TokenValidationResult;
  placeholder?: string;
  ariaLabel: string;
  disabled?: boolean;
  forceState?: ForcedState;
}

/**
 * Recessed well (--well, --h-input) for shorthand input.
 * Tokens appear as chips as you type; an invalid token is outlined in --danger
 * and named in an inline alert beside the field with the sideways invalid-input nudge.
 */
export function TokenInput({
  tokens,
  onTokensChange,
  draft: controlledDraft,
  onDraftChange,
  onSubmitLine,
  validateToken,
  placeholder,
  ariaLabel,
  disabled = false,
  forceState,
}: TokenInputProps) {
  const [internalDraft, setInternalDraft] = useState('');
  const [nudgeKey, setNudgeKey] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const alertId = useId();

  const draft = controlledDraft !== undefined ? controlledDraft : internalDraft;
  const setDraft = (next: string) => {
    if (controlledDraft === undefined) {
      setInternalDraft(next);
    }
    onDraftChange?.(next);
  };

  const evaluations = tokens.map((tok) => ({
    token: tok,
    result: validateToken ? validateToken(tok) : { valid: true },
  }));

  const firstInvalid = evaluations.find((entry) => !entry.result.valid);
  const hasError = Boolean(firstInvalid);

  const prevInvalidTokenRef = useRef<string | undefined>(firstInvalid?.token);
  useEffect(() => {
    if (firstInvalid && firstInvalid.token !== prevInvalidTokenRef.current) {
      setNudgeKey((k) => k + 1);
    }
    prevInvalidTokenRef.current = firstInvalid?.token;
  }, [firstInvalid?.token]);

  const commitSegments = (raw: string) => {
    const parts = raw
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...tokens, ...parts];
    onTokensChange?.(next);
    const addedInvalid = parts.some((p) => validateToken && !validateToken(p).valid);
    if (addedInvalid) {
      setNudgeKey((k) => k + 1);
    }
  };

  const handleInput = (value: string) => {
    if (/\s/.test(value)) {
      const endsWithSpace = /\s$/.test(value);
      const segments = value.split(/\s+/);
      const trailing = endsWithSpace ? '' : (segments.pop() ?? '');
      const toCommit = segments.join(' ').trim();
      if (toCommit) {
        commitSegments(toCommit);
      }
      setDraft(trailing);
      return;
    }
    setDraft(value);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (disabled) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      if (draft.trim()) {
        commitSegments(draft.trim());
        setDraft('');
      }
      if (onSubmitLine) {
        onSubmitLine();
      }
      return;
    }
    if (event.key === 'Backspace' && draft.length === 0 && tokens.length > 0) {
      event.preventDefault();
      onTokensChange?.(tokens.slice(0, -1));
    }
  };

  const removeAt = (index: number) => {
    if (disabled) return;
    onTokensChange?.(tokens.filter((_, idx) => idx !== index));
    inputRef.current?.focus();
  };

  return (
    <div className={styles.wrapper}>
      <div
        key={nudgeKey}
        className={cx(
          styles.well,
          hasError && styles.wellError,
          nudgeKey > 0 && hasError && styles.nudge,
          disabled && styles.wellDisabled,
        )}
        data-state={forceState}
        onClick={() => {
          if (!disabled) inputRef.current?.focus();
        }}
      >
        {evaluations.map(({ token, result }, idx) => (
          <span
            key={`${token}-${idx}`}
            className={cx(styles.tokenChip, result.valid ? styles.tokenValid : styles.tokenInvalid)}
            data-valid={result.valid ? 'true' : 'false'}
          >
            <PokerNotation>{token}</PokerNotation>
            {!disabled && onTokensChange && (
              <button
                type="button"
                className={styles.removeBtn}
                aria-label={t('kit.input.removeToken', { token })}
                onClick={(e) => {
                  e.stopPropagation();
                  removeAt(idx);
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 3l6 6M9 3L3 9"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            )}
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          value={draft}
          disabled={disabled}
          placeholder={tokens.length === 0 ? placeholder : ''}
          aria-label={ariaLabel}
          aria-invalid={hasError ? 'true' : undefined}
          aria-describedby={hasError ? alertId : undefined}
          onInput={(e) => handleInput(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {firstInvalid && (
        <div id={alertId} role="alert" className={styles.alert}>
          <svg
            className={styles.alertIcon}
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4" />
            <path
              d="M8 5v3.5M8 11h.01"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </svg>
          <span>
            {firstInvalid.result.reason ??
              tNodes('kit.input.invalidToken', {
                token: <PokerNotation>{firstInvalid.token}</PokerNotation>,
              })}
          </span>
        </div>
      )}
    </div>
  );
}
