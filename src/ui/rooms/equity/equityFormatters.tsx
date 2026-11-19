import type { ComponentChildren } from 'preact';
import type { EquityComputedPlayer, EquityPlayerEntry } from '../../../domain/equity';
import type { ParsePlayerHandResult, ShorthandErrorCode } from '../../../domain/shorthand';
import {
  CARD_RANKS,
  CARD_SUITS,
  type HandCategory,
  type RunoutEffectGroup,
  type RunoutRow,
} from '../../../engine-api';
import { formatNumber, formatPercent, t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import type { HeatGridRow, HeatTone } from '../../kit/heat-grid/HeatGrid';
import { parseCardCode } from '../../kit/playing-card/PlayingCard';

const RANKS_HIGH_TO_LOW = [...CARD_RANKS].reverse();
const SUITS_LIST = [...CARD_SUITS];

const SUIT_GLYPH: Record<'s' | 'h' | 'd' | 'c', string> = {
  s: '\u2660\uFE0E',
  h: '\u2665\uFE0E',
  d: '\u2666\uFE0E',
  c: '\u2663\uFE0E',
};

export function formatCardGlyph(code: string): string {
  const parsed = parseCardCode(code);
  if (!parsed) return code;
  const rank = parsed.rank === '10' ? 'T' : parsed.rank;
  return `${rank}${SUIT_GLYPH[parsed.suit]}`;
}

export function formatCategoryLabel(category: HandCategory): string {
  switch (category) {
    case 'high_card':
      return t('equity.cat.high_card');
    case 'one_pair':
      return t('equity.cat.one_pair');
    case 'two_pair':
      return t('equity.cat.two_pair');
    case 'three_of_a_kind':
      return t('equity.cat.three_of_a_kind');
    case 'straight':
      return t('equity.cat.straight');
    case 'flush':
      return t('equity.cat.flush');
    case 'full_house':
      return t('equity.cat.full_house');
    case 'four_of_a_kind':
      return t('equity.cat.four_of_a_kind');
    case 'straight_flush':
      return t('equity.cat.straight_flush');
  }
}

export function formatEffectGroupLabel(group: RunoutEffectGroup): string {
  switch (group) {
    case 'pairs_board':
      return t('equity.effects.pairs_board');
    case 'completes_flush':
      return t('equity.effects.completes_flush');
    case 'completes_straight':
      return t('equity.effects.completes_straight');
    case 'pairs_hero':
      return t('equity.effects.pairs_hero');
    case 'adds_draw':
      return t('equity.effects.adds_draw');
    case 'overcard':
      return t('equity.effects.overcard');
    case 'blank':
      return t('equity.effects.blank');
  }
}

export function formatShorthandError(errorCode: ShorthandErrorCode | 'max_players', detail?: string): ComponentChildren {
  const detailNode = detail ? <PokerNotation>{detail}</PokerNotation> : '';
  switch (errorCode) {
    case 'empty':
      return t('equity.err.empty');
    case 'incomplete_hand':
      return tNodes('equity.err.incomplete_hand', { detail: detailNode });
    case 'too_many_cards':
      return t('equity.err.too_many_cards');
    case 'invalid_rank':
      return tNodes('equity.err.invalid_rank', { detail: detailNode });
    case 'invalid_suit':
      return tNodes('equity.err.invalid_suit', { detail: detailNode });
    case 'duplicate_in_hand':
      return tNodes('equity.err.duplicate_in_hand', { detail: detailNode });
    case 'card_in_play':
      return tNodes('equity.err.card_in_play', { detail: detailNode });
    case 'invalid_range':
      return tNodes('equity.err.invalid_range', { detail: detailNode });
    case 'zero_combos':
      return t('equity.err.zero_combos');
    case 'invalid_syntax':
      return t('equity.err.invalid_syntax');
    case 'max_players':
      return t('equity.err.max_players');
  }
}

export function formatDraftPreview(parsed: ParsePlayerHandResult): ComponentChildren | undefined {
  if (!parsed.ok) return undefined;
  if (parsed.kind === 'exact') {
    return tNodes('equity.input.previewExact', {
      hand: <PokerNotation>{parsed.cards.map(formatCardGlyph).join(' ')}</PokerNotation>,
    });
  }
  if (parsed.kind === 'any') {
    return tNodes('equity.input.previewAny', {
      combos: <PokerNotation>{formatNumber(parsed.eligibleCombos)}</PokerNotation>,
    });
  }
  if (parsed.removedCombos > 0) {
    return tNodes('equity.input.previewRangeRemoved', {
      combos: <PokerNotation>{formatNumber(parsed.eligibleCombos)}</PokerNotation>,
      removed: <PokerNotation>{formatNumber(parsed.removedCombos)}</PokerNotation>,
    });
  }
  return tNodes('equity.input.previewRange', {
    combos: <PokerNotation>{formatNumber(parsed.eligibleCombos)}</PokerNotation>,
  });
}

export function formatRightNowFact(
  entry: EquityPlayerEntry,
  computed: EquityComputedPlayer | undefined,
): ComponentChildren {
  if (!computed) return undefined;

  if (computed.wins === 0 && computed.isExactCount) {
    return computed.ties > 0 ? t('equity.row.onlySplits') : t('equity.row.drawingDead');
  }

  if (entry.inputKind === 'exact' && computed.standing && computed.currentCategory) {
    const category = formatCategoryLabel(computed.currentCategory);
    if (computed.standing === 'leading') return t('equity.row.aheadNow', { category });
    if (computed.standing === 'tied') return t('equity.row.tiedNow', { category });
    return t('equity.row.behindNow', { category });
  }

  if (entry.inputKind === 'range') {
    if (computed.wins > 0 && computed.isExactCount) {
      return tNodes('equity.row.winsOfRivers', {
        wins: <PokerNotation>{formatNumber(computed.wins)}</PokerNotation>,
        total: <PokerNotation>{formatNumber(computed.trials)}</PokerNotation>,
      });
    }
    if (entry.removedCombos > 0) {
      return t('equity.row.combosRemoved', { removed: formatNumber(entry.removedCombos) });
    }
    return t('equity.row.combosLabel', { count: entry.eligibleCombos });
  }

  if (computed.isExactCount && computed.trials > 0) {
    return tNodes('equity.row.winsOfRivers', {
      wins: <PokerNotation>{formatNumber(computed.wins)}</PokerNotation>,
      total: <PokerNotation>{formatNumber(computed.trials)}</PokerNotation>,
    });
  }

  return t('equity.row.kindAny');
}

export function formatSignedDelta(deltaPct: number): string {
  const sign = deltaPct > 0.05 ? '+' : '';
  return `${sign}${formatPercent(deltaPct / 100, 1)}`;
}

function toneForRunoutDelta(deltaFraction: number | null, inPlay: boolean): HeatTone {
  if (inPlay) return 'struck';
  if (deltaFraction === null) return 'neutral';
  const pct = deltaFraction * 100;
  if (pct >= 8) return 'okHigh';
  if (pct >= 2) return 'okLow';
  if (pct <= -8) return 'overHigh';
  if (pct <= -2) return 'overLow';
  return 'neutral';
}

export function buildRunoutHeatGridRows(options: {
  rowsByCard: Readonly<Record<string, RunoutRow>>;
  deadSet: ReadonlySet<string>;
  isLoading: boolean;
  selectedCardId?: string | null;
  excludedCardId?: string | null;
}): HeatGridRow[] {
  const { rowsByCard, deadSet, isLoading, selectedCardId = null, excludedCardId = null } = options;
  return SUITS_LIST.map((suit) => ({
    id: suit,
    cells: RANKS_HIGH_TO_LOW.map((rank) => {
      const code = `${rank}${suit}`;
      const row = rowsByCard[code];
      const isSelected = selectedCardId === code;
      const struck =
        (!isLoading && row === undefined) ||
        (deadSet.has(code) && !isSelected) ||
        (excludedCardId !== null && excludedCardId === code);
      const label = formatCardGlyph(code);
      const tone = toneForRunoutDelta(row?.equityDelta ?? null, struck);
      const ariaLabel = struck
        ? t('kit.heat.cardInPlay', { card: label })
        : row && row.equityDelta !== null && row.equityDelta > 0.02
          ? t('kit.heat.cardHelps', { card: label })
          : row && row.equityDelta !== null && row.equityDelta < -0.02
            ? t('kit.heat.cardHurts', { card: label })
            : t('kit.heat.cardNeutral', { card: label });

      return {
        id: code,
        label,
        ariaLabel,
        tone,
        struck,
        disabled: struck,
      };
    }),
  }));
}
