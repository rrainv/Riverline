import { useRef } from 'preact/hooks';
import { getSharedHandRecorderStore } from '../../../domain/hand';
import type {
  ReviewStore,
  SavedLibraryFilter,
  SavedLibrarySort,
} from '../../../domain/review';
import { navigateTo } from '../../../domain/shellState';
import type { SavedObjectTagId } from '../../../domain/storage';
import { formatNumber, t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { Chip } from '../../kit/chip/Chip';
import { ChipButton, SegmentedControl, type SegmentOption } from '../../kit/choice/Choice';
import { TextField } from '../../kit/input/TextField';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import styles from './ReviewRoom.module.css';

interface SavedLibraryViewProps {
  store: ReviewStore;
}

const ALL_TAGS: readonly SavedObjectTagId[] = ['review_later', 'unsure', 'study'];

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

/**
 * Unified local library for completed hands, mid-hand spots, tags, search, and JSON backup.
 */
export function SavedLibraryView({ store }: SavedLibraryViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const filter = store.savedFilterSignal.value;
  const sort = store.savedSortSignal.value;
  const seatFilter = store.savedSeatFilterSignal.value;
  const search = store.savedSearchSignal.value;
  const seatOptions = store.availableSeatFiltersSignal.value;
  const items = store.filteredSavedItemsSignal.value;
  const backupStatus = store.backupStatusSignal.value;

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

  return (
    <Panel title={t('savedLibrary.heading')}>
      <p className={styles.roomSubtitle}>{t('savedLibrary.subtitle')}</p>

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

      {items.length === 0 ? (
        <p className={styles.honestyNote}>{t('savedLibrary.empty')}</p>
      ) : (
        <div className={styles.savedList}>
          {items.map((item) => {
            const { record } = item;
            const kindLabel = item.isCompleted
              ? t('recorder.saved.kindCompleted')
              : t('recorder.saved.kindSpot');
            const presetLabel =
              record.payload.tablePreset === 'home_game_50bb'
                ? t('recorder.preset.homeGame')
                : t('recorder.preset.sixMax');
            const unit = record.payload.unitLabel;

            return (
              <article key={record.objectId} className={styles.savedItem}>
                <div className={styles.savedMeta}>
                  <div className={styles.savedTitleRow}>
                    <h3 className={styles.savedTitle}>
                      <PokerNotation>{record.factTitle}</PokerNotation>
                    </h3>
                    <Chip>{kindLabel}</Chip>
                    {item.isStarterSample && <Chip>{t('review.starterBadge')}</Chip>}
                    {item.heroNetBb !== null && (
                      <Chip>
                        <PokerNotation>{formatSignedAmount(item.heroNetBb, unit)}</PokerNotation>
                      </Chip>
                    )}
                  </div>

                  <p className={styles.savedSub}>
                    {`${t('recorder.saved.metaLine', {
                      preset: presetLabel,
                      count: item.actionCount,
                    })} · `}
                    <PokerNotation>{formatPotAmount(item.finalPotBb, unit)}</PokerNotation>
                  </p>

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
  );
}
