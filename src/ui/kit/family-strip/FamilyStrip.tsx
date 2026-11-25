import { useRef, useState } from 'preact/hooks';
import { t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { cx, type ForcedState } from '../state';
import styles from './FamilyStrip.module.css';

export interface FamilyStripItem {
  id: string;
  hand: string;
  combos: number;
}

export interface FamilyStripProps {
  ariaLabel: string;
  contextLabel?: string;
  items: readonly FamilyStripItem[];
  cutoffIndex: number;
  baselineCutoffIndex?: number;
  onChangeCutoff?: (nextIndex: number) => void;
  disabled?: boolean;
  forceState?: ForcedState;
  className?: string;
}

export function FamilyStrip({
  ariaLabel,
  contextLabel,
  items,
  cutoffIndex,
  baselineCutoffIndex,
  onChangeCutoff,
  disabled = false,
  forceState,
  className,
}: FamilyStripProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const clampedCutoff = Math.max(-1, Math.min(items.length - 1, cutoffIndex));
  const includedItems = clampedCutoff >= 0 ? items.slice(0, clampedCutoff + 1) : [];
  const handCount = includedItems.length;
  const comboCount = includedItems.reduce((sum, item) => sum + item.combos, 0);

  const cutoffHand = clampedCutoff >= 0 ? items[clampedCutoff]?.hand : undefined;
  const cutoffText = cutoffHand
    ? t('kit.strip.cutoffAt', { hand: cutoffHand })
    : t('kit.strip.cutoffNone');

  const handsLabel = t('kit.strip.handsCount', { count: handCount });
  const combosLabel = t('kit.strip.combosCount', { count: comboCount });

  let baselineStatus: string | null = null;
  if (baselineCutoffIndex !== undefined && items.length > 0) {
    const clampedBase = Math.max(-1, Math.min(items.length - 1, baselineCutoffIndex));
    const baseHand = clampedBase >= 0 ? items[clampedBase]?.hand ?? '—' : t('kit.strip.cutoffNone');
    const diff = clampedCutoff - clampedBase;
    if (diff === 0) {
      baselineStatus = t('kit.strip.baselineComparisonMatch', { hand: baseHand });
    } else {
      const signed = diff > 0 ? `+${diff}` : String(diff);
      baselineStatus = t('kit.strip.baselineComparisonDiff', {
        hand: baseHand,
        delta: signed,
      });
    }
  }

  const updateFromPointer = (clientX: number, target: EventTarget | null) => {
    if (disabled || !onChangeCutoff || items.length === 0) return;
    const el = trackRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) {
        const rel = Math.max(0, Math.min(0.9999, (clientX - rect.left) / rect.width));
        const idx = Math.floor(rel * items.length);
        onChangeCutoff(idx);
        return;
      }
    }
    if (target instanceof HTMLElement) {
      const cell = target.closest('[data-strip-index]');
      const rawIdx = cell?.getAttribute('data-strip-index');
      if (rawIdx !== null && rawIdx !== undefined) {
        const parsed = Number(rawIdx);
        if (!Number.isNaN(parsed)) {
          onChangeCutoff(parsed);
        }
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (disabled || !onChangeCutoff || items.length === 0) return;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault();
        onChangeCutoff(Math.min(items.length - 1, clampedCutoff + 1));
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault();
        onChangeCutoff(Math.max(-1, clampedCutoff - 1));
        break;
      case 'Home':
      case 'Escape':
        e.preventDefault();
        onChangeCutoff(-1);
        break;
      case 'End':
        e.preventDefault();
        onChangeCutoff(items.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div className={cx(styles.root, className)}>
      <div className={styles.headerRow}>
        {contextLabel && <span className={styles.contextLabel}>{contextLabel}</span>}
        <span className={styles.cutoffLabel}>{cutoffText}</span>
      </div>

      <div className={styles.scrollFrame}>
        <div
          ref={trackRef}
          dir="ltr"
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={ariaLabel}
          aria-valuemin={-1}
          aria-valuemax={items.length - 1}
          aria-valuenow={clampedCutoff}
          aria-valuetext={`${cutoffText}, ${t('kit.strip.summaryLine', {
            hands: handsLabel,
            combos: combosLabel,
          })}`}
          aria-disabled={disabled || undefined}
          data-force-state={forceState}
          className={cx(styles.track, disabled && styles.trackDisabled)}
          style={{ '--strip-cols': items.length } as Record<string, string | number>}
          onPointerDown={(e) => {
            if (disabled) return;
            setDragging(true);
            try {
              e.currentTarget.setPointerCapture?.(e.pointerId);
            } catch {
              // synthetic events in JSDOM may not carry a real pointerId
            }
            updateFromPointer(e.clientX, e.target);
          }}
          onPointerMove={(e) => {
            if (!dragging || disabled) return;
            updateFromPointer(e.clientX, e.target);
          }}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          onClick={(e) => updateFromPointer(e.clientX, e.target)}
          onKeyDown={handleKeyDown}
        >
          {clampedCutoff === -1 && (
            <span className={styles.startKnob} aria-hidden="true" />
          )}
          {items.map((item, idx) => {
            const included = idx <= clampedCutoff;
            const isEdge = idx === clampedCutoff;
            const inBaseline =
              baselineCutoffIndex !== undefined && idx <= baselineCutoffIndex;
            const isBaselineEdge =
              baselineCutoffIndex !== undefined && idx === baselineCutoffIndex;

            return (
              <div
                key={item.id}
                data-strip-index={idx}
                data-included={included ? 'true' : 'false'}
                className={cx(
                  styles.cell,
                  included && styles.cellIncluded,
                  isEdge && styles.cellEdge,
                )}
              >
                <PokerNotation>{item.hand}</PokerNotation>
                {isEdge && <span className={styles.edgeKnob} aria-hidden="true" />}
                {inBaseline && <span className={styles.baselineTick} aria-hidden="true" />}
                {isBaselineEdge && (
                  <span className={styles.baselineEdgeMark} aria-hidden="true" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.footerRow}>
        <span className={styles.counts}>
          {t('kit.strip.summaryLine', { hands: handsLabel, combos: combosLabel })}
        </span>
        {baselineStatus && <span className={styles.baselineNote}>{baselineStatus}</span>}
      </div>
    </div>
  );
}
