import { deepFreeze } from './freeze';

export interface PotOddsFacts {
  readonly requiredRawEquity: number;
  readonly requiredPercent: number;
}

export interface DuelCallFacts {
  readonly calledPotBb: number;
  readonly effectiveStackBehindBb: number;
  readonly spr: number;
  readonly callerPotOddsFraction: number;
  readonly callerPotOddsPercent: number;
}

export interface AllInLuckInput {
  readonly finalPotBb: number;
  readonly investedBb: number;
  readonly equityFraction: number;
  readonly wonPotBb: number;
}

export interface AllInLuckFacts {
  readonly expectedShareBb: number;
  readonly expectedNetBb: number;
  readonly actualNetBb: number;
  readonly runoutLuckBb: number;
}

export interface ReviewCallEvInput {
  readonly finalPotBb: number;
  readonly heroInvestedBeforeCallBb: number;
  readonly callAmountBb: number;
  readonly equityFraction: number;
  readonly displayedEquityPercent?: number;
  readonly wonPotBb: number;
}

export interface ReviewCallEvFacts {
  readonly potAfterCallBb: number;
  readonly requiredCallEquity: number;
  readonly requiredCallEquityPercent: number;
  readonly exactExpectedShareBb: number;
  readonly displayedExpectedShareBb: number | null;
  readonly handEvExactBb: number;
  readonly handEvDisplayedBb: number | null;
  readonly callVsFoldEvExactBb: number;
  readonly callVsFoldEvDisplayedBb: number | null;
  readonly actualNetBb: number;
  readonly runoutLuckExactBb: number;
  readonly runoutLuckDisplayedBb: number | null;
}

export interface CallPriceComparisonInput {
  readonly heroEquityFraction: number | null;
  readonly requiredEquityFraction: number | null;
  readonly isCallAction: boolean;
  readonly isExact: boolean;
}

export interface CallPriceComparisonFacts {
  readonly heroEquityPct: number | null;
  readonly requiredEquityPct: number | null;
  readonly deltaVsRequiredPct: number | null;
  readonly behindRequiredPrice: boolean;
}

const CALL_PRICE_MISTAKE_TOLERANCE_PCT = 0.05;

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function assertNonNegativeFinite(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be finite and >= 0`);
  }
  return value;
}

/** Computes breakeven raw equity for calling into an already-formed pot (potBeforeCall + call). */
export function potOddsFacts(callAmount: number, potBeforeCall: number): PotOddsFacts {
  const call = assertNonNegativeFinite(callAmount, 'callAmount');
  const potBefore = assertNonNegativeFinite(potBeforeCall, 'potBeforeCall');
  const totalAfterCall = potBefore + call;
  const requiredRawEquity = totalAfterCall === 0 ? 0 : call / totalAfterCall;
  return deepFreeze({
    requiredRawEquity,
    requiredPercent: requiredRawEquity * 100,
  });
}

/**
 * Computes breakeven raw equity directly from call commitment and actor-contestable
 * pot after the call completes (`callAmount / actorContestablePotAfterCall`).
 */
export function potOddsFromAfterCall(
  callAmount: number,
  actorContestablePotAfterCall: number,
): PotOddsFacts {
  const call = assertNonNegativeFinite(callAmount, 'callAmount');
  const afterCall = assertNonNegativeFinite(
    actorContestablePotAfterCall,
    'actorContestablePotAfterCall',
  );
  if (call > afterCall) {
    throw new RangeError('callAmount cannot exceed actorContestablePotAfterCall');
  }
  const requiredRawEquity = afterCall === 0 ? 0 : call / afterCall;
  return deepFreeze({
    requiredRawEquity,
    requiredPercent: requiredRawEquity * 100,
  });
}

/**
 * Computes heads-up bet/call arithmetic (called pot, effective stack behind, SPR, and caller pot odds)
 * for Design Spec §8 verification scenarios and UI readouts.
 */
export function duelCallFacts(
  potBeforeBetBb: number,
  betBb: number,
  startingStackBb: number,
): DuelCallFacts {
  const potBefore = assertNonNegativeFinite(potBeforeBetBb, 'potBeforeBetBb');
  const bet = assertNonNegativeFinite(betBb, 'betBb');
  const stack = assertNonNegativeFinite(startingStackBb, 'startingStackBb');
  if (bet > stack) throw new RangeError('betBb cannot exceed startingStackBb');
  const calledPotBb = potBefore + 2 * bet;
  const effectiveStackBehindBb = stack - bet;
  const spr = calledPotBb === 0 ? 0 : effectiveStackBehindBb / calledPotBb;
  const odds = potOddsFacts(bet, potBefore + bet);
  return deepFreeze({
    calledPotBb,
    effectiveStackBehindBb,
    spr,
    callerPotOddsFraction: odds.requiredRawEquity,
    callerPotOddsPercent: odds.requiredPercent,
  });
}

/** Computes exact expected net vs actual net and runout luck (actual - EV) for an all-in spot. */
export function allInLuckFacts(input: AllInLuckInput): AllInLuckFacts {
  const finalPotBb = assertNonNegativeFinite(input.finalPotBb, 'finalPotBb');
  const investedBb = assertNonNegativeFinite(input.investedBb, 'investedBb');
  const wonPotBb = assertNonNegativeFinite(input.wonPotBb, 'wonPotBb');
  if (!Number.isFinite(input.equityFraction) || input.equityFraction < 0 || input.equityFraction > 1) {
    throw new RangeError('equityFraction must be in [0, 1]');
  }
  const expectedShareBb = finalPotBb * input.equityFraction;
  const expectedNetBb = expectedShareBb - investedBb;
  const actualNetBb = wonPotBb - investedBb;
  return deepFreeze({
    expectedShareBb,
    expectedNetBb,
    actualNetBb,
    runoutLuckBb: actualNetBb - expectedNetBb,
  });
}

/**
 * Computes Review EV decomposition (hand EV, call-vs-fold EV, and runout luck) from known cards.
 * Keeps both exact unrounded equity arithmetic and optional displayed-percentage consistency breakdown.
 */
export function reviewCallEvFacts(input: ReviewCallEvInput): ReviewCallEvFacts {
  const finalPotBb = assertNonNegativeFinite(input.finalPotBb, 'finalPotBb');
  const investedBefore = assertNonNegativeFinite(
    input.heroInvestedBeforeCallBb,
    'heroInvestedBeforeCallBb',
  );
  const callAmountBb = assertNonNegativeFinite(input.callAmountBb, 'callAmountBb');
  const wonPotBb = assertNonNegativeFinite(input.wonPotBb, 'wonPotBb');
  if (!Number.isFinite(input.equityFraction) || input.equityFraction < 0 || input.equityFraction > 1) {
    throw new RangeError('equityFraction must be in [0, 1]');
  }

  const totalInvested = investedBefore + callAmountBb;
  const potBeforeCallBb = finalPotBb - callAmountBb;
  const odds = potOddsFacts(callAmountBb, potBeforeCallBb);
  const exactExpectedShareBb = finalPotBb * input.equityFraction;
  const handEvExactBb = exactExpectedShareBb - totalInvested;
  const callVsFoldEvExactBb = exactExpectedShareBb - callAmountBb;
  const actualNetBb = wonPotBb - totalInvested;
  const runoutLuckExactBb = actualNetBb - handEvExactBb;

  let displayedExpectedShareBb: number | null = null;
  let handEvDisplayedBb: number | null = null;
  let callVsFoldEvDisplayedBb: number | null = null;
  let runoutLuckDisplayedBb: number | null = null;
  if (input.displayedEquityPercent !== undefined) {
    if (
      !Number.isFinite(input.displayedEquityPercent) ||
      input.displayedEquityPercent < 0 ||
      input.displayedEquityPercent > 100
    ) {
      throw new RangeError('displayedEquityPercent must be in [0, 100]');
    }
    displayedExpectedShareBb = finalPotBb * (input.displayedEquityPercent / 100);
    handEvDisplayedBb = displayedExpectedShareBb - totalInvested;
    callVsFoldEvDisplayedBb = displayedExpectedShareBb - callAmountBb;
    runoutLuckDisplayedBb = actualNetBb - handEvDisplayedBb;
  }

  return deepFreeze({
    potAfterCallBb: finalPotBb,
    requiredCallEquity: odds.requiredRawEquity,
    requiredCallEquityPercent: odds.requiredPercent,
    exactExpectedShareBb,
    displayedExpectedShareBb,
    handEvExactBb,
    handEvDisplayedBb,
    callVsFoldEvExactBb,
    callVsFoldEvDisplayedBb,
    actualNetBb,
    runoutLuckExactBb,
    runoutLuckDisplayedBb,
  });
}

/**
 * Compares hero equity against required pot-odds equity and determines whether an exact known-card
 * call fell meaningfully behind its price (outside a 0.05 percentage-point rounding tolerance).
 */
export function compareCallEquityToRequired(
  input: CallPriceComparisonInput,
): CallPriceComparisonFacts {
  if (
    input.heroEquityFraction !== null &&
    (!Number.isFinite(input.heroEquityFraction) ||
      input.heroEquityFraction < 0 ||
      input.heroEquityFraction > 1)
  ) {
    throw new RangeError('heroEquityFraction must be in [0, 1]');
  }
  if (
    input.requiredEquityFraction !== null &&
    (!Number.isFinite(input.requiredEquityFraction) ||
      input.requiredEquityFraction < 0 ||
      input.requiredEquityFraction > 1)
  ) {
    throw new RangeError('requiredEquityFraction must be in [0, 1]');
  }

  const heroEquityPct =
    input.heroEquityFraction !== null ? roundTenth(input.heroEquityFraction * 100) : null;
  const requiredEquityPct =
    input.requiredEquityFraction !== null ? roundTenth(input.requiredEquityFraction * 100) : null;
  const deltaVsRequiredPct =
    heroEquityPct !== null && requiredEquityPct !== null
      ? roundTenth(heroEquityPct - requiredEquityPct)
      : null;
  const behindRequiredPrice = Boolean(
    input.isExact &&
      input.isCallAction &&
      heroEquityPct !== null &&
      requiredEquityPct !== null &&
      heroEquityPct + CALL_PRICE_MISTAKE_TOLERANCE_PCT < requiredEquityPct,
  );

  return deepFreeze({
    heroEquityPct,
    requiredEquityPct,
    deltaVsRequiredPct,
    behindRequiredPrice,
  });
}
