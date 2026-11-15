import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { Button } from '../button/Button';
import { cx, type ForcedState } from '../state';
import styles from './TextField.module.css';

export interface TextFieldProps {
  value: string;
  onValueChange: (next: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  ariaLabel: string;
  /** Live parsed preview rendered cleanly beneath the field. */
  preview?: ComponentChildren;
  /** Named validation error rendered with alert semantics and gentle nudge. */
  error?: ComponentChildren;
  /** Optional inline submit button inside the input row. */
  submitLabel?: ComponentChildren;
  submitDisabled?: boolean;
  /** Keep input LTR (e.g. poker card/range shorthand). */
  ltrInput?: boolean;
  disabled?: boolean;
  forceState?: ForcedState;
}

/**
 * Single-line recessed well (--well, --h-input) with live preview and named error slot.
 */
export function TextField({
  value,
  onValueChange,
  onSubmit,
  placeholder,
  ariaLabel,
  preview,
  error,
  submitLabel,
  submitDisabled = false,
  ltrInput = true,
  disabled = false,
  forceState,
}: TextFieldProps) {
  const [nudgeKey, setNudgeKey] = useState(0);
  const prevErrorRef = useRef<boolean>(false);
  const helperId = useId();
  const hasError = Boolean(error);

  useEffect(() => {
    if (hasError && !prevErrorRef.current) {
      setNudgeKey((k) => k + 1);
    }
    prevErrorRef.current = hasError;
  }, [hasError]);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (disabled) return;
    if (event.key === 'Enter' && onSubmit) {
      event.preventDefault();
      if (!submitDisabled) {
        onSubmit();
      } else {
        setNudgeKey((k) => k + 1);
      }
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.row}>
        <div
          key={hasError ? `err-${nudgeKey}` : 'ok'}
          className={cx(
            styles.well,
            hasError && styles.wellError,
            hasError && styles.nudge,
            disabled && styles.wellDisabled,
          )}
          data-state={forceState}
        >
          <input
            type="text"
            className={cx(styles.input, ltrInput && styles.inputLtr)}
            value={value}
            placeholder={placeholder}
            aria-label={ariaLabel}
            aria-invalid={hasError ? 'true' : 'false'}
            aria-describedby={preview || error ? helperId : undefined}
            dir={ltrInput ? 'ltr' : undefined}
            disabled={disabled}
            onInput={(e) => onValueChange(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        {submitLabel !== undefined && onSubmit && (
          <Button
            variant="primary"
            disabled={disabled || submitDisabled}
            onClick={onSubmit}
          >
            {submitLabel}
          </Button>
        )}
      </div>
      {(error || preview) && (
        <div
          id={helperId}
          role={hasError ? 'alert' : undefined}
          className={hasError ? styles.errorText : styles.previewText}
        >
          {error ?? preview}
        </div>
      )}
    </div>
  );
}
