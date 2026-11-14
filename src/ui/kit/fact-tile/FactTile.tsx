import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatNumber, t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { TierBadge, type Tier } from '../chip/Chip';
import shimmer from '../shimmer/shimmer.module.css';
import { cx, motionIsInstant, readDurationMs } from '../state';
import styles from './FactTile.module.css';

export interface FactTileProps {
  label: ComponentChildren;
  /** Numeric value from the engine, or null when empty / unavailable. */
  value: number | null;
  decimals?: number;
  /** Suffix shown inside <PokerNotation>, e.g. "%" or "bb". */
  unit?: string;
  /** Optional tier or short note below the number. */
  tier?: Tier;
  note?: ComponentChildren;
  loading?: boolean;
  /** When true (for example after a keyboard action), skips the counting animation. */
  instant?: boolean;
}

/**
 * Label, one tabular number (--num), and a tier or unit.
 * Two to four per panel instead of a fact table.
 * Numbers count straight to the engine value over --dur-4 with no spring overshoot.
 */
export function FactTile({
  label,
  value,
  decimals = 1,
  unit,
  tier,
  note,
  loading = false,
  instant = false,
}: FactTileProps) {
  const [displayValue, setDisplayValue] = useState<number | null>(value);
  const prevValueRef = useRef<number | null>(value);

  const durMs = readDurationMs('--dur-4');
  const shouldAnimate =
    !instant &&
    value !== null &&
    prevValueRef.current !== null &&
    prevValueRef.current !== value &&
    durMs > 1 &&
    !motionIsInstant() &&
    typeof requestAnimationFrame === 'function';

  const effectiveValue = shouldAnimate ? displayValue : value;

  useEffect(() => {
    if (value === null) {
      prevValueRef.current = null;
      setDisplayValue(null);
      return;
    }

    const from = prevValueRef.current;
    prevValueRef.current = value;

    const currentDurMs = readDurationMs('--dur-4');
    if (
      instant ||
      from === null ||
      from === value ||
      currentDurMs <= 1 ||
      motionIsInstant() ||
      typeof requestAnimationFrame !== 'function'
    ) {
      setDisplayValue(value);
      return;
    }

    let rafId = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const tNorm = Math.min(1, Math.max(0, elapsed / currentDurMs));
      // Ease-out without overshoot: lands directly on the exact engine value.
      const eased = 1 - Math.pow(1 - tNorm, 3);
      if (tNorm >= 1) {
        setDisplayValue(value);
      } else {
        setDisplayValue(from + (value - from) * eased);
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafId);
      }
    };
  }, [value, instant]);

  const formatted =
    effectiveValue !== null
      ? formatNumber(effectiveValue, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : null;

  return (
    <div className={styles.tile} aria-busy={loading ? 'true' : undefined}>
      <div className={styles.label}>{label}</div>

      {loading ? (
        <span className={cx(shimmer.shimmer, styles.skeletonValue)} aria-hidden="true" />
      ) : formatted !== null ? (
        <div className={styles.valueRow} data-exact-value={value ?? undefined}>
          <PokerNotation className={styles.value}>
            {unit ? (unit === '%' ? `${formatted}%` : `${formatted} ${unit}`) : formatted}
          </PokerNotation>
        </div>
      ) : (
        <div className={styles.emptyValue}>{t('tier.unavailable')}</div>
      )}

      {(tier !== undefined || note !== undefined) && (
        <div className={styles.meta}>
          {tier !== undefined && <TierBadge tier={tier} />}
          {note !== undefined && <span className={styles.note}>{note}</span>}
        </div>
      )}
    </div>
  );
}

/** A responsive 2-to-4 column grid of FactTiles inside a Panel. */
export function FactTileRow({ children }: { children: ComponentChildren }) {
  return <div className={styles.row}>{children}</div>;
}
