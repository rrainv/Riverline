import { cloneData, deepFreeze } from '../freeze';
import type {
  HomeGameAccounting,
  HomeGameLedgerHistoryItem,
  HomeGameLedgerValidation,
  HomeGameParticipantResult,
  HomeGameSession,
  HomeGameSettleReadiness,
  HomeGameTransaction,
  HomeGameTransactionType,
} from './types';

export class HomeGameDomainError extends RangeError {
  readonly code: string;
  readonly balanceMinor?: number;
  readonly pendingPlayerIds?: readonly string[];

  constructor(
    code: string,
    message: string,
    extra?: { readonly balanceMinor?: number; readonly pendingPlayerIds?: readonly string[] },
  ) {
    super(message);
    this.name = 'HomeGameDomainError';
    this.code = code;
    this.balanceMinor = extra?.balanceMinor;
    this.pendingPlayerIds = extra?.pendingPlayerIds;
  }
}

const VALID_TRANSACTION_TYPES = new Set<HomeGameTransactionType>([
  'buy_in',
  'rebuy',
  'add_on',
  'cash_out',
  'correction',
]);

const MONEY_IN_TYPES = new Set<HomeGameTransactionType>(['buy_in', 'rebuy', 'add_on']);

function requireNonEmptyId(value: string, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 240) {
    throw new TypeError(`${label} must be a non-empty ID`);
  }
  return value;
}

function requirePositiveSafeInt(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
  return value;
}

export function normalizeHomeGameTransaction(tx: HomeGameTransaction): HomeGameTransaction {
  if (!VALID_TRANSACTION_TYPES.has(tx.type)) {
    throw new RangeError(`Unsupported transaction type: ${String(tx.type)}`);
  }
  const isCorrection = tx.type === 'correction';
  if (isCorrection !== (tx.correctionOfTransactionId !== null)) {
    throw new RangeError('Only correction entries may reference a corrected transaction');
  }
  if (isCorrection && tx.replacementOfTransactionId !== null) {
    throw new RangeError('A correction cannot be a replacement entry');
  }
  return deepFreeze({
    transactionId: requireNonEmptyId(tx.transactionId, 'Transaction ID'),
    sessionId: requireNonEmptyId(tx.sessionId, 'Transaction session ID'),
    playerId: requireNonEmptyId(tx.playerId, 'Transaction player ID'),
    type: tx.type,
    amountMinor: requirePositiveSafeInt(tx.amountMinor, 'Transaction amount'),
    createdAt: requireNonEmptyId(tx.createdAt, 'Transaction timestamp'),
    note: tx.note === null || tx.note === undefined ? null : String(tx.note).trim() || null,
    correctionOfTransactionId: isCorrection
      ? requireNonEmptyId(tx.correctionOfTransactionId!, 'Corrected transaction ID')
      : null,
    replacementOfTransactionId:
      tx.replacementOfTransactionId === null
        ? null
        : requireNonEmptyId(tx.replacementOfTransactionId, 'Replaced transaction ID'),
  });
}

/**
 * Creates an append-only reversal entry for a prior non-correction transaction.
 */
export function createHomeGameCorrection(
  original: HomeGameTransaction,
  transactionId: string,
  createdAt: string,
  note: string | null = null,
): HomeGameTransaction {
  if (original.type === 'correction') {
    throw new RangeError('A correction cannot reverse another correction');
  }
  return normalizeHomeGameTransaction({
    transactionId,
    sessionId: original.sessionId,
    playerId: original.playerId,
    type: 'correction',
    amountMinor: original.amountMinor,
    createdAt,
    note,
    correctionOfTransactionId: original.transactionId,
    replacementOfTransactionId: null,
  });
}

/**
 * Validates append-only ledger invariants for a session:
 * - every transaction belongs to this session & an enrolled participant
 * - no duplicate transaction IDs
 * - corrections reference an earlier non-correction with matching player & exact amount, at most once
 * - replacements reference an earlier corrected entry of matching player & type
 */
export function validateHomeGameLedger(
  session: HomeGameSession,
  transactions: readonly HomeGameTransaction[],
): HomeGameLedgerValidation {
  if (!Array.isArray(transactions)) {
    throw new TypeError('Home Game ledger must be an array');
  }
  const participantIds = new Set(session.participants.map((p) => p.playerId));
  const byId = new Map<string, HomeGameTransaction>();
  const corrected = new Set<string>();

  for (const rawTx of transactions) {
    const tx = normalizeHomeGameTransaction(rawTx);
    if (tx.sessionId !== session.sessionId) {
      throw new RangeError('Ledger transaction belongs to another session');
    }
    if (!participantIds.has(tx.playerId)) {
      throw new RangeError('Ledger transaction references a non-participant');
    }
    if (byId.has(tx.transactionId)) {
      throw new RangeError('Ledger contains a duplicate transaction ID');
    }

    if (tx.type === 'correction') {
      const original = byId.get(tx.correctionOfTransactionId!);
      if (!original) {
        throw new RangeError('Correction must reference an earlier transaction');
      }
      if (original.type === 'correction') {
        throw new RangeError('Correction cannot reverse another correction');
      }
      if (original.playerId !== tx.playerId || original.amountMinor !== tx.amountMinor) {
        throw new RangeError('Correction must exactly reverse the original player and amount');
      }
      if (corrected.has(original.transactionId)) {
        throw new RangeError('A transaction cannot be corrected twice');
      }
      corrected.add(original.transactionId);
    } else if (tx.replacementOfTransactionId !== null) {
      const original = byId.get(tx.replacementOfTransactionId);
      if (!original) {
        throw new RangeError('Replacement must reference an earlier transaction');
      }
      if (!corrected.has(original.transactionId)) {
        throw new RangeError('Replacement requires an earlier correction');
      }
      if (
        original.type === 'correction' ||
        original.playerId !== tx.playerId ||
        original.type !== tx.type
      ) {
        throw new RangeError('Replacement must preserve the original player and transaction type');
      }
    }

    byId.set(tx.transactionId, tx);
  }

  return deepFreeze({
    transactions: [...byId.values()],
    correctedTransactionIds: [...corrected],
  });
}

/**
 * Computes exact per-player and table accounting totals from the append-only ledger.
 */
export function calculateHomeGameAccounting(
  session: HomeGameSession,
  transactions: readonly HomeGameTransaction[],
): HomeGameAccounting {
  const ledger = validateHomeGameLedger(session, transactions);
  const byId = new Map(ledger.transactions.map((tx) => [tx.transactionId, tx]));
  const totalsByPlayer = new Map<
    string,
    { totalInMinor: number; totalOutMinor: number; buyInCount: number }
  >(
    session.participants.map((p) => [
      p.playerId,
      { totalInMinor: 0, totalOutMinor: 0, buyInCount: 0 },
    ]),
  );

  for (const tx of ledger.transactions) {
    const target =
      tx.type === 'correction' ? byId.get(tx.correctionOfTransactionId!)! : tx;
    const direction = tx.type === 'correction' ? -1 : 1;
    const entry = totalsByPlayer.get(tx.playerId)!;
    if (MONEY_IN_TYPES.has(target.type)) {
      entry.totalInMinor += direction * tx.amountMinor;
      entry.buyInCount += direction;
    } else if (target.type === 'cash_out') {
      entry.totalOutMinor += direction * tx.amountMinor;
    }
  }

  const participantResults: HomeGameParticipantResult[] = session.participants.map((p) => {
    const entry = totalsByPlayer.get(p.playerId)!;
    if (entry.totalInMinor < 0 || entry.totalOutMinor < 0 || entry.buyInCount < 0) {
      throw new RangeError('Corrections cannot make ledger totals negative');
    }
    return {
      playerId: p.playerId,
      displayName: p.displayName,
      seatNumber: p.seatNumber,
      status: p.status,
      totalInMinor: entry.totalInMinor,
      totalOutMinor: entry.totalOutMinor,
      netMinor: entry.totalOutMinor - entry.totalInMinor,
      buyInCount: entry.buyInCount,
    };
  });

  const totalInMinor = participantResults.reduce((sum, r) => sum + r.totalInMinor, 0);
  const totalOutMinor = participantResults.reduce((sum, r) => sum + r.totalOutMinor, 0);
  const balanceMinor = totalOutMinor - totalInMinor;
  const pendingPlayerIds = session.participants
    .filter((p) => p.status !== 'cashed_out')
    .map((p) => p.playerId);
  const balanced = balanceMinor === 0;
  const readyToSettle = pendingPlayerIds.length === 0 && balanced;

  return deepFreeze({
    sessionId: session.sessionId,
    currency: cloneData(session.currency),
    totalInMinor,
    totalOutMinor,
    balanceMinor,
    balanced,
    pendingPlayerIds,
    readyToSettle,
    participantResults,
  });
}

/**
 * Checks whether a session passes the cash-out and balance gate required to settle.
 */
export function validateHomeGameSessionReadyToSettle(
  session: HomeGameSession,
  transactions: readonly HomeGameTransaction[],
): HomeGameSettleReadiness {
  const accounting = calculateHomeGameAccounting(session, transactions);
  if (session.status === 'completed') {
    return deepFreeze({
      ok: false,
      reason: 'already_settled',
      pendingPlayerIds: accounting.pendingPlayerIds,
      balanceMinor: accounting.balanceMinor,
      accounting,
    });
  }
  if (accounting.pendingPlayerIds.length > 0) {
    return deepFreeze({
      ok: false,
      reason: 'pending_cashout',
      pendingPlayerIds: accounting.pendingPlayerIds,
      balanceMinor: accounting.balanceMinor,
      accounting,
    });
  }
  if (accounting.balanceMinor < 0) {
    return deepFreeze({
      ok: false,
      reason: 'more_in_than_out',
      pendingPlayerIds: [],
      balanceMinor: accounting.balanceMinor,
      accounting,
    });
  }
  if (accounting.balanceMinor > 0) {
    return deepFreeze({
      ok: false,
      reason: 'more_out_than_in',
      pendingPlayerIds: [],
      balanceMinor: accounting.balanceMinor,
      accounting,
    });
  }
  return deepFreeze({
    ok: true,
    accounting,
  });
}

/**
 * Builds inspectable append-only ledger history pairing originals with corrections & replacements.
 */
export function createHomeGameLedgerHistory(
  session: HomeGameSession,
  transactions: readonly HomeGameTransaction[],
): readonly HomeGameLedgerHistoryItem[] {
  const ledger = validateHomeGameLedger(session, transactions);
  const correctionByOriginal = new Map<string, HomeGameTransaction>();
  const replacementByOriginal = new Map<string, HomeGameTransaction>();
  for (const entry of ledger.transactions) {
    if (entry.correctionOfTransactionId) {
      correctionByOriginal.set(entry.correctionOfTransactionId, entry);
    }
    if (entry.replacementOfTransactionId) {
      replacementByOriginal.set(entry.replacementOfTransactionId, entry);
    }
  }

  const items: HomeGameLedgerHistoryItem[] = [];
  ledger.transactions.forEach((entry, index) => {
    if (entry.type === 'correction' || entry.replacementOfTransactionId !== null) return;
    items.push({
      order: index + 1,
      original: entry,
      corrected: correctionByOriginal.has(entry.transactionId),
      correction: correctionByOriginal.get(entry.transactionId) ?? null,
      replacement: replacementByOriginal.get(entry.transactionId) ?? null,
    });
  });

  return deepFreeze(items);
}
