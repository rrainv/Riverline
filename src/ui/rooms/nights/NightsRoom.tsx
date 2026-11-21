import type { HomeGameUnitPresetId } from '../../../engine-api';
import { t } from '../../../i18n';
import type { NightsStore, NightsTabId } from '../../../domain/nights';
import { Button } from '../../kit/button/Button';
import { Chip } from '../../kit/chip/Chip';
import { SegmentedControl } from '../../kit/choice/Choice';
import { Toast } from '../../kit/overlay/Overlay';
import { NightsCreateDialog } from './NightsCreateDialog';
import { NightsHandsView } from './NightsHandsView';
import { NightsLedgerView } from './NightsLedgerView';
import { NightsPastView } from './NightsPastView';
import styles from './NightsRoom.module.css';
import { NightsSettleView } from './NightsSettleView';

export interface NightsRoomProps {
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

export function NightsRoom({
  store,
  onRecordFullHand,
  onOpenHandInReview,
}: NightsRoomProps) {
  const activeTab = store.activeTabSignal.value;
  const night = store.activeNightSignal.value;

  return (
    <div className={styles.room}>
      <header className={styles.roomHeader}>
        <div className={styles.headingGroup}>
          <div className={styles.titleRow}>
            <h1 className={styles.roomTitle}>{t('nights.title')}</h1>
            {night && (
              <Chip>
                {night.session.currency.unitPreset === 'ils'
                  ? t('nights.units.ils')
                  : t('nights.units.chips')}
              </Chip>
            )}
            {night?.session.status === 'completed' && (
              <Chip>{t('nights.status.settled')}</Chip>
            )}
          </div>
          <p className={styles.roomSubtitle}>{t('nights.subtitle')}</p>
        </div>

        <div className={styles.headerControls}>
          <SegmentedControl<NightsTabId>
            ariaLabel={t('nights.title')}
            value={activeTab}
            onChange={(tab) => store.setActiveTab(tab)}
            options={[
              { value: 'ledger', label: t('nights.rail.ledger') },
              { value: 'hands', label: t('nights.rail.hands') },
              { value: 'settle', label: t('nights.rail.settle') },
              { value: 'past', label: t('nights.rail.past') },
            ]}
          />
          <Button
            variant={activeTab === 'past' ? 'primary' : 'secondary'}
            onClick={() => store.setCreateModalOpen(true)}
          >
            {t('nights.actions.newNight')}
          </Button>
        </div>
      </header>

      {activeTab === 'ledger' && <NightsLedgerView store={store} />}
      {activeTab === 'hands' && (
        <NightsHandsView
          store={store}
          onRecordFullHand={onRecordFullHand}
          onOpenHandInReview={onOpenHandInReview}
        />
      )}
      {activeTab === 'settle' && (
        <NightsSettleView
          store={store}
          onOpenHandInReview={onOpenHandInReview}
          onGoHands={() => store.setActiveTab('hands')}
        />
      )}
      {activeTab === 'past' && <NightsPastView store={store} />}

      <NightsCreateDialog store={store} />

      <Toast
        open={Boolean(store.toastMessageSignal.value)}
        message={store.toastMessageSignal.value ?? ''}
        onDismiss={() => store.dismissToast()}
      />
    </div>
  );
}
