import { cloneData, deepFreeze } from '../freeze';
import { calculateHomeGameAccounting } from './ledger';
import { calculateFewestTransfersSettlement } from './settlement';
import type {
  HomeGameMorningSummary,
  HomeGameParticipantResult,
  HomeGameSession,
  HomeGameTransaction,
  HomeGameTransfer,
} from './types';

/**
 * Builds a factual morning-after summary for a game night session.
 * Includes standings, settlement transfers (when balanced & cashed out), and neutral highlights.
 */
export function buildHomeGameMorningSummary(
  session: HomeGameSession,
  transactions: readonly HomeGameTransaction[],
): HomeGameMorningSummary {
  const accounting = calculateHomeGameAccounting(session, transactions);
  const standings = [...accounting.participantResults].sort(
    (a, b) => b.netMinor - a.netMinor || a.seatNumber - b.seatNumber,
  );

  let transfers: readonly HomeGameTransfer[] = [];
  if (accounting.readyToSettle) {
    transfers = calculateFewestTransfersSettlement(session, transactions).transfers;
  }

  const largestWinner: HomeGameParticipantResult | null =
    standings.find((r) => r.netMinor > 0) ?? null;

  const largestSwing: HomeGameParticipantResult | null =
    [...standings]
      .filter((r) => r.netMinor !== 0)
      .sort(
        (a, b) =>
          Math.abs(b.netMinor) - Math.abs(a.netMinor) || a.seatNumber - b.seatNumber,
      )[0] ?? null;

  return deepFreeze({
    sessionId: session.sessionId,
    title: session.title,
    settled: session.status === 'completed',
    settledAt: session.settledAt,
    currency: cloneData(session.currency),
    totalInMinor: accounting.totalInMinor,
    totalOutMinor: accounting.totalOutMinor,
    playerCount: session.participants.length,
    transferCount: transfers.length,
    transfers,
    standings,
    largestWinner,
    largestSwing,
  });
}
