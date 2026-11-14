import type { ComponentChildren, JSX } from 'preact';
import { t } from '../../../i18n';
import { cx, type ForcedState } from '../state';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export interface ButtonProps {
  variant?: ButtonVariant;
  children: ComponentChildren;
  onClick?: (event: JSX.TargetedMouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  /** Waiting for an answer: the label stays, the button does not act. */
  loading?: boolean;
  /** The commit landed: a check appears before the label, the amount stays readable. */
  confirmed?: boolean;
  type?: 'button' | 'submit';
  ariaLabel?: string;
  ariaDescribedBy?: string;
  forceState?: ForcedState;
  buttonRef?: (el: HTMLButtonElement | null) => void;
}

/**
 * Primary is the one accent-filled action per view and carries the committed amount
 * ("Confirm: bet 3.8 bb"). Secondary is an outline. Danger is an outline with a wash.
 */
export function Button({
  variant = 'secondary',
  children,
  onClick,
  disabled = false,
  loading = false,
  confirmed = false,
  type = 'button',
  ariaLabel,
  ariaDescribedBy,
  forceState,
  buttonRef,
}: ButtonProps) {
  const inert = disabled || loading;
  return (
    <button
      ref={buttonRef}
      type={type}
      className={cx(styles.button, styles[variant], loading && styles.loading, confirmed && styles.confirmed)}
      disabled={disabled}
      aria-disabled={loading ? 'true' : undefined}
      aria-busy={loading ? 'true' : undefined}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      data-state={forceState}
      onClick={(event) => {
        if (inert) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {confirmed && (
        <svg className={styles.check} viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      )}
      <span className={styles.label}>{children}</span>
      {loading && (
        <span className={styles.busy} role="status" aria-label={t('kit.button.busy')}>
          <i />
          <i />
          <i />
        </span>
      )}
    </button>
  );
}
