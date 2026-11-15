import { useRef, useState } from 'preact/hooks';
import type { HandRecorderStore } from '../../../domain/hand';
import { t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { Chip } from '../../kit/chip/Chip';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import styles from './HandRoom.module.css';

export function SavedHandsView({ store }: { store: HandRecorderStore }) {
  const hands = store.savedHandsSignal.value;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importStatus, setImportStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const handleExport = async () => {
    const bundle = await store.repository.exportBundle();
    const dateStamp = bundle.exportedAt.slice(0, 10);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `riverline-study-backup-${dateStamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const result = await store.repository.importBundle(text, { applyAppearance: true });
      await store.refreshSavedHands();
      if (result.ok) {
        setImportStatus({
          ok: true,
          message: t('recorder.saved.importOk', { imported: result.importedCount }),
        });
      } else {
        setImportStatus({
          ok: false,
          message: t('recorder.saved.importFail', { reason: result.detail ?? result.errorCode }),
        });
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setImportStatus({
        ok: false,
        message: t('recorder.saved.importFail', { reason }),
      });
    }
  };

  return (
    <div className={styles.column}>
      <Panel title={t('recorder.saved.heading')}>
        {hands.length === 0 ? (
          <p className={styles.mutedHint}>{t('recorder.saved.empty')}</p>
        ) : (
          <div className={styles.savedList}>
            {hands.map((item) => {
              const kindLabel =
                item.payload.savedKind === 'completed_hand'
                  ? t('recorder.saved.kindCompleted')
                  : t('recorder.saved.kindSpot');
              const presetLabel =
                item.payload.tablePreset === 'home_game_50bb'
                  ? t('recorder.preset.homeGame')
                  : t('recorder.preset.sixMax');
              return (
                <article key={item.objectId} className={styles.savedItem}>
                  <div className={styles.savedMeta}>
                    <div className={styles.savedTitleRow}>
                      <h3 className={styles.savedTitle}>
                        <PokerNotation>{item.factTitle}</PokerNotation>
                      </h3>
                      <Chip>{kindLabel}</Chip>
                    </div>
                    <p className={styles.savedSub}>
                      {t('recorder.saved.metaLine', {
                        preset: presetLabel,
                        count: item.payload.recordedActions.length,
                      })}
                    </p>
                  </div>
                  <div className={styles.savedActions}>
                    <Button variant="secondary" onClick={() => store.loadSavedHand(item)}>
                      {t('recorder.saved.open')}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => void store.archiveSavedHand(item.objectId)}
                    >
                      {t('recorder.saved.archive')}
                    </Button>
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
              onChange={(e) => void handleFileChange(e)}
            />
          </div>
          {importStatus && (
            <p
              role={importStatus.ok ? 'status' : 'alert'}
              className={importStatus.ok ? styles.savedTag : styles.errorText}
            >
              {importStatus.message}
            </p>
          )}
        </PanelSection>
      </Panel>
    </div>
  );
}
