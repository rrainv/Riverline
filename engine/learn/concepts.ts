import {
  deriveMinimumDefenseFrequency,
  deriveStackToPotRatio,
} from '../actor-call-economics';
import { potOddsFacts } from '../economics-facts';
import { calculateEquityExact, EQUITY_REQUEST_SCHEMA_VERSION } from '../equity';
import { deepFreeze } from '../freeze';
import {
  conditionHoldemRange,
  createHoldemWeightedRangeFromHandClassWeights,
} from '../holdem-range';
import { playersBehindForPosition } from '../personal-strategy/context';
import type { LearnConceptExample, LearnConceptId } from './types';

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Computes exact engine-backed numbers for each concept's worked example.
 * UI code renders these figures via localized templates without computing poker math.
 */
export function buildLearnConceptExample(conceptId: LearnConceptId): LearnConceptExample {
  switch (conceptId) {
    case 'pot_odds': {
      const potBeforeBetBb = 12;
      const betBb = 6;
      const potBeforeCallBb = potBeforeBetBb + betBb;
      const potAfterCallBb = potBeforeCallBb + betBb;
      const odds = potOddsFacts(betBb, potBeforeCallBb);
      return deepFreeze({
        conceptId,
        tier: 'exact',
        qualifier: 'price_only',
        numbers: {
          potBeforeBetBb,
          betBb,
          potBeforeCallBb,
          potAfterCallBb,
          requiredPercent: roundToOneDecimal(odds.requiredPercent),
        },
      });
    }

    case 'equity': {
      const cards = ['Ah', 'Kh'] as const;
      const opponentCards = ['Qs', 'Qc'] as const;
      const board = ['Qh', '7c', '2h'] as const;
      const eq = calculateEquityExact({
        schemaVersion: EQUITY_REQUEST_SCHEMA_VERSION,
        board: [...board],
        players: [
          { id: 'hero', cards: [...cards] },
          { id: 'villain', cards: [...opponentCards] },
        ],
        method: 'exact',
      });
      if ('error' in eq) {
        throw new Error(`Learn equity example failed: ${eq.error.message}`);
      }
      const hero = eq.players[0]!;
      return deepFreeze({
        conceptId,
        tier: 'exact',
        qualifier: 'known_cards',
        cards,
        opponentCards,
        board,
        numbers: {
          wins: hero.wins,
          trials: eq.trials,
          equityPercent: roundToOneDecimal(hero.equity * 100),
        },
      });
    }

    case 'ranges': {
      const totalCombos = 1326;
      const openClasses = [
        'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77',
        'AKs', 'AQs', 'AJs', 'ATs', 'A5s', 'A4s',
        'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'T9s', '98s', '87s',
        'AKo', 'AQo', 'AJo', 'KQo',
      ];
      const handClassWeights = Object.fromEntries(openClasses.map((cls) => [cls, 1]));
      const weighted = createHoldemWeightedRangeFromHandClassWeights({ handClassWeights });
      const conditioned = conditionHoldemRange(weighted, []);
      const openCombos = conditioned.facts.knownEligibleCombos;
      const openPercent = roundToOneDecimal((openCombos / totalCombos) * 100);
      return deepFreeze({
        conceptId,
        tier: 'exact',
        numbers: {
          openPercent,
          openCombos,
          totalCombos,
        },
      });
    }

    case 'blockers': {
      const cards = ['As', 'Kd'] as const;
      const aaRange = createHoldemWeightedRangeFromHandClassWeights({
        handClassWeights: { AA: 1 },
      });
      const fullCombos = conditionHoldemRange(aaRange, []).facts.knownEligibleCombos;
      const remainingCombos = conditionHoldemRange(aaRange, [...cards]).facts.knownEligibleCombos;
      return deepFreeze({
        conceptId,
        tier: 'exact',
        cards,
        numbers: {
          fullCombos,
          remainingCombos,
        },
      });
    }

    case 'position': {
      const tableSize = 6;
      const utgBehind = playersBehindForPosition(tableSize, 'UTG');
      const sbBehind = playersBehindForPosition(tableSize, 'SB');
      return deepFreeze({
        conceptId,
        tier: 'exact',
        numbers: {
          tableSize,
          utgBehind,
          sbBehind,
        },
      });
    }

    case 'spr': {
      const flopPotBb = 5;
      const effectiveBehindBb = 97.5;
      const spr = deriveStackToPotRatio({
        actorContestablePotAfterCallBb: flopPotBb,
        callAmountBb: 0,
        opponentCount: 1,
        effectiveStackBb: effectiveBehindBb,
      });
      return deepFreeze({
        conceptId,
        tier: 'exact',
        qualifier: 'price_only',
        numbers: {
          flopPotBb,
          effectiveBehindBb,
          spr: spr !== null ? roundToOneDecimal(spr) : 0,
        },
      });
    }

    case 'bluffing': {
      const potBeforeBetBb = 10;
      const betBb = 5;
      // Zero-showdown bluff breakeven: bet / (potBeforeBet + bet)
      const foldThreshold = potOddsFacts(betBb, potBeforeBetBb);
      const mdf = deriveMinimumDefenseFrequency({
        actorContestablePotAfterCallBb: potBeforeBetBb + betBb + betBb,
        callAmountBb: betBb,
      });
      return deepFreeze({
        conceptId,
        tier: 'exact',
        qualifier: 'price_only',
        numbers: {
          potBeforeBetBb,
          betBb,
          requiredFoldPercent: roundToOneDecimal(foldThreshold.requiredPercent),
          mdfPercent: mdf !== null ? roundToOneDecimal(mdf * 100) : 0,
        },
      });
    }

    case 'value': {
      const potBeforeBetBb = 12;
      const betBb = 8;
      const callerPotOdds = potOddsFacts(betBb, potBeforeBetBb + betBb);
      const mdf = deriveMinimumDefenseFrequency({
        actorContestablePotAfterCallBb: potBeforeBetBb + betBb + betBb,
        callAmountBb: betBb,
      });
      return deepFreeze({
        conceptId,
        tier: 'exact',
        qualifier: 'price_only',
        numbers: {
          potBeforeBetBb,
          betBb,
          callerNeedPercent: roundToOneDecimal(callerPotOdds.requiredPercent),
          mdfPercent: mdf !== null ? roundToOneDecimal(mdf * 100) : 0,
        },
      });
    }

    case 'multiway': {
      const cards = ['Kd', 'Jd'] as const;
      const opponentCards = ['Qh', 'Qc'] as const;
      const thirdPlayerCards = ['Th', '9h'] as const;
      const board = ['Ks', '8h', '4h'] as const;
      const hu = calculateEquityExact({
        schemaVersion: EQUITY_REQUEST_SCHEMA_VERSION,
        board: [...board],
        players: [
          { id: 'hero', cards: [...cards] },
          { id: 'v1', cards: [...opponentCards] },
        ],
        method: 'exact',
      });
      const threeWay = calculateEquityExact({
        schemaVersion: EQUITY_REQUEST_SCHEMA_VERSION,
        board: [...board],
        players: [
          { id: 'hero', cards: [...cards] },
          { id: 'v1', cards: [...opponentCards] },
          { id: 'v2', cards: [...thirdPlayerCards] },
        ],
        method: 'exact',
      });
      if ('error' in hu || 'error' in threeWay) {
        throw new Error('Learn multiway equity example failed');
      }
      return deepFreeze({
        conceptId,
        tier: 'exact',
        qualifier: 'known_cards',
        cards,
        opponentCards,
        thirdPlayerCards,
        board,
        numbers: {
          headsUpEquityPercent: roundToOneDecimal(hu.players[0]!.equity * 100),
          threeWayEquityPercent: roundToOneDecimal(threeWay.players[0]!.equity * 100),
          threeWayTrials: threeWay.trials,
        },
      });
    }
  }
}
