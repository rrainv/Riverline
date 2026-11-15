export const POSITIONS_BY_TABLE_SIZE: Readonly<Record<number, readonly string[]>> = Object.freeze({
  2: Object.freeze(['BTN', 'BB']),
  3: Object.freeze(['BTN', 'SB', 'BB']),
  4: Object.freeze(['BTN', 'CO', 'SB', 'BB']),
  5: Object.freeze(['BTN', 'HJ', 'CO', 'SB', 'BB']),
  6: Object.freeze(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']),
  7: Object.freeze(['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']),
  8: Object.freeze(['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']),
  9: Object.freeze(['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']),
  10: Object.freeze(['UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']),
});

export interface SeatedPlayerLike {
  readonly playerId: string;
  readonly seat: number;
}

export interface SeatAssignment {
  readonly playerId: string;
  readonly seat: number;
  readonly position: string;
  readonly isButton: boolean;
  readonly isSmallBlind: boolean;
  readonly isBigBlind: boolean;
}

export function playersBySeat<T extends SeatedPlayerLike>(players: readonly T[]): T[] {
  return [...players].sort((left, right) => left.seat - right.seat);
}

export function playersClockwiseAfterSeat<T extends SeatedPlayerLike>(
  players: readonly T[],
  seat: number,
): T[] {
  const ordered = playersBySeat(players);
  const index = ordered.findIndex((player) => player.seat === seat);
  if (index < 0) throw new RangeError(`Seat ${seat} is not occupied`);
  return ordered.slice(index + 1).concat(ordered.slice(0, index));
}

export function deriveSeatAssignments<T extends SeatedPlayerLike>(
  players: readonly T[],
  buttonSeat: number,
): SeatAssignment[] {
  const tableSize = players.length;
  const vocabulary = POSITIONS_BY_TABLE_SIZE[tableSize];
  if (!vocabulary) throw new RangeError('Position derivation supports 2 through 10 players');

  const button = players.find((player) => player.seat === buttonSeat);
  if (!button) throw new RangeError(`Button seat ${buttonSeat} is not occupied`);

  const clockwiseFromButton = playersClockwiseAfterSeat(players, buttonSeat);
  const smallBlind = tableSize === 2 ? button : clockwiseFromButton[0]!;
  const bigBlind = tableSize === 2 ? clockwiseFromButton[0]! : clockwiseFromButton[1]!;
  const earlyPositions = vocabulary.filter((position) => !['BTN', 'SB', 'BB'].includes(position));
  const clockwiseFromBigBlind = playersClockwiseAfterSeat(players, bigBlind.seat);
  const earlyPlayers = clockwiseFromBigBlind.filter(
    (player) =>
      player.playerId !== button.playerId &&
      player.playerId !== smallBlind.playerId &&
      player.playerId !== bigBlind.playerId,
  );

  if (earlyPlayers.length !== earlyPositions.length) {
    throw new Error('Position vocabulary does not match the seated player count');
  }

  const positions = new Map<string, string>([
    [button.playerId, 'BTN'],
    [bigBlind.playerId, 'BB'],
  ]);
  if (tableSize > 2) positions.set(smallBlind.playerId, 'SB');
  earlyPlayers.forEach((player, index) => positions.set(player.playerId, earlyPositions[index]!));

  return playersBySeat(players).map((player) =>
    Object.freeze({
      playerId: player.playerId,
      seat: player.seat,
      position: positions.get(player.playerId)!,
      isButton: player.playerId === button.playerId,
      isSmallBlind: player.playerId === smallBlind.playerId,
      isBigBlind: player.playerId === bigBlind.playerId,
    }),
  );
}
