import { useState } from 'preact/hooks';
import { minorToMajorNumber } from '../../../engine-api';
import { t, tNodes } from '../../../i18n';
import type { NightsStore } from '../../../domain/nights';
import { Button } from '../../kit/button/Button';
import { Chip } from '../../kit/chip/Chip';
import { FactTile } from '../../kit/fact-tile/FactTile';
import { TextField } from '../../kit/input/TextField';
import { PhoneSheet } from '../../kit/overlay/Overlay';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import { cx } from '../../kit/state';
import { NightAmount } from './nightsFormatters';
import { NightsEmptyState } from './NightsEmptyState';
import { NightsPlayerSheetContent } from './NightsPlayerSheetContent';
import styles from './NightsRoom.module.css';

interface NightsLedgerViewProps {
  readonly store: NightsStore;
}

function formatNameList(names: readonly string[]): string {
  return names.join(', ');
}

export function NightsLedgerView({ store }: NightsLedgerViewProps) {
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerBuyIn, setNewPlayerBuyIn] = useState('');
  const [phoneSheetOpen, setPhoneSheetOpen] = useState(false);

  const night = store.activeNightSignal.value;
  const acc = store.activeAccountingSignal.value;
  const readiness = store.settleReadinessSignal.value;

  if (!night || !acc) {
    return <NightsEmptyState store={store} />;
  }

  const currency = night.session.currency;
  const isSettled = night.session.status === 'completed';
  const pendingNames = acc.participantResults
    .filter((p) => p.status !== 'cashed_out')
    .map((p) => p.displayName);

  const totalInMajor = minorToMajorNumber(acc.totalInMinor, currency.minorUnit);
  const totalOutMajor = minorToMajorNumber(acc.totalOutMinor, currency.minorUnit);
  const onTableMajor = minorToMajorNumber(
    Math.abs(acc.totalInMinor - acc.totalOutMinor),
    currency.minorUnit,
  );
  const decimals =
    currency.minorUnit === 2 &&
    (acc.totalInMinor % 100 !== 0 || acc.totalOutMinor % 100 !== 0)
      ? 2
      : 0;

  let gateLabel = t('nights.gate.stillOnTable');
  let gateBigMinor = acc.totalInMinor - acc.totalOutMinor;
  let gateIsDanger = false;
  let gateText = t('nights.gate.pendingText', { names: formatNameList(pendingNames) });

  if (isSettled) {
    gateLabel = t('nights.status.settled');
    gateBigMinor = 0;
    gateText = t('nights.settle.auditNote');
  } else if (readiness?.ok) {
    gateLabel = t('nights.gate.balanced');
    gateBigMinor = 0;
    gateText = t('nights.gate.balancedText');
  } else if (readiness && !readiness.ok) {
    if (readiness.reason === 'more_in_than_out') {
      gateLabel = t('nights.gate.moreIn');
      gateBigMinor = Math.abs(readiness.balanceMinor);
      gateIsDanger = true;
      gateText = t('nights.gate.imbalanceText');
    } else if (readiness.reason === 'more_out_than_in') {
      gateLabel = t('nights.gate.moreOut');
      gateBigMinor = Math.abs(readiness.balanceMinor);
      gateIsDanger = true;
      gateText = t('nights.gate.imbalanceText');
    }
  }

  const openInspector = (playerId: string, focus: 'rebuy' | 'cash' | null) => {
    store.openPlayerSheet(playerId, focus);
    if (typeof window !== 'undefined' && window.innerWidth < 960) {
      setPhoneSheetOpen(true);
    }
  };

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return;
    const ok = await store.addPlayer(newPlayerName, newPlayerBuyIn);
    if (ok) {
      setNewPlayerName('');
      setNewPlayerBuyIn('');
    }
  };

  const selectedPlayer = acc.participantResults.find(
    (p) => p.playerId === store.selectedPlayerIdSignal.value,
  );

  return (
    <div className={styles.mainGrid}>
      <div className={styles.column}>
        <Panel
          label={t('nights.rail.ledger')}
          title={night.session.title}
          tier={{ tier: 'exact', detail: t('nights.summary.tierDetail') }}
        >
          <PanelSection>
            <div className={styles.gateBanner}>
              <span className={styles.sectionHeading}>{gateLabel}</span>
              <div className={styles.gateHeadline}>
                <span className={cx(styles.gateBig, gateIsDanger && styles.gateBigDanger)}>
                  <NightAmount
                    engine={store.engine}
                    amountMinor={gateBigMinor}
                    currency={currency}
                  />
                </span>
                <p className={styles.gateText}>{gateText}</p>
              </div>
            </div>
          </PanelSection>

          <PanelSection>
            <div className={styles.factGrid}>
              <FactTile
                label={t('nights.gate.totalIn')}
                value={totalInMajor}
                decimals={decimals}
                unit={currency.label}
                unitPosition={currency.unitPreset === 'ils' ? 'prefix' : 'suffix'}
              />
              <FactTile
                label={t('nights.gate.totalOut')}
                value={totalOutMajor}
                decimals={decimals}
                unit={currency.label}
                unitPosition={currency.unitPreset === 'ils' ? 'prefix' : 'suffix'}
              />
              <FactTile
                label={gateLabel}
                value={onTableMajor}
                decimals={decimals}
                unit={currency.label}
                unitPosition={currency.unitPreset === 'ils' ? 'prefix' : 'suffix'}
                tier="exact"
              />
            </div>
          </PanelSection>

          <PanelSection
            label={t('nights.ledger.playersHeading', {
              count: acc.participantResults.length,
            })}
          >
            <div className={styles.playerList}>
              {acc.participantResults.map((p) => {
                const isSelected = store.selectedPlayerIdSignal.value === p.playerId;
                const isOut = p.status === 'cashed_out';
                return (
                  <div
                    key={p.playerId}
                    className={cx(
                      styles.playerRow,
                      isSelected && styles.playerRowSelected,
                    )}
                  >
                    <button
                      type="button"
                      className={styles.playerMain}
                      aria-pressed={isSelected}
                      onClick={() => openInspector(p.playerId, null)}
                    >
                      <span className={styles.playerDisc} aria-hidden="true">
                        {p.displayName.slice(0, 1).toUpperCase()}
                      </span>
                      <span className={styles.playerInfo}>
                        <span className={styles.playerName}>{p.displayName}</span>
                        <span className={styles.playerMeta}>
                          {tNodes('nights.ledger.inLine', {
                            amount: (
                              <NightAmount
                                engine={store.engine}
                                amountMinor={p.totalInMinor}
                                currency={currency}
                              />
                            ),
                            count: t('nights.ledger.buyInsCount', {
                              count: p.buyInCount,
                            }),
                          })}
                        </span>
                        <span
                          className={cx(
                            styles.playerNet,
                            isOut && p.netMinor > 0 && styles.playerNetPositive,
                            isOut && p.netMinor < 0 && styles.playerNetNegative,
                          )}
                        >
                          {isOut ? (
                            <>
                              <NightAmount
                                engine={store.engine}
                                amountMinor={p.totalOutMinor}
                                currency={currency}
                              />
                              {' · '}
                              <NightAmount
                                engine={store.engine}
                                amountMinor={p.netMinor}
                                currency={currency}
                                signed={true}
                              />
                            </>
                          ) : (
                            `${t('nights.status.playing')} · ${t('nights.status.notCashedOut')}`
                          )}
                        </span>
                      </span>
                    </button>

                    <div className={styles.playerActions}>
                      {isSettled ? (
                        <Chip>{t('nights.status.settled')}</Chip>
                      ) : (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => openInspector(p.playerId, 'rebuy')}
                          >
                            {t('nights.actions.rebuy')}
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => openInspector(p.playerId, 'cash')}
                          >
                            {t('nights.actions.cashOut')}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </PanelSection>

          {!isSettled && (
            <PanelSection label={t('nights.actions.addPlayer')}>
              <div className={styles.addPlayerRow}>
                <TextField
                  value={newPlayerName}
                  onValueChange={setNewPlayerName}
                  onSubmit={() => void handleAddPlayer()}
                  placeholder={t('nights.ledger.addPlayerPlaceholder')}
                  ariaLabel={t('nights.ledger.addPlayerAria')}
                  ltrInput={false}
                />
                <TextField
                  value={newPlayerBuyIn}
                  onValueChange={setNewPlayerBuyIn}
                  onSubmit={() => void handleAddPlayer()}
                  placeholder={String(
                    minorToMajorNumber(currency.defaultBuyInMinor, currency.minorUnit),
                  )}
                  ariaLabel={t('nights.ledger.addPlayerBuyInAria')}
                  ltrInput={true}
                />
                <Button
                  variant="secondary"
                  disabled={!newPlayerName.trim()}
                  onClick={() => void handleAddPlayer()}
                >
                  {t('nights.actions.addPlayer')}
                </Button>
              </div>
            </PanelSection>
          )}
        </Panel>
      </div>

      <div className={styles.desktopOnly}>
        <Panel
          label={t('nights.actions.rebuy')}
          title={selectedPlayer ? selectedPlayer.displayName : t('nights.sheet.buyInsHeading')}
        >
          <NightsPlayerSheetContent
            store={store}
            onDone={selectedPlayer ? () => store.closePlayerSheet() : undefined}
          />
        </Panel>
      </div>

      <PhoneSheet
        open={phoneSheetOpen && Boolean(selectedPlayer)}
        onClose={() => {
          setPhoneSheetOpen(false);
          store.closePlayerSheet();
        }}
        title={selectedPlayer?.displayName ?? t('nights.sheet.buyInsHeading')}
      >
        <NightsPlayerSheetContent
          store={store}
          onDone={() => {
            setPhoneSheetOpen(false);
            store.closePlayerSheet();
          }}
        />
      </PhoneSheet>
    </div>
  );
}
