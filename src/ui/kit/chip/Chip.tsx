import type { ComponentChildren } from 'preact';
import { t, tNodes } from '../../../i18n';
import { cx } from '../state';
import styles from './Chip.module.css';

export const TIERS = ['exact', 'verified', 'estimated', 'unavailable'] as const;
export type Tier = (typeof TIERS)[number];

interface ChipProps {
  children: ComponentChildren;
  /** Inline notation (cards, amounts) is passed already wrapped in <PokerNotation>. */
  title?: string;
}

/** A static pill: a label, never a control (controls are ChipButton). */
export function Chip({ children, title }: ChipProps) {
  return (
    <span className={styles.chip} title={title}>
      {children}
    </span>
  );
}

export interface TierBadgeProps {
  tier: Tier;
  /** Qualifier after the tier, for example "all 990 runouts" or "price only". */
  detail?: ComponentChildren;
  /** Source before the tier, for example "Baseline". */
  source?: ComponentChildren;
}

/**
 * The tier badge. Neutral colours only: accent never reads as "correct".
 * Panels place it (once, inline-end of the header); rooms do not place it freely.
 */
export function TierBadge({ tier, detail, source }: TierBadgeProps) {
  const tierWord = t(`tier.${tier}`);
  let content: ComponentChildren = tierWord;
  if (detail !== undefined && source !== undefined) {
    content = tNodes('tier.withSourceAndDetail', { source, tier: tierWord, detail });
  } else if (detail !== undefined) {
    content = tNodes('tier.withDetail', { tier: tierWord, detail });
  } else if (source !== undefined) {
    content = tNodes('tier.withSource', { source, tier: tierWord });
  }
  return (
    <span className={cx(styles.chip, styles.tier, styles[`tier_${tier}`])} data-tier={tier}>
      {content}
    </span>
  );
}

/** A keyboard key, always left-to-right. */
export function Kbd({ children }: { children: ComponentChildren }) {
  return (
    <kbd dir="ltr" className={styles.kbd}>
      {children}
    </kbd>
  );
}
