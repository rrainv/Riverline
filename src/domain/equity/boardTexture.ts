export type BoardTextureTagId =
  | 'monotone'
  | 'two_tone'
  | 'rainbow'
  | 'paired'
  | 'trips'
  | 'connected'
  | 'dry'
  | 'broadway'
  | 'low';

const RANK_VAL: Readonly<Record<string, number>> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

export function classifyBoardTexture(board: readonly string[]): readonly BoardTextureTagId[] {
  if (board.length < 3) return [];

  const suitCounts = new Map<string, number>();
  const rankCounts = new Map<number, number>();
  let broadwayCount = 0;
  let allLow = true;

  for (const card of board) {
    if (card.length < 2) continue;
    const rank = RANK_VAL[card[0]!.toUpperCase()];
    const suit = card[1]!.toLowerCase();
    if (!rank) continue;
    suitCounts.set(suit, (suitCounts.get(suit) ?? 0) + 1);
    rankCounts.set(rank, (rankCounts.get(rank) ?? 0) + 1);
    if (rank >= 10) broadwayCount += 1;
    if (rank > 9) allLow = false;
  }

  const tags: BoardTextureTagId[] = [];
  const maxSuit = Math.max(0, ...suitCounts.values());
  const monoThreshold = board.length === 3 ? 3 : 4;
  const twoToneThreshold = board.length === 3 ? 2 : 3;
  if (maxSuit >= monoThreshold) {
    tags.push('monotone');
  } else if (maxSuit >= twoToneThreshold) {
    tags.push('two_tone');
  } else {
    tags.push('rainbow');
  }

  const maxRank = Math.max(0, ...rankCounts.values());
  if (maxRank >= 3) {
    tags.push('trips');
  } else if (maxRank === 2) {
    tags.push('paired');
  }

  const distinctRanks = [...rankCounts.keys()].sort((a, b) => a - b);
  let connected = false;
  for (let i = 0; i + 2 < distinctRanks.length; i += 1) {
    if (distinctRanks[i + 2]! - distinctRanks[i]! <= 4) {
      connected = true;
      break;
    }
  }
  if (!connected && distinctRanks.includes(14)) {
    const wheelRanks = distinctRanks.map((r) => (r === 14 ? 1 : r)).sort((a, b) => a - b);
    for (let i = 0; i + 2 < wheelRanks.length; i += 1) {
      if (wheelRanks[i + 2]! - wheelRanks[i]! <= 4) {
        connected = true;
        break;
      }
    }
  }
  if (connected) {
    tags.push('connected');
  }

  if (broadwayCount >= 2) {
    tags.push('broadway');
  } else if (allLow) {
    tags.push('low');
  }

  if (
    tags.includes('rainbow') &&
    maxRank === 1 &&
    !connected
  ) {
    tags.push('dry');
  }

  return tags;
}
