import type { HomeGameUnitPresetId } from '../../../engine-api';
import { t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import type { NightsStore } from '../../../domain/nights';
import { Button } from '../../kit/button/Button';
import { Chip } from '../../kit/chip/Chip';
import { TextField } from '../../kit/input/TextField';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import { cx } from '../../kit/state';
import { formatTimeShort } from './nightsFormatters';
import { NightsEmptyState } from './NightsEmptyState';
import styles from './NightsRoom.module.css';

interface NightsHandsViewProps {
  readonly store: NightsStore;
  readonly onRecordFullHand: (nightSessionId: string, unitPreset: HomeGameUnitPresetId) => void;
  readonly onOpenHandInReview: (handObjectId: string) => void;
}

export function NightsHandsView({
  store,
  onRecordFullHand,
  onOpenHandInReview,
}: NightsHandsViewProps) {
  const night = store.activeNightSignal.value;
  if (!night) {
    return <NightsEmptyState store={store} />;
  }

  const preview = store.shorthandPreviewSignal.value;
  const rawInput = store.handShorthandInputSignal.value;
  const hands = night.linkedHands;
  const handsById = store.savedHandsByIdSignal.value;

  let helperText = t('nights.hands.helperEmpty');
  if (rawInput.trim()) {
    if (preview.errorToken) {
      helperText = t('nights.hands.helperError', { token: preview.errorToken });
    } else if (preview.valid) {
      helperText =
        preview.boardCardCount > 0
          ? t('nights.hands.helperValid', {
              actions: preview.actionCount,
              cards: preview.boardCardCount,
            })
          : t('nights.hands.helperValidNoBoard', { actions: preview.actionCount });
    }
  }

  return (
    <div className={styles.column}>
      <Panel
        label={t('nights.rail.hands')}
        title={t('nights.hands.typeHeading')}
        tier={{ tier: 'exact', detail: t('recorder.tier.priceOnly') }}
      >
        <PanelSection>
          <TextField
            value={rawInput}
            onValueChange={(next) => store.setHandShorthandInput(next)}
            onSubmit={() => void store.saveQuickShorthandHand()}
            placeholder={t('nights.hands.placeholder')}
            ariaLabel={t('nights.hands.aria')}
            ltrInput={true}
            submitLabel={t('nights.actions.saveHand')}
            submitDisabled={!preview.valid}
            error={preview.errorToken ? helperText : undefined}
            preview={!preview.errorToken ? helperText : undefined}
          />

          {preview.tokens.length > 0 && (
            <div className={styles.tokenRow}>
              {preview.tokens.map((tok, idx) => (
                <span
                  key={`${tok.text}-${idx}`}
                  className={cx(styles.tokenChip, !tok.valid && styles.tokenChipBad)}
                >
                  <PokerNotation>{tok.text}</PokerNotation>
                </span>
              ))}
            </div>
          )}

          <div className={styles.inlineActionRow}>
            <Button
              variant="secondary"
              onClick={() =>
                onRecordFullHand(
                  night.session.sessionId,
                  night.session.currency.unitPreset,
                )
              }
            >
              {t('nights.actions.recordFullHand')}
            </Button>
          </div>
        </PanelSection>

        <PanelSection
          label={t('nights.hands.tonightHeading', {
            count: t('nights.hands.handCount', { count: hands.length }),
          })}
        >
          {hands.length === 0 ? (
            <p className={styles.mutedNote}>{t('nights.hands.empty')}</p>
          ) : (
            <div className={styles.entryList}>
              {hands.map((ref) => {
                const record = handsById[ref.handObjectId];
                const title = record?.factTitle ?? ref.shorthandSummary ?? ref.handObjectId;
                const timeStr = formatTimeShort(ref.linkedAt);
                return (
                  <div key={ref.handObjectId} className={styles.handCardRow}>
                    <div className={styles.handCardMeta}>
                      <span className={styles.handCardTitle}>
                        <PokerNotation>{title}</PokerNotation>
                      </span>
                      <span className={styles.handCardSub}>
                        {timeStr && <PokerNotation>{timeStr}</PokerNotation>}
                        {ref.shorthandSummary && (
                          <>
                            {timeStr ? ' · ' : ''}
                            <PokerNotation>{ref.shorthandSummary}</PokerNotation>
                          </>
                        )}
                      </span>
                    </div>
                    <div className={styles.inlineActionRow}>
                      {record && (
                        <Chip>
                          {record.payload.savedKind === 'completed_hand'
                            ? t('recorder.saved.kindCompleted')
                            : t('recorder.saved.kindSpot')}
                        </Chip>
                      )}
                      {record && (
                        <Button
                          variant="secondary"
                          onClick={() => onOpenHandInReview(ref.handObjectId)}
                        >
                          {t('nights.actions.openInReview')}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </PanelSection>
      </Panel>
    </div>
  );
}
