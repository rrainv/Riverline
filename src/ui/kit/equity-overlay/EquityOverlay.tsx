import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';
import { t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../button/Button';
import { TierBadge, type TierBadgeProps } from '../chip/Chip';
import { ChipButton } from '../choice/Choice';
import { EquityList, EquityRow, type EquityRowProps } from '../equity-row/EquityRow';
import { HeatGrid, type HeatGridRow } from '../heat-grid/HeatGrid';
import { useEscapeLayer } from '../overlay/Overlay';
import { PlayingCard } from '../playing-card/PlayingCard';
import styles from './EquityOverlay.module.css';

export interface EquityOverlaySourceOption {
  readonly id: string;
  readonly label: string;
}

export interface EquityOverlayPriceFacts {
  readonly neededPct: string;
  readonly callLabel: string;
  readonly potLabel: string;
}

export interface EquityOverlayProps {
  open: boolean;
  onClose: () => void;
  title?: ComponentChildren;
  tier: TierBadgeProps;
  lockedMessage?: string;
  emptyMessage?: string;
  loading?: boolean;
  boardCards?: readonly string[];
  canStepBack?: boolean;
  onStepBack?: () => void;
  heroRow?: EquityRowProps | null;
  villainRow?: EquityRowProps | null;
  sourceOptions?: readonly EquityOverlaySourceOption[];
  activeSourceId?: string;
  onSelectSource?: (id: string) => void;
  customRangeValue?: string;
  customRangeSummary?: string;
  customRangeInvalid?: boolean;
  onChangeCustomRange?: (next: string) => void;
  priceFacts?: EquityOverlayPriceFacts | null;
  honestyNote?: string;
  runoutGridRows?: readonly HeatGridRow[];
  runoutsLoading?: boolean;
  onPickNextCard?: (cardId: string) => void;
  onPinNote?: () => void;
  pinnedNotice?: boolean;
  onOpenInEquity?: () => void;
}

/**
 * Pure display drawer for inline equity (#82): renders at `--z-overlay` without
 * calculating poker maths, keeping Exact price distinct from equity & hindsight notes.
 */
export function EquityOverlay({
  open,
  onClose,
  title,
  tier,
  lockedMessage,
  emptyMessage,
  loading = false,
  boardCards = [],
  canStepBack = false,
  onStepBack,
  heroRow,
  villainRow,
  sourceOptions,
  activeSourceId,
  onSelectSource,
  customRangeValue,
  customRangeSummary,
  customRangeInvalid = false,
  onChangeCustomRange,
  priceFacts,
  honestyNote,
  runoutGridRows,
  runoutsLoading = false,
  onPickNextCard,
  onPinNote,
  pinnedNotice = false,
  onOpenInEquity,
}: EquityOverlayProps) {
  const titleId = useId();
  useEscapeLayer(open, onClose);

  if (!open) return null;

  const isLocked = Boolean(lockedMessage);
  const rowKeys = [heroRow?.id, villainRow?.id].filter((id): id is string => Boolean(id));

  return (
    <aside
      data-equity-overlay="true"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className={styles.drawer}
    >
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <h3 id={titleId} className={styles.title}>
            {title ?? t('equityOverlay.title')}
          </h3>
          <TierBadge {...tier} />
        </div>
        <button
          type="button"
          className={styles.closeBtn}
          aria-label={t('kit.overlay.close')}
          onClick={onClose}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M3 3l8 8M11 3l-8 8"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </header>

      <div className={styles.body}>
        {boardCards.length > 0 && (
          <div className={styles.boardRow}>
            <div className={styles.boardCardsWrap}>
              <span className={styles.microLabel}>{t('equityOverlay.boardLabel')}</span>
              <div className={styles.boardCards} dir="ltr">
                {boardCards.map((cardCode) => (
                  <PlayingCard key={cardCode} card={cardCode} size="mini" />
                ))}
              </div>
            </div>
            {canStepBack && onStepBack && (
              <Button variant="secondary" onClick={onStepBack}>
                {t('equityOverlay.stepBack')}
              </Button>
            )}
          </div>
        )}

        {isLocked ? (
          <>
            <p className={styles.noticeBox}>{lockedMessage}</p>
            {priceFacts && (
              <div className={styles.priceBox}>
                <span className={styles.microLabel}>{t('equityOverlay.priceHeading')}</span>
                <p className={styles.priceMain}>
                  {tNodes('equityOverlay.priceLine', {
                    call: <PokerNotation>{priceFacts.callLabel}</PokerNotation>,
                    pot: <PokerNotation>{priceFacts.potLabel}</PokerNotation>,
                    needed: <PokerNotation>{priceFacts.neededPct}</PokerNotation>,
                  })}
                </p>
                <p className={styles.notEvNote}>{t('equityOverlay.notEvNote')}</p>
              </div>
            )}
          </>
        ) : emptyMessage ? (
          <p className={styles.noticeBox}>{emptyMessage}</p>
        ) : (
          <>
            {sourceOptions && sourceOptions.length > 0 && onSelectSource && (
              <div className={styles.sourceSection}>
                <span className={styles.microLabel}>{t('equityOverlay.villainSourceLabel')}</span>
                <div className={styles.sourceChips}>
                  {sourceOptions.map((opt) => (
                    <ChipButton
                      key={opt.id}
                      selected={opt.id === activeSourceId}
                      onToggle={() => onSelectSource(opt.id)}
                    >
                      {opt.label}
                    </ChipButton>
                  ))}
                </div>
                {activeSourceId === 'custom' && onChangeCustomRange && (
                  <div className={styles.customRangeRow}>
                    <input
                      type="text"
                      className={styles.customRangeInput}
                      value={customRangeValue ?? ''}
                      onInput={(e) => onChangeCustomRange((e.target as HTMLInputElement).value)}
                      aria-label={t('equityOverlay.customRangeAria')}
                      placeholder={t('equityOverlay.customRangePlaceholder')}
                      dir="ltr"
                    />
                    {(customRangeSummary || customRangeInvalid) && (
                      <span
                        className={
                          customRangeInvalid
                            ? `${styles.customRangeStatus} ${styles.customRangeStatusInvalid}`
                            : styles.customRangeStatus
                        }
                      >
                        {customRangeInvalid
                          ? t('equityOverlay.customRangeInvalid')
                          : customRangeSummary}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            <div aria-busy={loading ? 'true' : undefined}>
              {rowKeys.length > 0 && (
                <EquityList rowKeys={rowKeys}>
                  {heroRow && <EquityRow {...heroRow} density="compact" />}
                  {villainRow && <EquityRow {...villainRow} density="compact" />}
                </EquityList>
              )}
            </div>

            {priceFacts && (
              <div className={styles.priceBox}>
                <span className={styles.microLabel}>{t('equityOverlay.priceHeading')}</span>
                <p className={styles.priceMain}>
                  {tNodes('equityOverlay.priceLine', {
                    call: <PokerNotation>{priceFacts.callLabel}</PokerNotation>,
                    pot: <PokerNotation>{priceFacts.potLabel}</PokerNotation>,
                    needed: <PokerNotation>{priceFacts.neededPct}</PokerNotation>,
                  })}
                </p>
                <p className={styles.notEvNote}>{t('equityOverlay.notEvNote')}</p>
              </div>
            )}

            {honestyNote && <p className={styles.honestyNote}>{honestyNote}</p>}

            {runoutGridRows && runoutGridRows.length > 0 && (
              <div className={styles.nextCardSection} aria-busy={runoutsLoading ? 'true' : undefined}>
                <div className={styles.nextCardHeader}>
                  <span className={styles.microLabel}>{t('equityOverlay.nextCardHeading')}</span>
                  <span className={styles.honestyNote}>{t('equityOverlay.nextCardHint')}</span>
                </div>
                <HeatGrid
                  variant="runout"
                  compact
                  ariaLabel={t('equityOverlay.nextCardHeading')}
                  rows={runoutGridRows}
                  animateEntrance={false}
                  onActivateCell={(cell) => onPickNextCard?.(cell.id)}
                />
              </div>
            )}

            {(onPinNote || onOpenInEquity) && (
              <div className={styles.footer}>
                {onOpenInEquity && (
                  <Button variant="secondary" onClick={onOpenInEquity}>
                    {t('equityOverlay.openInEquity')}
                  </Button>
                )}
                {onPinNote && (
                  <Button variant="secondary" confirmed={pinnedNotice} onClick={onPinNote}>
                    {pinnedNotice ? t('equityOverlay.pinned') : t('equityOverlay.pinNote')}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
