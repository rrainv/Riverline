import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { getSharedHandRecorderStore } from '../../../domain/hand';
import type {
  ReviewStore,
  SavedLibraryFilter,
  SavedLibrarySort,
} from '../../../domain/review';
import { navigateTo } from '../../../domain/shellState';
import type {
  EquityStreet,
  SavedHandRecord,
  SavedObjectTagId,
  ThinkingReasonId,
} from '../../../domain/storage';
import { formatNumber, t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { Chip } from '../../kit/chip/Chip';
import { ChipButton, SegmentedControl, type SegmentOption } from '../../kit/choice/Choice';
import {
  FeltTable,
  type SeatEmblem,
  type TableCardSpec,
  type TableSeat,
} from '../../kit/felt-table/FeltTable';
import { TextField } from '../../kit/input/TextField';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import { cx } from '../../kit/state';
import styles from './ReviewRoom.module.css';

export interface SavedLibraryOpenInEquityInput {
  readonly board: readonly string[];
  readonly players: readonly {
    readonly label: string;
    readonly rawInput: string;
    readonly isHero: boolean;
  }[];
}

interface SavedLibraryViewProps {
  readonly store: ReviewStore;
  readonly onOpenInEquity?: (input: SavedLibraryOpenInEquityInput) => void;
}

const ALL_TAGS: readonly SavedObjectTagId[] = ['review_later', 'unsure', 'study'];
const ALL_THINKING_REASONS: readonly ThinkingReasonId[] = [
  'stealing',
  'value',
  'draw',
  'pot_committed',
  'bluff_catch',
];
const SEAT_EMBLEMS: readonly SeatEmblem[] = ['wave', 'bars', 'prism', 'orbits', 'arc', 'grid', 'pie', 'eye'];

function formatSignedAmount(value: number, unit: 'bb' | '₪'): string {
  const absFormatted = formatNumber(Math.abs(value), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return unit === '₪' ? `${sign}₪${absFormatted}` : `${sign}${absFormatted} bb`;
}

function formatPotAmount(value: number, unit: 'bb' | '₪'): string {
  const formatted = formatNumber(value, { maximumFractionDigits: 1 });
  return unit === '₪' ? `₪${formatted}` : `${formatted} bb`;
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

function buildInspectorTable(record: SavedHandRecord): {
  readonly seats: TableSeat[];
  readonly board: TableCardSpec[];
} {
  const pokerState = record.payload.pokerState;
  const unit = record.payload.unitLabel;
  const winningCardSet = new Set<string>();
  if (pokerState.showdown.handRanksByPlayer) {
    for (const wId of pokerState.terminal.winnerPlayerIds) {
      const rank = pokerState.showdown.handRanksByPlayer[wId];
      if (rank) {
        for (const c of rank.bestFiveCards) winningCardSet.add(c);
      }
    }
  }

  const seats: TableSeat[] = pokerState.players.map((p, idx) => {
    const isHero = p.playerId === record.payload.heroPlayerId;
    const isWinner =
      pokerState.terminal.isTerminal &&
      pokerState.terminal.winnerPlayerIds.includes(p.playerId);

    let cards: TableCardSpec[] | undefined;
    if (!p.folded) {
      if (Array.isArray(p.holeCards)) {
        cards = p.holeCards.map((c) => ({
          card: c,
          state: 'face' as const,
          winning: isWinner && winningCardSet.has(c),
        }));
      } else if (isHero && record.payload.heroCards.length === 2) {
        cards = record.payload.heroCards.map((c) => ({
          card: c,
          state: 'face' as const,
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
      stack: formatPotAmount(p.currentStackMilliBb / 1000, unit),
      emblem: isHero ? 'hero' : SEAT_EMBLEMS[idx % SEAT_EMBLEMS.length],
      isHero,
      isDealer: p.seat === pokerState.buttonSeat,
      folded: p.folded,
      bet:
        !pokerState.terminal.isTerminal && p.streetContributionMilliBb > 0
          ? formatPotAmount(p.streetContributionMilliBb / 1000, unit)
          : undefined,
      cards,
    };
  });

  const board: TableCardSpec[] = pokerState.board.map((c) => ({
    card: c,
    state: 'face' as const,
    winning: pokerState.terminal.isTerminal && winningCardSet.has(c),
  }));

  return { seats, board };
}

/**
 * Unified local library for completed hands, mid-hand spots, tags, search, sticky inspector, and JSON backup.
 */
export function SavedLibraryView({ store, onOpenInEquity }: SavedLibraryViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inspectorHeadingId = useId();
  const filter = store.savedFilterSignal.value;
  const sort = store.savedSortSignal.value;
  const seatFilter = store.savedSeatFilterSignal.value;
  const search = store.savedSearchSignal.value;
  const seatOptions = store.availableSeatFiltersSignal.value;
  const rawItems = store.filteredSavedItemsSignal.value;
  const backupStatus = store.backupStatusSignal.value;

  const [selectedReasonFilter, setSelectedReasonFilter] = useState<ThinkingReasonId | 'all'>('all');

  const starterIds = new Set(
    store.savedLibraryItemsSignal.value
      .filter((item) => item.isStarterSample)
      .map((item) => item.record.objectId),
  );
  const unarchivedHands = store.savedHandsSignal.value.filter(
    (h) => !h.archived && !starterIds.has(h.objectId),
  );
  const reasonCounts: Readonly<Record<ThinkingReasonId, number>> = {
    stealing: unarchivedHands.filter((h) =>
      h.payload.heroNotes.some((n) => n.reasonChip === 'stealing'),
    ).length,
    value: unarchivedHands.filter((h) =>
      h.payload.heroNotes.some((n) => n.reasonChip === 'value'),
    ).length,
    draw: unarchivedHands.filter((h) =>
      h.payload.heroNotes.some((n) => n.reasonChip === 'draw'),
    ).length,
    pot_committed: unarchivedHands.filter((h) =>
      h.payload.heroNotes.some((n) => n.reasonChip === 'pot_committed'),
    ).length,
    bluff_catch: unarchivedHands.filter((h) =>
      h.payload.heroNotes.some((n) => n.reasonChip === 'bluff_catch'),
    ).length,
  };

  const items =
    selectedReasonFilter === 'all'
      ? rawItems
      : rawItems.filter((item) =>
          item.record.payload.heroNotes.some((n) => n.reasonChip === selectedReasonFilter),
        );

  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(
    () => items[0]?.record.objectId ?? null,
  );

  useEffect(() => {
    if (items.length === 0) {
      if (selectedObjectId !== null) setSelectedObjectId(null);
      return;
    }
    if (!selectedObjectId || !items.some((item) => item.record.objectId === selectedObjectId)) {
      setSelectedObjectId(items[0]!.record.objectId);
    }
  }, [items, selectedObjectId]);

  const selectedItem =
    items.find((item) => item.record.objectId === selectedObjectId) ?? items[0] ?? null;

  const filterOptions: ReadonlyArray<{ id: SavedLibraryFilter; label: string }> = [
    { id: 'all', label: t('savedLibrary.filter.all') },
    { id: 'hands', label: t('savedLibrary.filter.hands') },
    { id: 'spots', label: t('savedLibrary.filter.spots') },
    { id: 'archived', label: t('savedLibrary.filter.archived') },
  ];

  const sortOptions: SegmentOption<SavedLibrarySort>[] = [
    { value: 'new', label: t('savedLibrary.sort.new') },
    { value: 'big', label: t('savedLibrary.sort.big') },
  ];

  const handleExport = async () => {
    const json = await store.exportBackupJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'riverline-study-backup.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const text = await file.text();
    await store.importBackupJson(text);
  };

  const selectedRecord = selectedItem?.record ?? null;
  const selectedTable = selectedRecord ? buildInspectorTable(selectedRecord) : null;
  const selectedHandNote = selectedRecord ? (selectedRecord.payload.handNote ?? '').trim() : '';
  const selectedDecisionNotes = selectedRecord
    ? selectedRecord.payload.heroNotes
        .map((note) => {
          const reason = note.reasonChip ? t(`recorder.thinking.${note.reasonChip}`) : '';
          const custom = (note.customText ?? '').trim();
          const detail = [reason, custom].filter(Boolean).join(' · ');
          if (!detail) return null;
          return `${formatStreetName(note.street)}: ${detail}`;
        })
        .filter((line): line is string => line !== null)
    : [];

  const canOpenSelectedInEquity = Boolean(
    onOpenInEquity &&
      selectedRecord &&
      selectedRecord.payload.heroCards.length === 2 &&
      [0, 3, 4, 5].includes(selectedRecord.payload.pokerState.board.length),
  );

  const handleOpenSelectedInEquity = () => {
    if (!onOpenInEquity || !selectedRecord || selectedRecord.payload.heroCards.length !== 2) return;
    const board = selectedRecord.payload.pokerState.board;
    if (![0, 3, 4, 5].includes(board.length)) return;

    const revealedVillain =
      selectedRecord.payload.pokerState.players.find(
        (p) =>
          p.playerId !== selectedRecord.payload.heroPlayerId &&
          !p.folded &&
          Array.isArray(p.holeCards) &&
          p.holeCards.length === 2,
      ) ??
      selectedRecord.payload.pokerState.players.find(
        (p) =>
          p.playerId !== selectedRecord.payload.heroPlayerId &&
          Array.isArray(p.holeCards) &&
          p.holeCards.length === 2,
      );
    const fallbackVillain =
      selectedRecord.payload.pokerState.players.find(
        (p) => p.playerId !== selectedRecord.payload.heroPlayerId && !p.folded && p.dealtIn,
      ) ??
      selectedRecord.payload.pokerState.players.find(
        (p) => p.playerId !== selectedRecord.payload.heroPlayerId,
      );

    onOpenInEquity({
      board: [...board],
      players: [
        {
          label: selectedRecord.payload.heroPositionLabel || t('recorder.table.heroLabel'),
          rawInput: selectedRecord.payload.heroCards.join(''),
          isHero: true,
        },
        {
          label:
            revealedVillain?.position ??
            fallbackVillain?.position ??
            t('equity.row.villain', { index: 1 }),
          rawInput:
            revealedVillain && Array.isArray(revealedVillain.holeCards)
              ? revealedVillain.holeCards.join('')
              : 'any',
          isHero: false,
        },
      ],
    });
  };

  return (
    <div className={styles.savedLibraryLayout}>
      <div className={styles.savedListCol}>
        <Panel title={t('savedLibrary.heading')}>
          <div className={styles.libraryToolbar}>
            <div className={styles.filterRow}>
              <div className={styles.chipGroup}>
                {filterOptions.map((opt) => (
                  <ChipButton
                    key={opt.id}
                    selected={filter === opt.id}
                    onToggle={() => store.setSavedFilter(opt.id)}
                  >
                    {opt.label}
                  </ChipButton>
                ))}
              </div>

              <SegmentedControl
                ariaLabel={t('savedLibrary.heading')}
                options={sortOptions}
                value={sort}
                onChange={(next) => store.setSavedSort(next)}
              />
            </div>

            <div className={styles.filterRow}>
              <div className={styles.chipGroup}>
                <ChipButton
                  selected={seatFilter === 'all'}
                  onToggle={() => store.setSavedSeatFilter('all')}
                >
                  {t('savedLibrary.seatAll')}
                </ChipButton>
                {seatOptions.map((seat) => (
                  <ChipButton
                    key={seat}
                    selected={seatFilter === seat}
                    onToggle={() => store.setSavedSeatFilter(seat)}
                  >
                    <PokerNotation>{seat}</PokerNotation>
                  </ChipButton>
                ))}
              </div>
            </div>

            <TextField
              value={search}
              onValueChange={(next) => store.setSavedSearch(next)}
              placeholder={t('savedLibrary.searchPlaceholder')}
              ariaLabel={t('savedLibrary.searchAria')}
              ltrInput={false}
            />
          </div>

          <PanelSection label={t('savedLibrary.mirror.heading')}>
            <div className={styles.mirrorBox}>
              <p className={styles.honestyNote}>{t('savedLibrary.mirror.subtitle')}</p>
              <div className={styles.chipGroup}>
                <ChipButton
                  selected={selectedReasonFilter === 'all'}
                  onToggle={() => setSelectedReasonFilter('all')}
                >
                  {t('savedLibrary.mirror.allReasons')}
                </ChipButton>
                {ALL_THINKING_REASONS.map((reasonId) => {
                  const count = reasonCounts[reasonId];
                  const countText =
                    count < 20
                      ? t('savedLibrary.mirror.watchingCount', { count })
                      : t('savedLibrary.mirror.sampleCount', { count });
                  return (
                    <ChipButton
                      key={reasonId}
                      selected={selectedReasonFilter === reasonId}
                      onToggle={() =>
                        setSelectedReasonFilter((curr) => (curr === reasonId ? 'all' : reasonId))
                      }
                    >
                      <span>{t(`recorder.thinking.${reasonId}`)}</span>
                      <span className={styles.mirrorChipCount}>
                        <PokerNotation>{countText}</PokerNotation>
                      </span>
                    </ChipButton>
                  );
                })}
              </div>
            </div>
          </PanelSection>

          {items.length === 0 ? (
            <p className={styles.honestyNote}>{t('savedLibrary.empty')}</p>
          ) : (
            <div className={styles.savedList}>
              {items.map((item) => {
                const { record } = item;
                const isSelected = selectedItem?.record.objectId === record.objectId;
                const kindLabel = item.isCompleted
                  ? t('recorder.saved.kindCompleted')
                  : t('recorder.saved.kindSpot');
                const presetLabel =
                  record.payload.tablePreset === 'home_game_50bb'
                    ? t('recorder.preset.homeGame')
                    : t('recorder.preset.sixMax');
                const unit = record.payload.unitLabel;

                return (
                  <article
                    key={record.objectId}
                    className={cx(styles.savedItem, isSelected && styles.savedItemSelected)}
                  >
                    <button
                      type="button"
                      className={styles.savedSelectBtn}
                      aria-pressed={isSelected}
                      onClick={() => setSelectedObjectId(record.objectId)}
                    >
                      <span className={styles.savedTitleRow}>
                        <span className={styles.savedTitle}>
                          <PokerNotation>{record.factTitle}</PokerNotation>
                        </span>
                        <Chip>{kindLabel}</Chip>
                        {item.isStarterSample && <Chip>{t('review.starterBadge')}</Chip>}
                        {item.heroNetBb !== null && (
                          <Chip>
                            <PokerNotation>{formatSignedAmount(item.heroNetBb, unit)}</PokerNotation>
                          </Chip>
                        )}
                      </span>

                      <span className={styles.savedSub}>
                        {`${t('recorder.saved.metaLine', {
                          preset: presetLabel,
                          count: item.actionCount,
                        })} · `}
                        <PokerNotation>{formatPotAmount(item.finalPotBb, unit)}</PokerNotation>
                      </span>
                    </button>

                    <div className={styles.savedItemFooter}>
                      <div className={styles.chipGroup}>
                        {ALL_TAGS.map((tagId) => (
                          <ChipButton
                            key={tagId}
                            selected={record.tags.includes(tagId)}
                            onToggle={() => {
                              void store.toggleSavedTag(record.objectId, tagId);
                            }}
                          >
                            {t(`review.tags.${tagId}`)}
                          </ChipButton>
                        ))}
                      </div>

                      <div className={styles.savedActions}>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            store.openSavedHand(record);
                            store.setActiveSideTab('review');
                          }}
                        >
                          {t('savedLibrary.openReview')}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            getSharedHandRecorderStore().loadSavedHand(record);
                            navigateTo('hand');
                          }}
                        >
                          {t('savedLibrary.openRecorder')}
                        </Button>
                        {record.archived ? (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              void store.restoreSavedItem(record.objectId);
                            }}
                          >
                            {t('savedLibrary.restore')}
                          </Button>
                        ) : (
                          <Button
                            variant="danger"
                            onClick={() => {
                              void store.archiveSavedItem(record.objectId);
                            }}
                          >
                            {t('savedLibrary.archive')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <PanelSection label={t('recorder.saved.backupHeading')}>
            <div className={styles.backupBar}>
              <Button variant="primary" onClick={() => void handleExport()}>
                {t('recorder.saved.exportJson')}
              </Button>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                {t('recorder.saved.importJson')}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className={styles.hiddenInput}
                onChange={(event) => void handleFileChange(event)}
              />
            </div>

            {backupStatus.kind === 'imported' && (
              <p role="status" className={styles.statusOk}>
                {t('recorder.saved.importOk', { imported: backupStatus.importedCount })}
              </p>
            )}
            {backupStatus.kind === 'error' && (
              <p role="alert" className={styles.statusError}>
                {t('recorder.saved.importFail', { reason: backupStatus.detail })}
              </p>
            )}
          </PanelSection>
        </Panel>
      </div>

      <div className={styles.savedInspectorCol}>
        <Panel
          as="aside"
          title={t('savedLibrary.inspector.heading')}
          titleId={inspectorHeadingId}
        >
          {!selectedItem || !selectedRecord || !selectedTable ? (
            <p className={styles.honestyNote}>{t('savedLibrary.inspector.empty')}</p>
          ) : (
            <div className={styles.inspectorContent}>
              <div className={styles.inspectorStage}>
                <FeltTable
                  mode="hand"
                  compact
                  boardCardSize="small"
                  seatCardSize="mini"
                  seats={selectedTable.seats}
                  pot={selectedItem.finalPotBb}
                  potUnit={selectedRecord.payload.unitLabel}
                  board={selectedTable.board}
                  ariaLabel={t('recorder.table.aria')}
                />
              </div>

              <div className={styles.inspectorSummary}>
                <h3 className={styles.inspectorTitle}>
                  <PokerNotation>{selectedRecord.factTitle}</PokerNotation>
                </h3>
                {selectedRecord.payload.shorthandLine && (
                  <div className={styles.inspectorShorthandRow}>
                    <span className={styles.microLabel}>
                      {t('savedLibrary.inspector.shorthandLabel')}
                    </span>
                    <code className={styles.inspectorShorthand}>
                      <PokerNotation>{selectedRecord.payload.shorthandLine}</PokerNotation>
                    </code>
                  </div>
                )}
              </div>

              <PanelSection label={t('savedLibrary.inspector.noteHeading')}>
                {!selectedHandNote && selectedDecisionNotes.length === 0 ? (
                  <p className={styles.honestyNote}>{t('savedLibrary.inspector.noNotes')}</p>
                ) : (
                  <div className={styles.inspectorNotesStack}>
                    {selectedHandNote && (
                      <p className={styles.inspectorNoteText}>{selectedHandNote}</p>
                    )}
                    {selectedDecisionNotes.length > 0 && (
                      <ul className={styles.inspectorNoteList}>
                        {selectedDecisionNotes.map((line, idx) => (
                          <li key={idx} className={styles.inspectorNoteItem}>
                            {line}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </PanelSection>

              <div className={styles.inspectorActions}>
                <Button
                  variant="primary"
                  onClick={() => {
                    store.openSavedHand(selectedRecord);
                    store.setActiveSideTab('review');
                  }}
                >
                  {t('savedLibrary.inspector.openReview')}
                </Button>
                {canOpenSelectedInEquity && (
                  <Button variant="secondary" onClick={handleOpenSelectedInEquity}>
                    {t('savedLibrary.inspector.openEquity')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
