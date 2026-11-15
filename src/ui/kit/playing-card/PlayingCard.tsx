import type { JSX } from 'preact';
import { t } from '../../../i18n';
import { cx } from '../state';
import styles from './PlayingCard.module.css';

export type CardSuit = 's' | 'h' | 'd' | 'c';
export type CardSize = 'mini' | 'small' | 'standard' | 'large' | 'table';
export type CardState = 'face' | 'back' | 'slot';
export type CardMotion = 'none' | 'deal' | 'flip' | 'fold';

const SUIT_GLYPH: Record<CardSuit, string> = {
  s: '\u2660\uFE0E',
  h: '\u2665\uFE0E',
  d: '\u2666\uFE0E',
  c: '\u2663\uFE0E',
};

const SUIT_NAMES: Record<CardSuit, 'spades' | 'hearts' | 'diamonds' | 'clubs'> = {
  s: 'spades',
  h: 'hearts',
  d: 'diamonds',
  c: 'clubs',
};

export interface ParsedCard {
  rank: string;
  suit: CardSuit;
}

/**
 * Parses compact notation such as "As", "Kh", "10d", "Td", "2c".
 */
export function parseCardCode(code: string): ParsedCard | null {
  const trimmed = code.trim();
  const match = /^(10|[akqjtAKQJT2-9])([shdcSHDC])$/.exec(trimmed);
  if (!match) return null;
  const rawRank = match[1]!.toUpperCase();
  const suit = match[2]!.toLowerCase() as CardSuit;
  return {
    rank: rawRank === '10' ? '10' : rawRank,
    suit,
  };
}

export interface PlayingCardProps {
  /** Compact code like "Qh" or "As". Optional when rank + suit are passed directly. */
  card?: string;
  rank?: string;
  suit?: CardSuit;
  size?: CardSize;
  state?: CardState;
  /** True when the card is currently in play / dead / highlighted on board or hand. */
  struck?: boolean;
  /** True for showdown's winning five cards. */
  winning?: boolean;
  /** True for folded/non-winning showdown cards. */
  dimmed?: boolean;
  hoverLift?: boolean;
  motion?: CardMotion;
  /** Stagger position (0, 1, 2...) scaled by --stagger-m * --pace. */
  motionIndex?: number;
  /** Distinct muck trajectory (-1, 0, 1) so folded cards toss on uneven non-overlapping arcs. */
  foldLane?: number;
  ariaLabel?: string;
  className?: string;
}

/**
 * Playing card (#8). Rank over suit, bold 700, crisp card tokens, two-clock motion.
 */
export function PlayingCard({
  card,
  rank: rankProp,
  suit: suitProp,
  size = 'standard',
  state = 'face',
  struck = false,
  winning = false,
  dimmed = false,
  hoverLift = false,
  motion = 'none',
  motionIndex = 0,
  foldLane,
  ariaLabel,
  className,
}: PlayingCardProps) {
  const parsed = card ? parseCardCode(card) : null;
  const rank = rankProp ?? parsed?.rank ?? '';
  const suit = suitProp ?? parsed?.suit;
  const isRed = suit === 'h' || suit === 'd';

  const lane = foldLane ?? (motionIndex % 2 === 0 ? -1 : 1);
  const foldDx = `${lane * 26}px`;
  const foldDy = `${-48 - Math.abs(lane) * 14}px`;
  const foldRot = `${lane * 16}deg`;

  const inlineVars = {
    '--card-idx': motionIndex,
    '--fold-dx': foldDx,
    '--fold-dy': foldDy,
    '--fold-rot': foldRot,
  } as JSX.CSSProperties;

  let resolvedLabel = ariaLabel;
  if (!resolvedLabel) {
    if (state === 'slot') {
      resolvedLabel = t('kit.card.slotLabel');
    } else if (state === 'back') {
      resolvedLabel = t('kit.card.backLabel');
    } else if (rank && suit) {
      resolvedLabel = `${rank} ${t(`kit.card.suit.${SUIT_NAMES[suit]}`)}`;
    }
  }

  const rootClasses = cx(
    styles.card,
    styles[`size_${size}`],
    isRed && styles.red,
    struck && styles.struck,
    winning && styles.winning,
    dimmed && styles.dimmed,
    hoverLift && styles.hoverLift,
    motion !== 'none' && styles[`motion_${motion}`],
    className,
  );

  if (state === 'slot') {
    return (
      <span
        dir="ltr"
        role="img"
        aria-label={resolvedLabel}
        className={rootClasses}
        style={inlineVars}
      >
        <span className={styles.slotBox} aria-hidden="true" />
      </span>
    );
  }

  const showDualLayers = motion === 'deal' || motion === 'flip' || motion === 'fold';
  const renderBack = state === 'back' || showDualLayers;
  const renderFace = (state === 'face' || showDualLayers) && Boolean(rank && suit);

  return (
    <span
      dir="ltr"
      role="img"
      aria-label={resolvedLabel}
      className={rootClasses}
      style={inlineVars}
      data-card-state={state}
    >
      <span className={styles.flipper}>
        {renderBack && <span className={styles.backLayer} data-audit-allow="true" aria-hidden="true" />}
        {renderFace && suit && (
          <span className={styles.faceLayer} aria-hidden="true">
            <b className={styles.rank}>{rank}</b>
            <i className={styles.suit}>{SUIT_GLYPH[suit]}</i>
          </span>
        )}
      </span>
    </span>
  );
}

export interface PlayingCardPairProps {
  /** Face-up front card. */
  card?: string;
  rank?: string;
  suit?: CardSuit;
  size?: CardSize;
  ariaLabel?: string;
  className?: string;
}

/**
 * Two-card illustration variant: one face up in front, one face down behind.
 */
export function PlayingCardPair({
  card,
  rank,
  suit,
  size = 'standard',
  ariaLabel,
  className,
}: PlayingCardPairProps) {
  return (
    <span dir="ltr" className={cx(styles.pair, className)}>
      <PlayingCard state="back" size={size} className={styles.pairBack} ariaLabel={ariaLabel ? undefined : t('kit.card.backLabel')} />
      <PlayingCard
        card={card}
        rank={rank}
        suit={suit}
        size={size}
        state="face"
        className={styles.pairFront}
        ariaLabel={ariaLabel}
      />
    </span>
  );
}
