import { useEffect, useMemo, useState } from 'preact/hooks';
import { getSharedEngineClient } from '../../../engine-api';
import { parsePlayerHandInput } from '../../../domain/shorthand';
import type { StrategyStore } from '../../../domain/strategy';
import {
  computeTextureSubsetReport,
  TEXTURE_SUBSET_PRESETS,
  type TexturePresetId,
} from '../../../domain/strategy/textureSubset';
import { formatNumber, t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { ChipButton } from '../../kit/choice/Choice';
import { TextField } from '../../kit/input/TextField';
import { Panel } from '../../kit/panel/Panel';
import { PlayingCard } from '../../kit/playing-card/PlayingCard';
import styles from './StrategyRoom.module.css';

type SortKey = 'topPairPlus' | 'twoPairPlus' | 'draws' | 'continue';

interface TextureSubsetViewProps {
  readonly store: StrategyStore;
}

export function TextureSubsetView({ store }: TextureSubsetViewProps) {
  const engine = getSharedEngineClient();
  const [activePreset, setActivePreset] = useState<TexturePresetId>('btn_open');
  const [rangeInput, setRangeInput] = useState<string>(TEXTURE_SUBSET_PRESETS.btn_open);
  const [sortBy, setSortBy] = useState<SortKey>('continue');
  const pendingRange = store.pendingTextureSubsetRangeSignal.value;

  useEffect(() => {
    if (!pendingRange) return;
    setRangeInput(pendingRange);
    store.pendingTextureSubsetRangeSignal.value = null;
  }, [pendingRange, store]);

  const parsed = useMemo(
    () => parsePlayerHandInput(rangeInput, { engine }),
    [rangeInput, engine],
  );

  const rows = useMemo(() => {
    if (!parsed.ok || parsed.kind !== 'range') return [];
    const base = computeTextureSubsetReport(parsed.weightedRange);
    return [...base].sort((a, b) => {
      if (sortBy === 'topPairPlus') return b.topPairPlusPct - a.topPairPlusPct;
      if (sortBy === 'twoPairPlus') return b.twoPairPlusPct - a.twoPairPlusPct;
      if (sortBy === 'draws') return b.drawsPct - a.drawsPct;
      return b.continuePct - a.continuePct;
    });
  }, [parsed, sortBy]);

  return (
    <Panel
      label={t('strategy.subset.eyebrow')}
      title={t('strategy.subset.heading')}
      tier={{ tier: 'exact', detail: t('tier.detail.knownCards') }}
    >
      <div className={styles.betweenRow}>
        <div className={styles.chipGroup}>
          {(['btn_open', 'co_open', 'utg_open', 'bb_defend'] as const).map((preset) => (
            <ChipButton
              key={preset}
              selected={activePreset === preset}
              onToggle={() => {
                setActivePreset(preset);
                setRangeInput(TEXTURE_SUBSET_PRESETS[preset]);
              }}
            >
              {t(`strategy.subset.preset.${preset}` as never)}
            </ChipButton>
          ))}
        </div>
        <div className={styles.chipGroup}>
          {(['continue', 'topPairPlus', 'twoPairPlus', 'draws'] as const).map((key) => (
            <ChipButton
              key={key}
              selected={sortBy === key}
              onToggle={() => setSortBy(key)}
            >
              {t(`strategy.subset.sort.${key}` as never)}
            </ChipButton>
          ))}
        </div>
      </div>

      <TextField
        value={rangeInput}
        onValueChange={setRangeInput}
        ariaLabel={t('strategy.subset.rangeAria')}
        placeholder="22+, A2s+, KQo..."
        error={!parsed.ok ? t('equity.input.placeholder') : undefined}
        ltrInput
      />

      {rows.length > 0 && (
        <div className={styles.subsetTable} role="table" aria-label={t('strategy.subset.heading')}>
          <div className={styles.subsetHeaderRow} role="row">
            <span role="columnheader">{t('strategy.subset.col.board')}</span>
            <span role="columnheader">{t('strategy.subset.col.twoPairPlus')}</span>
            <span role="columnheader">{t('strategy.subset.col.topPairPlus')}</span>
            <span role="columnheader">{t('strategy.subset.col.draws')}</span>
            <span role="columnheader">{t('strategy.subset.col.continue')}</span>
            <span role="columnheader" />
          </div>
          {rows.map((row) => (
            <div key={row.flop.id} className={styles.subsetRow} role="row">
              <span className={styles.subsetBoardCell} role="cell">
                <span className={styles.subsetCardsRow}>
                  {row.flop.cards.map((card) => (
                    <PlayingCard key={card} card={card} size="mini" />
                  ))}
                </span>
                <span className={styles.subsetTag}>
                  {t(`strategy.subset.tag.${row.flop.textureTag}` as never)}
                </span>
              </span>
              <span role="cell">
                <PokerNotation>{`${formatNumber(row.twoPairPlusPct)}%`}</PokerNotation>
              </span>
              <span role="cell">
                <PokerNotation>{`${formatNumber(row.topPairPlusPct)}%`}</PokerNotation>
              </span>
              <span role="cell">
                <PokerNotation>{`${formatNumber(row.drawsPct)}%`}</PokerNotation>
              </span>
              <span role="cell">
                <PokerNotation>{`${formatNumber(row.continuePct)}%`}</PokerNotation>
              </span>
              <span role="cell">
                <Button
                  variant="secondary"
                  onClick={() => store.openRangeWalkWithSeed(rangeInput, row.flop.cards)}
                >
                  {t('strategy.subset.walkBtn')}
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
