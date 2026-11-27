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

export type EquityBarTone = 'accent' | 'over' | 'under' | 'brass';

export interface EquityRowProps {
  id: string;
  who: string;
  whoMeta?: string;
  isHero?: boolean;
  /** Exact two hole cards or face-down unknowns (`state: 'back'`). */
  cards?: EquityCardItem[];
  /** Omit placeholder card backs (e.g. comparison rows such as pot-odds floor). */
  hideCards?: boolean;
  /** Range string when cards are specified as a range rather than two hole cards. */
  rangeLabel?: string;
  /** Optional 13x13 boolean matrix projected from domain/shorthand for inline range thumbnail. */
  rangeMatrix?: readonly (readonly boolean[])[];
  /** Optional formatted combo summary (e.g. "19 combos"). */
  rangeComboLabel?: string;
  /** Optional bar color token for multiway distinction without judgement. */
  barTone?: EquityBarTone;
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
  onCardSlotClick?: (slotIndex: 0 | 1, anchorEl: HTMLButtonElement) => void;
  onEditRow?: () => void;
  onRandomizeRow?: () => void;
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
function buildRangeMatrixPath(matrix: readonly (readonly boolean[])[]): string {
  const parts: string[] = [];
  for (let r = 0; r < matrix.length; r += 1) {
    const row = matrix[r]!;
    for (let c = 0; c < row.length; c += 1) {
      if (row[c]) {
        parts.push(`M${c + 0.08} ${r + 0.08}h0.84v0.84h-0.84z`);
      }
    }
  }
  return parts.join('');
}

export function EquityRow({
  id,
  who,
  whoMeta,
  isHero = false,
  cards,
  rangeLabel,
  rangeMatrix,
  rangeComboLabel,
  barTone = 'accent',
  equityPct,
  previousEquityPct,
  deltaPct,
  rightNow,
  hideCards = false,
  density = 'roomy',
  expanded = false,
  onToggleExpand,
  expandedContent,
  onCardSlotClick,
  onEditRow,
  onRandomizeRow,
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
            cards.map((c, idx) =>
              onCardSlotClick ? (
                <button
                  key={idx}
                  type="button"
                  className={styles.cardBtn}
                  aria-label={t('kit.equity.editCardSlot', { who, slot: idx + 1 })}
                  onClick={(e) => onCardSlotClick(idx as 0 | 1, e.currentTarget)}
                >
                  <PlayingCard
                    card={c.card}
                    state={c.state ?? (c.card ? 'face' : 'back')}
                    size={cardSize}
                  />
                </button>
              ) : (
                <PlayingCard
                  key={idx}
                  card={c.card}
                  state={c.state ?? (c.card ? 'face' : 'back')}
                  size={cardSize}
                />
              ),
            )
          ) : rangeLabel ? (
            onEditRow ? (
              <button
                type="button"
                className={styles.rangeBoxBtn}
                aria-label={t('kit.equity.editRow', { who })}
                onClick={onEditRow}
              >
                {rangeMatrix && (
                  <svg
                    className={styles.rangeThumb}
                    viewBox="0 0 13 13"
                    aria-hidden="true"
                  >
                    <path d={buildRangeMatrixPath(rangeMatrix)} fill="currentColor" />
                  </svg>
                )}
                <span className={styles.rangeMeta}>
                  <span className={styles.rangePill}>
                    <PokerNotation>{rangeLabel}</PokerNotation>
                  </span>
                  {rangeComboLabel && (
                    <span className={styles.rangeCombos}>{rangeComboLabel}</span>
                  )}
                </span>
              </button>
            ) : (
              <span className={styles.rangeBox}>
                {rangeMatrix && (
                  <svg
                    className={styles.rangeThumb}
                    viewBox="0 0 13 13"
                    aria-hidden="true"
                  >
                    <path d={buildRangeMatrixPath(rangeMatrix)} fill="currentColor" />
                  </svg>
                )}
                <span className={styles.rangeMeta}>
                  <span className={styles.rangePill}>
                    <PokerNotation>{rangeLabel}</PokerNotation>
                  </span>
                  {rangeComboLabel && (
                    <span className={styles.rangeCombos}>{rangeComboLabel}</span>
                  )}
                </span>
              </span>
            )
          ) : hideCards ? null : onEditRow ? (
            <button
              type="button"
              className={styles.rangeBoxBtn}
              aria-label={t('kit.equity.editRow', { who })}
              onClick={onEditRow}
            >
              <PlayingCard state="back" size={cardSize} />
              <PlayingCard state="back" size={cardSize} />
            </button>
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
              className={cx(styles.barFill, styles[`barTone_${barTone}`])}
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
            <span
              className={cx(styles.delta, deltaClass)}
              title={
                clampedPrev !== undefined
                  ? t('kit.equity.previousTickTitle', {
                      pct: `${formatNumber(clampedPrev, { maximumFractionDigits: 1 })}%`,
                    })
                  : undefined
              }
            >
              {t('kit.equity.deltaVsPrior', { delta: formattedDelta })}
            </span>
          )}
        </div>

        <div className={styles.rightNowCell}>{rightNow}</div>

        <div className={styles.actionsCell}>
          {onEditRow && (
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={t('kit.equity.editRow', { who })}
              onClick={onEditRow}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z" />
              </svg>
            </button>
          )}
          {onRandomizeRow && (
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={t('kit.equity.randomizeRow', { who })}
              onClick={onRandomizeRow}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="2.5" y="2.5" width="11" height="11" rx="2.2" />
                <circle cx="5.7" cy="5.7" r="0.8" fill="currentColor" />
                <circle cx="10.3" cy="10.3" r="0.8" fill="currentColor" />
                <circle cx="8" cy="8" r="0.8" fill="currentColor" />
              </svg>
            </button>
          )}
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
