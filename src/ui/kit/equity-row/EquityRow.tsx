import type { ComponentChildren, JSX } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { formatNumber, t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { PlayingCard, type CardSize, type CardState } from '../playing-card/PlayingCard';
import { cx, motionIsInstant, type ForcedState } from '../state';
import styles from './EquityRow.module.css';

export type EquityRowDensity = 'roomy' | 'dense' | 'compact';

export interface EquityCardItem {
  card?: string;
  state?: CardState;
}

export interface EquityRowProps {
  id: string;
  who: string;
  whoMeta?: string;
  isHero?: boolean;
  /** Exact two hole cards or face-down unknowns (`state: 'back'`). */
  cards?: EquityCardItem[];
  /** Range string when cards are specified as a range rather than two hole cards. */
  rangeLabel?: string;
  /** Equity percentage in 0..100 (displayed once). */
  equityPct: number;
  /** Optional previous-street equity percentage in 0..100 (renders brass tick). */
  previousEquityPct?: number;
  /** Optional signed delta string (e.g. "+6.4%" or "-4.1%"), rendered next to equity %. */
  deltaPct?: number;
  /** Single honest "right now" fact (e.g. "Top pair · top kicker"). */
  rightNow?: ComponentChildren;
  density?: EquityRowDensity;
  expanded?: boolean;
  onToggleExpand?: () => void;
  expandedContent?: ComponentChildren;
  onRemove?: () => void;
  removeDisabled?: boolean;
  leaving?: boolean;
  forceActionState?: ForcedState;
}

const DENSITY_CARD_SIZE: Record<EquityRowDensity, CardSize> = {
  roomy: 'standard',
  dense: 'small',
  compact: 'mini',
};

/**
 * Equity row and bar (#11). Single horizontal row (never Layout B grid):
 * who, hand/range/unknown cards, scaleX bar from reading-start edge + previous-street tick,
 * equity percentage once with delta, one "right now" fact, expand slot, and remove action.
 */
export function EquityRow({
  id,
  who,
  whoMeta,
  isHero = false,
  cards,
  rangeLabel,
  equityPct,
  previousEquityPct,
  deltaPct,
  rightNow,
  density = 'roomy',
  expanded = false,
  onToggleExpand,
  expandedContent,
  onRemove,
  removeDisabled = false,
  leaving = false,
  forceActionState,
}: EquityRowProps) {
  const cardSize = DENSITY_CARD_SIZE[density];
  const clampedEquity = Math.max(0, Math.min(100, equityPct));
  const clampedPrev =
    previousEquityPct !== undefined ? Math.max(0, Math.min(100, previousEquityPct)) : undefined;

  const formattedPct = `${formatNumber(clampedEquity, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;

  let formattedDelta: string | null = null;
  let deltaClass = styles.deltaFlat;
  if (deltaPct !== undefined && Math.abs(deltaPct) >= 0.05) {
    const sign = deltaPct > 0 ? '+' : '−';
    formattedDelta = `${sign}${formatNumber(Math.abs(deltaPct), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`;
    deltaClass = deltaPct > 0 ? styles.deltaUp : styles.deltaDown;
  }

  return (
    <div
      data-equity-row={id}
      className={cx(
        styles.rowWrap,
        styles[`density_${density}`],
        isHero && styles.rowHero,
        leaving && styles.rowLeaving,
      )}
    >
      <div className={styles.rowMain}>
        <div className={styles.whoCell}>
          <span className={styles.whoName}>{who}</span>
          {whoMeta && <span className={styles.whoMeta}>{whoMeta}</span>}
        </div>

        <div className={styles.cardsCell}>
          {cards && cards.length > 0 ? (
            cards.map((c, idx) => (
              <PlayingCard
                key={idx}
                card={c.card}
                state={c.state ?? (c.card ? 'face' : 'back')}
                size={cardSize}
              />
            ))
          ) : rangeLabel ? (
            <span className={styles.rangePill}>
              <PokerNotation>{rangeLabel}</PokerNotation>
            </span>
          ) : (
            <>
              <PlayingCard state="back" size={cardSize} />
              <PlayingCard state="back" size={cardSize} />
            </>
          )}
        </div>

        <div className={styles.barCell}>
          <div className={styles.barTrack} role="presentation">
            <span
              className={styles.barFill}
              style={{ '--eq-ratio': clampedEquity / 100 } as JSX.CSSProperties}
            />
            {clampedPrev !== undefined && (
              <span
                className={styles.prevTick}
                style={{ '--prev-pct': clampedPrev } as JSX.CSSProperties}
                title={t('kit.equity.previousTickTitle', {
                  pct: `${formatNumber(clampedPrev, { maximumFractionDigits: 1 })}%`,
                })}
              />
            )}
          </div>
        </div>

        <div className={styles.pctCell}>
          <b className={styles.pctValue}>
            <PokerNotation>{formattedPct}</PokerNotation>
          </b>
          {formattedDelta && (
            <span className={cx(styles.delta, deltaClass)}>
              <PokerNotation>{formattedDelta}</PokerNotation>
            </span>
          )}
        </div>

        <div className={styles.rightNowCell}>{rightNow}</div>

        <div className={styles.actionsCell}>
          {onToggleExpand && (
            <button
              type="button"
              className={styles.iconBtn}
              aria-expanded={expanded ? 'true' : 'false'}
              aria-label={t('kit.equity.toggleDetails', { who })}
              data-state={forceActionState}
              onClick={onToggleExpand}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cx(expanded && styles.chevronExpanded)}
                aria-hidden="true"
              >
                <path d="M6 4l4 4-4 4" />
              </svg>
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              className={styles.iconBtn}
              disabled={removeDisabled}
              aria-label={t('kit.equity.removeRow', { who })}
              data-state={!onToggleExpand ? forceActionState : undefined}
              onClick={onRemove}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {expanded && expandedContent !== undefined && (
        <div className={styles.expandedDrawer}>{expandedContent}</div>
      )}
    </div>
  );
}

/**
 * FLIP-animated list container for EquityRow items (--dur-3 --ease-out on reorder/gap close).
 */
export function EquityList({
  rowKeys,
  children,
  ariaLabel,
}: {
  rowKeys: string[];
  children: ComponentChildren;
  ariaLabel?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const prevTopsRef = useRef<Map<string, number>>(new Map());

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const rows = Array.from(el.querySelectorAll<HTMLElement>('[data-equity-row]'));
    const nextTops = new Map<string, number>();

    rows.forEach((row) => {
      const key = row.dataset.equityRow;
      if (!key) return;
      const rect = row.getBoundingClientRect();
      nextTops.set(key, rect.top);
      const prevTop = prevTopsRef.current.get(key);
      if (prevTop !== undefined && !motionIsInstant()) {
        const dy = prevTop - rect.top;
        if (Math.abs(dy) >= 1) {
          row.style.transition = 'none';
          row.style.transform = `translateY(${dy}px)`;
          void row.offsetHeight;
          row.style.transition = 'transform var(--dur-3) var(--ease-out)';
          row.style.transform = '';
        }
      }
    });

    prevTopsRef.current = nextTops;
  }, [rowKeys.join('|')]);

  return (
    <div
      ref={listRef}
      role="region"
      aria-label={ariaLabel ?? t('kit.equity.listAria')}
      className={styles.list}
    >
      {children}
    </div>
  );
}
