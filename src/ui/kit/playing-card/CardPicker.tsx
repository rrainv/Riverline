import type { ComponentChildren } from 'preact';
import { t } from '../../../i18n';
import { HeatGrid, type HeatGridRow } from '../heat-grid/HeatGrid';
import { Dialog } from '../overlay/Overlay';

const SUITS = [
  { code: 's', glyph: '\u2660\uFE0E', key: 'spades' },
  { code: 'h', glyph: '\u2665\uFE0E', key: 'hearts' },
  { code: 'd', glyph: '\u2666\uFE0E', key: 'diamonds' },
  { code: 'c', glyph: '\u2663\uFE0E', key: 'clubs' },
] as const;

const RANKS_HIGH_TO_LOW = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;

export interface CardPickerProps {
  open: boolean;
  onClose: () => void;
  title: ComponentChildren;
  deadCards: ReadonlySet<string>;
  selectedCard?: string | null;
  onSelectCard: (card: string | null) => void;
  closeOnSelect?: boolean;
  clearLabel?: ComponentChildren;
  closeLabel?: ComponentChildren;
  returnFocusTo?: HTMLElement | null;
}

/**
 * Reuses kit Dialog + HeatGrid (runout 4x13 keyboard layout) to pick a single board/hand card.
 */
export function CardPicker({
  open,
  onClose,
  title,
  deadCards,
  selectedCard = null,
  onSelectCard,
  closeOnSelect = true,
  clearLabel,
  closeLabel,
  returnFocusTo,
}: CardPickerProps) {
  const rows: HeatGridRow[] = SUITS.map((suit) => ({
    id: suit.code,
    cells: RANKS_HIGH_TO_LOW.map((rank) => {
      const code = `${rank}${suit.code}`;
      const isSelected = selectedCard === code;
      const inPlay = deadCards.has(code) && !isSelected;
      return {
        id: code,
        label: `${rank}${suit.glyph}`,
        ariaLabel: inPlay
          ? t('kit.heat.cardInPlay', { card: `${rank}${suit.glyph}` })
          : `${rank} ${t(`kit.card.suit.${suit.key}`)}`,
        tone: inPlay ? 'struck' : isSelected ? 'okHigh' : 'neutral',
        struck: inPlay,
        disabled: inPlay,
      };
    }),
  }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      wide
      returnFocusTo={returnFocusTo}
      cancelLabel={closeLabel}
      confirmLabel={selectedCard && clearLabel ? clearLabel : undefined}
      onConfirm={
        selectedCard && clearLabel
          ? () => {
              onSelectCard(null);
              onClose();
            }
          : undefined
      }
    >
      <HeatGrid
        variant="runout"
        ariaLabel={typeof title === 'string' ? title : 'Card picker'}
        rows={rows}
        activeId={selectedCard}
        animateEntrance={false}
        onActivateCell={(cell) => {
          onSelectCard(cell.id);
          if (closeOnSelect) onClose();
        }}
      />
    </Dialog>
  );
}
