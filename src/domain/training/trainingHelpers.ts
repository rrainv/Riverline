import {
  HOLDEM_DECK,
  type EngineClient,
  type EngineResponse,
  type LegalActionSpec,
  type PokerState,
} from '../../engine-api';
import type { RecordedActionMeta } from '../storage';
import type { DuelPresetOption } from './types';

const DUEL_POT_PERCENT_PRESETS: readonly { readonly id: string; readonly pct: number; readonly label: string }[] = [
  { id: 'p33', pct: 0.33, label: '33%' },
  { id: 'p50', pct: 0.5, label: '50%' },
  { id: 'p75', pct: 0.75, label: '75%' },
  { id: 'p100', pct: 1, label: '100%' },
];

export function must<T>(res: EngineResponse<T>): T {
  if (!res.ok) throw new Error(res.error.message);
  return res.data;
}

export function nextId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function roundTenth(n: number): number {
  return Math.round(n * 10) / 10;
}

export function snapHalfBb(bb: number, minBb: number, maxBb: number): number {
  const stepped = Math.round(bb * 2) / 2;
  return roundTenth(Math.max(minBb, Math.min(maxBb, stepped)));
}

export function seededShuffleDeck(seed: number): string[] {
  const deck = [...HOLDEM_DECK];
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    const tmp = deck[i]!;
    deck[i] = deck[j]!;
    deck[j] = tmp;
  }
  return deck;
}

export function formatShorthandForDuel(state: PokerState): string {
  return state.actionHistory
    .map((act) => {
      const sub = act.submittedAction;
      if (sub.type === 'fold') return 'f';
      if (sub.type === 'check') return 'x';
      if (sub.type === 'call') return 'c';
      const bb = sub.amountToMilliBb !== null ? roundTenth(sub.amountToMilliBb / 1000) : 0;
      return `${sub.type === 'bet' ? 'b' : 'r'}${bb}`;
    })
    .join(' ');
}

export function toRecordedActions(state: PokerState, buttonSeat: number): RecordedActionMeta[] {
  return state.actionHistory.map((act, idx) => {
    const sub = act.submittedAction;
    const player = state.players.find((p) => p.playerId === act.playerId);
    const seat = player?.seat ?? 0;
    const isHero = act.playerId === 'hero';
    return {
      seq: idx + 1,
      street: act.street,
      playerId: act.playerId,
      seatIndex: seat,
      positionLabel: seat === buttonSeat ? 'BTN' : 'BB',
      isHero,
      type: sub.type,
      ...(sub.amountToMilliBb !== null ? { amountMilliBb: sub.amountToMilliBb } : {}),
    };
  });
}

export function computeCallCommitBb(state: PokerState, playerId: string): number {
  const player = state.players.find((p) => p.playerId === playerId);
  if (!player) return 0;
  const commitMilli = Math.min(
    player.currentStackMilliBb,
    Math.max(0, state.currentBetMilliBb - player.streetContributionMilliBb),
  );
  return roundTenth(commitMilli / 1000);
}

export function buildDuelSizePresets(
  engine: EngineClient,
  state: PokerState,
  legalSpec: LegalActionSpec | null,
  customAmounts: Readonly<Record<string, number>> = {},
): readonly DuelPresetOption[] {
  if (!legalSpec) return [];
  const wagerSpec = legalSpec.bet.available
    ? legalSpec.bet
    : legalSpec.raise.available
      ? legalSpec.raise
      : null;
  if (!wagerSpec || wagerSpec.minToMilliBb === null || wagerSpec.maxToMilliBb === null) {
    return [];
  }

  const minBb = roundTenth(wagerSpec.minToMilliBb / 1000);
  const maxBb = roundTenth(wagerSpec.maxToMilliBb / 1000);
  const hero = state.players.find((p) => p.playerId === 'hero')!;
  const astra = state.players.find((p) => p.playerId === 'astra')!;
  const potBb = roundTenth(state.potMilliBb / 1000);
  const callDiffBb = Math.max(0, roundTenth((state.currentBetMilliBb - hero.streetContributionMilliBb) / 1000));
  const potAfterCallBb = roundTenth(potBb + callDiffBb);
  const effectiveStackBeforeWagerBb = roundTenth(
    Math.min(
      hero.currentStackMilliBb / 1000 - callDiffBb,
      astra.currentStackMilliBb / 1000,
    ) + callDiffBb,
  );

  const computeCostFacts = (amountToBb: number) => {
    const astraNeedsBb = Math.max(
      0,
      roundTenth(
        Math.min(
          astra.currentStackMilliBb / 1000,
          amountToBb - astra.streetContributionMilliBb / 1000,
        ),
      ),
    );
    const potBeforeCallBb = roundTenth(
      potBb + Math.max(0, amountToBb - hero.streetContributionMilliBb / 1000),
    );
    if (legalSpec.bet.available && effectiveStackBeforeWagerBb >= amountToBb) {
      const res = engine.sync.duelCallFacts(potBb, amountToBb, effectiveStackBeforeWagerBb);
      if (res.ok) {
        return {
          callBb: roundTenth(amountToBb),
          potIfCalledBb: roundTenth(res.data.calledPotBb),
          behindBb: roundTenth(res.data.effectiveStackBehindBb),
          spr: Math.round(res.data.spr * 100) / 100,
          oddsPct: roundTenth(res.data.callerPotOddsPercent),
        };
      }
    }
    const oddsRes = engine.sync.potOddsFromPotBeforeCall(
      Math.round(astraNeedsBb * 1000),
      Math.round(potBeforeCallBb * 1000),
    );
    const sizeRes = engine.sync.actionSizeFacts(state, 'hero', Math.round(amountToBb * 1000));
    const potIfCalledBb = roundTenth(potBeforeCallBb + astraNeedsBb);
    const behindBb = Math.max(
      0,
      roundTenth(
        Math.min(
          hero.currentStackMilliBb / 1000 - Math.max(0, amountToBb - hero.streetContributionMilliBb / 1000),
          astra.currentStackMilliBb / 1000 - astraNeedsBb,
        ),
      ),
    );
    return {
      callBb: astraNeedsBb,
      potIfCalledBb,
      behindBb,
      spr:
        sizeRes.ok && sizeRes.data.sprAfterCalled !== null
          ? Math.round(sizeRes.data.sprAfterCalled * 100) / 100
          : potIfCalledBb > 0
            ? Math.round((behindBb / potIfCalledBb) * 100) / 100
            : 0,
      oddsPct: oddsRes.ok ? roundTenth(oddsRes.data.requiredPercent) : 0,
    };
  };

  const options: DuelPresetOption[] = [];
  for (const preset of DUEL_POT_PERCENT_PRESETS) {
    const rawTarget =
      state.street === 'preflop' && state.currentBetMilliBb <= state.game.bigBlindMilliBb
        ? preset.pct <= 0.33
          ? 2.2
          : preset.pct <= 0.5
            ? 2.5
            : preset.pct <= 0.75
              ? 3
              : 4
        : state.currentBetMilliBb / 1000 + callDiffBb + potAfterCallBb * preset.pct;
    const defaultBb = snapHalfBb(rawTarget, minBb, maxBb);
    const amountBb =
      customAmounts[preset.id] !== undefined
        ? roundTenth(Math.max(minBb, Math.min(maxBb, customAmounts[preset.id]!)))
        : defaultBb;
    options.push({
      id: preset.id,
      pctLabel: state.street === 'preflop' && state.currentBetMilliBb <= state.game.bigBlindMilliBb
        ? `${amountBb} bb`
        : preset.label,
      amountBb,
      adjustable: true,
      costLineValues: computeCostFacts(amountBb),
    });
  }

  const allInBb =
    legalSpec.allIn.available && legalSpec.allIn.amountToMilliBb !== null
      ? roundTenth(legalSpec.allIn.amountToMilliBb / 1000)
      : maxBb;

  options.push({
    id: 'allin',
    labelKey: 'training.duel.allIn',
    amountBb: allInBb,
    adjustable: false,
    costLineValues: computeCostFacts(allInBb),
  });

  return options;
}

