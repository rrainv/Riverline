import { useEffect, useState } from 'preact/hooks';
import { HOME_GAME_CURRENCY_PRESETS, minorToMajorNumber, type HomeGameUnitPresetId } from '../../../engine-api';
import { t } from '../../../i18n';
import type { NightsStore } from '../../../domain/nights';
import { Button } from '../../kit/button/Button';
import { ChipButton, SegmentedControl } from '../../kit/choice/Choice';
import { TextField } from '../../kit/input/TextField';
import { Dialog } from '../../kit/overlay/Overlay';
import styles from './NightsRoom.module.css';

interface NightsCreateDialogProps {
  readonly store: NightsStore;
}

interface DraftPlayerRow {
  readonly displayName: string;
  readonly initialBuyInInput: string;
}

const MAX_NIGHT_MAJOR_AMOUNT = 1_000_000;

function makeInitialDraftRows(): DraftPlayerRow[] {
  return [
    { displayName: '', initialBuyInInput: '' },
    { displayName: '', initialBuyInInput: '' },
  ];
}

export function NightsCreateDialog({ store }: NightsCreateDialogProps) {
  const open = store.createModalOpenSignal.value;
  const [title, setTitle] = useState('');
  const [unitPreset, setUnitPreset] = useState<HomeGameUnitPresetId>('chips');
  const [stakesPreset, setStakesPreset] = useState<string>('');
  const [players, setPlayers] = useState<DraftPlayerRow[]>(makeInitialDraftRows);

  useEffect(() => {
    if (open) {
      setTitle('');
      setStakesPreset('');
      setPlayers(makeInitialDraftRows());
    }
  }, [open]);

  const recentNames = store.recentPlayerNamesSignal.value;
  const currency = HOME_GAME_CURRENCY_PRESETS[unitPreset];
  const defaultBuyIn = String(
    minorToMajorNumber(currency.defaultBuyInMinor, currency.minorUnit),
  );
  const maxMinor = MAX_NIGHT_MAJOR_AMOUNT * (currency.minorUnit === 2 ? 100 : 1);

  const nameCounts = new Map<string, number>();
  for (const p of players) {
    const k = p.displayName.trim().toLowerCase();
    if (k) {
      nameCounts.set(k, (nameCounts.get(k) ?? 0) + 1);
    }
  }

  const rowErrors = players.map((row) => {
    const cleanName = row.displayName.trim();
    const isDuplicate = Boolean(cleanName && (nameCounts.get(cleanName.toLowerCase()) ?? 0) > 1);
    const trimmedBuyIn = row.initialBuyInInput.trim();
    let buyInInvalid = false;
    if (trimmedBuyIn) {
      const parsed = store.engine.sync.parseHomeGameAmount(trimmedBuyIn, currency.minorUnit);
      buyInInvalid = !parsed.ok || parsed.data < 0 || parsed.data > maxMinor;
    }
    return {
      nameError: isDuplicate ? t('nights.err.duplicatePlayer', { name: cleanName }) : undefined,
      buyInError: buyInInvalid ? t('nights.err.amountInvalid') : undefined,
    };
  });

  const handleConfirm = async () => {
    const baseTitle = title.trim() || t('nights.create.nightTitlePlaceholder');
    const resolvedTitle =
      stakesPreset && !baseTitle.includes(stakesPreset)
        ? `${baseTitle} (${stakesPreset})`
        : baseTitle;
    const created = await store.createNight({
      title: resolvedTitle,
      unitPreset,
      players,
    });
    if (created) {
      store.setCreateModalOpen(false);
    }
  };

  const addQuickName = (name: string) => {
    if (players.some((p) => p.displayName.trim().toLowerCase() === name.toLowerCase())) return;
    const emptyIdx = players.findIndex((p) => p.displayName.trim() === '');
    if (emptyIdx >= 0) {
      setPlayers(
        players.map((p, i) => (i === emptyIdx ? { ...p, displayName: name } : p)),
      );
      return;
    }
    setPlayers([...players, { displayName: name, initialBuyInInput: '' }]);
  };

  return (
    <Dialog
      open={open}
      onClose={() => store.setCreateModalOpen(false)}
      title={t('nights.create.title')}
      description={t('nights.create.description')}
      confirmLabel={t('nights.actions.createNight')}
      onConfirm={() => void handleConfirm()}
      wide={true}
    >
      <div className={styles.dialogBody}>
        <div className={styles.dialogField}>
          <span className={styles.sectionHeading}>{t('nights.create.nightTitleLabel')}</span>
          <TextField
            value={title}
            onValueChange={setTitle}
            placeholder={t('nights.create.nightTitlePlaceholder')}
            ariaLabel={t('nights.create.nightTitleLabel')}
            ltrInput={false}
          />
        </div>

        <div className={styles.dialogField}>
          <span className={styles.sectionHeading}>{t('nights.create.unitLabel')}</span>
          <SegmentedControl<HomeGameUnitPresetId>
            ariaLabel={t('nights.create.unitLabel')}
            value={unitPreset}
            onChange={(next) => setUnitPreset(next)}
            options={[
              { value: 'chips', label: t('nights.units.chips') },
              { value: 'ils', label: t('nights.units.ils') },
            ]}
          />
        </div>

        <div className={styles.dialogField}>
          <span className={styles.sectionHeading}>{t('nights.create.stakesLabel')}</span>
          <div className={styles.inlineActionRow}>
            {(['', '0.5/1', '1/2', '2/5', '5/10'] as const).map((preset) => (
              <ChipButton
                key={preset || 'none'}
                selected={stakesPreset === preset}
                onToggle={() => setStakesPreset(preset)}
              >
                {preset || t('nights.create.stakesNone')}
              </ChipButton>
            ))}
          </div>
        </div>

        {recentNames.length > 0 && (
          <div className={styles.dialogField}>
            <span className={styles.sectionHeading}>{t('nights.create.recentChips')}</span>
            <div className={styles.inlineActionRow}>
              {recentNames.slice(0, 8).map((name) => (
                <ChipButton
                  key={name}
                  selected={players.some(
                    (p) => p.displayName.trim().toLowerCase() === name.toLowerCase(),
                  )}
                  onToggle={() => addQuickName(name)}
                >
                  {name}
                </ChipButton>
              ))}
            </div>
          </div>
        )}

        <div className={styles.dialogField}>
          <span className={styles.sectionHeading}>{t('nights.create.playersLabel')}</span>
          {players.map((row, idx) => (
            <div key={idx} className={styles.dialogPlayerRow}>
              <TextField
                value={row.displayName}
                onValueChange={(next) =>
                  setPlayers((prev) =>
                    prev.map((p, i) => (i === idx ? { ...p, displayName: next } : p)),
                  )
                }
                placeholder={t('nights.ledger.addPlayerPlaceholder')}
                ariaLabel={`${t('nights.ledger.addPlayerAria')} ${idx + 1}`}
                error={rowErrors[idx]?.nameError}
                ltrInput={false}
              />
              <TextField
                value={row.initialBuyInInput}
                onValueChange={(next) =>
                  setPlayers((prev) =>
                    prev.map((p, i) =>
                      i === idx ? { ...p, initialBuyInInput: next } : p,
                    ),
                  )
                }
                placeholder={defaultBuyIn}
                ariaLabel={`${t('nights.ledger.addPlayerBuyInAria')} ${idx + 1}`}
                error={rowErrors[idx]?.buyInError}
                selectOnFocus={true}
                ltrInput={true}
              />
            </div>
          ))}
          <div>
            <Button
              variant="secondary"
              onClick={() =>
                setPlayers([
                  ...players,
                  { displayName: '', initialBuyInInput: '' },
                ])
              }
            >
              {t('nights.create.addRow')}
            </Button>
          </div>
        </div>

        {store.errorMessageSignal.value && (
          <p className={styles.errorNote}>{store.errorMessageSignal.value}</p>
        )}
      </div>
    </Dialog>
  );
}
