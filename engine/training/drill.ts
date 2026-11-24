import { deriveActorCallEconomics } from '../actor-call-economics';
import { applyChance } from '../chance';
import { deepFreeze } from '../freeze';
import { createGameRulesSnapshot } from '../game-rules';
import { preflopHandClassForCards } from '../hand-class';
import { getHoldemCombosForHandClass, HOLDEM_DECK } from '../holdem-combos';
import { initializeRecordedHand } from '../initialize-hand';
import { getLegalActionSpec } from '../legal-actions';
import { getEstimatedBaselineCutoff } from '../personal-strategy/baseline';
import { querySpotBaselineRegistry } from '../personal-strategy/spot-registry';
import {
  createStrategyContext,
  playersBehindForPosition,
  positionsForTableSize,
} from '../personal-strategy/context';
import { STRATEGY_FAMILIES, getStrategyFamily } from '../personal-strategy/families';
import type {
  StrategyFamilyId,
  StrategyStackDepthBb,
  StrategyTableSize,
} from '../personal-strategy/types';
import {
  POKER_ACTION_SCHEMA_VERSION,
  type ActionType,
  type PokerState,
} from '../schema';
import { applyAction } from '../transitions';
import type {
  TrainingDrillExercise,
  TrainingDrillMixSegment,
  TrainingDrillReasonKind,
  TrainingDrillRequest,
  TrainingDrillTarget,
} from './types';

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function findHandFamilyAndIndex(handClass: string): {
  readonly familyId: StrategyFamilyId | null;
  readonly index: number;
} {
  for (const fam of STRATEGY_FAMILIES) {
    const index = fam.hands.findIndex((h) => h.handClass === handClass);
    if (index >= 0) {
      return { familyId: fam.id, index };
    }
  }
  return { familyId: null, index: -1 };
}

function handStrengthScore(handClass: string): number {
  const rankOrder = '23456789TJQKA';
  const r1 = rankOrder.indexOf(handClass[0] ?? '2');
  const r2 = rankOrder.indexOf(handClass[1] ?? '2');
  const pair = r1 === r2;
  const suited = handClass.endsWith('s');
  if (pair) return 14 + r1 * 1.4;
  return Math.max(r1, r2) + Math.min(r1, r2) * 0.55 + (suited ? 3.2 : 0);
}

function pickRandomCardsForHandClass(
  handClass: string,
  rand: () => number,
): readonly [string, string] {
  const combos = getHoldemCombosForHandClass(handClass);
  const chosen = combos[Math.floor(rand() * combos.length) % combos.length]!;
  return chosen.cards;
}

function pickSeededSpot(
  request: TrainingDrillRequest,
  tableSize: StrategyTableSize,
  stackDepthBb: StrategyStackDepthBb,
  rand: () => number,
): {
  readonly target: TrainingDrillTarget;
  readonly heroPosition: string;
  readonly openerPosition: string | null;
  readonly handClass: string;
  readonly familyId: StrategyFamilyId | null;
  readonly reasonKind: TrainingDrillReasonKind;
} {
  const positions = positionsForTableSize(tableSize);
  const rfiPositions = positions.filter((p) => p !== 'BB');
  const requestedTarget: TrainingDrillTarget =
    request.target && request.target !== 'auto'
      ? request.target
      : (['preflop_rfi', 'preflop_facing_open', 'preflop_facing_3bet'] as const)[
          Math.floor(rand() * 3)
        ]!;

  let heroPosition = request.focusPosition;
  let openerPosition: string | null = null;
  const target: TrainingDrillTarget = requestedTarget;

  if (target === 'preflop_rfi') {
    if (!heroPosition || !rfiPositions.includes(heroPosition)) {
      heroPosition = rfiPositions[Math.floor(rand() * rfiPositions.length)]!;
    }
  } else if (target === 'preflop_facing_open') {
    const facingCandidates = positions.filter((p) => p !== positions[0]);
    if (!heroPosition || !facingCandidates.includes(heroPosition)) {
      heroPosition = facingCandidates[Math.floor(rand() * facingCandidates.length)]!;
    }
    const heroIdx = positions.indexOf(heroPosition);
    const possibleOpeners = positions.slice(0, heroIdx);
    openerPosition = possibleOpeners[Math.floor(rand() * possibleOpeners.length)]!;
  } else {
    // preflop_facing_3bet: hero opened earlier, later seat 3-bets
    const heroCandidates = positions.slice(0, positions.length - 1);
    if (!heroPosition || !heroCandidates.includes(heroPosition)) {
      heroPosition = heroCandidates[Math.floor(rand() * heroCandidates.length)]!;
    }
    const heroIdx = positions.indexOf(heroPosition);
    const possible3Bettors = positions.slice(heroIdx + 1);
    openerPosition = possible3Bettors[Math.floor(rand() * possible3Bettors.length)]!;
  }

  let familyId: StrategyFamilyId | null = request.focusFamilyId ?? null;
  let handClass: string;
  let reasonKind: TrainingDrillReasonKind = request.focusFamilyId ? 'leak_gap' : 'spot_practice';

  if (familyId) {
    const fam = getStrategyFamily(familyId);
    const ctx = createStrategyContext({
      tableSize,
      stackDepthBb,
      decisionFamily: 'preflop_rfi',
      position: heroPosition === 'BB' ? 'BTN' : heroPosition,
    });
    const cutoff = getEstimatedBaselineCutoff(ctx, familyId);
    const idx =
      cutoff !== null
        ? Math.max(
            0,
            Math.min(
              fam.hands.length - 1,
              cutoff + Math.floor(rand() * 5) - 2,
            ),
          )
        : Math.floor(rand() * fam.hands.length);
    handClass = fam.hands[idx]!.handClass;
  } else if (target === 'preflop_facing_open' && tableSize === 6 && heroPosition === 'BTN' && rand() < 0.25) {
    // Include canonical study anchor spots cleanly alongside varied hands
    handClass = 'AKs';
    openerPosition = 'CO';
    familyId = 'suited_aces';
    reasonKind = 'baseline_edge';
  } else {
    const chosenFam = STRATEGY_FAMILIES[Math.floor(rand() * STRATEGY_FAMILIES.length)]!;
    familyId = chosenFam.id;
    const ctx = createStrategyContext({
      tableSize,
      stackDepthBb,
      decisionFamily: 'preflop_rfi',
      position: heroPosition === 'BB' ? 'BTN' : heroPosition,
    });
    const cutoff = getEstimatedBaselineCutoff(ctx, familyId);
    if (target === 'preflop_rfi' && cutoff !== null) {
      const idx = Math.max(
        0,
        Math.min(
          chosenFam.hands.length - 1,
          cutoff + Math.floor(rand() * 5) - 2,
        ),
      );
      handClass = chosenFam.hands[idx]!.handClass;
      reasonKind = 'baseline_edge';
    } else {
      const idx = Math.floor(rand() * Math.min(chosenFam.hands.length, 8));
      handClass = chosenFam.hands[idx]!.handClass;
    }
  }

  return {
    target,
    heroPosition,
    openerPosition,
    handClass,
    familyId,
    reasonKind,
  };
}

function buildPreflopState(
  tableSize: StrategyTableSize,
  stackDepthBb: StrategyStackDepthBb,
  target: TrainingDrillTarget,
  heroPosition: string,
  openerPosition: string | null,
  heroCards: readonly [string, string],
  exerciseId: string,
): { readonly state: PokerState; readonly openerBetBb: number | null } {
  const positions = positionsForTableSize(tableSize);
  const heroIdx = positions.indexOf(heroPosition);
  const openerIdx = openerPosition ? positions.indexOf(openerPosition) : -1;
  // positions[0] is UTG (first after BB); BTN is at positions.length - 3 (or 0 in 2p, here 6 or 8)
  const btnIndex = positions.indexOf('BTN');
  const buttonSeat = btnIndex >= 0 ? btnIndex : 0;

  const rules = createGameRulesSnapshot({
    source: { kind: 'direct' },
    setup: { seatedPlayers: tableSize },
    definition: {
      schemaVersion: 'game-rules-definition/v2',
      variant: 'no_limit_texas_holdem',
      format: 'cash',
      tableSize: { minimumSeated: 2, maximumSeated: 10 },
      blinds: { smallBlindMilliBb: 500, bigBlindMilliBb: 1000, chipUnitMilliBb: 100 },
      ante: { type: 'none', amountMilliBb: 0 },
      straddle: { type: 'none' },
      collectionPolicy: { type: 'none' },
      recordedSettlementPolicy: { type: 'source_recorded_rake', rakeModel: 'unknown' },
    },
  });

  const startingStackMilliBb = stackDepthBb * 1000;
  const players = positions.map((pos, seat) => ({
    playerId: pos === heroPosition ? 'hero' : `seat-${pos.toLowerCase()}`,
    seat,
    startingStackMilliBb,
  }));

  let state = initializeRecordedHand({
    handId: exerciseId,
    rulesSnapshot: rules,
    buttonSeat,
    players,
  });

  const usedCards = new Set<string>(heroCards);
  if (usedCards.size !== 2 || !heroCards.every((c) => HOLDEM_DECK.includes(c))) {
    throw new RangeError('Invalid hero drill cards');
  }

  const otherIds = players
    .filter((p) => p.playerId !== 'hero')
    .map((p) => p.playerId);

  state = applyChance(state, {
    type: 'deal_hole',
    cardsByPlayer: { hero: [...heroCards] },
    hiddenPlayerIds: otherIds,
  });

  const act = (type: ActionType, amountToMilliBb: number | null = null) => {
    const actorId = state.actingPlayerId;
    if (!actorId) throw new RangeError('Unexpected missing acting player while setting up drill');
    state = applyAction(state, {
      schemaVersion: POKER_ACTION_SCHEMA_VERSION,
      playerId: actorId,
      type,
      amountToMilliBb,
    });
  };

  let openerBetBb: number | null = null;

  if (target === 'preflop_rfi') {
    for (let i = 0; i < heroIdx; i += 1) {
      act('fold');
    }
  } else if (target === 'preflop_facing_open') {
    for (let i = 0; i < heroIdx; i += 1) {
      if (i === openerIdx) {
        openerBetBb = 2.5;
        act('raise', 2500);
      } else {
        act('fold');
      }
    }
  } else {
    // preflop_facing_3bet: hero opens 2.5 bb, 3-bettor raises to 8.5 bb, everyone else folds
    for (let i = 0; i < positions.length; i += 1) {
      if (i === heroIdx) {
        act('raise', 2500);
      } else if (i === openerIdx) {
        openerBetBb = 8.5;
        act('raise', 8500);
      } else {
        act('fold');
      }
    }
    // Fold action back around up to Hero
    let guard = 0;
    while (state.actingPlayerId !== 'hero' && guard < 12) {
      act('fold');
      guard += 1;
    }
  }

  if (state.actingPlayerId !== 'hero') {
    throw new RangeError(`Drill setup expected hero (${heroPosition}) to act, got ${state.actingPlayerId}`);
  }

  return { state, openerBetBb };
}

function deriveRaisePresetsBb(
  target: TrainingDrillTarget,
  state: PokerState,
): readonly number[] {
  const legal = getLegalActionSpec(state);
  const bounds = legal.raise.available
    ? { min: legal.raise.minToMilliBb! / 1000, max: legal.raise.maxToMilliBb! / 1000 }
    : null;
  if (!bounds) return [];
  const rawCandidates =
    target === 'preflop_rfi'
      ? [2.2, 2.5, 3]
      : target === 'preflop_facing_open'
        ? [7, 8, 10]
        : [20, 22, 25];
  const valid = rawCandidates
    .map((v) => roundTenth(Math.min(bounds.max, Math.max(bounds.min, v))))
    .filter((v, idx, arr) => arr.indexOf(v) === idx);
  return valid;
}

function computeBaselineMix(
  tableSize: StrategyTableSize,
  stackDepthBb: StrategyStackDepthBb,
  target: TrainingDrillTarget,
  heroPosition: string,
  handClass: string,
  raisePresetsBb: readonly number[],
): {
  readonly tier: 'estimated' | 'unavailable';
  readonly segments: readonly TrainingDrillMixSegment[];
} {
  if (tableSize !== 6) {
    return { tier: 'unavailable', segments: [] };
  }

  if (stackDepthBb !== 100) {
    const reg = querySpotBaselineRegistry(
      createStrategyContext({
        tableSize,
        stackDepthBb,
        decisionFamily: target,
        position: heroPosition,
      }),
    );
    const freq = reg.available ? reg.row?.frequencies[handClass] : undefined;
    if (freq) {
      const raisePct = Math.round(freq.raise * 100);
      const callPct = Math.round(freq.call * 100);
      const foldPct = Math.max(0, 100 - raisePct - callPct);
      const segments: TrainingDrillMixSegment[] = [];
      if (foldPct > 0) {
        segments.push({ id: 'fold', action: 'fold', labelKind: 'fold', amountBb: null, pct: foldPct, tone: 'fold' });
      }
      if (callPct > 0) {
        segments.push({ id: 'call', action: 'call', labelKind: 'call', amountBb: null, pct: callPct, tone: 'call' });
      }
      if (raisePct > 0) {
        const mainSize = raisePresetsBb[1] ?? raisePresetsBb[0] ?? 2.5;
        segments.push({ id: `raise-${mainSize}`, action: 'raise', labelKind: 'raise', amountBb: mainSize, pct: raisePct, tone: 'raise2' });
      }
      return { tier: 'estimated', segments };
    }
    return { tier: 'unavailable', segments: [] };
  }

  const familyInfo = findHandFamilyAndIndex(handClass);
  const strength = handStrengthScore(handClass);

  if (target === 'preflop_rfi') {
    const rfiCtx = createStrategyContext({
      tableSize,
      stackDepthBb,
      decisionFamily: 'preflop_rfi',
      position: heroPosition,
    });
    const cutoff = familyInfo.familyId
      ? getEstimatedBaselineCutoff(rfiCtx, familyInfo.familyId)
      : null;

    let raisePct = 50;
    if (cutoff !== null && familyInfo.index >= 0) {
      const diff = familyInfo.index - cutoff;
      if (diff <= -3) raisePct = 100;
      else if (diff === -2) raisePct = 90;
      else if (diff === -1) raisePct = 75;
      else if (diff === 0) raisePct = 55;
      else if (diff === 1) raisePct = 30;
      else if (diff === 2) raisePct = 10;
      else raisePct = 0;
    } else {
      raisePct = strength >= 21 ? 85 : strength >= 16 ? 40 : 0;
    }
    const foldPct = 100 - raisePct;
    const segments: TrainingDrillMixSegment[] = [];
    if (foldPct > 0) {
      segments.push({
        id: 'fold',
        action: 'fold',
        labelKind: 'fold',
        amountBb: null,
        pct: foldPct,
        tone: 'fold',
      });
    }
    if (raisePct > 0) {
      const mainSize = raisePresetsBb[1] ?? raisePresetsBb[0] ?? 2.5;
      segments.push({
        id: `raise-${mainSize}`,
        action: 'raise',
        labelKind: 'raise',
        amountBb: mainSize,
        pct: raisePct,
        tone: 'raise2',
      });
    }
    return { tier: 'estimated', segments };
  }

  if (target === 'preflop_facing_open') {
    const s1 = raisePresetsBb[0] ?? 7;
    const s2 = raisePresetsBb[1] ?? 8;
    const s3 = raisePresetsBb[2] ?? 10;

    if (handClass === 'AKs' || handClass === 'QQ' || handClass === 'KK' || handClass === 'AA') {
      return {
        tier: 'estimated',
        segments: [
          { id: 'call', action: 'call', labelKind: 'call', amountBb: null, pct: 40, tone: 'call' },
          { id: `raise-${s1}`, action: 'raise', labelKind: 'raise', amountBb: s1, pct: 18, tone: 'raise1' },
          { id: `raise-${s2}`, action: 'raise', labelKind: 'raise', amountBb: s2, pct: 30, tone: 'raise2' },
          { id: `raise-${s3}`, action: 'raise', labelKind: 'raise', amountBb: s3, pct: 12, tone: 'raise3' },
        ],
      };
    }

    let foldPct = 0;
    let callPct = 0;
    let raisePct = 0;
    if (strength >= 22) {
      foldPct = 0;
      callPct = 35;
      raisePct = 65;
    } else if (strength >= 18) {
      foldPct = 15;
      callPct = 55;
      raisePct = 30;
    } else if (strength >= 14.5) {
      foldPct = 45;
      callPct = 40;
      raisePct = 15;
    } else {
      foldPct = 85;
      callPct = 15;
      raisePct = 0;
    }

    const segments: TrainingDrillMixSegment[] = [];
    if (foldPct > 0) {
      segments.push({ id: 'fold', action: 'fold', labelKind: 'fold', amountBb: null, pct: foldPct, tone: 'fold' });
    }
    if (callPct > 0) {
      segments.push({ id: 'call', action: 'call', labelKind: 'call', amountBb: null, pct: callPct, tone: 'call' });
    }
    if (raisePct > 0) {
      const rLow = Math.round(raisePct * 0.35);
      const rMid = raisePct - rLow;
      if (rLow > 0) {
        segments.push({ id: `raise-${s1}`, action: 'raise', labelKind: 'raise', amountBb: s1, pct: rLow, tone: 'raise1' });
      }
      if (rMid > 0) {
        segments.push({ id: `raise-${s2}`, action: 'raise', labelKind: 'raise', amountBb: s2, pct: rMid, tone: 'raise2' });
      }
    }
    return { tier: 'estimated', segments };
  }

  // preflop_facing_3bet
  const fourBetSize = raisePresetsBb[1] ?? raisePresetsBb[0] ?? 22;
  let foldPct = 0;
  let callPct = 0;
  let raisePct = 0;
  if (strength >= 25) {
    foldPct = 0;
    callPct = 30;
    raisePct = 70;
  } else if (strength >= 20.5) {
    foldPct = 15;
    callPct = 60;
    raisePct = 25;
  } else if (strength >= 17) {
    foldPct = 55;
    callPct = 35;
    raisePct = 10;
  } else {
    foldPct = 90;
    callPct = 10;
    raisePct = 0;
  }
  const segments: TrainingDrillMixSegment[] = [];
  if (foldPct > 0) segments.push({ id: 'fold', action: 'fold', labelKind: 'fold', amountBb: null, pct: foldPct, tone: 'fold' });
  if (callPct > 0) segments.push({ id: 'call', action: 'call', labelKind: 'call', amountBb: null, pct: callPct, tone: 'call' });
  if (raisePct > 0) {
    segments.push({ id: `raise-${fourBetSize}`, action: 'raise', labelKind: 'raise', amountBb: fourBetSize, pct: raisePct, tone: 'raise2' });
  }
  return { tier: 'estimated', segments };
}

export function generateTrainingDrill(
  request: TrainingDrillRequest = {},
): TrainingDrillExercise {
  const seed = Number.isInteger(request.seed) ? (request.seed as number) : 42;
  const tableSize: StrategyTableSize = request.tableSize === 8 ? 8 : 6;
  const stackDepthBb: StrategyStackDepthBb =
    request.stackDepthBb === 30 ||
    request.stackDepthBb === 40 ||
    request.stackDepthBb === 50 ||
    request.stackDepthBb === 60 ||
    request.stackDepthBb === 100
      ? request.stackDepthBb
      : 100;

  const rand = mulberry32(seed);
  const spot = pickSeededSpot(request, tableSize, stackDepthBb, rand);
  const heroCards = pickRandomCardsForHandClass(spot.handClass, rand);
  const handClass = preflopHandClassForCards(heroCards);
  const exerciseId = `drill-${seed}-${tableSize}m-${stackDepthBb}bb-${spot.target}-${spot.heroPosition}-${handClass}`;

  const { state, openerBetBb } = buildPreflopState(
    tableSize,
    stackDepthBb,
    spot.target,
    spot.heroPosition,
    spot.openerPosition,
    heroCards,
    exerciseId,
  );

  const legalSpec = getLegalActionSpec(state);
  const callEconomics = deriveActorCallEconomics(state, 'hero');
  const toCallBb = roundTenth(callEconomics.callCommitmentMilliBb / 1000);
  const potBeforeActionBb = roundTenth(state.potMilliBb / 1000);
  const potAfterCallBb = roundTenth(callEconomics.actorContestablePotAfterCallMilliBb / 1000);
  const requiredEquityPct =
    callEconomics.requiredRawEquity !== null
      ? roundTenth(callEconomics.requiredRawEquity * 100)
      : 0;
  const raisePresetsBb = deriveRaisePresetsBb(spot.target, state);
  const baseline = computeBaselineMix(
    tableSize,
    stackDepthBb,
    spot.target,
    spot.heroPosition,
    handClass,
    raisePresetsBb,
  );
  const strategyContext = createStrategyContext({
    tableSize,
    stackDepthBb,
    decisionFamily: spot.target,
    position: spot.heroPosition,
    openerPosition: spot.openerPosition,
  });

  return deepFreeze({
    exerciseId,
    seed,
    tableSize,
    stackDepthBb,
    decisionFamily: spot.target,
    heroPosition: spot.heroPosition,
    openerPosition: spot.openerPosition,
    openerBetBb,
    playersBehind: playersBehindForPosition(tableSize, spot.heroPosition),
    heroCards,
    handClass,
    familyId: spot.familyId,
    pokerState: state,
    legalSpec,
    callEconomics,
    toCallBb,
    potBeforeActionBb,
    potAfterCallBb,
    requiredEquityPct,
    raisePresetsBb,
    baselineMix: baseline.segments,
    baselineTier: baseline.tier,
    strategyContext,
    reasonKind: spot.reasonKind,
  });
}
