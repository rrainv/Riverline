import { useRef, useState } from 'preact/hooks';
import {
  positionsForTableSize,
  STRATEGY_STACK_DEPTHS,
  type HomeGameUnitPresetId,
} from '../../../engine-api';
import { t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import type { NightsStore } from '../../../domain/nights';
import { Button } from '../../kit/button/Button';
import { Chip } from '../../kit/chip/Chip';
import { ChipButton } from '../../kit/choice/Choice';
import { TextField } from '../../kit/input/TextField';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import { PopoverMenu } from '../../kit/overlay/PopoverMenu';
import { CardPicker } from '../../kit/playing-card/CardPicker';
import { PlayingCard } from '../../kit/playing-card/PlayingCard';
import { cx } from '../../kit/state';
import { formatTimeShort } from './nightsFormatters';
import { NightsEmptyState } from './NightsEmptyState';
import styles from './NightsRoom.module.css';

interface NightsHandsViewProps {
  readonly store: NightsStore;
  readonly onRecordFullHand: (
    nightSessionId: string,
    unitPreset: HomeGameUnitPresetId,
    seatCount?: 6 | 8,
    nightTitle?: string,
    heroCards?: readonly [string, string],
    heroSeatIndex?: number,
    startingStackBb?: number,
  ) => void;
  readonly onOpenHandInReview: (handObjectId: string) => void;
}

export function NightsHandsView({
  store,
  onRecordFullHand,
  onOpenHandInReview,
}: NightsHandsViewProps) {
  const [pickerSlot, setPickerSlot] = useState<0 | 1 | null>(null);
  const [randomMenuOpen, setRandomMenuOpen] = useState(false);
  const randomBtnRef = useRef<HTMLButtonElement | null>(null);
  const heroCardRefs = useRef<Array<HTMLButtonElement | null>>([null, null]);

  const night = store.activeNightSignal.value;
  if (!night) {
    return <NightsEmptyState store={store} />;
  }

  const preview = store.shorthandPreviewSignal.value;
  const rawInput = store.handShorthandInputSignal.value;
  const heroCards = store.handHeroCardsSignal.value;
  const seatCount = store.handSeatCountSignal.value;
  const heroSeatIndex = store.handHeroSeatIndexSignal.value;
  const startingStackBb = store.handStartingStackBbSignal.value;
  const handNoteDraft = store.handNoteDraftSignal.value;
  const seatPositions = store.handSeatPositionsSignal.value;
  const seatByPosition = new Map(seatPositions.map((p) => [p.position, p.seatIndex]));
  const positions = positionsForTableSize(seatCount);

  const hands = night.linkedHands;
  const handsById = store.savedHandsByIdSignal.value;

  let helperText = t('nights.hands.helperEmpty');
  if (rawInput.trim()) {
    if (preview.errorToken) {
      helperText = preview.errorMessage
        ? preview.errorMessage
        : t('nights.hands.helperError', { token: preview.errorToken });
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
          <div className={styles.handCaptureBar}>
            <div className={styles.captureGroup}>
              <span className={styles.sectionHeading}>{t('nights.hands.heroCardsLabel')}</span>
              <div className={styles.captureChipRow}>
                {([0, 1] as const).map((slotIdx) => (
                  <button
                    key={slotIdx}
                    ref={(el) => {
                      heroCardRefs.current[slotIdx] = el;
                    }}
                    type="button"
                    className={styles.cardSlotButton}
                    aria-label={t('nights.hands.pickCardTitle', { slot: slotIdx + 1 })}
                    onClick={() => setPickerSlot(slotIdx)}
                  >
                    <PlayingCard card={heroCards[slotIdx]} size="small" hoverLift />
                  </button>
                ))}
                <div className={styles.randomMenuWrap}>
                  <Button
                    buttonRef={(el) => {
                      randomBtnRef.current = el;
                    }}
                    variant="secondary"
                    onClick={() => setRandomMenuOpen((open) => !open)}
                  >
                    {t('random.menuButton')}
                  </Button>
                  <PopoverMenu
                    open={randomMenuOpen}
                    onClose={() => setRandomMenuOpen(false)}
                    anchorEl={randomBtnRef.current}
                    width={220}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.randomMenuItem}
                      onClick={() => {
                        store.randomizeHandHeroCards();
                        setRandomMenuOpen(false);
                      }}
                    >
                      {t('random.heroCards')}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.randomMenuItem}
                      onClick={() => {
                        const nextSeat =
                          (heroSeatIndex + 1 + Math.floor(Math.random() * Math.max(1, seatCount - 1))) %
                          seatCount;
                        store.setHandHeroSeatIndex(nextSeat);
                        setRandomMenuOpen(false);
                      }}
                    >
                      {t('random.heroPosition')}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.randomMenuItem}
                      onClick={() => {
                        const nextSeat =
                          (heroSeatIndex + 1 + Math.floor(Math.random() * Math.max(1, seatCount - 1))) %
                          seatCount;
                        store.setHandHeroSeatIndex(nextSeat);
                        store.randomizeHandHeroCards();
                        setRandomMenuOpen(false);
                      }}
                    >
                      {t('random.heroBoth')}
                    </button>
                  </PopoverMenu>
                </div>
              </div>
            </div>

            <div className={styles.captureGroup}>
              <span className={styles.sectionHeading}>{t('nights.hands.seatCountLabel')}</span>
              <div
                className={styles.captureChipRow}
                role="group"
                aria-label={t('nights.hands.seatCountLabel')}
              >
                {([6, 8] as const).map((count) => (
                  <ChipButton
                    key={count}
                    selected={seatCount === count}
                    onToggle={() => store.setHandSeatCount(count)}
                  >
                    <PokerNotation>{count}</PokerNotation>
                  </ChipButton>
                ))}
              </div>
            </div>

            <div className={styles.captureGroup}>
              <span className={styles.sectionHeading}>{t('nights.hands.heroSeatLabel')}</span>
              <div
                className={styles.captureChipRow}
                role="group"
                aria-label={t('nights.hands.heroSeatLabel')}
              >
                {positions.map((pos) => {
                  const seatIdx = seatByPosition.get(pos) ?? 0;
                  return (
                    <ChipButton
                      key={pos}
                      selected={heroSeatIndex === seatIdx}
                      onToggle={() => store.setHandHeroSeatIndex(seatIdx)}
                    >
                      <PokerNotation>{pos}</PokerNotation>
                    </ChipButton>
                  );
                })}
              </div>
            </div>

            <div className={styles.captureGroup}>
              <span className={styles.sectionHeading}>{t('nights.hands.stackLabel')}</span>
              <div
                className={styles.captureChipRow}
                role="group"
                aria-label={t('nights.hands.stackLabel')}
              >
                {STRATEGY_STACK_DEPTHS.map((bb) => (
                  <ChipButton
                    key={bb}
                    selected={startingStackBb === bb}
                    onToggle={() => store.setHandStartingStackBb(bb)}
                  >
                    <PokerNotation>{`${bb} bb`}</PokerNotation>
                  </ChipButton>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.handEntryStack}>
            <TextField
              value={rawInput}
              onValueChange={(next) => store.setHandShorthandInput(next)}
              onSubmit={() => void store.saveQuickShorthandHand()}
              placeholder={t('nights.hands.placeholder')}
              ariaLabel={t('nights.hands.aria')}
              ltrInput={true}
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

            <TextField
              multiline
              rows={2}
              ltrInput={false}
              value={handNoteDraft}
              onValueChange={(next) => store.setHandNoteDraft(next)}
              placeholder={t('nights.hands.notePlaceholder')}
              ariaLabel={t('nights.hands.noteAria')}
            />

            <div className={styles.inlineActionRow}>
              <Button
                variant="primary"
                disabled={!preview.valid}
                onClick={() => void store.saveQuickShorthandHand()}
              >
                {t('nights.actions.saveHand')}
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  onRecordFullHand(
                    night.session.sessionId,
                    night.session.currency.unitPreset,
                    seatCount,
                    night.session.title,
                    heroCards,
                    heroSeatIndex,
                    startingStackBb,
                  )
                }
              >
                {t('nights.actions.recordFullHand')}
              </Button>
            </div>
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
                      {record?.payload.handNote && (
                        <span className={styles.handCardNote}>{record.payload.handNote}</span>
                      )}
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

      <CardPicker
        open={pickerSlot !== null}
        onClose={() => setPickerSlot(null)}
        title={
          pickerSlot !== null
            ? t('nights.hands.pickCardTitle', { slot: pickerSlot + 1 })
            : ''
        }
        deadCards={
          pickerSlot !== null
            ? new Set([heroCards[pickerSlot === 0 ? 1 : 0]])
            : new Set()
        }
        selectedCard={pickerSlot !== null ? heroCards[pickerSlot] : null}
        closeOnSelect={pickerSlot !== 0}
        returnFocusTo={pickerSlot !== null ? heroCardRefs.current[pickerSlot] : null}
        onSelectCard={(card) => {
          if (pickerSlot !== null && card) {
            store.setHandHeroCard(pickerSlot, card);
            if (pickerSlot === 0) {
              setPickerSlot(1);
              return;
            }
          }
          setPickerSlot(null);
        }}
      />
    </div>
  );
}
