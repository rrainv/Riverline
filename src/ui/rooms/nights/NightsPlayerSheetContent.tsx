import { minorToMajorNumber, type HomeGameTransactionType } from '../../../engine-api';
import { t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import type { NightsStore } from '../../../domain/nights';
import { Button } from '../../kit/button/Button';
import { Chip } from '../../kit/chip/Chip';
import { TextField } from '../../kit/input/TextField';
import { Stepper } from '../../kit/stepper/Stepper';
import { cx } from '../../kit/state';
import { formatTimeShort, NightAmount } from './nightsFormatters';
import styles from './NightsRoom.module.css';

interface NightsPlayerSheetContentProps {
  readonly store: NightsStore;
  readonly onDone?: () => void;
}

function entryTypeLabel(type: HomeGameTransactionType): string {
  if (type === 'buy_in') return t('nights.sheet.entryBuyIn');
  if (type === 'rebuy') return t('nights.sheet.entryRebuy');
  if (type === 'add_on') return t('nights.sheet.entryAddOn');
  return t('nights.sheet.entryCashOut');
}

export function NightsPlayerSheetContent({
  store,
  onDone,
}: NightsPlayerSheetContentProps) {
  const night = store.activeNightSignal.value;
  const acc = store.activeAccountingSignal.value;
  const selectedId = store.selectedPlayerIdSignal.value;

  if (!night || !acc || !selectedId) {
    return <p className={styles.mutedNote}>{t('nights.sheet.selectPrompt')}</p>;
  }

  const player = acc.participantResults.find((p) => p.playerId === selectedId);
  if (!player) {
    return <p className={styles.mutedNote}>{t('nights.sheet.selectPrompt')}</p>;
  }

  const currency = night.session.currency;
  const isSettled = night.session.status === 'completed';
  const focus = store.sheetFocusSignal.value;
  const unitPosition = currency.unitPreset === 'ils' ? 'prefix' : 'suffix';
  const stepMajor = minorToMajorNumber(currency.stepMinor, currency.minorUnit);
  const history = store.ledgerHistorySignal.value.filter(
    (item) => item.original.playerId === selectedId,
  );

  const rebuyMinorParsed = store.engine.sync.parseHomeGameAmount(
    String(store.rebuyDraftMajorSignal.value),
    currency.minorUnit,
  );
  const rebuyMinor = rebuyMinorParsed.ok ? rebuyMinorParsed.data : 0;

  const cashOutParsed = store.engine.sync.parseHomeGameAmount(
    store.cashOutDraftTextSignal.value.trim() || '0',
    currency.minorUnit,
  );
  const cashOutMinor = cashOutParsed.ok && cashOutParsed.data >= 0 ? cashOutParsed.data : null;

  const isLastPending =
    acc.pendingPlayerIds.length === 1 && acc.pendingPlayerIds[0] === selectedId;
  const remainingMinor = Math.max(0, store.remainingOnTableMinorSignal.value ?? 0);

  return (
    <div className={styles.sheetSection}>
      <div className={styles.sheetHeaderRow}>
        <div className={styles.sheetIdentity}>
          <span className={styles.playerDisc} aria-hidden="true">
            {player.displayName.slice(0, 1).toUpperCase()}
          </span>
          <div className={styles.playerInfo}>
            <strong className={styles.playerName}>{player.displayName}</strong>
            <span className={styles.playerMeta}>
              {tNodes('nights.ledger.inLine', {
                amount: (
                  <NightAmount
                    engine={store.engine}
                    amountMinor={player.totalInMinor}
                    currency={currency}
                  />
                ),
                count: t('nights.ledger.buyInsCount', { count: player.buyInCount }),
              })}
            </span>
          </div>
        </div>
        {onDone && (
          <Button variant="secondary" onClick={onDone}>
            {t('nights.actions.done')}
          </Button>
        )}
      </div>

      {isSettled && <p className={styles.mutedNote}>{t('nights.sheet.lockedNote')}</p>}

      <div className={styles.controlStack}>
        <h3 className={styles.sectionHeading}>{t('nights.sheet.buyInsHeading')}</h3>
        <div className={styles.entryList}>
          {history.map((item) => {
            const tx = item.original;
            const timeStr = formatTimeShort(tx.createdAt);
            const isVoided = item.corrected && !item.replacement;
            return (
              <div key={tx.transactionId} className={styles.entryRow}>
                <span className={cx(styles.entryText, isVoided && styles.entryVoided)}>
                  {timeStr && <PokerNotation>{timeStr}</PokerNotation>}
                  <span>{entryTypeLabel(tx.type)}</span>
                  <NightAmount
                    engine={store.engine}
                    amountMinor={tx.amountMinor}
                    currency={currency}
                  />
                  {item.corrected && !item.replacement && (
                    <Chip>{t('nights.sheet.correctedTag')}</Chip>
                  )}
                  {item.replacement && <Chip>{t('nights.sheet.restoredTag')}</Chip>}
                </span>
                {!isSettled && (
                  item.corrected && !item.replacement ? (
                    <Button
                      variant="secondary"
                      onClick={() => void store.restoreLedgerEntry(tx.transactionId)}
                    >
                      {t('nights.actions.restore')}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        void store.correctLedgerEntry(
                          item.replacement ? item.replacement.transactionId : tx.transactionId,
                        )
                      }
                    >
                      {t('nights.actions.correct')}
                    </Button>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.controlStack}>
        <h3
          className={cx(
            styles.sectionHeading,
            focus === 'rebuy' && styles.sectionHeadingAccent,
          )}
        >
          {t('nights.sheet.rebuyHeading')}
        </h3>
        <Stepper
          ariaLabel={t('nights.sheet.rebuyHeading')}
          value={store.rebuyDraftMajorSignal.value}
          onChange={(next) => store.setRebuyDraftMajor(next)}
          min={stepMajor}
          step={stepMajor}
          decimals={0}
          unit={currency.label}
          unitPosition={unitPosition}
          disabled={isSettled}
        />
        <Button
          variant="secondary"
          disabled={isSettled || rebuyMinor <= 0}
          onClick={() => void store.addRebuy(selectedId, store.rebuyDraftMajorSignal.value)}
        >
          {tNodes('nights.actions.addRebuy', {
            amount: (
              <NightAmount
                engine={store.engine}
                amountMinor={rebuyMinor}
                currency={currency}
              />
            ),
          })}
        </Button>
      </div>

      <div className={styles.controlStack}>
        <h3
          className={cx(
            styles.sectionHeading,
            focus === 'cash' && styles.sectionHeadingAccent,
          )}
        >
          {t('nights.sheet.cashOutHeading')}
        </h3>
        <TextField
          value={store.cashOutDraftTextSignal.value}
          onValueChange={(next) => store.setCashOutDraftText(next)}
          ariaLabel={t('nights.sheet.cashOutAria')}
          ltrInput={true}
          disabled={isSettled}
          error={cashOutMinor === null ? store.errorMessageSignal.value ?? t('nights.sheet.cashOutAria') : undefined}
        />
        <Stepper
          ariaLabel={t('nights.sheet.cashOutHeading')}
          value={cashOutMinor !== null ? minorToMajorNumber(cashOutMinor, currency.minorUnit) : 0}
          onChange={(next) => store.setCashOutDraftText(String(next))}
          min={0}
          step={stepMajor}
          decimals={currency.minorUnit === 2 && cashOutMinor !== null && cashOutMinor % 100 !== 0 ? 2 : 0}
          unit={currency.label}
          unitPosition={unitPosition}
          disabled={isSettled}
        />
        <div className={styles.inlineActionRow}>
          {isLastPending && !isSettled && (
            <Button variant="secondary" onClick={() => store.fillRemainingCashOut()}>
              {tNodes('nights.actions.fillRemaining', {
                amount: (
                  <NightAmount
                    engine={store.engine}
                    amountMinor={remainingMinor}
                    currency={currency}
                  />
                ),
              })}
            </Button>
          )}
          {player.status === 'cashed_out' && !isSettled && (
            <Button
              variant="secondary"
              onClick={() => void store.returnPlayerToTable(selectedId)}
            >
              {t('nights.actions.returnToTable')}
            </Button>
          )}
        </div>
        <Button
          variant="primary"
          disabled={isSettled || cashOutMinor === null}
          onClick={() => void store.cashOutPlayer(selectedId, store.cashOutDraftTextSignal.value)}
        >
          {tNodes('nights.actions.confirmCashOut', {
            amount: (
              <NightAmount
                engine={store.engine}
                amountMinor={cashOutMinor ?? 0}
                currency={currency}
              />
            ),
          })}
        </Button>
      </div>
    </div>
  );
}
