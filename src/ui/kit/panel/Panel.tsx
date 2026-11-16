import { createContext, type ComponentChildren } from 'preact';
import { useContext } from 'preact/hooks';
import { cx } from '../state';
import { TierBadge, type TierBadgeProps } from '../chip/Chip';
import shimmer from '../shimmer/shimmer.module.css';
import styles from './Panel.module.css';

const InsidePanel = createContext(false);

export interface PanelProps {
  /** Micro label above the title (uppercase, --fs-micro). */
  label?: ComponentChildren;
  title?: ComponentChildren;
  titleId?: string;
  headingLevel?: 'h1' | 'h2';
  /** The panel's single tier badge, always at the inline-end of the header. */
  tier?: TierBadgeProps;
  /** Content shape shimmers while the answer is computed. */
  loading?: boolean;
  /** One honest line when there is nothing to show yet. */
  empty?: ComponentChildren;
  as?: 'section' | 'div' | 'aside';
  ariaLabel?: string;
  /** Stretch to fill the grid/flex track height and center body content vertically. */
  fullHeight?: boolean;
  children?: ComponentChildren;
}

/**
 * The one surface above the page. Never nested: group inside with PanelSection.
 */
export function Panel({
  label,
  title,
  titleId,
  headingLevel: HeadingTag = 'h2',
  tier,
  loading = false,
  empty,
  as: Tag = 'section',
  ariaLabel,
  fullHeight = false,
  children,
}: PanelProps) {
  const nested = useContext(InsidePanel);
  if (nested && import.meta.env.DEV) {
    console.error('Riverline kit: a Panel must never be nested inside another Panel. Use PanelSection.');
  }
  const hasHeader = label !== undefined || title !== undefined || tier !== undefined;

  let body: ComponentChildren = children;
  if (loading) {
    body = (
      <div className={styles.skeleton} aria-hidden="true">
        <span className={cx(shimmer.shimmer, styles.bar, styles.barLong)} />
        <span className={cx(shimmer.shimmer, styles.bar, styles.barMid)} />
        <span className={cx(shimmer.shimmer, styles.bar, styles.barShort)} />
      </div>
    );
  } else if (empty !== undefined) {
    body = <p className={styles.empty}>{empty}</p>;
  }

  return (
    <InsidePanel.Provider value={true}>
      <Tag
        className={cx(styles.panel, fullHeight && styles.panelFullHeight)}
        aria-labelledby={title !== undefined && titleId ? titleId : undefined}
        aria-label={ariaLabel}
        aria-busy={loading ? 'true' : undefined}
      >
        {hasHeader && (
          <header className={styles.header}>
            <div className={styles.heading}>
              {label !== undefined && <div className={styles.label}>{label}</div>}
              {title !== undefined && (
                <HeadingTag id={titleId} className={styles.title}>
                  {title}
                </HeadingTag>
              )}
            </div>
            {tier && (
              <div className={styles.tier}>
                <TierBadge {...tier} />
              </div>
            )}
          </header>
        )}
        {body !== undefined && body !== null && (
          <div className={cx(styles.content, fullHeight && styles.contentFullHeight)}>{body}</div>
        )}
      </Tag>
    </InsidePanel.Provider>
  );
}

/** A group inside a panel: space and a hairline, never a box. */
export function PanelSection({
  label,
  children,
}: {
  label?: ComponentChildren;
  children: ComponentChildren;
}) {
  return (
    <div className={styles.section}>
      {label !== undefined && <div className={styles.label}>{label}</div>}
      {children}
    </div>
  );
}
