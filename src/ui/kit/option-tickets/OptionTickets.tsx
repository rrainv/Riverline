import type { JSX } from 'preact';
import { formatNumber, t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../button/Button';
import { Kbd, TierBadge, type TierBadgeProps } from '../chip/Chip';
import { cx, type ForcedState } from '../state';
import styles from './OptionTickets.module.css';

export interface OptionTicketItem {
  id: string;
  shortcut: string;
  label: string;
  /** Optional static amount string, e.g. "2.5 bb" or "8.0 bb". */
  amount?: string;
  disabled?: boolean;
  forceState?: ForcedState;
}

export interface LadderSizeOption {
  id: string;
  value: number;
  unit?: string;
  /** Labelled cost readout for this specific size (shown on hover/focus and when chosen). */
  costDetail: string;
  costTier?: TierBadgeProps;
  min?: number;
  max?: number;
  step?: number;
}

export interface OptionTicketsProps {
  tickets: OptionTicketItem[];
  selectedTicketId?: string;
  onSelectTicket: (id: string) => void;

  /** Customisable size ladder shown under the tickets, never inside a ticket. */
  ladderLabel?: string;
  sizes?: LadderSizeOption[];
  selectedSizeId?: string;
  onSelectSize?: (id: string) => void;
  onAdjustSize?: (id: string, nextValue: number) => void;
  onResetSizes?: () => void;

  /** Confirm primary button (disabled until a ticket is picked). */
  confirmLabel?: string;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
  confirmed?: boolean;
  hint?: string;
  /** Render the primary confirm action button row (can be hidden in isolated tests). */
  showConfirm?: boolean;
  ariaLabel?: string;
}

function roundToStep(value: number, step: number): number {
  const factor = Math.round(1 / step) || 100;
  return Math.round(value * factor) / factor;
}

/**
 * Option tickets and customisable size ladder (#7).
 * Select a ticket, adjust or pick a size underneath, then confirm with the primary button.
 */
export function OptionTickets({
  tickets,
  selectedTicketId,
  onSelectTicket,
  ladderLabel,
  sizes,
  selectedSizeId,
  onSelectSize,
  onAdjustSize,
  onResetSizes,
  confirmLabel,
  onConfirm,
  confirmDisabled,
  confirmLoading = false,
  confirmed = false,
  hint,
  showConfirm = true,
  ariaLabel,
}: OptionTicketsProps) {
  const hasChosenTicket = Boolean(selectedTicketId);
  const activeSize = sizes?.find((s) => s.id === selectedSizeId) ?? sizes?.[0];

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    const keyUpper = event.key.toUpperCase();
    const matched = tickets.find(
      (tk) => !tk.disabled && tk.shortcut.toUpperCase() === keyUpper,
    );
    if (matched) {
      event.preventDefault();
      onSelectTicket(matched.id);
    }
  };

  return (
    <div
      className={styles.root}
      role="group"
      aria-label={ariaLabel ?? t('kit.tickets.ariaLabel')}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.ticketGrid}>
        {tickets.map((ticket, idx) => {
          const isChosen = ticket.id === selectedTicketId;
          const isOtherDimmed = hasChosenTicket && !isChosen && !ticket.disabled;

          return (
            <button
              key={ticket.id}
              type="button"
              disabled={ticket.disabled}
              aria-pressed={isChosen ? 'true' : 'false'}
              data-state={ticket.forceState}
              data-ticket-id={ticket.id}
              className={cx(
                styles.ticket,
                isChosen && styles.ticketChosen,
                isOtherDimmed && styles.ticketDimmed,
              )}
              style={{ '--ticket-idx': idx } as JSX.CSSProperties}
              onClick={() => onSelectTicket(ticket.id)}
            >
              {isChosen && (
                <svg className={styles.borderDrawSvg} aria-hidden="true">
                  <rect
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    rx="12"
                    pathLength="100"
                    className={styles.borderDrawRect}
                  />
                </svg>
              )}
              <span className={styles.ticketTop}>
                <b className={styles.ticketLabel}>{ticket.label}</b>
                <Kbd>{ticket.shortcut}</Kbd>
              </span>
              {ticket.amount !== undefined && (
                <span className={styles.ticketAmount}>
                  <PokerNotation>{ticket.amount}</PokerNotation>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {sizes && sizes.length > 0 && (
        <div className={styles.ladderBox} role="group" aria-label={ladderLabel ?? t('kit.tickets.ladderLabel')}>
          <div className={styles.ladderHeader}>
            <span className={styles.ladderTitle}>{ladderLabel ?? t('kit.tickets.ladderLabel')}</span>
            {onResetSizes && (
              <button type="button" className={styles.resetBtn} onClick={onResetSizes}>
                {t('kit.tickets.resetSizes')}
              </button>
            )}
          </div>

          <div className={styles.ladderRow}>
            {sizes.map((item) => {
              const isSelectedSize = item.id === activeSize?.id;
              const unit = item.unit ?? 'bb';
              const step = item.step ?? 0.5;
              const min = item.min ?? 1;
              const max = item.max ?? 100;
              const formatted = `${formatNumber(item.value, { maximumFractionDigits: 1 })} ${unit}`;

              return (
                <div key={item.id} className={styles.ladderCell}>
                  {onAdjustSize && (
                    <button
                      type="button"
                      className={styles.stepBtn}
                      disabled={item.value - step < min - 1e-9}
                      aria-label={t('kit.tickets.decreasePreset', { size: formatted })}
                      onClick={() => onAdjustSize(item.id, Math.max(min, roundToStep(item.value - step, step)))}
                    >
                      <span aria-hidden="true">−</span>
                    </button>
                  )}

                  <button
                    type="button"
                    aria-pressed={isSelectedSize ? 'true' : 'false'}
                    className={cx(styles.sizeBtn, isSelectedSize && styles.sizeBtnActive)}
                    onClick={() => onSelectSize?.(item.id)}
                  >
                    <PokerNotation>{formatted}</PokerNotation>
                  </button>

                  {onAdjustSize && (
                    <button
                      type="button"
                      className={styles.stepBtn}
                      disabled={item.value + step > max + 1e-9}
                      aria-label={t('kit.tickets.increasePreset', { size: formatted })}
                      onClick={() => onAdjustSize(item.id, Math.min(max, roundToStep(item.value + step, step)))}
                    >
                      <span aria-hidden="true">+</span>
                    </button>
                  )}

                  <span className={styles.costHoverTip} role="tooltip">
                    {tNodes('kit.tickets.costLine', {
                      size: <PokerNotation>{formatted}</PokerNotation>,
                      detail: item.costDetail,
                    })}
                  </span>
                </div>
              );
            })}
          </div>

          {activeSize && (
            <div className={styles.costSummary}>
              <span>
                {tNodes('kit.tickets.costLine', {
                  size: (
                    <PokerNotation>
                      {`${formatNumber(activeSize.value, { maximumFractionDigits: 1 })} ${activeSize.unit ?? 'bb'}`}
                    </PokerNotation>
                  ),
                  detail: activeSize.costDetail,
                })}
              </span>
              {activeSize.costTier && <TierBadge {...activeSize.costTier} />}
            </div>
          )}
        </div>
      )}

      {showConfirm && (
        <div className={styles.confirmFooter}>
          <span className={styles.footerHint}>
            {hint ?? (hasChosenTicket ? t('kit.tickets.readyHint') : t('kit.tickets.chooseHint'))}
          </span>
          <Button
            variant="primary"
            disabled={confirmDisabled ?? !hasChosenTicket}
            loading={confirmLoading}
            confirmed={confirmed}
            onClick={onConfirm}
          >
            {confirmLabel ?? t('kit.tickets.confirmAction')}
          </Button>
        </div>
      )}
    </div>
  );
}
