import { CARD_RANKS } from '../cards';
import { potOddsFromAfterCall } from '../economics-facts';
import { evaluateFive, evaluateSeven } from '../evaluator';
import { deepFreeze } from '../freeze';
import { POKER_ACTION_SCHEMA_VERSION, STREETS, type PokerHandRank } from '../schema';
import type { DuelBotDecision, DuelBotDecisionInput } from './types';

function evaluateBestAvailable(cards: readonly string[]): PokerHandRank {
  if (cards.length === 5) return evaluateFive(cards);
  if (cards.length === 7) return evaluateSeven(cards);
  let best = evaluateFive(cards.slice(0, 5));
  for (let drop = 0; drop < cards.length; drop += 1) {
    const sub = cards.filter((_, idx) => idx !== drop);
    const rank = sub.length === 5 ? evaluateFive(sub) : best;
    if (rank.score > best.score) best = rank;
  }
  return best;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function preflopStrengthScore(cards: readonly string[] | null): number {
  if (!cards || cards.length !== 2) return 0.45;
  const r1 = CARD_RANKS.indexOf(cards[0]![0]!);
  const r2 = CARD_RANKS.indexOf(cards[1]![0]!);
  const hi = Math.max(r1, r2);
  const lo = Math.min(r1, r2);
  const paired = r1 === r2;
  const suited = cards[0]![1] === cards[1]![1];
  const connected = Math.abs(r1 - r2) <= 2;

  if (paired) {
    return Math.min(0.98, 0.56 + (hi / 12) * 0.4);
  }
  const raw = 0.18 + (hi / 12) * 0.36 + (lo / 12) * 0.22 + (suited ? 0.08 : 0) + (connected ? 0.05 : 0);
  return Math.min(0.92, Math.max(0.15, raw));
}

function clampToChipUnit(valueMilliBb: number, chipUnit: number, min: number, max: number): number {
  const snapped = Math.round(valueMilliBb / chipUnit) * chipUnit;
  return Math.max(min, Math.min(max, snapped));
}

export function chooseDuelBotAction({
  actorInfo,
  seed,
  style = 'balanced',
}: DuelBotDecisionInput): DuelBotDecision {
  const { legalActionSpec: legal, actingPlayerId, ownCards, board, street, potMilliBb, game } = actorInfo;
  const rand = mulberry32(seed + actorInfo.actionHistory.length * 97);
  const roll = rand();
  const aggressionBias = style === 'loose_aggressive' ? 0.1 : style === 'tight_aggressive' ? -0.05 : 0;

  const odds =
    legal.call.available && legal.call.commitMilliBb > 0
      ? potOddsFromAfterCall(legal.call.commitMilliBb, potMilliBb + legal.call.commitMilliBb).requiredRawEquity
      : 0;

  if (street === STREETS.PREFLOP) {
    const score = preflopStrengthScore(ownCards) + aggressionBias;

    if (legal.check.available) {
      // BB facing a limp
      if (score >= 0.68 && legal.raise.available && legal.raise.minToMilliBb !== null && legal.raise.maxToMilliBb !== null) {
        const target = clampToChipUnit(3500, game.chipUnitMilliBb, legal.raise.minToMilliBb, legal.raise.maxToMilliBb);
        return deepFreeze({
          action: { schemaVersion: POKER_ACTION_SCHEMA_VERSION, playerId: actingPlayerId, type: 'raise', amountToMilliBb: target },
          reasonCode: 'preflop_value_raise',
        });
      }
      return deepFreeze({
        action: { schemaVersion: POKER_ACTION_SCHEMA_VERSION, playerId: actingPlayerId, type: 'check', amountToMilliBb: null },
        reasonCode: 'postflop_check',
      });
    }

    // Facing a raise/open preflop
    if (score >= 0.78 && roll < 0.65 && legal.raise.available && legal.raise.minToMilliBb !== null && legal.raise.maxToMilliBb !== null) {
      const target = clampToChipUnit(
        Math.round(actorInfo.currentBetMilliBb * 3),
        game.chipUnitMilliBb,
        legal.raise.minToMilliBb,
        legal.raise.maxToMilliBb,
      );
      return deepFreeze({
        action: { schemaVersion: POKER_ACTION_SCHEMA_VERSION, playerId: actingPlayerId, type: 'raise', amountToMilliBb: target },
        reasonCode: 'preflop_value_raise',
      });
    }

    const callThreshold = odds <= 0.25 ? 0.34 : odds <= 0.36 ? 0.46 : 0.62;
    if (score >= callThreshold || (legal.call.available && odds < 0.2)) {
      return deepFreeze({
        action: { schemaVersion: POKER_ACTION_SCHEMA_VERSION, playerId: actingPlayerId, type: 'call', amountToMilliBb: null },
        reasonCode: 'preflop_call',
      });
    }

    if (legal.fold.available) {
      return deepFreeze({
        action: { schemaVersion: POKER_ACTION_SCHEMA_VERSION, playerId: actingPlayerId, type: 'fold', amountToMilliBb: null },
        reasonCode: 'preflop_fold',
      });
    }
  }

  // Postflop: use actual card evaluation on Astra's own private cards + board
  let categoryScore = 0.35;
  if (ownCards && ownCards.length === 2 && board.length >= 3) {
    const rank = evaluateBestAvailable([...ownCards, ...board]);
    // categoryName/categoryScore: high_card=0.32, pair=0.58, two_pair=0.76, three_of_a_kind=0.84, straight+=0.92
    switch (rank.category) {
      case 'high_card':
        categoryScore = preflopStrengthScore(ownCards) >= 0.62 ? 0.42 : 0.28;
        break;
      case 'one_pair':
        categoryScore = 0.62;
        break;
      case 'two_pair':
        categoryScore = 0.78;
        break;
      case 'three_of_a_kind':
        categoryScore = 0.86;
        break;
      default:
        categoryScore = 0.94;
        break;
    }
  }
  const effectiveScore = categoryScore + aggressionBias;

  if (legal.check.available) {
    const shouldValueBet = effectiveScore >= 0.68 && roll < 0.7;
    const shouldBluff = effectiveScore < 0.4 && roll < 0.22;
    if ((shouldValueBet || shouldBluff) && legal.bet.available && legal.bet.minToMilliBb !== null && legal.bet.maxToMilliBb !== null) {
      const halfPot = clampToChipUnit(Math.round(potMilliBb * 0.5), game.chipUnitMilliBb, legal.bet.minToMilliBb, legal.bet.maxToMilliBb);
      return deepFreeze({
        action: { schemaVersion: POKER_ACTION_SCHEMA_VERSION, playerId: actingPlayerId, type: 'bet', amountToMilliBb: halfPot },
        reasonCode: shouldValueBet ? 'postflop_value_bet' : 'postflop_bluff_bet',
      });
    }
    return deepFreeze({
      action: { schemaVersion: POKER_ACTION_SCHEMA_VERSION, playerId: actingPlayerId, type: 'check', amountToMilliBb: null },
      reasonCode: 'postflop_check',
    });
  }

  // Facing a postflop bet or raise
  if (effectiveScore >= 0.85 && roll < 0.45 && legal.raise.available && legal.raise.minToMilliBb !== null && legal.raise.maxToMilliBb !== null) {
    const target = clampToChipUnit(
      Math.round(actorInfo.currentBetMilliBb * 2.5),
      game.chipUnitMilliBb,
      legal.raise.minToMilliBb,
      legal.raise.maxToMilliBb,
    );
    return deepFreeze({
      action: { schemaVersion: POKER_ACTION_SCHEMA_VERSION, playerId: actingPlayerId, type: 'raise', amountToMilliBb: target },
      reasonCode: 'postflop_value_bet',
    });
  }

  if (legal.call.available && effectiveScore >= odds + 0.14) {
    return deepFreeze({
      action: { schemaVersion: POKER_ACTION_SCHEMA_VERSION, playerId: actingPlayerId, type: 'call', amountToMilliBb: null },
      reasonCode: 'postflop_call_odds',
    });
  }

  if (legal.fold.available) {
    return deepFreeze({
      action: { schemaVersion: POKER_ACTION_SCHEMA_VERSION, playerId: actingPlayerId, type: 'fold', amountToMilliBb: null },
      reasonCode: 'postflop_fold',
    });
  }

  return deepFreeze({
    action: { schemaVersion: POKER_ACTION_SCHEMA_VERSION, playerId: actingPlayerId, type: 'check', amountToMilliBb: null },
    reasonCode: 'postflop_check',
  });
}
