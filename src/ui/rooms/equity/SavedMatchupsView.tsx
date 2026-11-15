import { useRef, useState } from 'preact/hooks';
import type { EquityStore } from '../../../domain/equity';
import { t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import { formatCardGlyph } from './equityFormatters';
import styles from './EquityRoom.module.css';

export function SavedMatchupsView({ store }: { store: EquityStore }) {
  const matchups = store.savedMatchupsSignal.value;
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
      await store.refreshSavedMatchups();
      if (result.ok) {
        setImportStatus({
          ok: true,
          message: t('equity.importOk', { imported: result.importedCount }),
        });
      } else {
        setImportStatus({
          ok: false,
          message: t('equity.importFail', { reason: result.detail ?? result.errorCode }),
        });
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      setImportStatus({
        ok: false,
        message: t('equity.importFail', { reason }),
      });
    }
  };

  return (
    <div className={styles.column}>
      <Panel title={t('equity.saved.heading')}>
        {matchups.length === 0 ? (
          <p className={styles.mutedHint}>{t('equity.saved.empty')}</p>
        ) : (
          <div className={styles.savedList}>
            {matchups.map((item) => {
              const boardText = item.payload.board.map(formatCardGlyph).join(' ');
              const seats = item.payload.players
                .map((p) => p.rawInput)
                .join(' vs ');
              return (
                <article key={item.objectId} className={styles.savedItem}>
                  <div className={styles.savedMeta}>
                    <h3 className={styles.savedTitle}>
                      <PokerNotation>{item.factTitle}</PokerNotation>
                    </h3>
                    <p className={styles.savedSub}>
                      <PokerNotation>{`${boardText} · ${seats}`}</PokerNotation>
                    </p>
                  </div>
                  <div className={styles.savedActions}>
                    <Button variant="secondary" onClick={() => store.loadSavedMatchup(item)}>
                      {t('equity.saved.open')}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => void store.archiveSavedMatchup(item.objectId)}
                    >
                      {t('equity.saved.archive')}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <PanelSection label={t('equity.saved.backupHeading')}>
          <div className={styles.backupBar}>
            <Button variant="primary" onClick={() => void handleExport()}>
              {t('equity.exportJson')}
            </Button>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              {t('equity.importJson')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className={styles.hiddenInput}
              aria-label={t('equity.importJson')}
              onChange={(e) => void handleFileChange(e)}
            />
          </div>
          {importStatus && (
            <p className={importStatus.ok ? styles.statusMessage : styles.statusError} role="status">
              {importStatus.message}
            </p>
          )}
        </PanelSection>
      </Panel>
    </div>
  );
}
