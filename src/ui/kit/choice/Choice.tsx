import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { cx, motionIsInstant, readDurationMs, type ForcedState } from '../state';
import styles from './Choice.module.css';

interface ChipButtonProps {
  selected: boolean;
  onToggle?: (next: boolean) => void;
  disabled?: boolean;
  forceState?: ForcedState;
  children: ComponentChildren;
}

/** A pill toggle for filters and other small, independent choices. */
export function ChipButton({ selected, onToggle, disabled = false, forceState, children }: ChipButtonProps) {
  return (
    <button
      type="button"
      className={cx(styles.chipButton, selected && styles.selected)}
      aria-pressed={selected}
      disabled={disabled}
      data-state={forceState}
      onClick={() => onToggle?.(!selected)}
    >
      {children}
    </button>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: ComponentChildren;
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  /** Sheet only: show one option in a forced visual state. */
  forceState?: ForcedState;
  forceStateOn?: T;
}

function readEase(): string {
  if (typeof getComputedStyle !== 'function') return 'ease';
  return getComputedStyle(document.documentElement).getPropertyValue('--ease-inout').trim() || 'ease';
}

/**
 * One choice from a few (table pace, street). The selected highlight glides between
 * options (--dur-3, --ease-inout). Arrow keys move the choice; selection follows focus.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  disabled = false,
  forceState,
  forceStateOn,
}: SegmentedControlProps<T>) {
  const groupRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLSpanElement | null>(null);
  const optionRefs = useRef(new Map<T, HTMLButtonElement>());
  const lastRect = useRef<{ x: number; y: number; w: number; value: T } | null>(null);

  const place = (animate: boolean) => {
    const indicator = indicatorRef.current;
    const button = optionRefs.current.get(value);
    if (!indicator || !button) return;
    const x = button.offsetLeft;
    const y = button.offsetTop;
    const w = button.offsetWidth;
    indicator.style.width = `${w}px`;
    indicator.style.height = `${button.offsetHeight}px`;
    indicator.style.transform = `translate(${x}px, ${y}px)`;
    indicator.style.opacity = w > 0 ? '1' : '0';
    const prev = lastRect.current;
    if (
      animate &&
      prev &&
      prev.value !== value &&
      w > 0 &&
      typeof indicator.animate === 'function' &&
      !motionIsInstant()
    ) {
      indicator.animate(
        [
          { transform: `translate(${prev.x}px, ${prev.y}px) scaleX(${prev.w / w})` },
          { transform: `translate(${x}px, ${y}px) scaleX(1)` },
        ],
        { duration: readDurationMs('--dur-3'), easing: readEase() },
      );
    }
    lastRect.current = { x, y, w, value };
  };

  useLayoutEffect(() => {
    place(true);
  });

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => place(false));
    ro.observe(group);
    return () => ro.disconnect();
  });

  const enabled = options.filter((o) => !o.disabled && !disabled);

  const move = (delta: number) => {
    if (enabled.length === 0) return;
    const idx = enabled.findIndex((o) => o.value === value);
    const next = enabled[(idx + delta + enabled.length) % enabled.length];
    if (next) {
      onChange(next.value);
      optionRefs.current.get(next.value)?.focus();
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const rtl = groupRef.current ? getComputedStyle(groupRef.current).direction === 'rtl' : false;
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        move(rtl ? -1 : 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        move(rtl ? 1 : -1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Home': {
        event.preventDefault();
        const first = enabled[0];
        if (first) {
          onChange(first.value);
          optionRefs.current.get(first.value)?.focus();
        }
        break;
      }
      case 'End': {
        event.preventDefault();
        const last = enabled[enabled.length - 1];
        if (last) {
          onChange(last.value);
          optionRefs.current.get(last.value)?.focus();
        }
        break;
      }
      default:
        break;
    }
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled ? 'true' : undefined}
      className={cx(styles.segmented, disabled && styles.segmentedDisabled)}
      onKeyDown={onKeyDown}
    >
      <span ref={indicatorRef} className={styles.indicator} aria-hidden="true" />
      {options.map((option) => {
        const checked = option.value === value;
        const isDisabled = disabled || option.disabled === true;
        return (
          <button
            key={option.value}
            ref={(el) => {
              if (el) optionRefs.current.set(option.value, el);
              else optionRefs.current.delete(option.value);
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked && !isDisabled ? 0 : -1}
            disabled={isDisabled}
            className={cx(styles.segment, checked && styles.segmentChecked)}
            data-state={forceStateOn === option.value ? forceState : undefined}
            onClick={() => {
              if (!checked) onChange(option.value);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
