import { useEffect, useRef, useState } from 'preact/hooks';
import { matchesShortcutEvent, shortcutsSignal } from '../../../domain/appearance';
import { getSharedEquityStore } from '../../../domain/equity';
import { COUNTERFACTUAL_RANGE_TEMPLATES } from '../../../domain/review';
import { navigateTo } from '../../../domain/shellState';
import { buildRangeMatrixMask, parsePlayerHandInput } from '../../../domain/shorthand';
import {
  EQUITY_REQUEST_SCHEMA_VERSION,
  getSharedEngineClient,
  WEIGHTED_EQUITY_REQUEST_VERSION,
  type DispatchableEquityRequest,
  type DispatchedEquityResult,
  type EngineChannel,
  type EquityResult,
  type RunoutExplorerOutcome,
  type RunoutExplorerResult,
  type RunoutRow,
  type WeightedEquityResult,
} from '../../../engine-api';
import { formatNumber, formatPercent, t } from '../../../i18n';
import type { TierBadgeProps } from '../../kit/chip/Chip';
import {
  EquityOverlay,
  type EquityOverlaySourceOption,
} from '../../kit/equity-overlay/EquityOverlay';
import type { EquityRowProps } from '../../kit/equity-row/EquityRow';
import { readDurationMs } from '../../kit/state';
import { buildRunoutHeatGridRows, formatCardGlyph } from './equityFormatters';

export type InlineEquitySourceId = 'showed' | 'any' | 'tight' | 'standard' | 'loose' | 'custom';

export interface InlineEquityPriceInput {
  readonly requiredPct: number;
  readonly callLabel: string;
  readonly potLabel: string;
}

export interface InlineEquityDrawerProps {
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly onClose: () => void;
  readonly heroCards: readonly [string, string] | null;
  readonly baseBoard: readonly string[];
  readonly revealedVillainCards?: readonly [string, string] | null;
  readonly villainLabel?: string;
  readonly defaultSource: InlineEquitySourceId;
  readonly lockedMessage?: string;
  readonly priceFacts?: InlineEquityPriceInput | null;
  readonly onPinNote?: (summaryLine: string) => void;
}

const INLINE_EQUITY_SAMPLES = 8_000;
const INLINE_RUNOUT_SAMPLES = 250;

function isWeightedEquityResult(data: DispatchedEquityResult): data is WeightedEquityResult {
  return (data as { schemaVersion?: string }).schemaVersion === 'weighted-equity-result/v1';
}

function isExactEquityResult(data: DispatchedEquityResult): data is EquityResult {
  return (data as { schemaVersion?: string }).schemaVersion === 'equity-result/v1';
}

/**
 * Shared smart wrapper for #82 Inline Equity Overlay across Review, Hand, and Training.
 * Dispatches equity and next-card runouts on the shared Worker only when open and unlocked.
 */
export function InlineEquityDrawer({
  open,
  onToggle,
  onClose,
  heroCards,
  baseBoard,
  revealedVillainCards = null,
  villainLabel,
  defaultSource,
  lockedMessage,
  priceFacts = null,
  onPinNote,
}: InlineEquityDrawerProps) {
  const normalizedDefault: InlineEquitySourceId =
    defaultSource === 'showed' && !revealedVillainCards ? 'any' : defaultSource;

  const [source, setSource] = useState<InlineEquitySourceId>(normalizedDefault);
  const [customRangeText, setCustomRangeText] = useState('top 20%');
  const [debouncedCustomRange, setDebouncedCustomRange] = useState('top 20%');
  const [steppedCards, setSteppedCards] = useState<readonly string[]>([]);
  const [loading, setLoading] = useState(false);
  const [runoutsLoading, setRunoutsLoading] = useState(false);
  const [heroPct, setHeroPct] = useState<number | null>(null);
  const [villainPct, setVillainPct] = useState<number | null>(null);
  const [isExact, setIsExact] = useState(false);
  const [trials, setTrials] = useState(0);
  const [rowsByCard, setRowsByCard] = useState<Readonly<Record<string, RunoutRow>>>({});
  const [pinnedNotice, setPinnedNotice] = useState(false);

  const mainChannelRef = useRef<EngineChannel<DispatchedEquityResult> | null>(null);
  const runoutChannelRef = useRef<EngineChannel<RunoutExplorerOutcome> | null>(null);
  const pinTimerRef = useRef<number | null>(null);
  const runSeqRef = useRef(0);
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;

  const heroKey = heroCards ? heroCards.join(',') : '';
  const baseBoardKey = baseBoard.join(',');
  const revealedKey = revealedVillainCards ? revealedVillainCards.join(',') : '';

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (!matchesShortcutEvent(event, shortcutsSignal.value.inlineEquity)) return;
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
      if (document.querySelector('[role="dialog"]:not([data-equity-overlay="true"])')) return;
      event.preventDefault();
      onToggleRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    return () => {
      mainChannelRef.current?.dispose();
      runoutChannelRef.current?.dispose();
      if (pinTimerRef.current !== null) {
        window.clearTimeout(pinTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setSteppedCards([]);
  }, [baseBoardKey, heroKey]);

  useEffect(() => {
    setSource(defaultSource === 'showed' && !revealedVillainCards ? 'any' : defaultSource);
  }, [defaultSource, revealedKey]);

  const resolvedSource: InlineEquitySourceId =
    source === 'showed' && !revealedVillainCards ? 'any' : source;
  const effectiveBoard = [...baseBoard, ...steppedCards].slice(0, 5);
  const effectiveBoardKey = effectiveBoard.join(',');
  const canStepRunout = effectiveBoard.length === 3 || effectiveBoard.length === 4;

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedCustomRange(customRangeText);
    }, 150);
    return () => window.clearTimeout(id);
  }, [customRangeText]);

  const engine = getSharedEngineClient();
  const trimmedCustomRange = debouncedCustomRange.trim();
  const rangeTemplate =
    resolvedSource === 'tight' || resolvedSource === 'standard' || resolvedSource === 'loose'
      ? COUNTERFACTUAL_RANGE_TEMPLATES[resolvedSource]
      : resolvedSource === 'custom'
        ? trimmedCustomRange || 'top 20%'
        : null;

  const parsedRange =
    rangeTemplate && heroCards
      ? parsePlayerHandInput(rangeTemplate, {
          deadCards: [...heroCards, ...effectiveBoard],
          engine,
        })
      : null;

  useEffect(() => {
    if (!open || lockedMessage || !heroCards || ![0, 3, 4, 5].includes(effectiveBoard.length)) {
      mainChannelRef.current?.cancel();
      runoutChannelRef.current?.cancel();
      setLoading(false);
      setRunoutsLoading(false);
      if (!heroCards || lockedMessage) {
        setHeroPct(null);
        setVillainPct(null);
        setRowsByCard({});
      }
      return;
    }

    const seq = (runSeqRef.current += 1);
    mainChannelRef.current ??= engine.createChannel<DispatchedEquityResult>('inline-equity-main');
    runoutChannelRef.current ??= engine.createChannel<RunoutExplorerOutcome>(
      'inline-equity-runouts',
    );

    let req: DispatchableEquityRequest | null = null;
    if (resolvedSource === 'showed' && revealedVillainCards) {
      req = {
        schemaVersion: EQUITY_REQUEST_SCHEMA_VERSION,
        board: [...effectiveBoard],
        deadCards: [],
        method: 'auto',
        samples: INLINE_EQUITY_SAMPLES,
        players: [
          { id: 'hero', cards: [...heroCards] },
          { id: 'villain', cards: [...revealedVillainCards] },
        ],
      };
    } else if (resolvedSource === 'any') {
      req = {
        schemaVersion: EQUITY_REQUEST_SCHEMA_VERSION,
        board: [...effectiveBoard],
        deadCards: [],
        method: 'auto',
        samples: INLINE_EQUITY_SAMPLES,
        players: [
          { id: 'hero', cards: [...heroCards] },
          { id: 'villain', cards: null },
        ],
      };
    } else if (parsedRange && parsedRange.ok && parsedRange.kind === 'exact') {
      req = {
        schemaVersion: EQUITY_REQUEST_SCHEMA_VERSION,
        board: [...effectiveBoard],
        deadCards: [],
        method: 'auto',
        samples: INLINE_EQUITY_SAMPLES,
        players: [
          { id: 'hero', cards: [...heroCards] },
          { id: 'villain', cards: [...parsedRange.cards] },
        ],
      };
    } else if (parsedRange && parsedRange.ok && parsedRange.kind === 'range') {
      req = {
        schemaVersion: WEIGHTED_EQUITY_REQUEST_VERSION,
        board: [...effectiveBoard],
        deadCards: [],
        method: 'auto',
        samples: INLINE_EQUITY_SAMPLES,
        players: [
          { id: 'hero', kind: 'exact', cards: [...heroCards] },
          {
            id: 'villain',
            kind: 'range',
            range: parsedRange.weightedRange,
            sourceRole: 'explicit_opponent_model',
            sourceId: `inline-overlay:${resolvedSource}`,
            weightSemantics: 'relative_combo_likelihood',
          },
        ],
      };
    }

    if (!req) {
      setLoading(false);
      setRunoutsLoading(false);
      setHeroPct(null);
      setVillainPct(null);
      setRowsByCard({});
      return;
    }

    setLoading(true);
    setRowsByCard({});
    setRunoutsLoading(canStepRunout);

    void (async () => {
      const mainRes = await mainChannelRef.current!.run((opts) =>
        engine.async.calculateEquity(req!, opts),
      );
      if (seq !== runSeqRef.current) return;

      if (!mainRes || !mainRes.ok) {
        setLoading(false);
        setRunoutsLoading(false);
        setHeroPct(null);
        setVillainPct(null);
        return;
      }

      const data = mainRes.data;
      if (isExactEquityResult(data)) {
        const heroRes = data.players.find((p) => p.id === 'hero');
        const villRes = data.players.find((p) => p.id === 'villain');
        setHeroPct(heroRes ? Math.round(heroRes.equity * 1000) / 10 : null);
        setVillainPct(villRes ? Math.round(villRes.equity * 1000) / 10 : null);
        setIsExact(Boolean(data.exact));
        setTrials(data.trials);
      } else if (isWeightedEquityResult(data)) {
        const heroRes = data.players.find((p) => p.id === 'hero');
        const villRes = data.players.find((p) => p.id === 'villain');
        setHeroPct(heroRes ? Math.round(heroRes.equity * 1000) / 10 : null);
        setVillainPct(villRes ? Math.round(villRes.equity * 1000) / 10 : null);
        setIsExact(data.method === 'exact');
        setTrials(data.trials);
      }
      setLoading(false);

      if (!canStepRunout) {
        runoutChannelRef.current?.cancel();
        setRunoutsLoading(false);
        return;
      }

      const runoutRes = await runoutChannelRef.current!.run((opts) =>
        engine.async.exploreRunouts(
          req as Exclude<DispatchableEquityRequest, { schemaVersion: 'runout-request/v1' }>,
          { ...opts, samples: INLINE_RUNOUT_SAMPLES },
        ),
      );
      if (seq !== runSeqRef.current) return;

      if (
        runoutRes &&
        runoutRes.ok &&
        runoutRes.data &&
        runoutRes.data.status !== 'unavailable' &&
        !('reason' in runoutRes.data && runoutRes.data.reason !== null)
      ) {
        const nextMap: Record<string, RunoutRow> = {};
        for (const row of (runoutRes.data as RunoutExplorerResult).rows) {
          const card = row.cards[0];
          if (card) nextMap[card] = row;
        }
        setRowsByCard(nextMap);
      }
      setRunoutsLoading(false);
    })();
  }, [open, lockedMessage, heroKey, effectiveBoardKey, resolvedSource, revealedKey, trimmedCustomRange]);

  const sourceOptions: EquityOverlaySourceOption[] = [
    ...(revealedVillainCards
      ? [{ id: 'showed', label: t('equityOverlay.sourceShowed') }]
      : []),
    { id: 'any', label: t('equityOverlay.sourceAny') },
    { id: 'tight', label: t('equityOverlay.sourceTight') },
    { id: 'standard', label: t('equityOverlay.sourceStandard') },
    { id: 'loose', label: t('equityOverlay.sourceLoose') },
    { id: 'custom', label: t('equityOverlay.sourceCustom') },
  ];

  const isRangeSource =
    resolvedSource === 'tight' ||
    resolvedSource === 'standard' ||
    resolvedSource === 'loose' ||
    resolvedSource === 'custom';

  let tier: TierBadgeProps = { tier: 'unavailable' };
  let honestyNote: string | undefined;

  if (lockedMessage) {
    tier = { tier: 'exact', detail: t('tier.detail.priceOnly') };
  } else if (!heroCards) {
    tier = { tier: 'unavailable' };
  } else if (heroPct !== null) {
    if (isRangeSource) {
      tier = {
        tier: 'estimated',
        detail: isExact
          ? t('review.decision.tierAssumptionDetail')
          : t('review.decision.tierAssumptionSampledDetail', {
              trials: formatNumber(trials),
            }),
      };
      honestyNote = t('equityOverlay.assumptionNote');
    } else if (resolvedSource === 'showed') {
      tier = {
        tier: isExact ? 'exact' : 'estimated',
        detail: isExact
          ? t('review.decision.tierKnownDetail', { trials: formatNumber(trials) })
          : t('review.decision.tierSampledDetail', { trials: formatNumber(trials) }),
      };
      honestyNote = isExact
        ? t('equityOverlay.hindsightNote')
        : t('equityOverlay.sampledNote', { trials: formatNumber(trials) });
    } else {
      tier = {
        tier: isExact ? 'exact' : 'estimated',
        detail: isExact
          ? t('equity.method.exact', { count: formatNumber(trials) })
          : t('review.luck.tierSampledDetail', { trials: formatNumber(trials) }),
      };
      honestyNote = isExact
        ? undefined
        : t('equityOverlay.sampledNote', { trials: formatNumber(trials) });
    }
  } else if (loading) {
    tier = { tier: 'estimated', detail: t('equity.method.estimating') };
  }

  const deltaPct =
    heroPct !== null && priceFacts ? Math.round((heroPct - priceFacts.requiredPct) * 10) / 10 : undefined;

  const heroRow: EquityRowProps | null =
    heroCards && heroPct !== null
      ? {
          id: 'inline-hero',
          who: t('training.duel.heroName'),
          isHero: true,
          cards: heroCards.map((c) => ({ card: c, state: 'face' as const })),
          barTone: 'accent',
          equityPct: heroPct,
          deltaPct,
        }
      : null;

  const sourceRangeLabel =
    resolvedSource === 'tight'
      ? t('equityOverlay.sourceTight')
      : resolvedSource === 'standard'
        ? t('equityOverlay.sourceStandard')
        : resolvedSource === 'loose'
          ? t('equityOverlay.sourceLoose')
          : t('equityOverlay.sourceCustom');

  const rangeMatrix =
    isRangeSource && parsedRange && parsedRange.ok && parsedRange.kind === 'range'
      ? buildRangeMatrixMask(parsedRange.handClasses)
      : undefined;

  const villainRow: EquityRowProps | null =
    villainPct !== null
      ? resolvedSource === 'showed' && revealedVillainCards
        ? {
            id: 'inline-villain',
            who: villainLabel ?? t('equityOverlay.sourceShowed'),
            cards: revealedVillainCards.map((c) => ({ card: c, state: 'face' as const })),
            barTone: 'under',
            equityPct: villainPct,
          }
        : resolvedSource === 'any'
          ? {
              id: 'inline-villain',
              who: t('equityOverlay.sourceAny'),
              cards: [{ state: 'back' }, { state: 'back' }],
              rangeLabel: 'any',
              barTone: 'under',
              equityPct: villainPct,
            }
          : {
              id: 'inline-villain',
              who: sourceRangeLabel,
              rangeLabel: parsedRange && parsedRange.ok ? parsedRange.canonical : undefined,
              rangeMatrix,
              rangeComboLabel:
                parsedRange && parsedRange.ok && parsedRange.kind === 'range'
                  ? t('review.decision.combosLabel', { count: parsedRange.eligibleCombos })
                  : undefined,
              barTone: 'under',
              equityPct: villainPct,
            }
      : null;

  const deadSet = new Set<string>([
    ...(heroCards ?? []),
    ...effectiveBoard,
    ...(resolvedSource === 'showed' && revealedVillainCards ? revealedVillainCards : []),
  ]);

  const runoutGridRows =
    canStepRunout && !lockedMessage && heroCards
      ? buildRunoutHeatGridRows({
          rowsByCard,
          deadSet,
          isLoading: runoutsLoading,
        })
      : undefined;

  const overlayPrice = priceFacts
    ? {
        neededPct: formatPercent(priceFacts.requiredPct / 100, 1),
        callLabel: priceFacts.callLabel,
        potLabel: priceFacts.potLabel,
      }
    : null;

  const handlePin =
    onPinNote && heroCards && heroPct !== null
      ? () => {
          const heroText = heroCards.map(formatCardGlyph).join(' ');
          const villText =
            resolvedSource === 'showed' && revealedVillainCards
              ? revealedVillainCards.map(formatCardGlyph).join(' ')
              : resolvedSource === 'any'
                ? t('equityOverlay.sourceAny')
                : sourceRangeLabel;
          const boardText =
            effectiveBoard.length > 0
              ? ` (${effectiveBoard.map(formatCardGlyph).join(' ')})`
              : '';
          const tierWord = t(`tier.${tier.tier}`);
          const pctText = formatPercent(heroPct / 100, 1);
          const line = `${heroText} vs ${villText}${boardText}: ${pctText} (${tierWord})`;
          onPinNote(line);
          setPinnedNotice(true);
          if (pinTimerRef.current !== null) {
            window.clearTimeout(pinTimerRef.current);
          }
          const noticeMs = readDurationMs('--dur-notice');
          if (noticeMs > 0) {
            pinTimerRef.current = window.setTimeout(() => setPinnedNotice(false), noticeMs);
          }
        }
      : undefined;

  const handleOpenInEquity = heroCards
    ? () => {
        const villainRawInput =
          resolvedSource === 'showed' && revealedVillainCards
            ? revealedVillainCards.join('')
            : resolvedSource === 'any'
              ? 'random'
              : parsedRange && parsedRange.ok
                ? parsedRange.canonical
                : rangeTemplate ?? 'top 20%';

        const villainDisplay =
          resolvedSource === 'showed' && revealedVillainCards
            ? villainLabel ?? t('equityOverlay.sourceShowed')
            : resolvedSource === 'any'
              ? t('equityOverlay.sourceAny')
              : sourceRangeLabel;

        getSharedEquityStore().loadExternalMatchup({
          board: [...effectiveBoard],
          players: [
            {
              label: t('training.duel.heroName'),
              rawInput: heroCards.join(''),
              isHero: true,
            },
            {
              label: villainDisplay,
              rawInput: villainRawInput,
              isHero: false,
            },
          ],
        });
        onClose();
        navigateTo('equity');
      }
    : undefined;

  const customRangeInvalid =
    resolvedSource === 'custom' &&
    Boolean(heroCards) &&
    Boolean(trimmedCustomRange) &&
    Boolean(parsedRange && !parsedRange.ok);

  const customRangeSummary =
    resolvedSource === 'custom' && parsedRange && parsedRange.ok
      ? parsedRange.kind === 'range'
        ? t('review.decision.combosLabel', { count: parsedRange.eligibleCombos })
        : parsedRange.canonical
      : undefined;

  return (
    <EquityOverlay
      open={open}
      onClose={onClose}
      tier={tier}
      lockedMessage={lockedMessage}
      emptyMessage={!lockedMessage && !heroCards ? t('equityOverlay.noHeroCards') : undefined}
      loading={loading}
      boardCards={effectiveBoard}
      canStepBack={steppedCards.length > 0}
      onStepBack={() => setSteppedCards((prev) => prev.slice(0, -1))}
      sourceOptions={!lockedMessage && heroCards ? sourceOptions : undefined}
      activeSourceId={resolvedSource}
      onSelectSource={(id) => setSource(id as InlineEquitySourceId)}
      customRangeValue={customRangeText}
      customRangeSummary={customRangeSummary}
      customRangeInvalid={customRangeInvalid}
      onChangeCustomRange={setCustomRangeText}
      heroRow={heroRow}
      villainRow={villainRow}
      priceFacts={overlayPrice}
      honestyNote={honestyNote}
      runoutGridRows={runoutGridRows}
      runoutsLoading={runoutsLoading}
      onPickNextCard={(cardId) => {
        if (effectiveBoard.length < 5) {
          setSteppedCards((prev) => [...prev, cardId]);
        }
      }}
      onPinNote={handlePin}
      pinnedNotice={pinnedNotice}
      onOpenInEquity={handleOpenInEquity}
    />
  );
}
