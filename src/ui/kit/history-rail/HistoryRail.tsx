import type { ComponentChildren } from 'preact';
import { t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Chip } from '../chip/Chip';
import { PlayingCard } from '../playing-card/PlayingCard';
import { cx, type ForcedState } from '../state';
import styles from './HistoryRail.module.css';

export interface HistoryRowItem {
  id: string;
  actor: string;
  isHero?: boolean;
  action: ComponentChildren;
  tag?: string;
}

export interface HistoryStreetGroup {
  id: string;
  streetLabel: string;
  potLabel?: string;
  rows: HistoryRowItem[];
}

export interface HistoryRailProps {
  groups: HistoryStreetGroup[];
  currentRowId?: string;
  onSelectRow?: (rowId: string) => void;
  forceRowState?: { rowId: string; state: ForcedState };
  ariaLabel?: string;
}

/**
 * History rail (#12, vertical): grouped by street, current row highlighted, new rows slide in.
 */
export function HistoryRail({
  groups,
  currentRowId,
  onSelectRow,
  forceRowState,
  ariaLabel,
}: HistoryRailProps) {
  return (
    <div
      role="region"
      aria-label={ariaLabel ?? t('kit.history.railAria')}
      className={styles.rail}
    >
      {groups.map((group) => (
        <section key={group.id} className={styles.streetGroup} aria-label={group.streetLabel}>
          <header className={styles.streetHeader}>
            <span className={styles.streetName}>{group.streetLabel}</span>
            {group.potLabel && (
              <span className={styles.streetPot}>
                <PokerNotation>{group.potLabel}</PokerNotation>
              </span>
            )}
          </header>

          <div className={styles.rowList}>
            {group.rows.map((row) => {
              const isCurrent = row.id === currentRowId;
              const forced = forceRowState?.rowId === row.id ? forceRowState.state : undefined;
              const content = (
                <>
                  <b className={cx(styles.actor, row.isHero && styles.actorHero)}>{row.actor}</b>
                  <span className={styles.actionText}>{row.action}</span>
                  {row.tag ? <Chip>{row.tag}</Chip> : <span />}
                </>
              );

              if (onSelectRow) {
                return (
                  <button
                    key={row.id}
                    type="button"
                    data-history-row={row.id}
                    aria-current={isCurrent ? 'step' : undefined}
                    data-state={forced}
                    className={cx(styles.entryButton, isCurrent && styles.entryCurrent)}
                    onClick={() => onSelectRow(row.id)}
                  >
                    {content}
                  </button>
                );
              }

              return (
                <div
                  key={row.id}
                  data-history-row={row.id}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={cx(styles.entryRow, isCurrent && styles.entryCurrent)}
                >
                  {content}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export interface StreetStripItem {
  id: string;
  streetLabel: string;
  cards?: string[];
  result: ComponentChildren;
  pot: string;
  spr: string;
  disabled?: boolean;
  forceState?: ForcedState;
}

export interface StreetStripProps {
  streets: StreetStripItem[];
  currentStreetId?: string;
  onSelectStreet?: (id: string) => void;
  ariaLabel?: string;
}

/**
 * Horizontal street strip (#12): shows street, board cards, result, pot, and SPR by street.
 */
export function StreetStrip({
  streets,
  currentStreetId,
  onSelectStreet,
  ariaLabel,
}: StreetStripProps) {
  return (
    <div
      role="region"
      aria-label={ariaLabel ?? t('kit.history.stripAria')}
      className={styles.strip}
    >
      {streets.map((item) => {
        const isCurrent = item.id === currentStreetId;
        const inner = (
          <>
            <div className={styles.stripTop}>
              <span className={styles.stripStreet}>{item.streetLabel}</span>
              {item.cards && item.cards.length > 0 && (
                <span className={styles.stripCards}>
                  {item.cards.map((c, idx) => (
                    <PlayingCard key={`${c}-${idx}`} card={c} size="mini" />
                  ))}
                </span>
              )}
            </div>
            <div className={styles.stripResult}>{item.result}</div>
            <div className={styles.stripMetrics}>
              <span className={styles.stripMetric}>
                {tNodes('kit.history.potMetric', {
                  amount: <PokerNotation>{item.pot}</PokerNotation>,
                })}
              </span>
              <span className={styles.stripMetric}>
                {tNodes('kit.history.sprMetric', {
                  ratio: <PokerNotation>{item.spr}</PokerNotation>,
                })}
              </span>
            </div>
          </>
        );

        if (onSelectStreet) {
          return (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              aria-current={isCurrent ? 'step' : undefined}
              data-state={item.forceState}
              data-street-id={item.id}
              className={cx(styles.stripButton, isCurrent && styles.stripCurrent)}
              onClick={() => onSelectStreet(item.id)}
            >
              {inner}
            </button>
          );
        }

        return (
          <div
            key={item.id}
            data-street-id={item.id}
            aria-current={isCurrent ? 'step' : undefined}
            className={cx(styles.stripCard, isCurrent && styles.stripCurrent)}
          >
            {inner}
          </div>
        );
      })}
    </div>
  );
}
