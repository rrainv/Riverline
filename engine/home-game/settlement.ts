import { cloneData, deepFreeze } from '../freeze';
import { calculateHomeGameAccounting, HomeGameDomainError } from './ledger';
import type {
  HomeGameParticipantResult,
  HomeGameSession,
  HomeGameSettlement,
  HomeGameTransaction,
  HomeGameTransfer,
} from './types';

interface SideNode {
  readonly playerId: string;
  readonly displayName: string;
  readonly seatNumber: number;
  remaining: number;
}

function makeTransfer(
  from: Pick<SideNode, 'playerId' | 'displayName'>,
  to: Pick<SideNode, 'playerId' | 'displayName'>,
  amountMinor: number,
): HomeGameTransfer {
  return {
    fromPlayerId: from.playerId,
    fromName: from.displayName,
    toPlayerId: to.playerId,
    toName: to.displayName,
    amountMinor,
  };
}

/**
 * Exact minimum-transfer bipartite DFS solver (debtors -> creditors directly, no pass-through).
 * Every step settles min(debtor.remaining, creditor.remaining), eliminating at least one node
 * and strictly preserving sum(transfers) === sum(positiveNets).
 */
function solveExactBipartiteMinTransfers(
  debtors: SideNode[],
  creditors: SideNode[],
): HomeGameTransfer[] {
  let best: HomeGameTransfer[] | null = null;
  const current: HomeGameTransfer[] = [];

  function dfs(): void {
    const remDebtors = debtors.filter((d) => d.remaining > 0);
    const remCreditors = creditors.filter((c) => c.remaining > 0);
    if (remDebtors.length === 0 && remCreditors.length === 0) {
      best = [...current];
      return;
    }

    const lowerBound = Math.max(remDebtors.length, remCreditors.length);
    if (best !== null && current.length + lowerBound >= best.length) {
      return;
    }

    // Branch on the smaller side's first open node for tighter search.
    if (remDebtors.length <= remCreditors.length) {
      const debtor = remDebtors[0]!;
      const seenAmounts = new Set<number>();
      for (const creditor of remCreditors) {
        if (seenAmounts.has(creditor.remaining)) continue;
        seenAmounts.add(creditor.remaining);

        const amount = Math.min(debtor.remaining, creditor.remaining);
        debtor.remaining -= amount;
        creditor.remaining -= amount;
        current.push(makeTransfer(debtor, creditor, amount));
        dfs();
        current.pop();
        debtor.remaining += amount;
        creditor.remaining += amount;
      }
    } else {
      const creditor = remCreditors[0]!;
      const seenAmounts = new Set<number>();
      for (const debtor of remDebtors) {
        if (seenAmounts.has(debtor.remaining)) continue;
        seenAmounts.add(debtor.remaining);

        const amount = Math.min(debtor.remaining, creditor.remaining);
        debtor.remaining -= amount;
        creditor.remaining -= amount;
        current.push(makeTransfer(debtor, creditor, amount));
        dfs();
        current.pop();
        debtor.remaining += amount;
        creditor.remaining += amount;
      }
    }
  }

  dfs();
  return best ?? [];
}

/**
 * Deterministic largest-first greedy fallback for large tables (> 12 remaining non-zero nodes).
 */
function solveLargestFirstGreedy(
  debtors: SideNode[],
  creditors: SideNode[],
): HomeGameTransfer[] {
  const dList = debtors
    .map((d) => ({ ...d }))
    .sort((a, b) => b.remaining - a.remaining || a.seatNumber - b.seatNumber);
  const cList = creditors
    .map((c) => ({ ...c }))
    .sort((a, b) => b.remaining - a.remaining || a.seatNumber - b.seatNumber);

  const transfers: HomeGameTransfer[] = [];
  let di = 0;
  let ci = 0;
  while (di < dList.length && ci < cList.length) {
    const debtor = dList[di]!;
    const creditor = cList[ci]!;
    const amount = Math.min(debtor.remaining, creditor.remaining);
    transfers.push(makeTransfer(debtor, creditor, amount));
    debtor.remaining -= amount;
    creditor.remaining -= amount;
    if (debtor.remaining === 0) di += 1;
    if (creditor.remaining === 0) ci += 1;
  }
  return transfers;
}

function buildSettlementFromResults(
  results: readonly HomeGameParticipantResult[],
): HomeGameTransfer[] {
  const debtors: SideNode[] = results
    .filter((r) => r.netMinor < 0)
    .map((r) => ({
      playerId: r.playerId,
      displayName: r.displayName,
      seatNumber: r.seatNumber,
      remaining: -r.netMinor,
    }))
    .sort((a, b) => b.remaining - a.remaining || a.seatNumber - b.seatNumber);

  const creditors: SideNode[] = results
    .filter((r) => r.netMinor > 0)
    .map((r) => ({
      playerId: r.playerId,
      displayName: r.displayName,
      seatNumber: r.seatNumber,
      remaining: r.netMinor,
    }))
    .sort((a, b) => b.remaining - a.remaining || a.seatNumber - b.seatNumber);

  if (debtors.length === 0 && creditors.length === 0) return [];

  // Phase 1: Greedily match exact opposite-amount pairs (always provably optimal).
  const pairedTransfers: HomeGameTransfer[] = [];
  for (const debtor of debtors) {
    const match = creditors.find((c) => c.remaining === debtor.remaining && c.remaining > 0);
    if (match) {
      const amount = debtor.remaining;
      pairedTransfers.push(makeTransfer(debtor, match, amount));
      debtor.remaining = 0;
      match.remaining = 0;
    }
  }

  const remDebtors = debtors.filter((d) => d.remaining > 0);
  const remCreditors = creditors.filter((c) => c.remaining > 0);
  if (remDebtors.length === 0 && remCreditors.length === 0) {
    return pairedTransfers;
  }

  const restTransfers =
    remDebtors.length + remCreditors.length <= 12
      ? solveExactBipartiteMinTransfers(remDebtors, remCreditors)
      : solveLargestFirstGreedy(remDebtors, remCreditors);

  return [...pairedTransfers, ...restTransfers];
}

/**
 * Calculates a deterministic, conservative fewest-transfers settlement for a balanced session.
 */
export function calculateFewestTransfersSettlement(
  session: HomeGameSession,
  transactions: readonly HomeGameTransaction[],
): HomeGameSettlement {
  const accounting = calculateHomeGameAccounting(session, transactions);
  if (accounting.pendingPlayerIds.length > 0) {
    throw new HomeGameDomainError(
      'pending_cashout',
      'All active players must cash out before settling',
      { pendingPlayerIds: accounting.pendingPlayerIds, balanceMinor: accounting.balanceMinor },
    );
  }
  if (!accounting.balanced) {
    throw new HomeGameDomainError(
      'unbalanced_session',
      `Settlement unavailable: session is unbalanced by ${Math.abs(accounting.balanceMinor)} minor units`,
      { balanceMinor: accounting.balanceMinor },
    );
  }

  const transfers = buildSettlementFromResults(accounting.participantResults);
  const totalPositiveMinor = accounting.participantResults
    .filter((r) => r.netMinor > 0)
    .reduce((sum, r) => sum + r.netMinor, 0);
  const totalTransferredMinor = transfers.reduce((sum, t) => sum + t.amountMinor, 0);

  if (totalTransferredMinor !== totalPositiveMinor) {
    throw new Error('Settlement conservation invariant failed');
  }
  if (transfers.some((t) => t.amountMinor <= 0)) {
    throw new Error('Settlement produced a non-positive transfer');
  }

  return deepFreeze({
    sessionId: session.sessionId,
    currency: cloneData(session.currency),
    totalTransferredMinor,
    transfers,
  });
}
