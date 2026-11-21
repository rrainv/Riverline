import { useEffect, useRef, useState } from 'preact/hooks';
import { REPLAY_FRAME_OPERATIONS, type HandCategory } from '../../../engine-api';
import {
  askBeforeVerdictSignal,
  minimalCardsSignal,
  motionSignal,
  shortcutsSignal,
  teacherVoiceSignal,
} from '../../../domain/appearance';
import { getSharedHandRecorderStore } from '../../../domain/hand';
import type {
  CounterfactualRangeId,
  ReplayFrameMeta,
  ReviewStore,
} from '../../../domain/review';
import { navigateTo } from '../../../domain/shellState';
import type { EquityStreet, SavedObjectTagId, ThinkingReasonId } from '../../../domain/storage';
import { formatLocaleFixed, formatNumber, formatPercent, t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { Chip, Kbd, type TierBadgeProps } from '../../kit/chip/Chip';
import { ChipButton, SegmentedControl, type SegmentOption } from '../../kit/choice/Choice';
import { EquityList, EquityRow } from '../../kit/equity-row/EquityRow';
import { FactTile, FactTileRow } from '../../kit/fact-tile/FactTile';
import {
  FeltTable,
  type SeatEmblem,
  type TableCardSpec,
  type TableSeat,
} from '../../kit/felt-table/FeltTable';
import {
  HistoryRail,
  StreetStrip,
  type HistoryStreetGroup,
  type StreetStripItem,
} from '../../kit/history-rail/HistoryRail';
import { TextField } from '../../kit/input/TextField';
import { TeacherCallout, type LampMood } from '../../kit/lamp/Lamp';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import { PlayingCard } from '../../kit/playing-card/PlayingCard';
import { cx } from '../../kit/state';
import { formatCardGlyph, formatCategoryLabel } from '../equity/equityFormatters';
import { InlineEquityDrawer } from '../equity/InlineEquityDrawer';
import { SavedLibraryView } from './SavedLibraryView';
import styles from './ReviewRoom.module.css';

interface ReviewMotionSnapshot {
  readonly recordId: string;
  readonly frameIndex: number;
  readonly board: readonly string[];
  readonly street: string;
  readonly potMilliBb: number;
  readonly isSettled: boolean;
  readonly foldedIds: ReadonlySet<string>;
  readonly revealedIds: ReadonlySet<string>;
  readonly contributingSeatIds: readonly string[];
  readonly activeNonFoldedSeatIds: readonly string[];
}

interface ReviewMotionTracker {
  lastSig: string | null;
  prev: ReviewMotionSnapshot | null;
  dealHero: boolean;
  dealBoardFrom: number;
  foldedSeatIds: ReadonlySet<string>;
  revealedSeatIds: ReadonlySet<string>;
  chipTrigger: number;
  chipSeats: readonly string[];
}

export interface ReviewOpenInEquityInput {
  readonly board: readonly string[];
  readonly players: readonly {
    readonly label: string;
    readonly rawInput: string;
    readonly isHero: boolean;
  }[];
  readonly potBeforeBetBb?: number;
  readonly betToCallBb?: number;
  readonly remainingStackBb?: number;
}

export interface ReviewDrillDecisionInput {
  readonly position: string;
  readonly heroCards: readonly [string, string];
}

export interface ReviewRoomProps {
  readonly store: ReviewStore;
  readonly onOpenInEquity?: (input: ReviewOpenInEquityInput) => void;
  readonly onDrillDecision?: (input: ReviewDrillDecisionInput) => void;
}

const SEAT_EMBLEMS: readonly SeatEmblem[] = ['wave', 'bars', 'prism', 'orbits', 'arc', 'grid', 'pie', 'eye'];
const THINKING_REASONS: readonly ThinkingReasonId[] = [
  'stealing',
  'value',
  'draw',
  'pot_committed',
  'bluff_catch',
];
const HAND_TAGS: readonly SavedObjectTagId[] = ['review_later', 'unsure', 'study'];
const STREET_ORDER: readonly EquityStreet[] = ['preflop', 'flop', 'turn', 'river'];

function formatAmount(valueBb: number, unit: 'bb' | '₪'): string {
  const num = formatNumber(valueBb, { maximumFractionDigits: 1 });
  return unit === '₪' ? `₪${num}` : `${num} bb`;
}

function formatSignedAmount(valueBb: number, unit: 'bb' | '₪'): string {
  const abs = formatNumber(Math.abs(valueBb), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const sign = valueBb > 0 ? '+' : valueBb < 0 ? '-' : '';
  return unit === '₪' ? `${sign}₪${abs}` : `${sign}${abs} bb`;
}

function formatStreetName(street: EquityStreet): string {
  switch (street) {
    case 'preflop':
      return t('recorder.street.preflop');
    case 'flop':
      return t('recorder.street.flop');
    case 'turn':
      return t('recorder.street.turn');
    case 'river':
      return t('recorder.street.river');
  }
}

function formatActionWord(actionType: string): string {
  switch (actionType) {
    case 'fold':
      return t('recorder.tickets.fold');
    case 'check':
      return t('recorder.tickets.check');
    case 'call':
      return t('recorder.tickets.call');
    case 'bet':
      return t('recorder.tickets.bet');
    case 'raise':
      return t('recorder.tickets.raise');
    case 'all_in':
      return t('recorder.tickets.allIn');
    default:
      return actionType;
  }
}

function formatFrameLabel(
  frame: ReplayFrameMeta,
  unit: 'bb' | '₪',
  heroCards?: readonly string[],
  revealedCardsById?: Readonly<Record<string, readonly string[]>>,
): string {
  switch (frame.operation) {
    case REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND:
      return t('review.replay.frameInit');
    case REPLAY_FRAME_OPERATIONS.DEAL_HOLE:
    case REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED:
      return t('review.replay.frameDealHole', {
        cards: heroCards ? heroCards.join(' ') : '',
      });
    case REPLAY_FRAME_OPERATIONS.DEAL_BOARD:
      return t('review.replay.frameBoard', {
        street: formatStreetName(frame.street),
        cards: frame.boardAdded ? frame.boardAdded.join(' ') : '',
      });
    case REPLAY_FRAME_OPERATIONS.REVEAL_HOLE: {
      const revealed = frame.revealedPlayerId
        ? revealedCardsById?.[frame.revealedPlayerId]
        : undefined;
      return t('review.replay.frameReveal', {
        position: frame.positionLabel ?? frame.revealedPlayerId ?? '',
        cards: revealed ? revealed.join(' ') : '',
      });
    }
    case REPLAY_FRAME_OPERATIONS.SHOWDOWN:
    case REPLAY_FRAME_OPERATIONS.RECORDED_SETTLEMENT:
      return t('review.replay.frameShowdown');
    default: {
      const pos = frame.positionLabel ?? frame.playerId ?? '';
      const act = formatActionWord(frame.actionType ?? frame.operation);
      if (
        frame.amountMilliBb !== undefined &&
        frame.actionType !== 'fold' &&
        frame.actionType !== 'check'
      ) {
        return t('review.replay.frameActionAmount', {
          position: pos,
          action: act,
          amount: formatAmount(frame.amountMilliBb / 1000, unit),
        });
      }
      return t('review.replay.frameAction', { position: pos, action: act });
    }
  }
}

function formatCounterfactualLabel(mode: CounterfactualRangeId): string {
  switch (mode) {
    case 'showed':
      return t('review.decision.rangeShowed');
    case 'tight':
      return t('review.decision.rangeTight');
    case 'standard':
      return t('review.decision.rangeStandard');
    case 'loose':
      return t('review.decision.rangeLoose');
  }
}

/**
 * Hand review room (`/review`): frame replay, equity-vs-price decisions, counterfactual villain
 * ranges, Decisions vs luck separation, and the unified local Saved library.
 */
export function ReviewRoom({ store, onOpenInEquity, onDrillDecision }: ReviewRoomProps) {
  const activeTab = store.activeSideTabSignal.value;
  const record = store.activeRecordSignal.value;
  const snap = store.replaySnapshotSignal.value;
  const frameIndex = store.frameIndexSignal.value;
  const frameMeta = store.currentFrameMetaSignal.value;
  const pokerState = store.currentPokerStateSignal.value;
  const currentDecision = store.currentDecisionSignal.value;
  const selectedDecisionIdx = store.selectedDecisionIndexSignal.value;
  const counterfactualMode = store.counterfactualRangeSignal.value;
  const feltExpanded = store.feltExpandedSignal.value;
  const evalData = store.decisionEvaluationSignal.value;
  const luck = store.decisionsVsLuckSignal.value;
  const [whatIfOpen, setWhatIfOpen] = useState(false);
  const [whatIfFraction, setWhatIfFraction] = useState<0.5 | 0.67 | 1>(0.67);
  const activeNote = store.activeHeroNoteSignal.value;
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [equityOverlayOpen, setEquityOverlayOpen] = useState(false);
  const motionRef = useRef<ReviewMotionTracker>({
    lastSig: null,
    prev: null,
    dealHero: false,
    dealBoardFrom: 0,
    foldedSeatIds: new Set<string>(),
    revealedSeatIds: new Set<string>(),
    chipTrigger: 0,
    chipSeats: [],
  });

  const allowCardMotion = motionSignal.value !== 'reduced' && !minimalCardsSignal.value;
  const shortcuts = shortcutsSignal.value;
  const isGentleVoice = teacherVoiceSignal.value === 'gentle';
  const askBeforeVerdict = askBeforeVerdictSignal.value;

  useEffect(() => {
    if (activeTab !== 'review') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (document.querySelector('[role="dialog"]')) return;
      const lower = event.key.toLowerCase();
      if (lower === 'j' || event.key === 'ArrowRight') {
        if (snap.decisions.length > 0 && selectedDecisionIdx < snap.decisions.length - 1) {
          event.preventDefault();
          store.selectDecision(selectedDecisionIdx + 1);
        } else if (frameIndex < snap.frames.length - 1) {
          event.preventDefault();
          store.stepFrame(1);
        }
      } else if (lower === 'k' || event.key === 'ArrowLeft') {
        if (snap.decisions.length > 0 && selectedDecisionIdx > 0) {
          event.preventDefault();
          store.selectDecision(selectedDecisionIdx - 1);
        } else if (frameIndex > 0) {
          event.preventDefault();
          store.stepFrame(-1);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, store, snap.decisions.length, snap.frames.length, selectedDecisionIdx, frameIndex]);

  const unit = record.payload.unitLabel;

  if (activeTab === 'saved') {
    return (
      <section className={styles.room} aria-label={t('savedLibrary.heading')}>
        <header className={styles.roomHeader}>
          <div className={styles.headingGroup}>
            <h1 className={styles.roomTitle}>{t('savedLibrary.heading')}</h1>
            <p className={styles.roomSubtitle}>{t('savedLibrary.subtitle')}</p>
          </div>
          <div className={styles.headerControls}>
            <Button variant="secondary" onClick={() => store.setActiveSideTab('review')}>
              {t('review.side.review')}
            </Button>
          </div>
        </header>

        <SavedLibraryView store={store} onOpenInEquity={onOpenInEquity} />
      </section>
    );
  }

  // Horizontal street strip from canonical street summaries
  const streetItems: StreetStripItem[] = snap.streetSummaries.map((stSummary) => {
    const potText = formatAmount(stSummary.potMilliBb / 1000, unit);
    const sprText =
      stSummary.spr === null
        ? '-'
        : formatNumber(stSummary.spr, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          });
    const lastOnStreet = [...snap.frames]
      .reverse()
      .find((f) => f.street === stSummary.street && f.actionSeq !== undefined);
    const resultNode = lastOnStreet ? (
      <PokerNotation>{formatFrameLabel(lastOnStreet, unit)}</PokerNotation>
    ) : stSummary.available ? (
      formatStreetName(stSummary.street)
    ) : (
      '-'
    );

    return {
      id: stSummary.street,
      streetLabel: formatStreetName(stSummary.street),
      cards: stSummary.boardCards.length > 0 ? [...stSummary.boardCards] : undefined,
      result: resultNode,
      pot: potText,
      spr: sprText,
      disabled: !stSummary.available,
    };
  });

  // History rail grouped by street from replay frames
  const historyGroups: HistoryStreetGroup[] = [];
  for (const st of STREET_ORDER) {
    const rowsForStreet = snap.frames.filter(
      (f) => f.street === st && f.actionSeq !== undefined,
    );
    if (rowsForStreet.length === 0) continue;
    const summary = snap.streetSummaries.find((s) => s.street === st);
    historyGroups.push({
      id: st,
      streetLabel: formatStreetName(st),
      potLabel: summary && summary.available
        ? formatAmount(summary.potMilliBb / 1000, unit)
        : undefined,
      rows: rowsForStreet.map((f) => {
        const verb = formatActionWord(f.actionType ?? f.operation);
        const amtText =
          f.amountMilliBb !== undefined &&
          f.actionType !== 'fold' &&
          f.actionType !== 'check'
            ? ` ${f.approximate ? '~' : ''}${formatAmount(f.amountMilliBb / 1000, unit)}`
            : '';
        return {
          id: `frame-${f.index}`,
          actor: f.positionLabel ?? f.playerId ?? '',
          isHero: Boolean(f.isHero),
          action: <PokerNotation>{`${verb}${amtText}`}</PokerNotation>,
          tag: f.isDecisionFrame
            ? `D${(snap.decisions.find((d) => d.actionFrameIndex === f.index)?.decisionIndex ?? 0) + 1}`
            : undefined,
        };
      }),
    });
  }

  // Optional FeltTable mapped directly from projected replay PokerState (no leakage before reveal)
  const winningCardSet = new Set<string>();
  if (pokerState.showdown.handRanksByPlayer) {
    for (const wId of pokerState.terminal.winnerPlayerIds) {
      const rank = pokerState.showdown.handRanksByPlayer[wId];
      if (rank) {
        for (const c of rank.bestFiveCards) winningCardSet.add(c);
      }
    }
  }

  const lastActionFrameByPlayer = new Map<string, ReplayFrameMeta>();
  for (let i = 0; i <= frameIndex && i < snap.frames.length; i += 1) {
    const f = snap.frames[i]!;
    if (f.playerId && f.actionSeq !== undefined && f.street === pokerState.street) {
      lastActionFrameByPlayer.set(f.playerId, f);
    }
  }

  const curFoldedIds = new Set(pokerState.players.filter((p) => p.folded).map((p) => p.playerId));
  const curRevealedIds = new Set(
    pokerState.players
      .filter(
        (p) =>
          p.playerId !== record.payload.heroPlayerId &&
          !p.folded &&
          Array.isArray(p.holeCards),
      )
      .map((p) => p.playerId),
  );
  const curContributingSeats = pokerState.players
    .filter((p) => p.streetContributionMilliBb > 0)
    .map((p) => p.playerId);
  const curActiveSeats = pokerState.players
    .filter((p) => !p.folded)
    .map((p) => p.playerId);
  const isSettledNow = pokerState.phase === 'showdown' || pokerState.terminal.isTerminal;

  const curMotionSnapshot: ReviewMotionSnapshot = {
    recordId: record.objectId,
    frameIndex,
    board: [...pokerState.board],
    street: pokerState.street,
    potMilliBb: frameMeta.potMilliBb,
    isSettled: isSettledNow,
    foldedIds: curFoldedIds,
    revealedIds: curRevealedIds,
    contributingSeatIds: curContributingSeats,
    activeNonFoldedSeatIds: curActiveSeats,
  };

  const curMotionSig = [
    feltExpanded ? 1 : 0,
    curMotionSnapshot.recordId,
    curMotionSnapshot.frameIndex,
    curMotionSnapshot.board.join(','),
    curMotionSnapshot.street,
    curMotionSnapshot.potMilliBb,
    curMotionSnapshot.isSettled ? 1 : 0,
    [...curFoldedIds].join(','),
    [...curRevealedIds].join(','),
    curContributingSeats.join(','),
  ].join('|');

  if (!feltExpanded || !allowCardMotion) {
    motionRef.current.dealHero = false;
    motionRef.current.dealBoardFrom = curMotionSnapshot.board.length;
    motionRef.current.foldedSeatIds = new Set<string>();
    motionRef.current.revealedSeatIds = new Set<string>();
    motionRef.current.lastSig = curMotionSig;
    motionRef.current.prev = feltExpanded ? curMotionSnapshot : null;
  } else if (motionRef.current.lastSig !== curMotionSig) {
    const prev = motionRef.current.prev;
    if (!prev || prev.recordId !== curMotionSnapshot.recordId) {
      motionRef.current.dealHero = false;
      motionRef.current.dealBoardFrom = curMotionSnapshot.board.length;
      motionRef.current.foldedSeatIds = new Set<string>();
      motionRef.current.revealedSeatIds = new Set<string>();
    } else if (curMotionSnapshot.frameIndex < prev.frameIndex) {
      motionRef.current.dealHero = false;
      motionRef.current.dealBoardFrom = curMotionSnapshot.board.length;
      motionRef.current.foldedSeatIds = new Set<string>();
      motionRef.current.revealedSeatIds = new Set<string>();
    } else if (curMotionSnapshot.frameIndex > prev.frameIndex) {
      motionRef.current.dealHero =
        frameMeta.operation === REPLAY_FRAME_OPERATIONS.DEAL_HOLE ||
        frameMeta.operation === REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED;
      if (curMotionSnapshot.board.length > prev.board.length) {
        motionRef.current.dealBoardFrom = prev.board.length;
      }
      motionRef.current.foldedSeatIds = new Set(
        [...curFoldedIds].filter((id) => !prev.foldedIds.has(id)),
      );
      motionRef.current.revealedSeatIds = new Set(
        [...curRevealedIds].filter((id) => !prev.revealedIds.has(id)),
      );

      const streetChanged = prev.street !== curMotionSnapshot.street;
      const settledNow = !prev.isSettled && curMotionSnapshot.isSettled;
      if (
        (streetChanged || settledNow) &&
        (prev.contributingSeatIds.length > 0 || curMotionSnapshot.potMilliBb > prev.potMilliBb)
      ) {
        motionRef.current.chipTrigger += 1;
        motionRef.current.chipSeats =
          prev.contributingSeatIds.length > 0
            ? [...prev.contributingSeatIds]
            : [...curMotionSnapshot.activeNonFoldedSeatIds];
      }
    }
    motionRef.current.lastSig = curMotionSig;
    motionRef.current.prev = curMotionSnapshot;
  }

  const activeMotion = motionRef.current;

  const feltSeats: TableSeat[] = pokerState.players.map((p, idx) => {
    const isHero = p.playerId === record.payload.heroPlayerId;
    const isWinner =
      pokerState.terminal.isTerminal &&
      pokerState.terminal.winnerPlayerIds.includes(p.playerId);
    const lastAct = lastActionFrameByPlayer.get(p.playerId);
    let actionBubble: string | undefined;
    if (p.folded) {
      actionBubble = t('recorder.turn.folded');
    } else if (lastAct) {
      const verb = formatActionWord(lastAct.actionType ?? lastAct.operation);
      if (
        lastAct.amountMilliBb !== undefined &&
        lastAct.actionType !== 'fold' &&
        lastAct.actionType !== 'check'
      ) {
        actionBubble = `${verb} ${formatAmount(lastAct.amountMilliBb / 1000, unit)}`;
      } else {
        actionBubble = verb;
      }
    }

    let cards: TableCardSpec[] | undefined;
    if (!p.folded) {
      if (Array.isArray(p.holeCards)) {
        cards = p.holeCards.map((c) => ({
          card: c,
          state: 'face' as const,
          winning: isWinner && winningCardSet.has(c),
          motion: !allowCardMotion
            ? 'none'
            : isHero && activeMotion.dealHero
              ? 'deal'
              : !isHero && activeMotion.revealedSeatIds.has(p.playerId)
                ? 'flip'
                : 'none',
        }));
      } else if (
        p.holeCards &&
        typeof p.holeCards === 'object' &&
        'status' in p.holeCards &&
        p.holeCards.status === 'hidden'
      ) {
        cards = [{ state: 'back' as const }, { state: 'back' as const }];
      }
    } else if (allowCardMotion && activeMotion.foldedSeatIds.has(p.playerId)) {
      cards = Array.isArray(p.holeCards)
        ? p.holeCards.map((c) => ({ card: c, state: 'face' as const, motion: 'fold' as const }))
        : [
            { state: 'back' as const, motion: 'fold' as const },
            { state: 'back' as const, motion: 'fold' as const },
          ];
    }

    return {
      id: p.playerId,
      name: isHero ? `${p.position} (${t('recorder.table.heroLabel')})` : p.position,
      stack: formatAmount(p.currentStackMilliBb / 1000, unit),
      emblem: isHero ? 'hero' : SEAT_EMBLEMS[idx % SEAT_EMBLEMS.length],
      isHero,
      isDealer: p.seat === pokerState.buttonSeat,
      folded: p.folded,
      thinking: pokerState.phase === 'betting' && pokerState.actingPlayerId === p.playerId,
      actionBubble,
      bet:
        !pokerState.terminal.isTerminal && p.streetContributionMilliBb > 0
          ? formatAmount(p.streetContributionMilliBb / 1000, unit)
          : undefined,
      cards,
    };
  });

  const feltBoard: TableCardSpec[] = pokerState.board.map((c, idx) => ({
    card: c,
    state: 'face' as const,
    winning: pokerState.terminal.isTerminal && winningCardSet.has(c),
    motion: allowCardMotion && idx >= activeMotion.dealBoardFrom ? 'deal' : 'none',
  }));

  const showdownResultText =
    pokerState.terminal.isTerminal && pokerState.terminal.reason === 'showdown'
      ? pokerState.terminal.winnerPlayerIds
          .map((wId) => {
            const p = pokerState.players.find((pl) => pl.playerId === wId);
            const pos =
              p?.playerId === record.payload.heroPlayerId
                ? t('recorder.table.heroLabel')
                : p?.position ?? wId;
            const cat = pokerState.showdown.handRanksByPlayer?.[wId]?.category;
            return cat ? `${pos} (${formatCategoryLabel(cat as HandCategory)})` : pos;
          })
          .join(', ')
      : undefined;

  const currentStreetSummary = snap.streetSummaries.find((s) => s.street === frameMeta.street);
  const currentPotText = formatAmount(frameMeta.potMilliBb / 1000, unit);
  const hasAnyHiddenVillainNow = pokerState.players.some(
    (p) =>
      p.playerId !== record.payload.heroPlayerId &&
      !p.folded &&
      !Array.isArray(p.holeCards),
  );

  // Decision panel tier & honesty copy
  const decisionTier: TierBadgeProps =
    evalData.tier === 'exact'
      ? {
          tier: 'exact',
          detail: t('review.decision.tierKnownDetail', {
            trials: formatNumber(evalData.trials ?? 0),
          }),
        }
      : evalData.tier === 'estimated'
        ? {
            tier: 'estimated',
            detail:
              evalData.detailKey === 'showdown_sampled'
                ? t('review.decision.tierSampledDetail', {
                    trials: formatNumber(evalData.trials ?? 0),
                  })
                : evalData.rangeSampled
                  ? t('review.decision.tierAssumptionSampledDetail', {
                      trials: formatNumber(evalData.trials ?? 0),
                    })
                  : t('review.decision.tierAssumptionDetail'),
          }
        : { tier: 'unavailable', detail: t('review.decision.tierUnavailableDetail') };

  const counterfactualOptions: SegmentOption<CounterfactualRangeId>[] = [
    { value: 'showed', label: t('review.decision.rangeShowed') },
    { value: 'tight', label: t('review.decision.rangeTight') },
    { value: 'standard', label: t('review.decision.rangeStandard') },
    { value: 'loose', label: t('review.decision.rangeLoose') },
  ];

  const rangeLabelText = formatCounterfactualLabel(counterfactualMode);
  const heroHadPctText =
    evalData.heroEquityPct !== null ? formatPercent(evalData.heroEquityPct / 100, 1) : '-';
  const neededPctText =
    evalData.requiredEquityPct !== null
      ? formatPercent(evalData.requiredEquityPct / 100, 1)
      : '-';
  const heroHadPlainText =
    evalData.heroEquityPct !== null ? formatLocaleFixed(evalData.heroEquityPct, 1) : '-';
  const neededPlainText =
    evalData.requiredEquityPct !== null ? formatLocaleFixed(evalData.requiredEquityPct, 1) : '-';

  const hasThinkingNote = Boolean(
    activeNote?.reasonChip || (activeNote?.customText ?? '').trim(),
  );
  const verdictGated =
    askBeforeVerdict &&
    Boolean(currentDecision) &&
    !hasThinkingNote &&
    evalData.heroEquityPct !== null;

  let coachHeading: string | undefined;
  let coachText = t('review.decision.unavailableBody');
  let coachMood: LampMood = 'idle';

  if (evalData.isLoading) {
    coachMood = 'thinking';
  } else if (verdictGated) {
    coachHeading = t('review.teacher.heading');
    coachText = t('review.decision.thinkingHeading');
    coachMood = 'curious';
  } else if (evalData.isMathMistake && evalData.villainRevealedCards) {
    coachHeading = t('review.decision.mistakeTitle');
    coachText = isGentleVoice
      ? t('review.verdict.gentleMistake', {
          needed: neededPlainText,
          equity: heroHadPlainText,
        })
      : t('review.decision.mistakeBody', {
          needed: neededPctText,
          had: heroHadPctText,
          cards: evalData.villainRevealedCards.map(formatCardGlyph).join(' '),
        });
    coachMood = isGentleVoice ? 'curious' : 'stern';
  } else if (evalData.tier === 'estimated' && evalData.detailKey === 'showdown_sampled') {
    coachText = t('review.decision.sampledKnownBody', {
      had: heroHadPctText,
      cards: (evalData.villainRevealedCards ?? []).map(formatCardGlyph).join(' '),
      trials: formatNumber(evalData.trials ?? 0),
    });
    coachMood = 'speaking';
  } else if (evalData.tier === 'estimated') {
    coachText = t('review.decision.counterfactualBody', {
      range: rangeLabelText,
      had: heroHadPctText,
    });
    coachMood = 'speaking';
  } else if (evalData.tier === 'exact' && evalData.heroEquityPct !== null) {
    if (evalData.requiredEquityPct === null) {
      coachText = t('review.decision.exactOpenBody', {
        had: heroHadPctText,
        cards: (evalData.villainRevealedCards ?? []).map(formatCardGlyph).join(' '),
      });
      coachMood = 'speaking';
    } else if (isGentleVoice && evalData.heroEquityPct >= evalData.requiredEquityPct) {
      coachText = t('review.verdict.gentleWithin', {
        equity: heroHadPlainText,
        needed: neededPlainText,
      });
      coachMood =
        evalData.heroEquityPct >= evalData.requiredEquityPct + 15 ? 'celebrating' : 'approving';
    } else {
      coachText = t('review.decision.goodCallBody', {
        needed: neededPctText,
        had: heroHadPctText,
      });
      coachMood =
        evalData.heroEquityPct >= evalData.requiredEquityPct + 15
          ? 'celebrating'
          : evalData.heroEquityPct >= evalData.requiredEquityPct
            ? 'approving'
            : 'speaking';
    }
  }

  if (!verdictGated && !evalData.isLoading && activeNote?.reasonChip && evalData.heroEquityPct !== null) {
    if (activeNote.reasonChip === 'bluff_catch' && evalData.heroEquityPct >= 60) {
      coachText = `${coachText} ${t('review.decision.noteCheckAhead', {
        reason: t('recorder.thinking.bluff_catch'),
        had: heroHadPctText,
      })}`;
    } else if (activeNote.reasonChip === 'value' && evalData.heroEquityPct < 45) {
      coachText = `${coachText} ${t('review.decision.noteCheckBehind', {
        reason: t('recorder.thinking.value'),
        had: heroHadPctText,
      })}`;
    }
  }

  // Decisions vs luck tier, prior invested reference & decomposition bars
  const luckTier: TierBadgeProps = !luck.isAvailable
    ? { tier: 'unavailable' }
    : luck.tier === 'estimated'
      ? {
          tier: 'estimated',
          detail: t('review.luck.tierSampledDetail', {
            trials: formatNumber(luck.trials ?? 0),
          }),
        }
      : { tier: 'exact', detail: t('review.luck.tierDetail') };

  const decisiveDecision =
    [...snap.decisions].reverse().find((d) => d.facingBet) ??
    snap.decisions[snap.decisions.length - 1] ??
    null;
  const priorInvestedBb = decisiveDecision
    ? decisiveDecision.heroInvestedBeforeDecisionMilliBb / 1000
    : 0;

  const decompScaleMax =
    luck.isAvailable &&
    luck.handEvBb !== null &&
    luck.runoutLuckBb !== null &&
    luck.actualNetBb !== null
      ? Math.max(
          Math.abs(luck.handEvBb),
          Math.abs(luck.runoutLuckBb),
          Math.abs(luck.actualNetBb),
          1,
        )
      : 1;

  return (
    <section className={styles.room} aria-label={t('review.title')}>
      <Panel>
        <div className={styles.summaryBar}>
          <div className={styles.summaryLeft}>
            <div className={styles.heroCards} dir="ltr">
              {record.payload.heroCards.map((cardCode) => (
                <PlayingCard key={cardCode} card={cardCode} size="small" />
              ))}
            </div>
            <div className={styles.summaryText}>
              <div className={styles.summaryEyebrowRow}>
                <h1 className={styles.summaryTitle}>{t('review.title')}</h1>
                {snap.isStarterSample && <Chip>{t('review.starterBadge')}</Chip>}
              </div>
              <p className={styles.summaryFact}>
                <PokerNotation>{record.factTitle}</PokerNotation>
              </p>
            </div>
          </div>

          <div className={styles.summaryRight}>
            <div className={styles.headerControls}>
              {HAND_TAGS.map((tagId) => (
                <ChipButton
                  key={tagId}
                  selected={record.tags.includes(tagId)}
                  onToggle={() => {
                    void store.toggleActiveHandTag(tagId);
                  }}
                >
                  {t(`review.tags.${tagId}`)}
                </ChipButton>
              ))}
              {!snap.isStarterSample && (
                <Button variant="secondary" onClick={() => store.openStarterFridayHand()}>
                  {t('review.actions.loadExample')}
                </Button>
              )}
              <Button variant="secondary" onClick={() => store.setActiveSideTab('saved')}>
                {t('review.actions.openLibrary')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  getSharedHandRecorderStore().loadSavedHand(record);
                  navigateTo('hand');
                }}
              >
                {t('review.actions.editInRecorder')}
              </Button>
            </div>

            {luck.isAvailable && luck.actualNetBb !== null && (
              <div className={styles.totalReadout}>
                <span className={styles.microLabel}>{t('review.summary.totalLabel')}</span>
                <strong
                  className={cx(
                    styles.totalValue,
                    luck.actualNetBb < 0
                      ? styles.totalNegative
                      : luck.actualNetBb > 0
                        ? styles.totalPositive
                        : undefined,
                  )}
                >
                  <PokerNotation>{formatSignedAmount(luck.actualNetBb, luck.unitLabel)}</PokerNotation>
                </strong>
              </div>
            )}
          </div>
        </div>
      </Panel>

      <div className={styles.mainGrid}>
        <div className={styles.column}>
          <Panel label={t('review.decisions.heading')}>
            {snap.decisions.length === 0 ? (
              <p className={styles.honestyNote}>{t('review.replay.noDecisions')}</p>
            ) : (
              <div className={styles.decisionList}>
                {snap.decisions.map((dec) => {
                  const isSel = selectedDecisionIdx === dec.decisionIndex;
                  const actWord = formatActionWord(dec.actionMeta.type);
                  const amtText =
                    dec.actionMeta.amountMilliBb !== undefined &&
                    dec.actionMeta.type !== 'fold' &&
                    dec.actionMeta.type !== 'check'
                      ? ` ${formatAmount(dec.actionMeta.amountMilliBb / 1000, unit)}`
                      : '';
                  const isSelectedMistake = isSel && !verdictGated && evalData.isMathMistake;
                  return (
                    <button
                      key={dec.decisionIndex}
                      type="button"
                      className={cx(styles.decisionRow, isSel && styles.decisionRowActive)}
                      aria-current={isSel ? 'step' : undefined}
                      onClick={() => store.selectDecision(dec.decisionIndex)}
                    >
                      <span className={styles.decisionIndex}>{dec.decisionIndex + 1}</span>
                      <span className={styles.decisionText}>
                        <span className={styles.decisionAction}>
                          <PokerNotation>{`${actWord}${amtText}`}</PokerNotation>
                        </span>
                        <span className={styles.decisionMeta}>
                          {`${t('review.replay.decisionTab', { index: dec.decisionIndex + 1 })} · ${formatStreetName(dec.street)}`}
                        </span>
                      </span>
                      <span
                        className={cx(
                          styles.decisionDot,
                          isSelectedMistake ? styles.decisionDotOver : styles.decisionDotOk,
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>
            )}

            <PanelSection label={t('review.replay.heading')}>
              <div className={styles.replayTopLine}>
                <span>
                  {t('review.replay.frameCounter', {
                    current: formatNumber(frameIndex + 1),
                    total: formatNumber(snap.frames.length),
                  })}
                </span>
                <PokerNotation>
                  {currentStreetSummary && currentStreetSummary.spr !== null
                    ? t('review.replay.potSpr', {
                        pot: currentPotText,
                        spr: formatNumber(currentStreetSummary.spr, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        }),
                      })
                    : t('review.replay.potOnly', { pot: currentPotText })}
                </PokerNotation>
              </div>

              <div className={styles.replayNavRow}>
                <ChipButton
                  selected={false}
                  disabled={frameIndex <= 0}
                  onToggle={() => store.stepFrame(-1)}
                >
                  {t('review.replay.stepBack')}
                </ChipButton>
                <ChipButton
                  selected={false}
                  disabled={frameIndex >= snap.frames.length - 1}
                  onToggle={() => store.stepFrame(1)}
                >
                  {t('review.replay.stepNext')}
                </ChipButton>
                <ChipButton
                  selected={feltExpanded}
                  onToggle={() => store.toggleFeltExpanded()}
                >
                  {t('review.actions.toggleTable')}
                </ChipButton>
                {historyGroups.length > 0 && (
                  <ChipButton
                    selected={historyExpanded}
                    onToggle={() => setHistoryExpanded((prev) => !prev)}
                  >
                    {t('recorder.history.heading')}
                  </ChipButton>
                )}
                <ChipButton
                  selected={equityOverlayOpen}
                  onToggle={() => setEquityOverlayOpen((prev) => !prev)}
                >
                  {t('equityOverlay.trigger')} <Kbd>{shortcuts.inlineEquity}</Kbd>
                </ChipButton>
              </div>

              {hasAnyHiddenVillainNow && (
                <p className={styles.noticeBanner}>{t('review.replay.hiddenNotice')}</p>
              )}

              {feltExpanded && (
                <div className={styles.tableBox}>
                  <FeltTable
                    mode="hand"
                    compact
                    seats={feltSeats}
                    activeSeatId={
                      pokerState.phase === 'betting'
                        ? (pokerState.actingPlayerId ?? undefined)
                        : undefined
                    }
                    pot={frameMeta.potMilliBb / 1000}
                    potUnit={unit}
                    board={feltBoard}
                    showdownResult={showdownResultText}
                    chipsToPotTrigger={allowCardMotion ? activeMotion.chipTrigger : 0}
                    chipsToPotSeats={[...activeMotion.chipSeats]}
                    ariaLabel={t('recorder.table.aria')}
                  />
                </div>
              )}

              {historyExpanded && historyGroups.length > 0 && (
                <div className={styles.historyScroll}>
                  <HistoryRail
                    groups={historyGroups}
                    currentRowId={`frame-${frameIndex}`}
                    onSelectRow={(rowId) => {
                      const idx = Number(rowId.replace('frame-', ''));
                      if (Number.isInteger(idx)) store.jumpToFrame(idx);
                    }}
                  />
                </div>
              )}
            </PanelSection>
          </Panel>
        </div>

        <div className={styles.column}>
          <Panel
            label={t('review.decision.heading', {
              index: currentDecision ? currentDecision.decisionIndex + 1 : 1,
              street: formatStreetName(currentDecision?.street ?? frameMeta.street),
            })}
            loading={evalData.isLoading}
            tier={decisionTier}
          >
            <div className={styles.decisionMetaStack}>
              {currentDecision && (
                <div className={styles.priceHeader}>
                  <p className={styles.priceLine}>
                    {currentDecision.facingBet && currentDecision.requiredEquityPct !== null ? (
                      tNodes('review.decision.priceLine', {
                        call: (
                          <PokerNotation>
                            {formatAmount(
                              currentDecision.callEconomics.callCommitmentMilliBb / 1000,
                              unit,
                            )}
                          </PokerNotation>
                        ),
                        potAfter: (
                          <PokerNotation>
                            {formatAmount(
                              currentDecision.callEconomics.actorContestablePotAfterCallMilliBb /
                                1000,
                              unit,
                            )}
                          </PokerNotation>
                        ),
                        needed: <PokerNotation>{neededPctText}</PokerNotation>,
                      })
                    ) : (
                      tNodes('review.decision.openPriceLine', {
                        action: formatActionWord(currentDecision.actionMeta.type),
                        street: formatStreetName(currentDecision.street),
                        pot: (
                          <PokerNotation>
                            {formatAmount(currentDecision.potBeforeDecisionMilliBb / 1000, unit)}
                          </PokerNotation>
                        ),
                      })
                    )}
                  </p>
                </div>
              )}

              <div className={styles.counterfactualBar}>
                <span className={styles.microLabel}>{t('review.decision.rangeAria')}</span>
                <SegmentedControl
                  ariaLabel={t('review.decision.rangeAria')}
                  options={counterfactualOptions}
                  value={counterfactualMode}
                  onChange={(next) => store.setCounterfactualRange(next)}
                />
              </div>

              {counterfactualMode !== 'showed' && (
                <p className={styles.noticeBanner}>
                  {t('review.decision.assumptionNote', { range: rangeLabelText })}
                </p>
              )}
            </div>

            <EquityList
              ariaLabel={t('review.decision.barsAria')}
              rowKeys={[
                ...(evalData.requiredEquityPct !== null ? ['required-equity'] : []),
                ...(evalData.heroEquityPct !== null ? ['hero-decision-equity'] : []),
                ...(evalData.villainEquityPct !== null ? ['villain-decision-equity'] : []),
                ...(evalData.additionalVillains ?? []).map((v) => `villain-${v.playerId}`),
              ]}
            >
              {evalData.requiredEquityPct !== null && (
                <EquityRow
                  id="required-equity"
                  density="dense"
                  who={t('review.decision.neededRow')}
                  whoMeta={t('review.decision.neededMeta')}
                  hideCards
                  barTone="brass"
                  equityPct={evalData.requiredEquityPct}
                />
              )}

              {evalData.heroEquityPct !== null && (
                <EquityRow
                  id="hero-decision-equity"
                  density="dense"
                  who={t('review.decision.hadRow')}
                  whoMeta={
                    counterfactualMode === 'showed' && evalData.villainRevealedCards
                      ? t('review.decision.hadExactMeta', {
                          position: evalData.villainPositionLabel ?? '',
                          cards: evalData.villainRevealedCards.join(' '),
                        })
                      : t('review.decision.hadRangeMeta', { range: rangeLabelText })
                  }
                  isHero
                  cards={record.payload.heroCards.map((c) => ({ card: c, state: 'face' as const }))}
                  barTone={evalData.isMathMistake ? 'over' : 'accent'}
                  equityPct={evalData.heroEquityPct}
                  deltaPct={evalData.deltaVsRequiredPct ?? undefined}
                />
              )}

              {evalData.villainEquityPct !== null && (
                <EquityRow
                  id="villain-decision-equity"
                  density="dense"
                  who={t('review.decision.villainRow', {
                    position: evalData.villainPositionLabel ?? '',
                  })}
                  cards={
                    evalData.villainRevealedCards
                      ? evalData.villainRevealedCards.map((c) => ({
                          card: c,
                          state: 'face' as const,
                        }))
                      : undefined
                  }
                  rangeLabel={evalData.villainRangeSpec?.canonical}
                  rangeMatrix={evalData.villainRangeSpec?.rangeMatrix}
                  rangeComboLabel={
                    evalData.villainRangeSpec
                      ? t('review.decision.combosLabel', {
                          count: evalData.villainRangeSpec.eligibleCombos,
                        })
                      : undefined
                  }
                  barTone="under"
                  equityPct={evalData.villainEquityPct}
                />
              )}

              {(evalData.additionalVillains ?? []).map((v) => (
                <EquityRow
                  key={v.playerId}
                  id={`villain-${v.playerId}`}
                  density="dense"
                  who={t('review.decision.villainRow', { position: v.positionLabel })}
                  whoMeta={v.revealedCards ? undefined : t('kit.equity.factUnknown')}
                  cards={
                    v.revealedCards
                      ? v.revealedCards.map((c) => ({ card: c, state: 'face' as const }))
                      : undefined
                  }
                  barTone="under"
                  equityPct={v.equityPct}
                />
              ))}
            </EquityList>

            {(() => {
              const decisionBoard = currentDecision?.boardAtDecision ?? [];
              const heroCardsPair =
                record.payload.heroCards.length === 2
                  ? ([record.payload.heroCards[0]!, record.payload.heroCards[1]!] as const)
                  : null;
              const canOpenDecisionInEquity =
                Boolean(onOpenInEquity) &&
                heroCardsPair !== null &&
                [0, 3, 4, 5].includes(decisionBoard.length);
              const canDrillDecision = Boolean(onDrillDecision) && heroCardsPair !== null;
              if (!canOpenDecisionInEquity && !canDrillDecision && !currentDecision) return null;

              return (
                <div className={styles.decisionActions}>
                  {canOpenDecisionInEquity && heroCardsPair && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        onOpenInEquity?.({
                          board: [...decisionBoard],
                          players: [
                            {
                              label:
                                currentDecision?.actionMeta.positionLabel ??
                                (record.payload.heroPositionLabel || t('recorder.table.heroLabel')),
                              rawInput: heroCardsPair.join(''),
                              isHero: true,
                            },
                            {
                              label:
                                evalData.villainPositionLabel ??
                                t('equity.row.villain', { index: 1 }),
                              rawInput:
                                evalData.villainRevealedCards?.join('') ||
                                evalData.villainRangeSpec?.canonical ||
                                'any',
                              isHero: false,
                            },
                            ...(evalData.additionalVillains ?? []).map((v) => ({
                              label: v.positionLabel,
                              rawInput: v.revealedCards?.join('') || 'any',
                              isHero: false,
                            })),
                          ],
                          potBeforeBetBb: currentDecision
                            ? currentDecision.potBeforeDecisionMilliBb / 1000
                            : undefined,
                          betToCallBb:
                            currentDecision && currentDecision.facingBet
                              ? currentDecision.callEconomics.callCommitmentMilliBb / 1000
                              : undefined,
                          remainingStackBb: (() => {
                            const heroAtState = pokerState.players.find(
                              (p) => p.playerId === record.payload.heroPlayerId,
                            );
                            if (!heroAtState) return undefined;
                            const callExtra =
                              currentDecision && currentDecision.facingBet
                                ? currentDecision.callEconomics.callCommitmentMilliBb
                                : 0;
                            return (heroAtState.currentStackMilliBb + callExtra) / 1000;
                          })(),
                        });
                      }}
                    >
                      {t('review.actions.openInEquity')}
                    </Button>
                  )}
                  {canDrillDecision && heroCardsPair && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        onDrillDecision?.({
                          position:
                            currentDecision?.actionMeta.positionLabel ??
                            record.payload.heroPositionLabel,
                          heroCards: heroCardsPair,
                        });
                      }}
                    >
                      {t('review.actions.drillThis')}
                    </Button>
                  )}
                  {currentDecision && (
                    <Button
                      variant="secondary"
                      onClick={() => setWhatIfOpen((open) => !open)}
                    >
                      {t('review.whatIf.toggle')}
                    </Button>
                  )}
                </div>
              );
            })()}

            {whatIfOpen && currentDecision && (() => {
              const potBb = currentDecision.potBeforeDecisionMilliBb / 1000;
              const toCallBb = currentDecision.facingBet
                ? currentDecision.callEconomics.callCommitmentMilliBb / 1000
                : 0;
              const heroPlayerAtState = pokerState.players.find(
                (p) => p.playerId === record.payload.heroPlayerId,
              );
              const heroStackBb =
                ((heroPlayerAtState?.currentStackMilliBb ?? 0) +
                  (currentDecision.actionMeta.amountMilliBb ?? 0)) /
                1000;
              const potAfterCall = potBb + toCallBb;
              const callReqPct =
                potAfterCall > 0 ? ((toCallBb / potAfterCall) * 100).toFixed(1) : '0.0';
              const callNextSpr =
                potAfterCall > 0
                  ? (Math.max(0, heroStackBb - toCallBb) / potAfterCall).toFixed(1)
                  : '0.0';

              const raiseExtraBb = Math.max(1, Number((potAfterCall * whatIfFraction).toFixed(1)));
              const totalInvestedBb = toCallBb + raiseExtraBb;
              const breakEvenFoldPct =
                potBb + totalInvestedBb > 0
                  ? ((totalInvestedBb / (potBb + totalInvestedBb)) * 100).toFixed(1)
                  : '0.0';
              const finalCalledPotBb = potBb + toCallBb + raiseExtraBb * 2;
              const villainPricePct =
                finalCalledPotBb > 0
                  ? ((raiseExtraBb / finalCalledPotBb) * 100).toFixed(1)
                  : '0.0';
              const raiseNextSpr =
                finalCalledPotBb > 0
                  ? (Math.max(0, heroStackBb - totalInvestedBb) / finalCalledPotBb).toFixed(1)
                  : '0.0';

              const decisionPosition =
                currentDecision.actionMeta.positionLabel ?? record.payload.heroPositionLabel;
              const minBoardLen = currentDecision.boardAtDecision.length;
              const echoHands = store.savedHandsSignal.value.filter(
                (h) =>
                  h.objectId !== record.objectId &&
                  !h.archived &&
                  h.payload.heroPositionLabel === decisionPosition &&
                  h.payload.pokerState.board.length >= minBoardLen,
              );

              return (
                <>
                  <PanelSection label={t('review.whatIf.heading')}>
                    <div className={styles.thinkingStack}>
                      <p className={styles.honestyNote}>
                        {t('review.whatIf.ifFold', {
                          pot: formatAmount(potBb, unit),
                          unit,
                        })}
                      </p>
                      {toCallBb > 0 && (
                        <p className={styles.honestyNote}>
                          {t('review.whatIf.ifCall', {
                            call: formatAmount(toCallBb, unit),
                            pot: formatAmount(potAfterCall, unit),
                            req: callReqPct,
                            spr: callNextSpr,
                          })}
                        </p>
                      )}
                      <div className={styles.chipGroup}>
                        <ChipButton
                          selected={whatIfFraction === 0.5}
                          onToggle={() => setWhatIfFraction(0.5)}
                        >
                          {t('review.whatIf.sizeHalf')}
                        </ChipButton>
                        <ChipButton
                          selected={whatIfFraction === 0.67}
                          onToggle={() => setWhatIfFraction(0.67)}
                        >
                          {t('review.whatIf.sizeTwoThirds')}
                        </ChipButton>
                        <ChipButton
                          selected={whatIfFraction === 1}
                          onToggle={() => setWhatIfFraction(1)}
                        >
                          {t('review.whatIf.sizePot')}
                        </ChipButton>
                      </div>
                      <p className={styles.honestyNote}>
                        {t('review.whatIf.ifVillainFolds', {
                          bet: formatAmount(totalInvestedBb, unit),
                          pot: formatAmount(potBb, unit),
                          be: breakEvenFoldPct,
                        })}
                      </p>
                      <p className={styles.honestyNote}>
                        {t('review.whatIf.ifVillainCalls', {
                          bet: formatAmount(totalInvestedBb, unit),
                          pot: formatAmount(finalCalledPotBb, unit),
                          vPrice: villainPricePct,
                          spr: raiseNextSpr,
                        })}
                      </p>
                    </div>
                  </PanelSection>

                  <PanelSection label={t('review.echo.heading')}>
                    <div className={styles.thinkingStack}>
                      <p className={styles.honestyNote}>
                        {t('review.echo.summary', {
                          count: echoHands.length,
                          street: formatStreetName(currentDecision.street),
                          position: decisionPosition,
                        })}
                      </p>
                      {echoHands.length === 0 ? (
                        <p className={styles.honestyNote}>{t('review.echo.empty')}</p>
                      ) : (
                        <div className={styles.chipGroup}>
                          {echoHands.slice(0, 3).map((echo) => (
                            <ChipButton
                              key={echo.objectId}
                              selected={false}
                              onToggle={() => store.openSavedHand(echo)}
                            >
                              {echo.factTitle}
                            </ChipButton>
                          ))}
                        </div>
                      )}
                    </div>
                  </PanelSection>
                </>
              );
            })()}

            <PanelSection label={t('review.decision.thinkingHeading')}>
              <div className={styles.thinkingStack}>
                <div className={styles.chipGroup}>
                  {THINKING_REASONS.map((reasonId) => (
                    <ChipButton
                      key={reasonId}
                      selected={activeNote?.reasonChip === reasonId}
                      onToggle={() => {
                        void store.toggleThinkingReason(reasonId);
                      }}
                    >
                      {t(`recorder.thinking.${reasonId}`)}
                    </ChipButton>
                  ))}
                </div>
                <TextField
                  multiline
                  rows={2}
                  value={activeNote?.customText ?? ''}
                  onValueChange={(next) => {
                    void store.setThinkingCustomText(next);
                  }}
                  placeholder={t('recorder.thinking.notePlaceholder')}
                  ariaLabel={t('recorder.thinking.noteAria')}
                  ltrInput={false}
                />
              </div>
            </PanelSection>

            <PanelSection label={t('review.notes.handSummaryHeading')}>
              <TextField
                multiline
                rows={2}
                ltrInput={false}
                value={record.payload.handNote ?? ''}
                onValueChange={(next) => {
                  void store.setHandSummaryNote(next);
                }}
                placeholder={t('review.notes.handSummaryPlaceholder')}
                ariaLabel={t('review.notes.handSummaryAria')}
              />
            </PanelSection>
          </Panel>
        </div>

        <div className={styles.column}>
          <Panel
            title={t('review.luck.heading')}
            loading={luck.isLoading}
            tier={luckTier}
          >
            {!luck.isAvailable ? (
              <p className={styles.honestyNote}>
                {luck.unavailableReason === 'spot_incomplete'
                  ? t('review.luck.unavailableSpot')
                  : t('review.luck.unavailableHidden')}
              </p>
            ) : (
              <>
                <FactTileRow>
                  <FactTile
                    label={t('review.luck.callVsFoldEv')}
                    value={luck.callVsFoldEvBb}
                    decimals={1}
                    unit={luck.unitLabel}
                    note={t('review.luck.callVsFoldEvNote', {
                      invested: formatAmount(priorInvestedBb, luck.unitLabel),
                    })}
                  />
                  <FactTile
                    label={t('review.luck.handEv')}
                    value={luck.handEvBb}
                    decimals={1}
                    unit={luck.unitLabel}
                    note={t('review.luck.handEvNote')}
                  />
                </FactTileRow>

                <div className={styles.decompList}>
                  {luck.handEvBb !== null && (
                    <div className={styles.decompRow}>
                      <span className={styles.decompLabel}>{t('review.luck.handEv')}</span>
                      <div className={styles.decompTrack} aria-hidden="true">
                        <div
                          className={
                            luck.handEvBb >= 0
                              ? styles.decompFillPositive
                              : styles.decompFillNegative
                          }
                          style={{
                            transform: `scaleX(${Math.max(
                              0.04,
                              Math.min(1, Math.abs(luck.handEvBb) / decompScaleMax),
                            )})`,
                          }}
                        />
                      </div>
                      <span className={styles.decompValue}>
                        <PokerNotation>
                          {formatSignedAmount(luck.handEvBb, luck.unitLabel)}
                        </PokerNotation>
                      </span>
                    </div>
                  )}

                  {luck.runoutLuckBb !== null && (
                    <div className={styles.decompRow}>
                      <span className={styles.decompLabel}>{t('review.luck.runoutLuck')}</span>
                      <div className={styles.decompTrack} aria-hidden="true">
                        <div
                          className={styles.decompFillLuck}
                          style={{
                            transform: `scaleX(${Math.max(
                              0.04,
                              Math.min(1, Math.abs(luck.runoutLuckBb) / decompScaleMax),
                            )})`,
                          }}
                        />
                      </div>
                      <span className={styles.decompValue}>
                        <PokerNotation>
                          {formatSignedAmount(luck.runoutLuckBb, luck.unitLabel)}
                        </PokerNotation>
                      </span>
                    </div>
                  )}

                  {luck.actualNetBb !== null && (
                    <div className={styles.decompRow}>
                      <span className={styles.decompLabel}>{t('review.luck.actualNet')}</span>
                      <div className={styles.decompTrack} aria-hidden="true">
                        <div
                          className={
                            luck.actualNetBb >= 0
                              ? styles.decompFillPositive
                              : styles.decompFillNegative
                          }
                          style={{
                            transform: `scaleX(${Math.max(
                              0.04,
                              Math.min(1, Math.abs(luck.actualNetBb) / decompScaleMax),
                            )})`,
                          }}
                        />
                      </div>
                      <span className={styles.decompValue}>
                        <PokerNotation>
                          {formatSignedAmount(luck.actualNetBb, luck.unitLabel)}
                        </PokerNotation>
                      </span>
                    </div>
                  )}
                </div>

                <p className={styles.honestyNote}>{t('review.luck.equityNote')}</p>
              </>
            )}
          </Panel>

          <TeacherCallout
            surface="panel"
            heading={coachHeading ?? t('review.teacher.heading')}
            text={coachText}
            mood={coachMood}
          />
        </div>
      </div>

      <StreetStrip
        ariaLabel={t('review.replay.timelineAria')}
        streets={streetItems}
        currentStreetId={frameMeta.street}
        onSelectStreet={(street) => store.selectStreet(street as EquityStreet)}
      />

      <InlineEquityDrawer
        open={equityOverlayOpen}
        onToggle={() => setEquityOverlayOpen((prev) => !prev)}
        onClose={() => setEquityOverlayOpen(false)}
        heroCards={
          record.payload.heroCards.length === 2
            ? ([record.payload.heroCards[0]!, record.payload.heroCards[1]!] as const)
            : null
        }
        baseBoard={currentDecision?.boardAtDecision ?? []}
        revealedVillainCards={
          evalData.villainRevealedCards && evalData.villainRevealedCards.length === 2
            ? ([evalData.villainRevealedCards[0]!, evalData.villainRevealedCards[1]!] as const)
            : null
        }
        villainLabel={
          evalData.villainPositionLabel
            ? t('review.decision.villainRow', { position: evalData.villainPositionLabel })
            : undefined
        }
        defaultSource={evalData.villainRevealedCards ? 'showed' : 'standard'}
        priceFacts={
          currentDecision && currentDecision.facingBet && currentDecision.requiredEquityPct !== null
            ? {
                requiredPct: currentDecision.requiredEquityPct,
                callLabel: formatAmount(
                  currentDecision.callEconomics.callCommitmentMilliBb / 1000,
                  unit,
                ),
                potLabel: formatAmount(
                  currentDecision.callEconomics.actorContestablePotAfterCallMilliBb / 1000,
                  unit,
                ),
              }
            : null
        }
        onPinNote={(summaryLine) => {
          const existing = (activeNote?.customText ?? '').trim();
          const nextText = existing ? `${existing} | ${summaryLine}` : summaryLine;
          void store.setThinkingCustomText(nextText);
        }}
      />
    </section>
  );
}
