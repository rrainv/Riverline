import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { cx, type ForcedState } from '../state';
import styles from './HeatGrid.module.css';

export type HeatGridVariant = 'runout' | 'leakMap' | 'matrix13';

export type HeatTone =
  | 'okLow'
  | 'okHigh'
  | 'overLow'
  | 'overHigh'
  | 'underLow'
  | 'underHigh'
  | 'neutral'
  | 'struck';

export type MatrixCellState = 'yours' | 'baseline' | 'match' | 'unknown';

export interface HeatGridCell {
  id: string;
  label: string;
  subLabel?: string;
  ariaLabel: string;
  tone?: HeatTone;
  matrixState?: MatrixCellState;
  struck?: boolean;
  disabled?: boolean;
  hasBaselineTick?: boolean;
  forceState?: ForcedState;
}

export interface HeatGridRow {
  id: string;
  label?: string;
  cells: readonly HeatGridCell[];
}

export interface HeatGridColumnFooter {
  id: string;
  valueLabel: string;
  fillPercent: number;
  baselinePercent?: number;
  sampleLabel?: string;
}

export interface HeatGridLegendEntry {
  key: string;
  label: string;
  tone?: HeatTone;
  matrixState?: MatrixCellState;
  isTick?: boolean;
}

export interface HeatGridProps {
  variant: HeatGridVariant;
  ariaLabel: string;
  rows: readonly HeatGridRow[];
  columnHeaders?: readonly string[];
  columnFooters?: readonly HeatGridColumnFooter[];
  footerRowLabel?: string;
  activeId?: string | null;
  onActivateCell?: (cell: HeatGridCell) => void;
  onClearActive?: () => void;
  animateEntrance?: boolean;
  compact?: boolean;
  legend?: readonly HeatGridLegendEntry[];
  className?: string;
}

const TONE_CLASS: Record<HeatTone, string> = {
  okLow: styles.toneOkLow ?? '',
  okHigh: styles.toneOkHigh ?? '',
  overLow: styles.toneOverLow ?? '',
  overHigh: styles.toneOverHigh ?? '',
  underLow: styles.toneUnderLow ?? '',
  underHigh: styles.toneUnderHigh ?? '',
  neutral: styles.toneNeutral ?? '',
  struck: styles.toneStruck ?? '',
};

const MATRIX_CLASS: Record<MatrixCellState, string> = {
  yours: styles.stateYours ?? '',
  baseline: styles.stateBaseline ?? '',
  match: styles.stateMatch ?? '',
  unknown: styles.stateUnknown ?? '',
};

export function HeatGrid({
  variant,
  ariaLabel,
  rows,
  columnHeaders,
  columnFooters,
  footerRowLabel,
  activeId: controlledActiveId,
  onActivateCell,
  onClearActive,
  animateEntrance = true,
  compact = false,
  legend,
  className,
}: HeatGridProps) {
  const [uncontrolledActiveId, setUncontrolledActiveId] = useState<string | null>(null);
  const [focusCoord, setFocusCoord] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const gridRef = useRef<HTMLDivElement>(null);

  const activeId = controlledActiveId !== undefined ? controlledActiveId : uncontrolledActiveId;

  useEffect(() => {
    if (rows.length === 0) return;
    if (focusCoord.r >= rows.length || focusCoord.c >= (rows[focusCoord.r]?.cells.length ?? 0)) {
      setFocusCoord({ r: 0, c: 0 });
    }
  }, [rows, focusCoord.r, focusCoord.c]);

  const forceLtr = variant === 'runout' || variant === 'matrix13';
  const colCount = rows[0]?.cells.length ?? 0;

  const isCellNavigable = (cell: HeatGridCell | undefined): boolean =>
    Boolean(cell && (variant !== 'runout' || (!cell.disabled && !cell.struck)));

  const moveFocus = (nextR: number, nextC: number, dr = 0, dc = 0) => {
    const maxR = rows.length - 1;
    let r = Math.max(0, Math.min(maxR, nextR));
    let maxC = Math.max(0, (rows[r]?.cells.length ?? 1) - 1);
    let c = Math.max(0, Math.min(maxC, nextC));

    if (variant === 'runout' && (dr !== 0 || dc !== 0)) {
      let steps = 0;
      const maxSteps = rows.length * Math.max(1, colCount) + 2;
      while (steps < maxSteps && !isCellNavigable(rows[r]?.cells[c])) {
        const candidateR = r + dr;
        const candidateC = c + dc;
        if (
          candidateR < 0 ||
          candidateR > maxR ||
          candidateC < 0 ||
          candidateC >= (rows[candidateR]?.cells.length ?? 0)
        ) {
          return;
        }
        r = candidateR;
        c = candidateC;
        steps += 1;
      }
      if (!isCellNavigable(rows[r]?.cells[c])) return;
    }

    maxC = Math.max(0, (rows[r]?.cells.length ?? 1) - 1);
    c = Math.max(0, Math.min(maxC, c));
    setFocusCoord({ r, c });
    const targetCell = rows[r]?.cells[c];
    if (targetCell) {
      cellRefs.current.get(targetCell.id)?.focus();
    }
  };

  const handleCellKeyDown = (r: number, c: number, cell: HeatGridCell, e: KeyboardEvent) => {
    const isRtl =
      !forceLtr &&
      gridRef.current !== null &&
      typeof window !== 'undefined' &&
      window.getComputedStyle(gridRef.current).direction === 'rtl';

    switch (e.key) {
      case 'ArrowRight': {
        e.preventDefault();
        const dc = isRtl ? -1 : 1;
        moveFocus(r, c + dc, 0, dc);
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        const dc = isRtl ? 1 : -1;
        moveFocus(r, c + dc, 0, dc);
        break;
      }
      case 'ArrowDown': {
        e.preventDefault();
        moveFocus(r + 1, c, 1, 0);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        moveFocus(r - 1, c, -1, 0);
        break;
      }
      case 'Home': {
        e.preventDefault();
        moveFocus(r, 0, 0, 1);
        break;
      }
      case 'End': {
        e.preventDefault();
        moveFocus(r, Math.max(0, (rows[r]?.cells.length ?? 1) - 1), 0, -1);
        break;
      }
      case 'Escape': {
        e.preventDefault();
        if (controlledActiveId === undefined) {
          setUncontrolledActiveId(null);
        }
        onClearActive?.();
        break;
      }
      case 'Enter':
      case ' ': {
        e.preventDefault();
        activateCell(r, c, cell);
        break;
      }
      default:
        break;
    }
  };

  const activateCell = (r: number, c: number, cell: HeatGridCell) => {
    setFocusCoord({ r, c });
    if (cell.disabled || cell.struck) {
      return;
    }
    if (controlledActiveId === undefined) {
      setUncontrolledActiveId((prev) => (prev === cell.id ? null : cell.id));
    }
    onActivateCell?.(cell);
  };

  const variantGridClass =
    variant === 'runout'
      ? styles.runoutGrid
      : variant === 'matrix13'
        ? styles.matrixGrid
        : compact
          ? styles.leakGridCompact
          : styles.leakGrid;

  const variantCellClass =
    variant === 'runout'
      ? styles.runoutCell
      : variant === 'matrix13'
        ? styles.matrixCell
        : compact
          ? styles.leakCellCompact
          : styles.leakCell;

  return (
    <div className={cx(styles.wrapper, className)}>
      <div className={styles.scrollFrame}>
        <div
          ref={gridRef}
          role="grid"
          aria-label={ariaLabel}
          dir={forceLtr ? 'ltr' : undefined}
          className={cx(styles.grid, variantGridClass)}
          style={
            variant === 'leakMap'
              ? ({ '--leak-cols': colCount } as Record<string, string | number>)
              : ({ '--grid-cols': Math.max(1, colCount) } as Record<string, string | number>)
          }
        >
          {columnHeaders && columnHeaders.length > 0 && (
            <div role="row" className={styles.colHeaders}>
              {variant === 'leakMap' && <div className={styles.cornerCell} aria-hidden="true" />}
              {columnHeaders.map((header) => (
                <div
                  key={header}
                  role="columnheader"
                  className={cx(styles.colHeader, compact && styles.colHeaderCompact)}
                >
                  {header}
                </div>
              ))}
            </div>
          )}

          {rows.map((row, r) => (
            <div key={row.id} role="row" className={styles.rowGroup}>
              {variant === 'leakMap' && row.label !== undefined && (
                <div
                  role="rowheader"
                  className={cx(styles.rowHeader, compact && styles.rowHeaderCompact)}
                >
                  {row.label}
                </div>
              )}

              {row.cells.map((cell, c) => {
                const isFocusable = focusCoord.r === r && focusCoord.c === c;
                const isActive = activeId === cell.id;
                const isStruck = Boolean(cell.struck || cell.disabled);
                const stateClass =
                  cell.matrixState !== undefined
                    ? MATRIX_CLASS[cell.matrixState]
                    : isStruck
                      ? styles.toneStruck
                      : TONE_CLASS[cell.tone ?? 'neutral'];

                const staggerStep = Math.min(r + c, 24);

                return (
                  <button
                    key={cell.id}
                    ref={(el) => {
                      if (el) {
                        cellRefs.current.set(cell.id, el);
                      } else {
                        cellRefs.current.delete(cell.id);
                      }
                    }}
                    type="button"
                    role="gridcell"
                    aria-label={cell.ariaLabel}
                    aria-selected={isActive}
                    aria-disabled={isStruck || undefined}
                    data-force-state={cell.forceState}
                    tabIndex={isFocusable ? 0 : -1}
                    className={cx(
                      styles.cell,
                      variantCellClass,
                      stateClass,
                      variant === 'runout' && (row.id === 'h' || row.id === 'd') && !isStruck && styles.runoutRedSuit,
                      animateEntrance && styles.cellAnimated,
                      isActive && styles.cellActive,
                    )}
                    style={
                      animateEntrance
                        ? ({ '--stagger-step': staggerStep } as Record<string, string | number>)
                        : undefined
                    }
                    onClick={() => activateCell(r, c, cell)}
                    onFocus={() => setFocusCoord({ r, c })}
                    onKeyDown={(e) => handleCellKeyDown(r, c, cell, e)}
                  >
                    <span className={styles.mainLabel} dir={forceLtr ? 'ltr' : undefined}>
                      {cell.label}
                    </span>
                    {cell.subLabel && <span className={styles.subLabel}>{cell.subLabel}</span>}
                    {cell.hasBaselineTick && (
                      <span className={styles.baselineTickBar} aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {variant === 'leakMap' && columnFooters && columnFooters.length > 0 && (
            <div role="row" className={styles.rowGroup}>
              <div role="rowheader" className={styles.rowHeader}>
                {footerRowLabel ?? ''}
              </div>
              {columnFooters.map((foot) => (
                <div key={foot.id} role="gridcell" className={styles.footerCell}>
                  <span className={styles.footerValue}>{foot.valueLabel}</span>
                  <div className={styles.footerTrack} aria-hidden="true">
                    <span
                      className={styles.footerFill}
                      style={{ width: `${Math.max(0, Math.min(100, foot.fillPercent))}%` }}
                    />
                    {foot.baselinePercent !== undefined && (
                      <span
                        className={styles.footerTick}
                        style={{
                          insetInlineStart: `${Math.max(0, Math.min(100, foot.baselinePercent))}%`,
                        }}
                      />
                    )}
                  </div>
                  {foot.sampleLabel && <span className={styles.footerMeta}>{foot.sampleLabel}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {legend && legend.length > 0 && (
        <div className={styles.legend}>
          {legend.map((entry) => (
            <span key={entry.key} className={styles.legendItem}>
              {entry.isTick ? (
                <span className={styles.legendSwatchTick} aria-hidden="true" />
              ) : (
                <span
                  className={cx(
                    styles.legendSwatch,
                    entry.matrixState ? MATRIX_CLASS[entry.matrixState] : TONE_CLASS[entry.tone ?? 'neutral'],
                  )}
                  aria-hidden="true"
                />
              )}
              <span>{entry.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function HeatGridStateTile({
  label,
  children,
}: {
  label: string;
  children: ComponentChildren;
}) {
  return (
    <div className={styles.statusBar}>
      <span>{label}</span>
      {children}
    </div>
  );
}
