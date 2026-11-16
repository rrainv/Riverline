import type { ComponentChildren } from 'preact';
import { formatNumber, t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { cx, type ForcedState } from '../state';
import styles from './Stepper.module.css';

export interface StepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Unit shown next to the number inside <PokerNotation> (for example "bb" or "₪"). */
  unit?: string;
  /** Where the unit renders relative to the number (`suffix` -> "3.5 bb", `prefix` -> "₪100"). */
  unitPosition?: 'prefix' | 'suffix';
  decimals?: number;
  ariaLabel: string;
  disabled?: boolean;
  /** Phone and touch layouts: buttons grow to at least --tap-min (40 px). */
  size?: 'default' | 'touch';
  /** Sheet only: show one button in a forced visual state. */
  forceState?: ForcedState;
  forceTarget?: 'minus' | 'plus';
  label?: ComponentChildren;
}

function roundToStep(value: number, step: number): number {
  const factor = Math.round(1 / step) || 100;
  return Math.round(value * factor) / factor;
}

/**
 * Minus, value, plus, for amounts on the phone and for bet-size edits.
 * Value and unit stay left-to-right via <PokerNotation> with tabular figures.
 */
export function Stepper({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 0.5,
  unit,
  unitPosition = 'suffix',
  decimals,
  ariaLabel,
  disabled = false,
  size = 'default',
  forceState,
  forceTarget,
  label,
}: StepperProps) {
  const canDecrement = !disabled && value - step >= min - 1e-9;
  const canIncrement = !disabled && value + step <= max + 1e-9;

  const adjust = (delta: number) => {
    if (disabled) return;
    const raw = roundToStep(value + delta, step);
    const clamped = Math.min(max, Math.max(min, raw));
    if (clamped !== value) {
      onChange(clamped);
    }
  };

  const formattedNumber = formatNumber(
    value,
    decimals !== undefined
      ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
      : undefined,
  );

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cx(
        styles.stepper,
        size === 'touch' && styles.touch,
        disabled && styles.disabled,
      )}
    >
      {label !== undefined && <span className={styles.groupLabel}>{label}</span>}
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.stepButton}
          disabled={!canDecrement}
          aria-label={`${ariaLabel}: ${t('kit.stepper.decrease')}`}
          data-state={forceTarget === 'minus' ? forceState : undefined}
          onClick={() => adjust(-step)}
        >
          <span aria-hidden="true">−</span>
        </button>

        <output className={styles.readout} aria-live="polite">
          <PokerNotation>
            {unit
              ? unitPosition === 'prefix'
                ? `${unit}${formattedNumber}`
                : `${formattedNumber} ${unit}`
              : formattedNumber}
          </PokerNotation>
        </output>

        <button
          type="button"
          className={styles.stepButton}
          disabled={!canIncrement}
          aria-label={`${ariaLabel}: ${t('kit.stepper.increase')}`}
          data-state={forceTarget === 'plus' ? forceState : undefined}
          onClick={() => adjust(step)}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
    </div>
  );
}
