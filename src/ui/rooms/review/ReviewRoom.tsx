import { REPLAY_FRAME_OPERATIONS } from '../../../engine-api';
import { getSharedHandRecorderStore } from '../../../domain/hand';
import type {
  CounterfactualRangeId,
  ReplayFrameMeta,
  ReviewStore,
} from '../../../domain/review';
import { navigateTo } from '../../../domain/shellState';
import type { EquityStreet, SavedObjectTagId, ThinkingReasonId } from '../../../domain/storage';
import { formatNumber, formatPercent, t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { Chip, type TierBadgeProps } from '../../kit/chip/Chip';
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
import { TeacherCallout } from '../../kit/lamp/Lamp';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import { SavedLibraryView } from './SavedLibraryView';
import styles from './ReviewRoom.module.css';

interface ReviewRoomProps {
  store: ReviewStore;
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
export function ReviewRoom({ store }: ReviewRoomProps) {
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
  const activeNote = store.activeHeroNoteSignal.value;

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

        <SavedLibraryView store={store} />
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
        }));
      } else if (
        p.holeCards &&
        typeof p.holeCards === 'object' &&
        'status' in p.holeCards &&
        p.holeCards.status === 'hidden'
      ) {
        cards = [{ state: 'back' as const }, { state: 'back' as const }];
      }
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

  const feltBoard: TableCardSpec[] = pokerState.board.map((c) => ({
    card: c,
    state: 'face' as const,
    winning: pokerState.terminal.isTerminal && winningCardSet.has(c),
  }));

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
        ? { tier: 'estimated', detail: t('review.decision.tierAssumptionDetail') }
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

  let coachHeading: string | undefined;
  let coachText = t('review.decision.unavailableBody');
  let coachMood: 'idle' | 'stern' | 'curious' = 'idle';

  if (evalData.isMathMistake && evalData.villainRevealedCards) {
    coachHeading = t('review.decision.mistakeTitle');
    coachText = t('review.decision.mistakeBody', {
      needed: neededPctText,
      had: heroHadPctText,
      cards: evalData.villainRevealedCards.join(' '),
    });
    coachMood = 'stern';
  } else if (evalData.tier === 'estimated') {
    coachText = t('review.decision.counterfactualBody', {
      range: rangeLabelText,
      had: heroHadPctText,
    });
    coachMood = 'curious';
  } else if (evalData.tier === 'exact' && evalData.heroEquityPct !== null) {
    if (evalData.requiredEquityPct === null) {
      coachText = t('review.decision.exactOpenBody', {
        had: heroHadPctText,
        cards: (evalData.villainRevealedCards ?? []).join(' '),
      });
    } else {
      coachText = t('review.decision.goodCallBody', {
        needed: neededPctText,
        had: heroHadPctText,
      });
    }
  }

  // Decisions vs luck tier, prior invested reference & decomposition bars
  const luckTier: TierBadgeProps = luck.isAvailable
    ? { tier: 'exact', detail: t('review.luck.tierDetail') }
    : { tier: 'unavailable' };

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
      <header className={styles.roomHeader}>
        <div className={styles.headingGroup}>
          <h1 className={styles.roomTitle}>{t('review.title')}</h1>
          <p className={styles.roomSubtitle}>{t('review.subtitle')}</p>
        </div>

        <div className={styles.headerControls}>
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
      </header>

      <Panel label={t('review.replay.timelineAria')}>
        <div className={styles.timelineMetaRow}>
          <Chip>
            <PokerNotation>{record.factTitle}</PokerNotation>
          </Chip>
          {snap.isStarterSample && <Chip>{t('review.starterBadge')}</Chip>}
        </div>

        <StreetStrip
          ariaLabel={t('review.replay.timelineAria')}
          streets={streetItems}
          currentStreetId={frameMeta.street}
          onSelectStreet={(street) => store.selectStreet(street as EquityStreet)}
        />
      </Panel>

      <div className={styles.mainGrid}>
        <div className={styles.column}>
          <Panel label={t('review.replay.heading')}>
            <div className={styles.replaySummary}>
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

              <p className={styles.replayFrameText}>
                <PokerNotation>
                  {formatFrameLabel(
                    frameMeta,
                    unit,
                    record.payload.heroCards,
                    snap.revealedVillainCardsById,
                  )}
                </PokerNotation>
              </p>
            </div>

            <div className={styles.replayNavRow}>
              <Button
                variant="secondary"
                disabled={frameIndex <= 0}
                onClick={() => store.stepFrame(-1)}
              >
                {t('review.replay.stepBack')}
              </Button>
              <Button
                variant="secondary"
                disabled={frameIndex >= snap.frames.length - 1}
                onClick={() => store.stepFrame(1)}
              >
                {t('review.replay.stepNext')}
              </Button>
              <Button variant="secondary" onClick={() => store.toggleFeltExpanded()}>
                {t('review.actions.toggleTable')}
              </Button>
            </div>

            {snap.decisions.length === 0 ? (
              <p className={styles.honestyNote}>{t('review.replay.noDecisions')}</p>
            ) : (
              <div className={styles.decisionPills}>
                {snap.decisions.map((dec) => (
                  <ChipButton
                    key={dec.decisionIndex}
                    selected={selectedDecisionIdx === dec.decisionIndex}
                    onToggle={() => store.selectDecision(dec.decisionIndex)}
                  >
                    {t('review.replay.decisionTab', { index: dec.decisionIndex + 1 })}
                  </ChipButton>
                ))}
              </div>
            )}

            {hasAnyHiddenVillainNow && (
              <p className={styles.noticeBanner}>{t('review.replay.hiddenNotice')}</p>
            )}

            {feltExpanded && (
              <div className={styles.tableBox}>
                <FeltTable
                  mode="hand"
                  seats={feltSeats}
                  activeSeatId={
                    pokerState.phase === 'betting'
                      ? (pokerState.actingPlayerId ?? undefined)
                      : undefined
                  }
                  pot={frameMeta.potMilliBb / 1000}
                  potUnit={unit}
                  board={feltBoard}
                  ariaLabel={t('recorder.table.aria')}
                />
              </div>
            )}

            {historyGroups.length > 0 && (
              <HistoryRail
                groups={historyGroups}
                currentRowId={`frame-${frameIndex}`}
                onSelectRow={(rowId) => {
                  const idx = Number(rowId.replace('frame-', ''));
                  if (Number.isInteger(idx)) store.jumpToFrame(idx);
                }}
              />
            )}

            <PanelSection label={t('review.tags.heading')}>
              <div className={styles.chipGroup}>
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
              </div>
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
            {currentDecision && (
              <div className={styles.priceHeader}>
                <p className={styles.priceLine}>
                  {currentDecision.facingBet && currentDecision.requiredEquityPct !== null ? (
                    <PokerNotation>
                      {t('review.decision.priceLine', {
                        call: formatAmount(
                          currentDecision.callEconomics.callCommitmentMilliBb / 1000,
                          unit,
                        ),
                        potAfter: formatAmount(
                          currentDecision.callEconomics.actorContestablePotAfterCallMilliBb / 1000,
                          unit,
                        ),
                        needed: neededPctText,
                      })}
                    </PokerNotation>
                  ) : (
                    <PokerNotation>
                      {t('review.decision.openPriceLine', {
                        action: formatActionWord(currentDecision.actionMeta.type),
                        street: formatStreetName(currentDecision.street),
                        pot: formatAmount(currentDecision.potBeforeDecisionMilliBb / 1000, unit),
                      })}
                    </PokerNotation>
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

            <EquityList
              ariaLabel={t('review.decision.barsAria')}
              rowKeys={[
                ...(evalData.requiredEquityPct !== null ? ['required-equity'] : []),
                ...(evalData.heroEquityPct !== null ? ['hero-decision-equity'] : []),
                ...(evalData.villainEquityPct !== null ? ['villain-decision-equity'] : []),
              ]}
            >
              {evalData.requiredEquityPct !== null && (
                <EquityRow
                  id="required-equity"
                  who={t('review.decision.neededRow')}
                  whoMeta={t('review.decision.neededMeta')}
                  barTone="brass"
                  equityPct={evalData.requiredEquityPct}
                />
              )}

              {evalData.heroEquityPct !== null && (
                <EquityRow
                  id="hero-decision-equity"
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
            </EquityList>

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

            <TeacherCallout
              surface="well"
              heading={coachHeading}
              text={coachText}
              mood={coachMood}
            />
          </Panel>

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
                  <FactTile
                    label={t('review.luck.runoutLuck')}
                    value={luck.runoutLuckBb}
                    decimals={1}
                    unit={luck.unitLabel}
                    note={t('review.luck.runoutLuckNote')}
                  />
                  <FactTile
                    label={t('review.luck.actualNet')}
                    value={luck.actualNetBb}
                    decimals={1}
                    unit={luck.unitLabel}
                    note={t('review.luck.actualNetNote', {
                      pot: formatAmount(luck.finalPotBb, luck.unitLabel),
                    })}
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
        </div>
      </div>
    </section>
  );
}
