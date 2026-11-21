import { tokenizeActionShorthandLine } from '../shorthand';

export type ParsedHandHistoryResult =
  | {
      readonly ok: true;
      readonly seatCount?: 6 | 8;
      readonly heroPositionLabel?: string;
      readonly heroCards?: readonly [string, string];
      readonly tokens: readonly string[];
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

function normalizeCard(rank: string, suit: string): string {
  return `${rank.toUpperCase()}${suit.toLowerCase()}`;
}

function positionSequenceForCount(count: number): readonly string[] {
  if (count <= 2) return ['BTN', 'BB'];
  if (count === 3) return ['BTN', 'SB', 'BB'];
  if (count === 4) return ['BTN', 'SB', 'BB', 'CO'];
  if (count === 5) return ['BTN', 'SB', 'BB', 'HJ', 'CO'];
  if (count === 6) return ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'];
  if (count === 7) return ['BTN', 'SB', 'BB', 'UTG', 'MP', 'HJ', 'CO'];
  return ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'HJ', 'CO'];
}

function parseMultiLineHandHistory(rawText: string): ParsedHandHistoryResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Extract big blind size from header: e.g. ($0.50/$1.00 USD) or (1/2)
  let bbUnit = 1;
  const stakesMatch = /(?:\$|€|₪)?(\d+(?:\.\d+)?)\s*\/\s*(?:\$|€|₪)?(\d+(?:\.\d+)?)/.exec(
    lines[0] ?? '',
  );
  if (stakesMatch) {
    const parsedBb = Number(stakesMatch[2]);
    if (Number.isFinite(parsedBb) && parsedBb > 0) bbUnit = parsedBb;
  }

  let buttonSeatNum: number | null = null;
  for (const line of lines) {
    const btnMatch = /Seat\s+#?(\d+)\s+is\s+the\s+button/i.exec(line);
    if (btnMatch) {
      buttonSeatNum = Number(btnMatch[1]);
      break;
    }
  }

  const seats: { seatNum: number; name: string }[] = [];
  for (const line of lines) {
    const seatMatch = /^Seat\s+(\d+):\s*(.+?)\s*\((?:\$|€|₪)?[\d.,]+\s+in\s+chips/i.exec(line);
    if (seatMatch) {
      seats.push({
        seatNum: Number(seatMatch[1]),
        name: seatMatch[2]!.trim(),
      });
    }
  }

  if (seats.length < 2) {
    return { ok: false, message: 'Could not detect seated players in hand history' };
  }

  const seatCount: 6 | 8 = seats.length > 6 ? 8 : 6;
  const btnIdx =
    buttonSeatNum !== null
      ? Math.max(
          0,
          seats.findIndex((s) => s.seatNum === buttonSeatNum),
        )
      : 0;
  const orderedSeats = [...seats.slice(btnIdx), ...seats.slice(0, btnIdx)];
  const posNames = positionSequenceForCount(orderedSeats.length);
  const posByPlayerName = new Map<string, string>();
  orderedSeats.forEach((s, idx) => {
    const pos = posNames[idx] ?? `S${idx + 1}`;
    posByPlayerName.set(s.name.toLowerCase(), pos);
  });

  let heroCards: [string, string] | undefined;
  let heroPositionLabel: string | undefined;
  const tokens: string[] = [];
  let inHoleCards = false;

  for (const line of lines) {
    if (/^\*\*\*\s*HOLE CARDS\s*\*\*\*/i.test(line)) {
      inHoleCards = true;
      continue;
    }
    if (/^\*\*\*\s*(?:SHOW\s*DOWN|SUMMARY)\s*\*\*\*/i.test(line)) {
      break;
    }

    const dealtMatch = /^Dealt\s+to\s+(.+?)\s*\[([2-9TJQKA])([shdc])\s+([2-9TJQKA])([shdc])\]/i.exec(
      line,
    );
    if (dealtMatch) {
      const heroName = dealtMatch[1]!.trim().toLowerCase();
      heroCards = [
        normalizeCard(dealtMatch[2]!, dealtMatch[3]!),
        normalizeCard(dealtMatch[4]!, dealtMatch[5]!),
      ];
      heroPositionLabel = posByPlayerName.get(heroName);
      continue;
    }

    if (!inHoleCards) continue;

    const flopMatch =
      /^\*\*\*\s*FLOP\s*\*\*\*\s*\[([2-9TJQKA])([shdc])\s+([2-9TJQKA])([shdc])\s+([2-9TJQKA])([shdc])\]/i.exec(
        line,
      );
    if (flopMatch) {
      tokens.push(
        '/',
        `${normalizeCard(flopMatch[1]!, flopMatch[2]!)}${normalizeCard(flopMatch[3]!, flopMatch[4]!)}${normalizeCard(flopMatch[5]!, flopMatch[6]!)}`,
      );
      continue;
    }

    const turnOrRiverMatch =
      /^\*\*\*\s*(?:TURN|RIVER)\s*\*\*\*.*\[([2-9TJQKA])([shdc])\]\s*$/i.exec(line);
    if (turnOrRiverMatch) {
      tokens.push('/', normalizeCard(turnOrRiverMatch[1]!, turnOrRiverMatch[2]!));
      continue;
    }

    const actionMatch = /^(.+?):\s*(folds|checks|calls|bets|raises)\b(.*)$/i.exec(line);
    if (!actionMatch) continue;
    const playerPos = posByPlayerName.get(actionMatch[1]!.trim().toLowerCase());
    if (!playerPos) continue;
    const posPrefix = playerPos.toLowerCase();
    const verb = actionMatch[2]!.toLowerCase();
    const rest = actionMatch[3] ?? '';

    if (verb === 'folds') {
      tokens.push(posPrefix, 'f');
    } else if (verb === 'checks') {
      tokens.push(posPrefix, 'x');
    } else if (verb === 'calls') {
      tokens.push(posPrefix, 'c');
    } else if (/all-in/i.test(rest)) {
      tokens.push(posPrefix, 'allin');
    } else if (verb === 'bets') {
      const amtMatch = /(?:\$|€|₪)?(\d+(?:\.\d+)?)/.exec(rest);
      const amt = amtMatch ? Number(amtMatch[1]) : bbUnit;
      const bb = Math.max(0.5, Math.round((amt / bbUnit) * 10) / 10);
      tokens.push(posPrefix, `b${bb}`);
    } else if (verb === 'raises') {
      const toMatch = /\bto\s+(?:\$|€|₪)?(\d+(?:\.\d+)?)/i.exec(rest);
      const fallbackMatch = /(?:\$|€|₪)?(\d+(?:\.\d+)?)/.exec(rest);
      const amt = toMatch ? Number(toMatch[1]) : fallbackMatch ? Number(fallbackMatch[1]) : bbUnit * 2;
      const bb = Math.max(2, Math.round((amt / bbUnit) * 10) / 10);
      tokens.push(posPrefix, `r${bb}`);
    }
  }

  if (tokens.length === 0) {
    return { ok: false, message: 'No valid actions found in hand history' };
  }

  return {
    ok: true,
    seatCount,
    heroPositionLabel,
    heroCards,
    tokens,
  };
}

/**
 * Parses a PokerStars / GGPoker multi-line hand history or a loose shorthand note
 * (e.g. "BTN AhKd | btn:r2.5 sb:f bb:c / Qh7c2h") into Riverline shorthand tokens.
 */
export function parseHandHistoryText(rawText: string): ParsedHandHistoryResult {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { ok: false, message: 'Empty hand history' };
  }

  if (/\*\*\*\s*HOLE CARDS\s*\*\*\*|Seat\s+\d+:/i.test(trimmed)) {
    return parseMultiLineHandHistory(trimmed);
  }

  let heroPositionLabel: string | undefined;
  let heroCards: [string, string] | undefined;
  let actionText = trimmed;

  const pipeIdx = trimmed.indexOf('|');
  if (pipeIdx !== -1) {
    const header = trimmed.slice(0, pipeIdx).trim();
    actionText = trimmed.slice(pipeIdx + 1).trim();
    const posMatch = /\b(BTN|SB|BB|UTG\+1|UTG|HJ|CO|MP)\b/i.exec(header);
    if (posMatch) {
      heroPositionLabel = posMatch[1]!.toUpperCase();
    }
    const cardsMatch = /\b([2-9TJQKA])([shdc])\s*([2-9TJQKA])([shdc])\b/i.exec(header);
    if (cardsMatch) {
      heroCards = [
        normalizeCard(cardsMatch[1]!, cardsMatch[2]!),
        normalizeCard(cardsMatch[3]!, cardsMatch[4]!),
      ];
    }
  }

  const tokens = tokenizeActionShorthandLine(actionText);
  if (tokens.length === 0) {
    return { ok: false, message: 'No valid actions found' };
  }

  return {
    ok: true,
    heroPositionLabel,
    heroCards,
    tokens,
  };
}
