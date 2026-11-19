import { minorToMajorNumber } from '../../../engine-api';
import { t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import type { NightsStore } from '../../../domain/nights';
import { Button } from '../../kit/button/Button';
import { Chip } from '../../kit/chip/Chip';
import { FactTile } from '../../kit/fact-tile/FactTile';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import { cx } from '../../kit/state';
import { NightAmount } from './nightsFormatters';
import { NightsEmptyState } from './NightsEmptyState';
import styles from './NightsRoom.module.css';

interface NightsSettleViewProps {
  readonly store: NightsStore;
  readonly onOpenHandInReview: (handObjectId: string) => void;
  readonly onGoHands: () => void;
}

export function NightsSettleView({
  store,
  onOpenHandInReview,
  onGoHands,
}: NightsSettleViewProps) {
  const night = store.activeNightSignal.value;
  const acc = store.activeAccountingSignal.value;
  const readiness = store.settleReadinessSignal.value;
  const settlement = store.settlementSignal.value;
  const summary = store.morningSummarySignal.value;

  if (!night || !acc || !readiness || !summary) {
    return <NightsEmptyState store={store} />;
  }

  const currency = night.session.currency;
  const isSettled = night.session.status === 'completed';
  const canSettle = readiness.ok && !isSettled;
  const pendingNames = acc.participantResults
    .filter((p) => p.status !== 'cashed_out')
    .map((p) => p.displayName);

  const badgeText = settlement
    ? t('nights.settle.transferCount', { count: settlement.transfers.length })
    : t('nights.settle.waitingBadge');

  const blockedMessage =
    readiness.ok
      ? null
      : readiness.reason === 'pending_cashout'
        ? t('nights.settle.blockedPending', { names: pendingNames.join(', ') })
        : tNodes('nights.settle.blockedImbalance', {
            diff: (
              <NightAmount
                engine={store.engine}
                amountMinor={Math.abs(readiness.balanceMinor)}
                currency={currency}
              />
            ),
          });

  const decimals =
    currency.minorUnit === 2 &&
    (summary.totalInMinor % 100 !== 0 || summary.totalOutMinor % 100 !== 0)
      ? 2
      : 0;

  return (
    <div className={styles.mainGrid}>
      <div className={styles.column}>
        <Panel
          label={t('nights.rail.settle')}
          title={t('nights.settle.heading')}
          tier={{ tier: 'exact', detail: badgeText }}
        >
          {settlement ? (
            <PanelSection>
              {settlement.transfers.length === 0 ? (
                <p className={styles.mutedNote}>{t('nights.settle.evenLine')}</p>
              ) : (
                <div className={styles.entryList}>
                  {settlement.transfers.map((tr) => (
                    <div
                      key={`${tr.fromPlayerId}-${tr.toPlayerId}`}
                      className={styles.transferRow}
                    >
                      <span className={styles.transferLine}>
                        {tNodes('nights.settle.paysLine', {
                          from: <strong>{tr.fromName}</strong>,
                          to: <strong>{tr.toName}</strong>,
                        })}
                      </span>
                      <span className={styles.transferAmount}>
                        <NightAmount
                          engine={store.engine}
                          amountMinor={tr.amountMinor}
                          currency={currency}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </PanelSection>
          ) : (
            <PanelSection label={t('nights.settle.blockedTitle')}>
              <p className={styles.errorNote}>{blockedMessage}</p>
            </PanelSection>
          )}

          <PanelSection>
            <div className={styles.inlineActionRow}>
              {isSettled ? (
                <>
                  <Chip>{t('nights.status.settled')}</Chip>
                  <Button
                    variant="secondary"
                    onClick={() => void store.reopenActiveNight()}
                  >
                    {t('nights.actions.reopenNight')}
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  disabled={!canSettle}
                  onClick={() => void store.settleActiveNight()}
                >
                  {t('nights.actions.settleNight')}
                </Button>
              )}
            </div>
            <p className={styles.mutedNote}>{t('nights.settle.auditNote')}</p>
          </PanelSection>
        </Panel>
      </div>

      <div className={styles.column}>
        <Panel
          label={night.session.title}
          title={t('nights.summary.heading')}
          tier={{ tier: 'exact', detail: t('nights.summary.tierDetail') }}
        >
          <PanelSection>
            <div className={styles.factGrid}>
              <FactTile
                label={t('nights.summary.totalIn')}
                value={minorToMajorNumber(summary.totalInMinor, currency.minorUnit)}
                decimals={decimals}
                unit={currency.label}
                unitPosition={currency.unitPreset === 'ils' ? 'prefix' : 'suffix'}
              />
              <FactTile
                label={t('nights.summary.players')}
                value={summary.playerCount}
                decimals={0}
              />
              <FactTile
                label={t('nights.summary.transfers')}
                value={summary.transferCount}
                decimals={0}
                tier="exact"
              />
            </div>
          </PanelSection>

          {summary.largestWinner && (
            <PanelSection>
              <p className={styles.mutedNote}>
                {tNodes('nights.summary.largestNet', {
                  name: <strong>{summary.largestWinner.displayName}</strong>,
                  amount: (
                    <NightAmount
                      engine={store.engine}
                      amountMinor={summary.largestWinner.netMinor}
                      currency={currency}
                      signed={true}
                    />
                  ),
                })}
              </p>
            </PanelSection>
          )}

          <PanelSection label={t('nights.summary.standingsHeading')}>
            <div className={styles.entryList}>
              {summary.standings.map((row) => (
                <div key={row.playerId} className={styles.standingRow}>
                  <span className={styles.standingInfo}>
                    <strong>{row.displayName}</strong>
                    <span className={styles.playerMeta}>
                      <NightAmount
                        engine={store.engine}
                        amountMinor={row.totalInMinor}
                        currency={currency}
                      />
                      {' → '}
                      <NightAmount
                        engine={store.engine}
                        amountMinor={row.totalOutMinor}
                        currency={currency}
                      />
                    </span>
                  </span>
                  <span
                    className={cx(
                      styles.playerNet,
                      row.netMinor > 0 && styles.playerNetPositive,
                      row.netMinor < 0 && styles.playerNetNegative,
                    )}
                  >
                    <NightAmount
                      engine={store.engine}
                      amountMinor={row.netMinor}
                      currency={currency}
                      signed={true}
                    />
                  </span>
                </div>
              ))}
            </div>
          </PanelSection>

          <PanelSection
            label={t('nights.summary.handsHeading', { count: night.linkedHands.length })}
          >
            {night.linkedHands.length === 0 ? (
              <div className={styles.controlStack}>
                <p className={styles.mutedNote}>{t('nights.hands.empty')}</p>
                <Button variant="secondary" onClick={onGoHands}>
                  {t('nights.rail.hands')}
                </Button>
              </div>
            ) : (
              <div className={styles.entryList}>
                {night.linkedHands.map((ref) => {
                  const rec = store.savedHandsByIdSignal.value[ref.handObjectId];
                  return (
                    <div key={ref.handObjectId} className={styles.handCardRow}>
                      <span className={styles.handCardTitle}>
                        <PokerNotation>
                          {rec?.factTitle ?? ref.shorthandSummary ?? ref.handObjectId}
                        </PokerNotation>
                      </span>
                      {rec && (
                        <Button
                          variant="secondary"
                          onClick={() => onOpenHandInReview(ref.handObjectId)}
                        >
                          {t('nights.actions.openInReview')}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </PanelSection>
        </Panel>
      </div>
    </div>
  );
}
