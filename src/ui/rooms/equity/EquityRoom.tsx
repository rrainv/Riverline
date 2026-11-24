import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  DEFAULT_INTERACTIVE_SAMPLES,
  REFINED_INTERACTIVE_SAMPLES,
  type EquityPlayerEntry,
  type EquityStore,
} from '../../../domain/equity';
import { classifyBoardTexture } from '../../../domain/equity/boardTexture';
import {
  computePostflopRangeBreakdown,
  RANGE_BREAKDOWN_BUCKET_ORDER,
  type RangeBreakdownBucketId,
} from '../../../domain/equity/rangeBreakdown';
import { computeEquityHistogramVsRange } from '../../../domain/equity/rangeHistogram';
import {
  allVillainProfilesSignal,
  deleteVillainProfile,
  saveVillainProfile,
} from '../../../domain/profiles/villainProfiles';
import {
  buildRangeMatrixMask,
  parsePlayerHandInput,
} from '../../../domain/shorthand';
import { getSharedStrategyStore } from '../../../domain/strategy';
import { CATEGORY_BY_RANK, createStrategyContext, getSharedEngineClient, type HandCategory } from '../../../engine-api';
import { formatNumber, formatPercent, t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { Chip, TierBadge, type Tier } from '../../kit/chip/Chip';
import { ChipButton } from '../../kit/choice/Choice';
import { EquityList, EquityRow } from '../../kit/equity-row/EquityRow';
import { FactTile, FactTileRow } from '../../kit/fact-tile/FactTile';
import { TextField } from '../../kit/input/TextField';
import { Panel } from '../../kit/panel/Panel';
import { CardPicker } from '../../kit/playing-card/CardPicker';
import { PlayingCard } from '../../kit/playing-card/PlayingCard';
import { PopoverMenu } from '../../kit/overlay/PopoverMenu';
import { cx, readDurationMs } from '../../kit/state';
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
const MATRIX_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;

function matrixCellClass(r: number, c: number): string {
  const r1 = MATRIX_RANKS[r]!;
  const r2 = MATRIX_RANKS[c]!;
  if (r === c) return `${r1}${r2}`;
  if (r < c) return `${r1}${r2}s`;
  return `${r2}${r1}o`;
}

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
  const density = store.densitySignal.value;
  const draftInput = store.draftInputSignal.value;
  const draftPreview = store.draftPreviewSignal.value;
  const submitError = store.submitAttemptedErrorSignal.value;
  const refined = store.refinedSamplesSignal.value;
  const deadCards = new Set(store.deadCardsSignal.value);

  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [playerCardPicker, setPlayerCardPicker] = useState<{
    playerId: string;
    slotIndex: 0 | 1;
    anchor: HTMLButtonElement | null;
  } | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editPlayerText, setEditPlayerText] = useState<string>('');
  const [newProfileName, setNewProfileName] = useState<string>('');
  const villainProfiles = allVillainProfilesSignal.value;
  const slotButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [expandedRows, setExpandedRows] = useState<ReadonlySet<string>>(() => new Set());
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [randomMenuOpen, setRandomMenuOpen] = useState(false);
  const randomBtnRef = useRef<HTMLButtonElement | null>(null);
  const [impliedExtraBb, setImpliedExtraBb] = useState(0);
  const [showRiverDist, setShowRiverDist] = useState(true);
  const [matrixWeightBrush, setMatrixWeightBrush] = useState<1 | 0.75 | 0.5 | 0.25>(1);
  const saveTimerRef = useRef<number | null>(null);
  const potBeforeBetBb = store.potBeforeBetBbSignal.value;
  const betToCallBb = store.betToCallBbSignal.value;
  const remainingStackBb = store.remainingStackBbSignal.value;
  const keepHero = store.randomKeepHeroSignal.value;
  const keepVillains = store.randomKeepVillainsSignal.value;
  const keepBoard = store.randomKeepBoardSignal.value;
  const setPotBeforeBetBb = (next: number) => {
    store.potBeforeBetBbSignal.value = next;
  };
  const setBetToCallBb = (next: number) => {
    store.betToCallBbSignal.value = next;
  };
  const setRemainingStackBb = (next: number) => {
    store.remainingStackBbSignal.value = next;
  };

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

  const heroPlayer = players[0];
  const heroComputed = heroPlayer ? equitySnap.players[heroPlayer.id] : undefined;
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
        actorContestablePotAfterCallBb: potBeforeBetBb + effectiveCallBb,
        effectiveStackBb: remainingStackBb,
      })
    : null;
  const mdfPct = mdfRes && mdfRes.ok && mdfRes.data !== null ? mdfRes.data * 100 : null;
  const priceComparisonRes =
    equitySnap.status === 'ready' && heroComputed && callFacts
      ? engineClient.sync.compareCallEquityToRequired({
          heroEquityFraction: heroEquityPct / 100,
          requiredEquityFraction: callFacts.callerPotOddsPercent / 100,
          isExact: equitySnap.method === 'exact',
          isCallAction: true,
        })
      : null;
  const priceComparison = priceComparisonRes && priceComparisonRes.ok ? priceComparisonRes.data : null;

  const rangeVillain = players.find((p, idx) => idx > 0 && p.inputKind === 'range' && p.weightedRange);
  const unconditionedVillainParsed = rangeVillain
    ? parsePlayerHandInput(rangeVillain.rawInput, {
        deadCards: [...effBoard],
        engine: engineClient,
      })
    : null;
  const unconditionedVillainRange =
    unconditionedVillainParsed && unconditionedVillainParsed.ok && unconditionedVillainParsed.kind === 'range'
      ? unconditionedVillainParsed.weightedRange
      : rangeVillain?.weightedRange;

  const blockerAnalysisRes =
    heroPlayer &&
    heroPlayer.inputKind === 'exact' &&
    heroPlayer.cards &&
    rangeVillain &&
    unconditionedVillainRange
      ? engineClient.sync.analyzeRange({
          heroCards: [...heroPlayer.cards],
          board: [...effBoard],
          deadCards: [],
          ranges: {
            villain: {
              role: 'opponent',
              subjectId: rangeVillain.id,
              label: rangeVillain.label,
              range: unconditionedVillainRange,
            },
          },
        })
      : null;
  const blockerFacts =
    blockerAnalysisRes && blockerAnalysisRes.ok
      ? blockerAnalysisRes.data.ranges['villain']?.blockers ?? null
      : null;

  const boardTextureTags = useMemo(() => classifyBoardTexture(effBoard), [effBoard]);

  const breakdownTarget = rangeVillain ?? players.find((p) => p.inputKind === 'range' && p.weightedRange);
  const rangeFilterBucketsMap = store.rangeFilterBucketsSignal.value;
  const rangeBucketWeightsMap = store.rangeBucketWeightsSignal.value;
  const activeBucketWeights = useMemo<Readonly<Partial<Record<RangeBreakdownBucketId, number>>>>(() => {
    if (!breakdownTarget) return {};
    const weights = rangeBucketWeightsMap[breakdownTarget.id];
    if (weights && Object.keys(weights).length > 0) return weights;
    const saved = rangeFilterBucketsMap[breakdownTarget.id];
    if (!saved || saved.length === 0) return {};
    const out: Partial<Record<RangeBreakdownBucketId, number>> = {};
    for (const id of RANGE_BREAKDOWN_BUCKET_ORDER) {
      if (!saved.includes(id)) out[id] = 0;
    }
    return out;
  }, [breakdownTarget, rangeBucketWeightsMap, rangeFilterBucketsMap]);

  const rangeBreakdown = useMemo(() => {
    if (effBoard.length < 3 || !breakdownTarget?.weightedRange) return null;
    return computePostflopRangeBreakdown(
      breakdownTarget.weightedRange,
      effBoard,
      store.deadCardsSignal.value,
    );
  }, [breakdownTarget, effBoard, store.deadCardsSignal.value]);

  const equityHistogram = useMemo(() => {
    if (
      !heroPlayer ||
      heroPlayer.inputKind !== 'exact' ||
      !heroPlayer.cards ||
      !rangeVillain ||
      !unconditionedVillainRange ||
      effBoard.length < 3
    ) {
      return null;
    }
    const villainCombos = unconditionedVillainRange.entries
      .filter((e) => e.state === 'known' && e.weight > 0)
      .map((e) => {
        if (e.comboId.startsWith('holdem-combo/v1:')) {
          const parts = e.comboId.slice('holdem-combo/v1:'.length).split(':');
          if (parts.length === 2 && parts[0] && parts[1]) {
            return [parts[0], parts[1]] as const;
          }
        }
        if (e.comboId.length === 4) {
          return [e.comboId.slice(0, 2), e.comboId.slice(2, 4)] as const;
        }
        return null;
      })
      .filter((c): c is readonly [string, string] => c !== null);
    return computeEquityHistogramVsRange({
      heroCards: heroPlayer.cards,
      villainCombos,
      board: effBoard,
    });
  }, [heroPlayer, rangeVillain, unconditionedVillainRange, effBoard]);

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
      aria-busy={equitySnap.status === 'calculating'}
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

                  const isEditingThisRow = editingPlayerId === entry.id;
                  const showDrawer = isExpanded || isEditingThisRow;

                  const toggleMatrixClass = (handClass: string) => {
                    const parsedCurrent =
                      entry.inputKind === 'range'
                        ? parsePlayerHandInput(editPlayerText || entry.rawInput, {
                            deadCards: [],
                            engine: engineClient,
                          })
                        : null;
                    const weightMap = new Map<string, number>();
                    if (parsedCurrent && parsedCurrent.ok && parsedCurrent.kind === 'range') {
                      for (const hc of parsedCurrent.handClasses) {
                        weightMap.set(hc, parsedCurrent.handClassWeights[hc] ?? 1);
                      }
                    } else if (entry.inputKind === 'range' && entry.handClasses) {
                      for (const hc of entry.handClasses) {
                        weightMap.set(hc, 1);
                      }
                    }
                    const existingWeight = weightMap.get(handClass);
                    if (
                      existingWeight !== undefined &&
                      Math.abs(existingWeight - matrixWeightBrush) < 0.01
                    ) {
                      weightMap.delete(handClass);
                    } else {
                      weightMap.set(handClass, matrixWeightBrush);
                    }
                    const nextStr =
                      weightMap.size > 0
                        ? [...weightMap.entries()]
                            .map(([hc, w]) => (w < 0.9999 ? `${hc}:${Math.round(w * 100)}%` : hc))
                            .join(', ')
                        : 'any';
                    setEditPlayerText(nextStr);
                    store.updatePlayerInput(entry.id, nextStr);
                  };

                  const expandedNode = showDrawer ? (
                    <div className={styles.drawerBody}>
                      {isEditingThisRow && (
                        <div className={styles.rowEditorBox}>
                          <div className={styles.rowEditorHeader}>
                            <span className={styles.blockerSubheading}>
                              {t('equity.editor.heading', { who: whoLabel })}
                            </span>
                            <div className={styles.rowEditorPresets}>
                              <ChipButton
                                selected={entry.inputKind === 'any'}
                                onToggle={() => {
                                  setEditPlayerText('any');
                                  store.updatePlayerInput(entry.id, 'any');
                                }}
                              >
                                {t('equity.editor.presetAny')}
                              </ChipButton>
                              <ChipButton
                                selected={false}
                                onToggle={() => {
                                  const next = 'QQ+, AKs, AQs, AKo';
                                  setEditPlayerText(next);
                                  store.updatePlayerInput(entry.id, next);
                                }}
                              >
                                {t('equity.editor.presetTop15')}
                              </ChipButton>
                              <ChipButton
                                selected={false}
                                onToggle={() => {
                                  const next = '77+, ATs+, KQs, AJo+, KQo';
                                  setEditPlayerText(next);
                                  store.updatePlayerInput(entry.id, next);
                                }}
                              >
                                {t('equity.editor.presetTop25')}
                              </ChipButton>
                              <ChipButton
                                selected={false}
                                onToggle={() => {
                                  const next = '22+, A2s+, K9s+, Q9s+, J9s+, T9s, A9o+, KTo+, QJo';
                                  setEditPlayerText(next);
                                  store.updatePlayerInput(entry.id, next);
                                }}
                              >
                                {t('equity.editor.presetTop40')}
                              </ChipButton>
                              <ChipButton
                                selected={false}
                                onToggle={() => {
                                  const strat = getSharedStrategyStore();
                                  const ctx = createStrategyContext({
                                    tableSize: 6,
                                    stackDepthBb: 100,
                                    decisionFamily: 'preflop_rfi',
                                    position: 'BTN',
                                  });
                                  const proj = engineClient.sync.projectStrategyMatrix(
                                    ctx,
                                    strat.evidenceSignal.value,
                                  );
                                  const opened = proj.ok
                                    ? proj.data.cells
                                        .filter((c) => c.dominantAction === 'raise')
                                        .map((c) => c.handClass)
                                    : [];
                                  const next = opened.length > 0 ? opened.join(', ') : '22+, A2s+, K9s+, Q9s+, J9s+, T9s, A9o+, KTo+, QJo';
                                  setEditPlayerText(next);
                                  store.updatePlayerInput(entry.id, next);
                                }}
                              >
                                {t('equity.editor.loadBtnPlan')}
                              </ChipButton>
                              {villainProfiles.map((prof) => (
                                <span key={prof.id} className={styles.profileChipWrap}>
                                  <ChipButton
                                    selected={editPlayerText.trim() === prof.rangeText}
                                    onToggle={() => {
                                      setEditPlayerText(prof.rangeText);
                                      store.updatePlayerInput(entry.id, prof.rangeText);
                                    }}
                                  >
                                    {prof.name}
                                  </ChipButton>
                                  {!prof.builtIn && (
                                    <button
                                      type="button"
                                      className={styles.profileDeleteBtn}
                                      aria-label={`Remove ${prof.name}`}
                                      onClick={() => deleteVillainProfile(prof.id)}
                                    >
                                      ×
                                    </button>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className={styles.saveProfileRow}>
                            <input
                              type="text"
                              className={styles.saveProfileInput}
                              value={newProfileName}
                              placeholder={t('equity.profiles.namePlaceholder')}
                              aria-label={t('equity.profiles.namePlaceholder')}
                              onInput={(e) => setNewProfileName((e.target as HTMLInputElement).value)}
                            />
                            <Button
                              variant="secondary"
                              disabled={!editPlayerText.trim()}
                              onClick={() => {
                                const targetName = newProfileName.trim() || whoLabel;
                                if (saveVillainProfile(targetName, editPlayerText)) {
                                  setNewProfileName('');
                                }
                              }}
                            >
                              {t('equity.profiles.saveBtn')}
                            </Button>
                          </div>

                          <TextField
                            value={editPlayerText}
                            onValueChange={setEditPlayerText}
                            onSubmit={() => {
                              if (store.updatePlayerInput(entry.id, editPlayerText)) {
                                setEditingPlayerId(null);
                              }
                            }}
                            placeholder={t('equity.editor.inputPlaceholder')}
                            ariaLabel={t('equity.editor.heading', { who: whoLabel })}
                            submitLabel={t('equity.editor.apply')}
                            ltrInput
                          />

                          <div className={styles.rowEditorPresets} role="group" aria-label={t('equity.editor.weightBrushAria')}>
                            <span className={styles.mutedHint}>{t('equity.editor.weightBrushLabel')}</span>
                            {([1, 0.75, 0.5, 0.25] as const).map((w) => (
                              <ChipButton
                                key={w}
                                selected={matrixWeightBrush === w}
                                onToggle={() => setMatrixWeightBrush(w)}
                              >
                                <PokerNotation>{`${Math.round(w * 100)}%`}</PokerNotation>
                              </ChipButton>
                            ))}
                          </div>
                          <p className={styles.mutedHint}>{t('equity.editor.matrixHint')}</p>
                          <div className={styles.rangeMatrixGrid} dir="ltr" role="grid">
                            {MATRIX_RANKS.map((_, r) =>
                              MATRIX_RANKS.map((__, c) => {
                                const cls = matrixCellClass(r, c);
                                const active = Boolean(matrixMask?.[r]?.[c]);
                                return (
                                  <button
                                    key={cls}
                                    type="button"
                                    className={cx(
                                      styles.rangeMatrixCell,
                                      active && styles.rangeMatrixCellActive,
                                    )}
                                    aria-pressed={active ? 'true' : 'false'}
                                    onClick={() => toggleMatrixClass(cls)}
                                  >
                                    {cls}
                                  </button>
                                );
                              }),
                            )}
                          </div>
                        </div>
                      )}
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
                          ? entry.hasPartialWeights && entry.weightedEligibleCombos !== undefined
                            ? t('equity.row.weightedCombosLabel', {
                                weighted: entry.weightedEligibleCombos,
                                count: entry.eligibleCombos,
                              })
                            : t('equity.row.combosLabel', { count: entry.eligibleCombos })
                          : undefined
                      }
                      rangeMatrix={matrixMask}
                      equityPct={computed ? computed.equityPct : 0}
                      previousEquityPct={computed?.previousEquityPct}
                      deltaPct={computed?.deltaPct}
                      barTone={barTone}
                      rightNow={formatRightNowFact(entry, computed)}
                      density={density}
                      expanded={showDrawer}
                      onToggleExpand={() => {
                        if (isEditingThisRow) setEditingPlayerId(null);
                        toggleExpandedRow(entry.id);
                      }}
                      expandedContent={expandedNode}
                      onCardSlotClick={(slotIndex, anchor) => {
                        setPlayerCardPicker({
                          playerId: entry.id,
                          slotIndex,
                          anchor,
                        });
                      }}
                      onEditRow={() => {
                        if (isEditingThisRow) {
                          setEditingPlayerId(null);
                        } else {
                          setEditingPlayerId(entry.id);
                          setEditPlayerText(entry.rawInput);
                        }
                      }}
                      onRandomizeRow={() => store.randomizePlayer(entry.id)}
                      onRemove={players.length > 2 ? () => store.removePlayer(entry.id) : undefined}
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
                  <div className={styles.boardFeltStrip} data-audit-allow="true">
                    <div className={styles.boardSlots} dir="ltr" role="group" aria-label={t('equity.board.label')}>
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
                            className={cx(
                              styles.boardSlotBtn,
                              slotIdx >= 3 && styles.boardSlotStreetGap,
                            )}
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
                  </div>

                  <div className={styles.boardActions}>
                    <div className={styles.randomMenuWrap}>
                      <Button
                        buttonRef={(el) => {
                          randomBtnRef.current = el;
                        }}
                        variant="secondary"
                        onClick={() => setRandomMenuOpen((open) => !open)}
                      >
                        {t('random.menuButton')}
                      </Button>
                      <PopoverMenu
                        open={randomMenuOpen}
                        onClose={() => setRandomMenuOpen(false)}
                        anchorEl={randomBtnRef.current}
                      >
                        <button
                          type="button"
                          role="menuitem"
                          className={styles.randomMenuItem}
                          onClick={() => {
                            store.dealRandomBoard('current');
                            setRandomMenuOpen(false);
                          }}
                        >
                          {t('random.boardCurrent')}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className={styles.randomMenuItem}
                          onClick={() => {
                            store.dealRandomBoard('flop');
                            setRandomMenuOpen(false);
                          }}
                        >
                          {t('random.boardFlop')}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className={styles.randomMenuItem}
                          onClick={() => {
                            store.dealRandomBoard('turn');
                            setRandomMenuOpen(false);
                          }}
                        >
                          {t('random.boardTurn')}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className={styles.randomMenuItem}
                          onClick={() => {
                            store.dealRandomBoard('river');
                            setRandomMenuOpen(false);
                          }}
                        >
                          {t('random.boardRiver')}
                        </button>
                        {heroPlayer && (
                          <button
                            type="button"
                            role="menuitem"
                            className={styles.randomMenuItem}
                            onClick={() => {
                              store.randomizePlayer(heroPlayer.id);
                              setRandomMenuOpen(false);
                            }}
                          >
                            {t('random.heroCards')}
                          </button>
                        )}
                        <button
                          type="button"
                          role="menuitem"
                          className={styles.randomMenuItem}
                          onClick={() => {
                            store.randomizeVillains();
                            setRandomMenuOpen(false);
                          }}
                        >
                          {t('random.villainHands')}
                        </button>

                        <div className={styles.randomMenuDivider} />

                        <div className={styles.randomMenuSection}>
                          <span className={styles.randomMenuLabel}>{t('random.locksHeading')}</span>
                          <div className={styles.randomKeepsRow}>
                            <ChipButton
                              selected={keepHero}
                              onToggle={() => store.setRandomKeep('hero', !keepHero)}
                            >
                              {t('equity.random.keepHero')}
                            </ChipButton>
                            <ChipButton
                              selected={keepVillains}
                              onToggle={() => store.setRandomKeep('villains', !keepVillains)}
                            >
                              {t('equity.random.keepVillains')}
                            </ChipButton>
                            <ChipButton
                              selected={keepBoard}
                              onToggle={() => store.setRandomKeep('board', !keepBoard)}
                            >
                              {t('equity.random.keepBoard')}
                            </ChipButton>
                          </div>
                          <Button
                            variant="primary"
                            onClick={() => {
                              store.randomizeMatchup();
                              setRandomMenuOpen(false);
                            }}
                          >
                            {t('random.fullMatchup')}
                          </Button>
                        </div>
                      </PopoverMenu>
                    </div>

                    <Button
                      variant="secondary"
                      disabled={board.length === 0 && !store.turnCardSignal.value}
                      onClick={() => store.clearBoard()}
                    >
                      {t('equity.board.clear')}
                    </Button>
                    {nonZeroRiverCategories.length > 0 && (
                      <ChipButton
                        selected={showRiverDist}
                        onToggle={() => setShowRiverDist((prev) => !prev)}
                      >
                        {t('equity.board.toggleOdds')}
                      </ChipButton>
                    )}
                  </div>
                </div>
              </div>

              {nonZeroRiverCategories.length === 0 ? (
                <p className={styles.mutedHint}>{t('equity.method.incompleteBoard')}</p>
              ) : showRiverDist ? (
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
              ) : null}

              {boardTextureTags.length > 0 && (
                <div className={styles.blockerChipRow} aria-label={t('equity.texture.aria')}>
                  {boardTextureTags.map((tag) => (
                    <Chip key={tag}>{t(`equity.texture.${tag}` as never)}</Chip>
                  ))}
                </div>
              )}
            </Panel>

            {rangeBreakdown && breakdownTarget && (
              <Panel
                title={t('equity.breakdown.heading', {
                  who: breakdownTarget.isHero
                    ? t('equity.row.hero')
                    : t('equity.row.villain', {
                        index: Math.max(
                          1,
                          players.filter((p) => !p.isHero).findIndex((p) => p.id === breakdownTarget.id) + 1,
                        ),
                      }),
                })}
                tier={{ tier: 'exact', detail: t('tier.detail.knownCards') }}
              >
                <div className={styles.breakdownHeaderRow}>
                  <div className={styles.breakdownPresets}>
                    <ChipButton
                      selected={Object.keys(activeBucketWeights).length === 0}
                      onToggle={() => store.setRangeBreakdownFilter(breakdownTarget.id, null)}
                    >
                      {t('equity.breakdown.presetAll')}
                    </ChipButton>
                    <ChipButton
                      selected={
                        activeBucketWeights.air === 0 &&
                        activeBucketWeights.gutshot_overcards === 0
                      }
                      onToggle={() =>
                        store.setRangeBreakdownFilter(breakdownTarget.id, [
                          'sets_plus',
                          'two_pair',
                          'top_overpair',
                          'mid_weak_pair',
                          'combo_draw',
                          'flush_straight_draw',
                        ])
                      }
                    >
                      {t('equity.breakdown.presetPairsDraws')}
                    </ChipButton>
                    <ChipButton
                      selected={
                        activeBucketWeights.mid_weak_pair === 0 &&
                        activeBucketWeights.air === 0 &&
                        activeBucketWeights.sets_plus === undefined &&
                        activeBucketWeights.top_overpair === undefined
                      }
                      onToggle={() =>
                        store.setRangeBreakdownFilter(breakdownTarget.id, [
                          'sets_plus',
                          'two_pair',
                          'top_overpair',
                        ])
                      }
                    >
                      {t('equity.breakdown.presetTopPlus')}
                    </ChipButton>
                  </div>
                  <span className={styles.breakdownSummary}>
                    {(() => {
                      const keptWeight = rangeBreakdown.buckets.reduce(
                        (acc, b) => acc + b.weightedCombos * (activeBucketWeights[b.id] ?? 1),
                        0,
                      );
                      const keptPct =
                        rangeBreakdown.totalWeight > 0
                          ? Math.round((keptWeight / rangeBreakdown.totalWeight) * 1000) / 10
                          : 0;
                      return t('equity.breakdown.continuing', {
                        pct: formatNumber(keptPct),
                        combos: formatNumber(Math.round(keptWeight * 10) / 10),
                      });
                    })()}
                  </span>
                </div>
                <div className={styles.breakdownList}>
                  {rangeBreakdown.buckets.map((bucket) => {
                    const mult = activeBucketWeights[bucket.id] ?? 1;
                    const active = mult > 0;
                    const empty = bucket.comboCount === 0;
                    return (
                      <button
                        key={bucket.id}
                        type="button"
                        disabled={empty}
                        aria-pressed={active ? 'true' : 'false'}
                        className={cx(
                          styles.breakdownRow,
                          active && !empty && styles.breakdownRowActive,
                          empty && styles.breakdownRowEmpty,
                        )}
                        onClick={() =>
                          store.cycleRangeBreakdownBucketWeight(breakdownTarget.id, bucket.id)
                        }
                      >
                        <span className={styles.breakdownLabel}>
                          {t(`equity.breakdown.bucket.${bucket.id}` as never)}
                        </span>
                        <span className={styles.breakdownTrack} aria-hidden="true">
                          <span
                            className={styles.breakdownFill}
                            style={{ width: `${Math.min(100, Math.max(0, bucket.sharePct))}%` }}
                          />
                        </span>
                        <span className={styles.breakdownStats}>
                          <PokerNotation>{formatNumber(bucket.comboCount)}</PokerNotation>
                          {' · '}
                          <PokerNotation>{formatPercent(bucket.sharePct / 100, 1)}</PokerNotation>
                          {' · '}
                          <PokerNotation>{`${Math.round(mult * 100)}%`}</PokerNotation>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Panel>
            )}

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
                <Stepper
                  label={t('equity.callStrip.impliedLabel')}
                  ariaLabel={t('equity.callStrip.impliedLabel')}
                  value={impliedExtraBb}
                  onChange={setImpliedExtraBb}
                  min={0}
                  max={300}
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

              {impliedExtraBb > 0 && callFacts && effectiveCallBb > 0 && (
                <p className={styles.mutedHint}>
                  {tNodes('equity.callStrip.impliedAssumption', {
                    extra: <PokerNotation>{formatNumber(impliedExtraBb)}</PokerNotation>,
                    needed: (
                      <PokerNotation>
                        {formatPercent(
                          effectiveCallBb /
                            (potBeforeBetBb + effectiveCallBb * 2 + impliedExtraBb),
                          1,
                        )}
                      </PokerNotation>
                    ),
                  })}
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
            {equityHistogram && (
              <Panel
                title={t('equity.histogram.heading')}
                tier={{
                  tier: equityHistogram.exact ? 'exact' : 'estimated',
                  detail: t('equity.histogram.combosCount', {
                    count: formatNumber(equityHistogram.totalCombos),
                  }),
                }}
              >
                <p className={styles.mutedHint}>
                  {t('equity.histogram.summary', {
                    crushing: formatNumber(equityHistogram.crushingPct, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    }),
                    flipped: formatNumber(equityHistogram.flippedPct, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    }),
                    behind: formatNumber(equityHistogram.behindPct, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    }),
                  })}
                </p>
                <div className={styles.histogramGrid}>
                  {equityHistogram.buckets.map((bucket) => (
                    <div key={bucket.id} className={styles.histogramBucket}>
                      <span className={styles.histogramPct}>
                        <PokerNotation>{`${formatNumber(bucket.sharePct, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}%`}</PokerNotation>
                      </span>
                      <span className={styles.histogramLabel}>
                        <PokerNotation>{bucket.label}</PokerNotation>
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
            )}
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

      <CardPicker
        open={playerCardPicker !== null}
        onClose={() => setPlayerCardPicker(null)}
        title={t('kit.equity.editCardSlot', {
          who: players.find((p) => p.id === playerCardPicker?.playerId)?.label ?? 'Player',
          slot: (playerCardPicker?.slotIndex ?? 0) + 1,
        })}
        deadCards={deadCards}
        selectedCard={
          playerCardPicker
            ? (players.find((p) => p.id === playerCardPicker.playerId)?.cards?.[
                playerCardPicker.slotIndex
              ] ?? null)
            : null
        }
        clearLabel={t('equity.board.clearCard')}
        closeLabel={t('equity.board.closePicker')}
        returnFocusTo={playerCardPicker?.anchor ?? null}
        onSelectCard={(card) => {
          if (playerCardPicker && card) {
            store.setPlayerCard(playerCardPicker.playerId, playerCardPicker.slotIndex, card);
          }
        }}
      />
    </section>
  );
}
