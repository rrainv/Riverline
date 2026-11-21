import type { JSX } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { resetSharedEquityStore } from '../../../domain/equity';
import { resetSharedHandRecorderStore } from '../../../domain/hand';
import { resetSharedHomeStore } from '../../../domain/home';
import { resetSharedLearnStore } from '../../../domain/learn';
import { resetSharedNightsStore } from '../../../domain/nights';
import { resetSharedReviewStore } from '../../../domain/review';
import {
  getDefaultStudyRepository,
  type StudyRepository,
  type StudyStorageCounts,
} from '../../../domain/storage';
import { resetSharedStrategyStore } from '../../../domain/strategy';
import { resetSharedTrainingStore } from '../../../domain/training';
import { t } from '../../../i18n';
import { Button } from '../../kit/button/Button';
import { FactTile, FactTileRow } from '../../kit/fact-tile/FactTile';
import { Dialog } from '../../kit/overlay/Overlay';
import { Panel } from '../../kit/panel/Panel';
import styles from '../SettingsRoom.module.css';

export interface SettingsDataSectionProps {
  repository?: StudyRepository;
}

type PersistState = 'checking' | 'granted' | 'not_granted' | 'unsupported' | 'declined';

interface FeedbackMessage {
  readonly kind: 'ok' | 'error';
  readonly message: string;
}

async function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
    reader.readAsText(file);
  });
}

export function SettingsDataSection({ repository }: SettingsDataSectionProps) {
  const repo = repository ?? getDefaultStudyRepository();
  const [counts, setCounts] = useState<StudyStorageCounts | null>(null);
  const [backupFeedback, setBackupFeedback] = useState<FeedbackMessage | null>(null);
  const [persistState, setPersistState] = useState<PersistState>('checking');
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wiping, setWiping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const wipeButtonRef = useRef<HTMLButtonElement | null>(null);
  const mountedRef = useRef(true);

  const refreshCounts = useCallback(async () => {
    const next = await repo.getStorageCounts();
    if (mountedRef.current) {
      setCounts(next);
    }
  }, [repo]);

  useEffect(() => {
    mountedRef.current = true;
    void refreshCounts();

    const navStorage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    if (!navStorage || typeof navStorage.persisted !== 'function') {
      setPersistState('unsupported');
      return () => {
        mountedRef.current = false;
      };
    }

    let cancelled = false;
    void navStorage
      .persisted()
      .then((granted) => {
        if (!cancelled && mountedRef.current) {
          setPersistState(granted ? 'granted' : 'not_granted');
        }
      })
      .catch(() => {
        if (!cancelled && mountedRef.current) {
          setPersistState('unsupported');
        }
      });

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [refreshCounts]);

  const handleExport = async () => {
    const bundle = await repo.exportBundle();
    const json = JSON.stringify(bundle, null, 2);
    const dateStamp = new Date().toISOString().slice(0, 10);
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `riverline-backup-${dateStamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      if (typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(url);
      }
    }
    if (mountedRef.current) {
      setBackupFeedback({
        kind: 'ok',
        message: t('settings.data.exportSuccess', { count: bundle.events.length }),
      });
    }
  };

  const handleImportChange = async (event: JSX.TargetedEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    try {
      const text = await readFileAsText(file);
      const result = await repo.importBundle(text);
      if (!mountedRef.current) return;
      if (result.ok) {
        await refreshCounts();
        if (mountedRef.current) {
          setBackupFeedback({
            kind: 'ok',
            message: t('settings.data.importSuccess', {
              imported: result.importedCount,
              skipped: result.skippedDuplicates,
            }),
          });
        }
      } else {
        setBackupFeedback({
          kind: 'error',
          message: t('settings.data.importError', {
            reason: result.detail || result.errorCode,
          }),
        });
      }
    } catch (err) {
      if (mountedRef.current) {
        setBackupFeedback({
          kind: 'error',
          message: t('settings.data.importError', {
            reason: err instanceof Error ? err.message : String(err),
          }),
        });
      }
    }
  };

  const handleRequestPersist = async () => {
    const navStorage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    if (!navStorage || typeof navStorage.persist !== 'function') {
      setPersistState('unsupported');
      return;
    }
    try {
      const granted = await navStorage.persist();
      if (mountedRef.current) {
        setPersistState(granted ? 'granted' : 'declined');
      }
    } catch {
      if (mountedRef.current) {
        setPersistState('unsupported');
      }
    }
  };

  const handleConfirmWipe = async () => {
    if (wiping) return;
    setWiping(true);
    try {
      await repo.clearAllData();
      resetSharedReviewStore();
      resetSharedHandRecorderStore();
      resetSharedNightsStore();
      resetSharedEquityStore();
      resetSharedTrainingStore();
      resetSharedStrategyStore();
      resetSharedHomeStore();
      resetSharedLearnStore();
      await refreshCounts();
      if (mountedRef.current) {
        setWipeOpen(false);
        setBackupFeedback({
          kind: 'ok',
          message: t('settings.data.wipeDone'),
        });
      }
    } finally {
      if (mountedRef.current) {
        setWiping(false);
      }
    }
  };

  const persistCopy =
    persistState === 'granted'
      ? t('settings.data.persistGranted')
      : persistState === 'declined'
        ? t('settings.data.persistDeclined')
        : persistState === 'unsupported'
          ? t('settings.data.persistUnsupported')
          : t('settings.data.persistNotGranted');

  const canRequestPersist =
    (persistState === 'not_granted' || persistState === 'declined') &&
    typeof navigator !== 'undefined' &&
    typeof navigator.storage?.persist === 'function';

  return (
    <div className={styles.stack}>
      <Panel as="div">
        <div className={styles.sectionFirst}>
          <div className={styles.sectionLabel}>{t('settings.data.countsHeading')}</div>
          <FactTileRow>
            <FactTile
              label={t('settings.data.savedHands')}
              value={counts ? counts.savedHands : null}
              decimals={0}
              loading={counts === null}
              instant
            />
            <FactTile
              label={t('settings.data.savedMatchups')}
              value={counts ? counts.savedMatchups : null}
              decimals={0}
              loading={counts === null}
              instant
            />
            <FactTile
              label={t('settings.data.nights')}
              value={counts ? counts.nights : null}
              decimals={0}
              loading={counts === null}
              instant
            />
            <FactTile
              label={t('settings.data.trainingSessions')}
              value={counts ? counts.trainingSessions : null}
              decimals={0}
              loading={counts === null}
              instant
            />
          </FactTileRow>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>{t('settings.data.backupHeading')}</div>
          <div className={styles.chipRow}>
            <Button variant="primary" onClick={() => void handleExport()}>
              {t('settings.data.exportBtn')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className={styles.hiddenInput}
              aria-hidden="true"
              tabIndex={-1}
              onChange={(e) => void handleImportChange(e)}
            />
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              {t('settings.data.importBtn')}
            </Button>
          </div>
          {backupFeedback && (
            <div
              className={
                backupFeedback.kind === 'error' ? styles.alertBox : styles.statusBox
              }
              role={backupFeedback.kind === 'error' ? 'alert' : 'status'}
            >
              {backupFeedback.message}
            </div>
          )}
        </div>
      </Panel>

      <div className={styles.grid}>
        <Panel as="div">
          <div className={styles.sectionFirst}>
            <div className={styles.sectionLabel}>{t('settings.data.persistHeading')}</div>
            <p className={styles.bodyText}>{persistCopy}</p>
            {canRequestPersist && (
              <div className={styles.chipRow}>
                <Button variant="secondary" onClick={() => void handleRequestPersist()}>
                  {t('settings.data.persistRequestBtn')}
                </Button>
              </div>
            )}
          </div>
        </Panel>

        <Panel as="div">
          <div className={styles.sectionFirst}>
            <div className={styles.sectionLabel}>{t('settings.data.wipeHeading')}</div>
            <p className={styles.bodyText}>{t('settings.data.wipeWarning')}</p>
            <div className={styles.chipRow}>
              <Button
                variant="danger"
                buttonRef={(el) => {
                  wipeButtonRef.current = el;
                }}
                onClick={() => setWipeOpen(true)}
              >
                {t('settings.data.wipeBtn')}
              </Button>
            </div>
          </div>
        </Panel>
      </div>

      <Dialog
        open={wipeOpen}
        onClose={() => setWipeOpen(false)}
        title={t('settings.data.wipeDialogTitle')}
        description={t('settings.data.wipeDialogDesc')}
        confirmPhrase={t('settings.data.wipeConfirmPhrase')}
        confirmLabel={t('settings.data.wipeConfirmBtn')}
        returnFocusTo={wipeButtonRef.current}
        onConfirm={() => void handleConfirmWipe()}
      />
    </div>
  );
}
