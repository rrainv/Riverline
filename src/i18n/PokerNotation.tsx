import type { ComponentChildren } from 'preact';
import styles from './PokerNotation.module.css';

export interface PokerNotationProps {
  children: ComponentChildren;
  className?: string;
}

/**
 * Isolates poker cards, ranges, amounts, and position codes left-to-right
 * inside right-to-left (Hebrew) sentences, with tabular numerals.
 */
export function PokerNotation({ children, className }: PokerNotationProps) {
  const cls = className ? `${styles.notation} ${className}` : styles.notation;
  return (
    <bdi dir="ltr" className={cls}>
      {children}
    </bdi>
  );
}
