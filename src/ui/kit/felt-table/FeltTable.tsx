import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatNumber, t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import {
  PlayingCard,
  type CardMotion,
  type CardSize,
  type CardState,
} from '../playing-card/PlayingCard';
import { cx, motionIsInstant, readDurationMs, type ForcedState } from '../state';
import styles from './FeltTable.module.css';

export type SeatEmblem =
  | 'hero'
  | 'wave'
  | 'bars'
  | 'prism'
  | 'orbits'
  | 'arc'
  | 'grid'
  | 'pie'
  | 'eye'
  | 'chart';

export interface TableCardSpec {
  card?: string;
  state?: CardState;
  struck?: boolean;
  winning?: boolean;
  dimmed?: boolean;
  motion?: CardMotion;
}

export interface TableSeat {
  id: string;
  name: string;
  stack: string;
  styleLine?: string;
  emblem?: SeatEmblem;
  isHero?: boolean;
  isDealer?: boolean;
  folded?: boolean;
  thinking?: boolean;
  actionBubble?: ComponentChildren;
  bet?: string;
  cards?: TableCardSpec[];
}

export interface TableMenuSeat {
  id: string;
  title: string;
  subtitle?: ComponentChildren;
  emblem: SeatEmblem;
  selected?: boolean;
  disabled?: boolean;
  forceState?: ForcedState;
  onClick?: () => void;
}

export interface ChipFlightEntry {
  seatId: string;
}

interface SeatSlot {
  x: number;
  y: number;
  betX: number;
  betY: number;
  tagAbove: boolean;
  cardsSide: 'left' | 'right';
}

const SLOTS_HEADSUP: SeatSlot[] = [
  { x: 50, y: 81, betX: 35, betY: 67, tagAbove: false, cardsSide: 'right' },
  { x: 50, y: 22, betX: 38, betY: 35, tagAbove: true, cardsSide: 'right' },
];

const SLOTS_SIX: SeatSlot[] = [
  { x: 50, y: 80, betX: 32, betY: 67, tagAbove: false, cardsSide: 'right' },
  { x: 14, y: 64, betX: 26, betY: 53, tagAbove: false, cardsSide: 'right' },
  { x: 16, y: 28, betX: 30, betY: 42, tagAbove: true, cardsSide: 'right' },
  { x: 50, y: 21, betX: 41, betY: 34, tagAbove: true, cardsSide: 'right' },
  { x: 84, y: 28, betX: 70, betY: 42, tagAbove: true, cardsSide: 'left' },
  { x: 86, y: 64, betX: 74, betY: 53, tagAbove: false, cardsSide: 'left' },
];

const SLOTS_EIGHT: SeatSlot[] = [
  { x: 50, y: 82, betX: 44, betY: 66, tagAbove: false, cardsSide: 'right' },
  { x: 24, y: 76, betX: 31, betY: 61, tagAbove: false, cardsSide: 'right' },
  { x: 14, y: 50, betX: 28, betY: 38, tagAbove: false, cardsSide: 'right' },
  { x: 24, y: 22, betX: 34, betY: 35, tagAbove: true, cardsSide: 'right' },
  { x: 50, y: 17, betX: 42, betY: 31, tagAbove: true, cardsSide: 'right' },
  { x: 76, y: 22, betX: 66, betY: 35, tagAbove: true, cardsSide: 'left' },
  { x: 86, y: 50, betX: 72, betY: 38, tagAbove: false, cardsSide: 'left' },
  { x: 76, y: 76, betX: 69, betY: 61, tagAbove: false, cardsSide: 'left' },
];

const SLOTS_MENU_THREE: Array<{ x: number; y: number; tagAbove: boolean }> = [
  { x: 50, y: 22, tagAbove: true },
  { x: 85, y: 58, tagAbove: false },
  { x: 15, y: 58, tagAbove: false },
];

const SLOTS_MENU_FOUR: Array<{ x: number; y: number; tagAbove: boolean }> = [
  { x: 50, y: 24, tagAbove: true },
  { x: 86, y: 50, tagAbove: false },
  { x: 50, y: 79, tagAbove: false },
  { x: 14, y: 50, tagAbove: false },
];

function SeatIcon({ emblem }: { emblem: SeatEmblem }) {
  switch (emblem) {
    case 'hero':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="8" r="3.6" />
          <path d="M5 20c1-4 4-6 7-6s6 2 7 6" />
        </svg>
      );
    case 'wave':
      return (
        <svg viewBox="0 0 40 40" width="24" height="24" aria-hidden="true">
          <path d="M6 22q7-13 14 0t14 0" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="20" cy="11" r="2.6" fill="currentColor" />
        </svg>
      );
    case 'bars':
      return (
        <svg viewBox="0 0 40 40" width="24" height="24" aria-hidden="true">
          <path d="M9 14h22M9 26h22" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="20" cy="20" r="3.4" fill="currentColor" />
        </svg>
      );
    case 'prism':
      return (
        <svg viewBox="0 0 40 40" width="24" height="24" aria-hidden="true">
          <path d="M20 8L33 31H7Z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
          <circle cx="20" cy="24" r="3" fill="currentColor" />
        </svg>
      );
    case 'orbits':
      return (
        <svg viewBox="0 0 40 40" width="24" height="24" aria-hidden="true">
          <circle cx="16" cy="20" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <circle cx="25" cy="20" r="9" fill="none" stroke="currentColor" strokeWidth="2.4" opacity="0.65" />
        </svg>
      );
    case 'arc':
      return (
        <svg viewBox="0 0 40 40" width="24" height="24" aria-hidden="true">
          <circle cx="20" cy="20" r="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeDasharray="62 20" strokeLinecap="round" />
          <circle cx="20" cy="20" r="5" fill="currentColor" />
          <circle cx="32" cy="10" r="2.3" fill="currentColor" />
        </svg>
      );
    case 'grid':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
        </svg>
      );
    case 'pie':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3a9 9 0 100 18 9 9 0 000-18zM12 3v9h9" />
        </svg>
      );
    case 'eye':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 12c0-3 4-5 9-5s9 2 9 5-4 5-9 5-9-2-9-5z" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    case 'chart':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        </svg>
      );
  }
}

export interface FeltTableHandProps {
  mode?: 'hand';
  seats: TableSeat[];
  activeSeatId?: string;
  pot?: number;
  potUnit?: string;
  board?: TableCardSpec[];
  boardCardSize?: CardSize;
  seatCardSize?: CardSize;
  showdownResult?: string;
  /** Increment to animate light chips arcing from betting seats to the pot + bump pot. */
  chipsToPotTrigger?: number;
  chipsToPotSeats?: string[];
  compact?: boolean;
  ariaLabel?: string;
}

export interface FeltTableMenuProps {
  mode: 'menu';
  menuSeats: TableMenuSeat[];
  eyebrow?: string;
  heading?: string;
  body?: string;
  centerAction?: ComponentChildren;
  compact?: boolean;
  ariaLabel?: string;
}

export type FeltTableProps = FeltTableHandProps | FeltTableMenuProps;

function getSlotsForSeats(seats: TableSeat[]): SeatSlot[] {
  if (seats.length <= 2) return SLOTS_HEADSUP;
  const baseSlots = seats.length <= 6 ? SLOTS_SIX : SLOTS_EIGHT;
  const heroIdx = seats.findIndex((s) => s.isHero);
  if (heroIdx <= 0) return baseSlots;
  // Rotate so Hero always lands at slot 0 (bottom)
  const out: SeatSlot[] = [];
  for (let i = 0; i < seats.length; i++) {
    const slotIdx = (i - heroIdx + baseSlots.length) % baseSlots.length;
    out.push(baseSlots[slotIdx]!);
  }
  return out;
}

/**
 * Felt table (#9): stadium felt with double brass rim, hero at bottom,
 * seats around, board cards, travelling action ring, thinking dots,
 * action bubbles above seats, chip flights, showdown highlight, and Training menu variant.
 */
export function FeltTable(props: FeltTableProps) {
  if (props.mode === 'menu') {
    return <FeltMenuTable {...props} />;
  }
  return <FeltHandTable {...props} />;
}

/** Isolated pot count-up so animation frames never re-render table seats or cards. */
function AnimatedPotValue({ pot, potUnit }: { pot: number; potUnit: string }) {
  const [displayPot, setDisplayPot] = useState<number>(pot);
  const prevPotRef = useRef<number>(pot);

  // Straight numeric count-up to the engine pot value (no spring easing on numbers)
  useEffect(() => {
    const startVal = prevPotRef.current;
    prevPotRef.current = pot;
    if (startVal === pot || motionIsInstant()) {
      setDisplayPot(pot);
      return;
    }
    const dur = Math.max(120, readDurationMs('--dur-4'));
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      setDisplayPot(startVal + (pot - startVal) * p);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setDisplayPot(pot);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pot]);

  return (
    <b className={styles.potValue}>
      <PokerNotation>
        {`${formatNumber(displayPot, { maximumFractionDigits: 1 })} ${potUnit}`}
      </PokerNotation>
    </b>
  );
}

function FeltHandTable({
  seats,
  activeSeatId,
  pot,
  potUnit = 'bb',
  board = [],
  boardCardSize = 'standard',
  seatCardSize = 'small',
  showdownResult,
  chipsToPotTrigger = 0,
  chipsToPotSeats = [],
  compact = false,
  ariaLabel,
}: FeltTableHandProps) {
  const slots = getSlotsForSeats(seats);

  const activeIndex = activeSeatId ? seats.findIndex((s) => s.id === activeSeatId) : -1;
  const activeSlot = activeIndex >= 0 ? slots[activeIndex] : undefined;

  const chipOrigins = chipsToPotTrigger > 0
    ? (chipsToPotSeats.length > 0
        ? chipsToPotSeats
        : seats.filter((s) => Boolean(s.bet)).map((s) => s.id)
      )
        .map((id) => {
          const idx = seats.findIndex((s) => s.id === id);
          return idx >= 0 ? slots[idx] : undefined;
        })
        .filter((s): s is SeatSlot => Boolean(s))
    : [];

  return (
    <div
      dir="ltr"
      role="region"
      aria-label={ariaLabel ?? t('kit.table.ariaLabel')}
      className={cx(styles.tableStage, compact && styles.compactStage)}
    >
      <div className={styles.feltOval} data-audit-allow="true" />

      {activeSlot && (
        <div className={styles.ringLayer} aria-hidden="true">
          <div
            className={styles.ringMover}
            style={{ '--ring-x': activeSlot.x, '--ring-y': activeSlot.y } as JSX.CSSProperties}
          >
            <div className={styles.ringCircle} />
          </div>
        </div>
      )}

      {chipOrigins.length > 0 && (
        <div key={`chips-${chipsToPotTrigger}`} className={styles.chipFlight} aria-hidden="true">
          {chipOrigins.map((origin, idx) => (
            <div
              key={idx}
              className={styles.chipMover}
              style={
                {
                  '--from-x': origin.betX,
                  '--from-y': origin.betY,
                  '--to-x': 50,
                  '--to-y': 40,
                  '--chip-idx': idx,
                } as JSX.CSSProperties
              }
            >
              <span className={styles.flyingChip} />
            </div>
          ))}
        </div>
      )}

      <div className={styles.centerStack}>
        {pot !== undefined && (
          <div key={`pot-${chipsToPotTrigger}`} className={cx(styles.potBox, chipsToPotTrigger > 0 && styles.potBump)}>
            <span className={styles.potLabel}>{t('kit.table.pot')}</span>
            <AnimatedPotValue pot={pot} potUnit={potUnit} />
          </div>
        )}

        {board.length > 0 && (
          <div className={styles.boardRow} aria-label={t('kit.table.boardAria')}>
            {board.map((c, idx) => (
              <span
                key={`${c.card ?? 'slot'}-${idx}`}
                className={idx >= 3 ? styles.boardCardStreetGap : undefined}
              >
                <PlayingCard
                  card={c.card}
                  state={c.state}
                  size={boardCardSize}
                  struck={c.struck}
                  winning={c.winning}
                  dimmed={c.dimmed}
                  motion={c.motion}
                  motionIndex={idx}
                />
              </span>
            ))}
          </div>
        )}

        {showdownResult && <div className={styles.showdownResult}>{showdownResult}</div>}
      </div>

      {seats.map((seat, idx) => {
        const slot = slots[idx % slots.length]!;
        const isActive = seat.id === activeSeatId;
        const emblem: SeatEmblem = seat.emblem ?? (seat.isHero ? 'hero' : 'wave');

        return (
          <div key={seat.id}>
            {seat.bet && (
              <div
                className={styles.betChip}
                style={{ '--bet-x': slot.betX, '--bet-y': slot.betY } as JSX.CSSProperties}
              >
                <span className={styles.chipPip} aria-hidden="true" />
                <PokerNotation>{seat.bet}</PokerNotation>
              </div>
            )}

            <div
              className={cx(
                styles.seat,
                slot.tagAbove && styles.tagAbove,
                slot.x === 50 && !slot.tagAbove && styles.bubbleSideLeft,
                seat.folded && styles.seatFolded,
                isActive && styles.seatActive,
              )}
              style={{ '--seat-x': slot.x, '--seat-y': slot.y } as JSX.CSSProperties}
              data-seat-id={seat.id}
              data-folded={seat.folded ? 'true' : undefined}
            >
              {(seat.thinking || seat.actionBubble) && (
                <div
                  className={cx(styles.bubble, seat.thinking && styles.bubbleThinking)}
                  role={seat.thinking ? 'status' : undefined}
                  aria-label={seat.thinking ? t('kit.table.thinking', { seat: seat.name }) : undefined}
                >
                  {seat.thinking ? (
                    <span className={styles.thinkingDots} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : (
                    seat.actionBubble
                  )}
                </div>
              )}

              <span className={styles.disc} data-audit-allow="true">
                <SeatIcon emblem={emblem} />
                {seat.isDealer && (
                  <span className={styles.dealerMark} title={t('kit.table.dealer')} aria-label={t('kit.table.dealer')}>
                    D
                  </span>
                )}
              </span>

              <span className={styles.tag}>
                <b className={styles.seatName}>{seat.name}</b>
                <span className={styles.seatSub}>
                  <PokerNotation>{seat.stack}</PokerNotation>
                  {seat.styleLine && <span>· {seat.styleLine}</span>}
                </span>
              </span>

              {seat.cards && seat.cards.length > 0 && (
                <div
                  className={cx(
                    styles.seatCards,
                    slot.cardsSide === 'left' ? styles.cardsLeft : styles.cardsRight,
                  )}
                >
                  {seat.cards.map((c, cIdx) => (
                    <PlayingCard
                      key={cIdx}
                      card={c.card}
                      state={c.state}
                      size={seat.isHero ? 'standard' : seatCardSize}
                      winning={c.winning}
                      dimmed={c.dimmed}
                      motion={c.motion}
                      motionIndex={cIdx}
                      foldLane={cIdx === 0 ? -1 : 1}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FeltMenuTable({
  menuSeats,
  eyebrow,
  heading,
  body,
  centerAction,
  compact = false,
  ariaLabel,
}: FeltTableMenuProps) {
  return (
    <div
      dir="ltr"
      role="region"
      aria-label={ariaLabel ?? t('kit.table.menuAriaLabel')}
      className={cx(styles.tableStage, compact && styles.compactStage)}
    >
      <div className={styles.feltOval} data-audit-allow="true" />

      <div className={styles.menuCenter}>
        {eyebrow && <div className={styles.menuEyebrow}>{eyebrow}</div>}
        {heading && <h3 className={styles.menuHeading}>{heading}</h3>}
        {body && <p className={styles.menuBody}>{body}</p>}
        {centerAction}
      </div>

      {menuSeats.map((seat, idx) => {
        const menuSlots = menuSeats.length === 3 ? SLOTS_MENU_THREE : SLOTS_MENU_FOUR;
        const slot = menuSlots[idx % menuSlots.length]!;
        return (
          <button
            key={seat.id}
            type="button"
            disabled={seat.disabled}
            aria-pressed={seat.selected ? 'true' : undefined}
            data-state={seat.forceState}
            onClick={seat.onClick}
            className={cx(
              styles.menuSeatBtn,
              slot.tagAbove && styles.tagAbove,
              seat.selected && styles.menuSeatSelected,
            )}
            style={{ '--seat-x': slot.x, '--seat-y': slot.y } as JSX.CSSProperties}
          >
            <span className={styles.disc} data-audit-allow="true">
              <SeatIcon emblem={seat.emblem} />
            </span>
            <span className={styles.tag}>
              <b className={styles.seatName}>{seat.title}</b>
              {seat.subtitle && <span className={styles.seatSub}>{seat.subtitle}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
