import { useEffect, useRef, useState } from 'preact/hooks';
import {
  DEFAULT_INTERACTIVE_SAMPLES,
  REFINED_INTERACTIVE_SAMPLES,
  type EquityPlayerEntry,
  type EquityStore,
} from '../../../domain/equity';
import { buildRangeMatrixMask } from '../../../domain/shorthand';
import { CATEGORY_BY_RANK, getSharedEngineClient, type HandCategory } from '../../../engine-api';
import { formatNumber, formatPercent, t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { Chip, TierBadge, type Tier } from '../../kit/chip/Chip';
import { EquityList, EquityRow } from '../../kit/equity-row/EquityRow';
import { FactTile, FactTileRow } from '../../kit/fact-tile/FactTile';
import { TextField } from '../../kit/input/TextField';
import { Panel } from '../../kit/panel/Panel';
import { CardPicker } from '../../kit/playing-card/CardPicker';
import { PlayingCard } from '../../kit/playing-card/PlayingCard';
import { readDurationMs } from '../../kit/state';
import { Stepper } from '../../kit/stepper/Stepper';
import {
  formatCardGlyph,
  formatCategoryLabel,
  formatDraftPreview,
  formatRightNowFact,
  formatShorthandError,
} from './equityFormatters';
import { RunoutExplorerPanel } from './RunoutExplorerPanel';
import { SavedMatchupsView } from './SavedMatchupsView';
import styles from './EquityRoom.module.css';

const ALL_CATEGORIES: readonly HandCategory[] = [...CATEGORY_BY_RANK].reverse();

function kindBadgeLabel(entry: EquityPlayerEntry): string {
  if (entry.inputKind === 'exact') return t('equity.row.kindCards');
  if (entry.inputKind === 'range') return t('equity.row.kindRange');
  return t('equity.row.kindAny');
}

export interface EquityRoomProps {
  store: EquityStore;
  readonly onDrillMatchup?: () => void;
  readonly returnLabel?: string;
  readonly onReturnToOrigin?: () => void;
}

export function EquityRoom({
  store,
  onDrillMatchup,
  returnLabel,
  onReturnToOrigin,
}: EquityRoomProps) {
  const activeTab = store.activeSideTabSignal.value;
  const board = store.boardSignal.value;
  const effBoard = store.effectiveBoardSignal.value;
  const players = store.playersSignal.value;
  const equitySnap = store.equitySnapshotSignal.value;
  const runoutSnap = store.runoutSnapshotSignal.value;
  const density = store.densitySignal.value;
  const draftInput = store.draftInputSignal.value;
  const draftPreview = store.draftPreviewSignal.value;
  const submitError = store.submitAttemptedErrorSignal.value;
  const refined = store.refinedSamplesSignal.value;
  const deadCards = new Set(store.deadCardsSignal.value);

  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const slotButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [expandedRows, setExpandedRows] = useState<ReadonlySet<string>>(() => new Set());
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const [potBeforeBetBb, setPotBeforeBetBb] = useState<number>(12);
  const [betToCallBb, setBetToCallBb] = useState<number>(6);
  const [remainingStackBb, setRemainingStackBb] = useState<number>(40);

  useEffect(() => {
    void store.refreshSavedMatchups();
  }, [store]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (equitySnap.status === 'ready' && Object.keys(equitySnap.players).length > 0) return;
    if ([0, 3, 4, 5].includes(effBoard.length) && players.length >= 2 && equitySnap.status === 'idle') {
      void store.recompute();
    }
  }, [store, effBoard.length, players.length, equitySnap.status, equitySnap.players]);

  const toggleExpandedRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Determine the single header method badge
  const canEvaluate = [0, 3, 4, 5].includes(effBoard.length);
  let methodTier: Tier = 'unavailable';
  let methodDetail = t('equity.method.incompleteBoard');
  if (canEvaluate && equitySnap.status === 'calculating') {
    methodTier = 'estimated';
    methodDetail = t('equity.method.estimating');
  } else if (canEvaluate && equitySnap.status === 'ready') {
    if (equitySnap.method === 'exact') {
      methodTier = 'exact';
      methodDetail = t('equity.method.exact', { count: formatNumber(equitySnap.trials) });
    } else {
      methodTier = 'estimated';
      methodDetail = t('equity.method.estimated', {
        margin: `${formatPercent(equitySnap.maxMargin95Pct / 100, 1)}`,
        count: formatNumber(equitySnap.trials),
      });
    }
  }

  const heroComputed = equitySnap.players['hero'];
  const heroEquityPct = heroComputed?.equityPct ?? 0;

  const engineClient = getSharedEngineClient();
  const effectiveCallBb = Math.min(betToCallBb, remainingStackBb);
  const callFactsRes = engineClient.sync.duelCallFacts(
    potBeforeBetBb,
    effectiveCallBb,
    remainingStackBb,
  );
  const callFacts = callFactsRes.ok ? callFactsRes.data : null;
  const mdfRes = callFacts
    ? engineClient.sync.minimumDefenseFrequency({
        opponentCount: 1,
        callAmountBb: effectiveCallBb,
        actorContestablePotAfterCallBb: callFacts.calledPotBb,
        effectiveStackBb: remainingStackBb,
      })
    : null;
  const mdfPct = mdfRes && mdfRes.ok && mdfRes.data !== null ? mdfRes.data * 100 : null;
  const priceComparisonRes =
    equitySnap.status === 'ready' && heroComputed && callFacts
      ? engineClient.sync.compareCallEquityToRequired({
          heroEquityFraction: heroEquityPct / 100,
          requiredEquityFraction: callFacts.callerPotOddsFraction,
          isExact: true,
          isCallAction: true,
        })
      : null;
  const priceComparison = priceComparisonRes && priceComparisonRes.ok ? priceComparisonRes.data : null;

  const heroPlayer = players[0];
  const rangeVillain = players.find((p, idx) => idx > 0 && p.inputKind === 'range' && p.weightedRange);
  const blockerAnalysisRes =
    heroPlayer &&
    heroPlayer.inputKind === 'exact' &&
    heroPlayer.cards &&
    rangeVillain &&
    rangeVillain.weightedRange
      ? engineClient.sync.analyzeRange({
          heroCards: [...heroPlayer.cards],
          board: [...effBoard],
          deadCards: [],
          ranges: {
            villain: {
              role: 'opponent',
              subjectId: rangeVillain.id,
              label: rangeVillain.label,
              range: rangeVillain.weightedRange,
            },
          },
        })
      : null;
  const blockerFacts =
    blockerAnalysisRes && blockerAnalysisRes.ok
      ? blockerAnalysisRes.data.ranges['villain']?.blockers ?? null
      : null;

  const nonZeroRiverCategories = heroComputed
    ? ALL_CATEGORIES.map((category) => ({
        category,
        share: heroComputed.riverCategoryShares[category] ?? 0,
      }))
        .filter((item) => item.share > 0.0005)
        .sort((a, b) => b.share - a.share)
    : [];

  let addErrorNode = undefined;
  if (submitError) {
    addErrorNode = formatShorthandError(
      submitError as Parameters<typeof formatShorthandError>[0],
      !draftPreview.ok ? draftPreview.detail : undefined,
    );
  } else if (draftInput.trim().length > 0 && !draftPreview.ok && draftPreview.errorCode !== 'incomplete_hand') {
    addErrorNode = formatShorthandError(draftPreview.errorCode, draftPreview.detail);
  }

  const handleSave = async () => {
    const saved = await store.saveCurrentMatchup();
    if (saved) {
      setSavedConfirmed(true);
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      const noticeMs = readDurationMs('--dur-notice');
      if (noticeMs > 0) {
        saveTimerRef.current = window.setTimeout(() => setSavedConfirmed(false), noticeMs);
      }
    }
  };

  let villainCounter = 0;

  return (
    <section
      className={styles.room}
      aria-labelledby="equity-room-heading"
      aria-busy={equitySnap.status === 'calculating' || runoutSnap.status === 'calculating'}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && pickerSlot === null && store.stepBackWithEscape()) {
          e.preventDefault();
        }
      }}
    >
      <header className={styles.roomHeader}>
        <div className={styles.headingGroup}>
          <h1 id="equity-room-heading" className={styles.roomTitle}>
            {t('equity.title')}
          </h1>
          <p className={styles.roomSubtitle}>{t('equity.subtitle')}</p>
        </div>

        <div className={styles.headerControls}>
          <TierBadge tier={methodTier} detail={methodDetail} />
          <p className={styles.notEv}>{t('equity.notEv')}</p>
          <div className={styles.headerActions}>
            {returnLabel && onReturnToOrigin && (
              <Button variant="secondary" onClick={onReturnToOrigin}>
                {t('equity.actions.backToOrigin', { room: returnLabel })}
              </Button>
            )}
            {onDrillMatchup && (
              <Button variant="secondary" onClick={onDrillMatchup}>
                {t('equity.actions.drillThis')}
              </Button>
            )}
            {canEvaluate && equitySnap.method === 'estimated' && (
              <Button variant="secondary" onClick={() => store.setRefinedSamples(!refined)}>
                {refined
                  ? t('equity.refined', { count: formatNumber(REFINED_INTERACTIVE_SAMPLES) })
                  : `${t('equity.refine')} (${formatNumber(DEFAULT_INTERACTIVE_SAMPLES)})`}
              </Button>
            )}
            <Button variant="secondary" confirmed={savedConfirmed} onClick={() => void handleSave()}>
              {savedConfirmed ? t('equity.savedNotice') : t('equity.saveMatchup')}
            </Button>
          </div>
        </div>
      </header>

      {activeTab === 'saved' ? (
        <SavedMatchupsView store={store} />
      ) : (
        <div className={styles.mainGrid}>
          <div className={styles.column}>
            <Panel>
              <EquityList rowKeys={players.map((p) => p.id)}>
                {players.map((entry) => {
                  if (!entry.isHero) villainCounter += 1;
                  const computed = equitySnap.players[entry.id];
                  const isExpanded = expandedRows.has(entry.id);
                  const whoLabel = entry.isHero
                    ? t('equity.row.hero')
                    : t('equity.row.villain', { index: villainCounter });

                  const cardProps =
                    entry.inputKind === 'exact' && entry.cards
                      ? [{ card: entry.cards[0] }, { card: entry.cards[1] }]
                      : undefined;

                  const matrixMask =
                    entry.inputKind === 'range' && entry.handClasses
                      ? buildRangeMatrixMask(entry.handClasses)
                      : undefined;

                  const expandedNode = isExpanded ? (
                    <div className={styles.drawerBody}>
                      {computed && (
                        <p className={styles.drawerFact}>
                          {tNodes('equity.row.winsOfRivers', {
                            wins: <PokerNotation>{formatNumber(computed.wins)}</PokerNotation>,
                            total: <PokerNotation>{formatNumber(computed.trials)}</PokerNotation>,
                          })}
                        </p>
                      )}
                      {entry.inputKind === 'range' && entry.handClasses && (
                        <p className={styles.drawerFact}>
                          {tNodes('equity.row.rangeBreakdown', {
                            classes: <PokerNotation>{[...entry.handClasses].slice(0, 10).join(', ')}</PokerNotation>,
                          })}
                        </p>
                      )}
                      {computed && (
                        <div className={styles.drawerBadges}>
                          {ALL_CATEGORIES.filter((cat) => (computed.riverCategoryShares[cat] ?? 0) > 0.01)
                            .sort(
                              (a, b) =>
                                (computed.riverCategoryShares[b] ?? 0) -
                                (computed.riverCategoryShares[a] ?? 0),
                            )
                            .slice(0, 5)
                            .map((cat) => (
                              <span key={cat}>
                                {formatCategoryLabel(cat)}{' '}
                                <PokerNotation>
                                  {formatPercent(computed.riverCategoryShares[cat] ?? 0, 1)}
                                </PokerNotation>
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  ) : undefined;

                  const barTone = entry.isHero
                    ? 'accent'
                    : (computed?.equityPct ?? 0) >= heroEquityPct
                      ? 'over'
                      : 'under';

                  return (
                    <EquityRow
                      key={entry.id}
                      id={entry.id}
                      who={whoLabel}
                      whoMeta={kindBadgeLabel(entry)}
                      isHero={entry.isHero}
                      cards={cardProps}
                      rangeLabel={entry.inputKind === 'range' ? entry.canonical : undefined}
                      rangeComboLabel={
                        entry.inputKind === 'range'
                          ? t('equity.row.combosLabel', { count: entry.eligibleCombos })
                          : undefined
                      }
                      rangeMatrix={matrixMask}
                      equityPct={computed ? computed.equityPct : 0}
                      previousEquityPct={computed?.previousEquityPct}
                      deltaPct={computed?.deltaPct}
                      barTone={barTone}
                      rightNow={formatRightNowFact(entry, computed)}
                      density={density}
                      expanded={isExpanded}
                      onToggleExpand={() => toggleExpandedRow(entry.id)}
                      expandedContent={expandedNode}
                      onRemove={players.length > 2 && !entry.isHero ? () => store.removePlayer(entry.id) : undefined}
                    />
                  );
                })}
              </EquityList>

              <div className={styles.addPlayerBox}>
                <TextField
                  value={draftInput}
                  onValueChange={(next) => store.setDraftInput(next)}
                  onSubmit={() => {
                    store.addPlayer();
                  }}
                  placeholder={t('equity.input.placeholder')}
                  ariaLabel={t('equity.input.ariaLabel')}
                  preview={
                    players.length >= 10
                      ? t('equity.input.maxReached')
                      : formatDraftPreview(draftPreview)
                  }
                  error={addErrorNode}
                  submitLabel={t('equity.input.addBtn')}
                  submitDisabled={players.length >= 10 || !draftPreview.ok}
                  disabled={players.length >= 10}
                  ltrInput
                />
              </div>
            </Panel>

            <Panel title={t('equity.riverDist.heading')}>
              <div className={styles.boardBand}>
                <div className={styles.boardRow}>
                  <div className={styles.boardSlots} role="group" aria-label={t('equity.board.label')}>
                    {[0, 1, 2, 3, 4].map((slotIdx) => {
                      const card = effBoard[slotIdx];
                      const isBaseOrTurnSlot = slotIdx < 3 ? board[slotIdx] : effBoard[slotIdx];
                      return (
                        <button
                          key={slotIdx}
                          ref={(el) => {
                            slotButtonRefs.current[slotIdx] = el;
                          }}
                          type="button"
                          className={styles.boardSlotBtn}
                          aria-label={
                            isBaseOrTurnSlot
                              ? `${t('equity.board.slotTitle', { slot: slotIdx + 1 })}: ${formatCardGlyph(isBaseOrTurnSlot)}`
                              : t('equity.board.slotTitle', { slot: slotIdx + 1 })
                          }
                          onClick={() => setPickerSlot(slotIdx)}
                        >
                          <PlayingCard
                            size="standard"
                            state={card ? 'face' : 'slot'}
                            card={card}
                          />
                        </button>
                      );
                    })}
                  </div>

                  <div className={styles.boardActions}>
                    <Button variant="secondary" onClick={() => store.dealRandomBoard()}>
                      {t('equity.board.random')}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={board.length === 0 && !store.turnCardSignal.value}
                      onClick={() => store.clearBoard()}
                    >
                      {t('equity.board.clear')}
                    </Button>
                  </div>
                </div>
              </div>

              {nonZeroRiverCategories.length === 0 ? (
                <p className={styles.mutedHint}>{t('equity.method.incompleteBoard')}</p>
              ) : (
                <div className={styles.distList}>
                  {nonZeroRiverCategories.map((item) => (
                    <div key={item.category} className={styles.distRow}>
                      <span className={styles.distLabel}>{formatCategoryLabel(item.category)}</span>
                      <div className={styles.distTrack} aria-hidden="true">
                        <div
                          className={styles.distFill}
                          style={{ transform: `scaleX(${Math.max(0.02, Math.min(1, item.share))})` }}
                        />
                      </div>
                      <span className={styles.distPct}>
                        <PokerNotation>{formatPercent(item.share, 1)}</PokerNotation>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel
              title={t('equity.callStrip.heading')}
              tier={{ tier: 'exact', detail: t('tier.detail.priceOnly') }}
            >
              <div className={styles.callStripControls}>
                <Stepper
                  label={t('equity.callStrip.potLabel')}
                  ariaLabel={t('equity.callStrip.potLabel')}
                  value={potBeforeBetBb}
                  onChange={setPotBeforeBetBb}
                  min={1}
                  max={500}
                  step={1}
                  unit="bb"
                />
                <Stepper
                  label={t('equity.callStrip.betLabel')}
                  ariaLabel={t('equity.callStrip.betLabel')}
                  value={betToCallBb}
                  onChange={setBetToCallBb}
                  min={0.5}
                  max={500}
                  step={0.5}
                  unit="bb"
                />
                <Stepper
                  label={t('equity.callStrip.stackLabel')}
                  ariaLabel={t('equity.callStrip.stackLabel')}
                  value={remainingStackBb}
                  onChange={setRemainingStackBb}
                  min={1}
                  max={500}
                  step={5}
                  unit="bb"
                />
              </div>

              <FactTileRow>
                <FactTile
                  label={t('equity.callStrip.requiredEquity')}
                  value={callFacts ? callFacts.callerPotOddsPercent : null}
                  decimals={1}
                  unit="%"
                  instant
                />
                <FactTile
                  label={t('equity.callStrip.sprAfterCall')}
                  value={callFacts ? callFacts.spr : null}
                  decimals={2}
                  instant
                />
                <FactTile
                  label={t('equity.callStrip.mdf')}
                  value={mdfPct}
                  decimals={1}
                  unit="%"
                  instant
                />
              </FactTileRow>

              {equitySnap.status === 'ready' && heroComputed && callFacts && priceComparison && (
                <p
                  className={
                    priceComparison.behindRequiredPrice
                      ? styles.callVerdictBelow
                      : styles.callVerdictClears
                  }
                >
                  {tNodes(
                    priceComparison.behindRequiredPrice
                      ? 'equity.callStrip.belowPrice'
                      : 'equity.callStrip.clearsPrice',
                    {
                      hero: <PokerNotation>{formatPercent(heroEquityPct / 100, 1)}</PokerNotation>,
                      needed: (
                        <PokerNotation>
                          {formatPercent(callFacts.callerPotOddsPercent / 100, 1)}
                        </PokerNotation>
                      ),
                    },
                  )}
                </p>
              )}
            </Panel>

            {blockerFacts && (
              <Panel
                title={t('equity.blockers.heading')}
                tier={{ tier: 'exact', detail: t('tier.detail.knownCards') }}
              >
                <div className={styles.blockerBody}>
                  <p className={styles.blockerSummary}>
                    {tNodes('equity.blockers.summary', {
                      removed: (
                        <PokerNotation>{blockerFacts.heroRemovedKnownComboCount}</PokerNotation>
                      ),
                      before: (
                        <PokerNotation>
                          {blockerFacts.physicalEligibleComboCountBeforeHero}
                        </PokerNotation>
                      ),
                      after: (
                        <PokerNotation>
                          {blockerFacts.physicalEligibleComboCountAfterHero}
                        </PokerNotation>
                      ),
                    })}
                  </p>
                  <div className={styles.blockerChipRow}>
                    {blockerFacts.perHeroCard.map((c) => (
                      <Chip key={c.card}>
                        {tNodes('equity.blockers.cardImpact', {
                          card: <PokerNotation>{formatCardGlyph(c.card)}</PokerNotation>,
                          count: <PokerNotation>{c.directKnownComboCount}</PokerNotation>,
                        })}
                      </Chip>
                    ))}
                  </div>
                  {blockerFacts.mostAffectedClasses.length > 0 && (
                    <div className={styles.blockerClassesGroup}>
                      <span className={styles.blockerSubheading}>
                        {t('equity.blockers.topClasses')}
                      </span>
                      <div className={styles.blockerChipRow}>
                        {blockerFacts.mostAffectedClasses.slice(0, 6).map((cls) => (
                          <Chip key={cls.handClass}>
                            <PokerNotation>
                              {cls.handClass} (-{cls.removedKnownComboCount})
                            </PokerNotation>
                          </Chip>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Panel>
            )}
          </div>

          <div className={styles.column}>
            <RunoutExplorerPanel store={store} />
          </div>
        </div>
      )}

      <CardPicker
        open={pickerSlot !== null}
        onClose={() => setPickerSlot(null)}
        title={t('equity.board.slotTitle', { slot: (pickerSlot ?? 0) + 1 })}
        deadCards={deadCards}
        selectedCard={pickerSlot !== null ? (effBoard[pickerSlot] ?? null) : null}
        clearLabel={t('equity.board.clearCard')}
        closeLabel={t('equity.board.closePicker')}
        returnFocusTo={pickerSlot !== null ? slotButtonRefs.current[pickerSlot] ?? null : null}
        onSelectCard={(card) => {
          if (pickerSlot !== null) {
            store.setBoardSlotCard(pickerSlot, card);
          }
        }}
      />
    </section>
  );
}
