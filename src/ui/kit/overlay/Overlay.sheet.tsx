import { useRef, useState } from 'preact/hooks';
import { t } from '../../../i18n';
import { Button } from '../button/Button';
import { StateMatrix } from '../sheet/StateMatrix';
import styles from '../sheet/KitSheet.module.css';
import { Stepper } from '../stepper/Stepper';
import { CommandPalette } from './CommandPalette';
import { Dialog, PhoneSheet, Toast, Tooltip } from './Overlay';

export function OverlaySheetEntry() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [destructiveOpen, setDestructiveOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(true);
  const [sheetBuyIn, setSheetBuyIn] = useState(100);

  const dialogBtnRef = useRef<HTMLButtonElement | null>(null);
  const destructiveBtnRef = useRef<HTMLButtonElement | null>(null);
  const sheetBtnRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div className={styles.specimenBlock} role="region" aria-label={t('kit.overlay.sectionTitle')}>
      <StateMatrix
        title={t('kit.overlay.sectionTitle')}
        states={{
          rest: (
            <div className={styles.stack}>
              <div className={styles.inlineRow}>
                <Button
                  variant="secondary"
                  buttonRef={(el) => {
                    dialogBtnRef.current = el;
                  }}
                  onClick={() => setDialogOpen(true)}
                >
                  {t('kit.overlay.openDialog')}
                </Button>
                <Button
                  variant="danger"
                  buttonRef={(el) => {
                    destructiveBtnRef.current = el;
                  }}
                  onClick={() => setDestructiveOpen(true)}
                >
                  {t('kit.overlay.openDestructive')}
                </Button>
                <Button
                  variant="secondary"
                  buttonRef={(el) => {
                    sheetBtnRef.current = el;
                  }}
                  onClick={() => setSheetOpen(true)}
                >
                  {t('kit.overlay.openSheet')}
                </Button>
                <Button variant="secondary" onClick={() => setToastOpen((v) => !v)}>
                  {t('kit.overlay.openToast')}
                </Button>
              </div>

              <Toast
                open={toastOpen}
                inlinePreview
                message={t('kit.overlay.toastSaved')}
                actionLabel={t('kit.overlay.toastUndo')}
                onAction={() => setToastOpen(false)}
                onDismiss={() => setToastOpen(false)}
              />
            </div>
          ),
          hover: (
            <div className={styles.tooltipStage}>
              <Tooltip content={t('kit.overlay.tooltipText')} defaultOpen>
                <Button variant="secondary" forceState="hover">
                  {t('kit.overlay.tooltipTrigger')}
                </Button>
              </Tooltip>
            </div>
          ),
          focus: (
            <Dialog
              open
              inlinePreview
              onClose={() => {}}
              title={t('kit.overlay.destructiveTitle')}
              confirmPhrase="Friday-100bb"
              confirmLabel={t('kit.overlay.deleteConfirm')}
              onConfirm={() => {}}
            />
          ),
          loading: <CommandPalette open inlinePreview activeRoute="kit" loading />,
          empty: (
            <CommandPalette
              open
              inlinePreview
              activeRoute="kit"
              initialQuery="no_matching_room_xyz"
            />
          ),
          russianLong: (
            <Dialog
              open
              inlinePreview
              onClose={() => {}}
              title={t('kit.overlay.destructiveTitle', undefined, 'ru')}
              description={t('kit.overlay.russianLongDesc', undefined, 'ru')}
            />
          ),
        }}
      />

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={t('kit.overlay.dialogTitle')}
        description={t('kit.overlay.dialogDesc')}
        confirmLabel={t('kit.overlay.confirm')}
        onConfirm={() => setDialogOpen(false)}
        returnFocusTo={dialogBtnRef.current}
      />

      <Dialog
        open={destructiveOpen}
        onClose={() => setDestructiveOpen(false)}
        title={t('kit.overlay.destructiveTitle')}
        description={t('kit.overlay.destructiveDesc')}
        confirmPhrase="Friday-100bb"
        confirmLabel={t('kit.overlay.deleteConfirm')}
        onConfirm={() => setDestructiveOpen(false)}
        returnFocusTo={destructiveBtnRef.current}
      />

      <PhoneSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('kit.overlay.sheetTitle')}
        returnFocusTo={sheetBtnRef.current}
      >
        <p className={styles.sheetNote}>{t('kit.overlay.sheetBody')}</p>
        <Stepper
          ariaLabel={t('kit.stepper.buyInLabel')}
          label={t('kit.stepper.buyInLabel')}
          value={sheetBuyIn}
          onChange={setSheetBuyIn}
          min={20}
          max={500}
          step={20}
          decimals={0}
          unit="bb"
          size="touch"
        />
      </PhoneSheet>
    </div>
  );
}
