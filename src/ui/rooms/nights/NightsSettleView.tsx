import { useState } from 'preact/hooks';
import { minorToMajorNumber, type HomeGameTransfer } from '../../../engine-api';
import { t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import type { NightsStore } from '../../../domain/nights';
import { Button } from '../../kit/button/Button';
import { Chip } from '../../kit/chip/Chip';
import { ChipButton } from '../../kit/choice/Choice';
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
  const [showReceiptNames, setShowReceiptNames] = useState(true);
  const [showReceiptAmounts, setShowReceiptAmounts] = useState(true);
  const [showReceiptHands, setShowReceiptHands] = useState(false);
  const [receiptCopied, setReceiptCopied] = useState(false);
  const [settleMode, setSettleMode] = useState<'fewest' | 'banker'>('fewest');
  const [bankerPlayerId, setBankerPlayerId] = useState<string>('');

  const night = store.activeNightSignal.value;
  const acc = store.activeAccountingSignal.value;
  const readiness = store.settleReadinessSignal.value;
  const settlement = store.settlementSignal.value;
  const summary = store.morningSummarySignal.value;

  if (!night || !acc || !readiness || !summary) {
    return <NightsEmptyState store={store} />;
  }

  const currency = night.session.currency;
  const isBalanced = readiness.ok;
  const isSettled = night.session.status === 'completed';
  const canSettle = isBalanced && !isSettled;
  const pendingNames = acc.participantResults
    .filter((p) => p.status !== 'cashed_out')
    .map((p) => p.displayName);

  const effectiveBanker =
    night.session.participants.find((p) => p.playerId === bankerPlayerId) ??
    night.session.participants[0] ??
    null;

  const bankerTransfers: HomeGameTransfer[] = [];
  if (isBalanced && effectiveBanker) {
    for (const r of acc.participantResults) {
      if (r.playerId === effectiveBanker.playerId || r.netMinor === 0) continue;
      if (r.netMinor < 0) {
        bankerTransfers.push({
          fromPlayerId: r.playerId,
          fromName: r.displayName,
          toPlayerId: effectiveBanker.playerId,
          toName: effectiveBanker.displayName,
          amountMinor: -r.netMinor,
        });
      } else {
        bankerTransfers.push({
          fromPlayerId: effectiveBanker.playerId,
          fromName: effectiveBanker.displayName,
          toPlayerId: r.playerId,
          toName: r.displayName,
          amountMinor: r.netMinor,
        });
      }
    }
  }

  const activeTransfers: readonly HomeGameTransfer[] =
    settleMode === 'banker' ? bankerTransfers : (settlement?.transfers ?? []);

  const badgeText = settlement
    ? t('nights.settle.transferCount', { count: activeTransfers.length })
    : t('nights.settle.waitingBadge');

  const blockedMessage =
    isBalanced
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

  const participantNameById = new Map<string, string>();
  night.session.participants.forEach((p, idx) => {
    participantNameById.set(
      p.playerId,
      showReceiptNames ? p.displayName : t('nights.receipt.anonPlayer', { index: idx + 1 }),
    );
  });

  const dateStamp = night.session.createdAt.slice(0, 10);
  const receiptLines: string[] = [
    `${night.session.title} · ${dateStamp} · ${t('nights.receipt.heading')}`,
  ];
  const trimmedSessionNote = (night.sessionNote ?? '').trim();
  if (showReceiptNames && trimmedSessionNote) {
    receiptLines.push(trimmedSessionNote);
  }

  if (!isBalanced) {
    const diffRes = store.engine.sync.formatHomeGameAmount(
      Math.abs(readiness.balanceMinor),
      currency,
    );
    const diffStr = diffRes.ok ? diffRes.data : String(Math.abs(readiness.balanceMinor));
    receiptLines.push(
      readiness.reason === 'pending_cashout'
        ? t('nights.settle.blockedPending', { names: pendingNames.join(', ') })
        : `${t('nights.settle.blockedTitle')}: ${diffStr}`,
    );
  } else {
    if (showReceiptAmounts && summary.standings.length > 0) {
      const netParts = summary.standings.map((row) => {
        const name = participantNameById.get(row.playerId) ?? row.displayName;
        const res = store.engine.sync.formatHomeGameAmount(Math.abs(row.netMinor), currency);
        const amt = res.ok ? res.data : String(Math.abs(row.netMinor));
        const sign = row.netMinor > 0 ? '+' : row.netMinor < 0 ? '−' : '';
        return `${name} ${sign}${amt}`;
      });
      receiptLines.push(netParts.join(' · '));
    }

    const transfers = activeTransfers;
    if (transfers.length === 0) {
      receiptLines.push(t('nights.settle.evenLine'));
    } else {
      for (const tr of transfers) {
        const from = participantNameById.get(tr.fromPlayerId) ?? tr.fromName;
        const to = participantNameById.get(tr.toPlayerId) ?? tr.toName;
        if (showReceiptAmounts) {
          const res = store.engine.sync.formatHomeGameAmount(tr.amountMinor, currency);
          const amountStr = res.ok ? res.data : String(tr.amountMinor);
          receiptLines.push(`${from} → ${to}: ${amountStr}`);
        } else {
          receiptLines.push(`${from} → ${to}`);
        }
      }
    }

    if (showReceiptHands && night.linkedHands.length > 0) {
      const handsById = store.savedHandsByIdSignal.value;
      for (const ref of night.linkedHands.slice(0, 3)) {
        const rec = handsById[ref.handObjectId];
        const handLabel = rec?.factTitle ?? ref.shorthandSummary ?? ref.handObjectId;
        receiptLines.push(handLabel);
      }
    }
  }

  const receiptText = receiptLines.join('\n');

  const handleCopyReceipt = () => {
    void navigator.clipboard?.writeText?.(receiptText);
    setReceiptCopied(true);
  };

  const handleDownloadReceipt = () => {
    const blob = new Blob([receiptText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'riverline-receipt.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

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
              <div className={styles.captureChipRow}>
                <ChipButton
                  selected={settleMode === 'fewest'}
                  onToggle={() => setSettleMode('fewest')}
                >
                  {t('nights.settle.modeFewest')}
                </ChipButton>
                <ChipButton
                  selected={settleMode === 'banker'}
                  onToggle={() => setSettleMode('banker')}
                >
                  {t('nights.settle.modeBanker')}
                </ChipButton>
              </div>
              {settleMode === 'banker' && effectiveBanker && (
                <div className={styles.captureChipRow}>
                  <span className={styles.mutedNote}>{t('nights.settle.bankerLabel')}:</span>
                  {night.session.participants.map((p) => (
                    <ChipButton
                      key={p.playerId}
                      selected={effectiveBanker.playerId === p.playerId}
                      onToggle={() => setBankerPlayerId(p.playerId)}
                    >
                      {p.displayName}
                    </ChipButton>
                  ))}
                </div>
              )}
              {activeTransfers.length === 0 ? (
                <p className={styles.mutedNote}>{t('nights.settle.evenLine')}</p>
              ) : (
                <div className={styles.entryList}>
                  {activeTransfers.map((tr) => (
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
          tier={
            isBalanced
              ? { tier: 'exact', detail: t('nights.summary.tierDetail') }
              : { tier: 'unavailable', detail: t('nights.settle.waitingBadge') }
          }
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
                <p className={styles.mutedNote}>{t('nights.summary.handsEmpty')}</p>
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

          <PanelSection label={t('nights.receipt.heading')}>
            <div className={styles.receiptStack}>
              <p className={styles.mutedNote}>{t('nights.receipt.subtitle')}</p>
              <div className={styles.captureChipRow}>
                <ChipButton
                  selected={showReceiptNames}
                  onToggle={() => {
                    setShowReceiptNames((prev) => !prev);
                    setReceiptCopied(false);
                  }}
                >
                  {t('nights.receipt.toggleNames')}
                </ChipButton>
                <ChipButton
                  selected={showReceiptAmounts}
                  onToggle={() => {
                    setShowReceiptAmounts((prev) => !prev);
                    setReceiptCopied(false);
                  }}
                >
                  {t('nights.receipt.toggleAmounts')}
                </ChipButton>
                <ChipButton
                  selected={showReceiptHands}
                  onToggle={() => {
                    setShowReceiptHands((prev) => !prev);
                    setReceiptCopied(false);
                  }}
                >
                  {t('nights.receipt.toggleHands')}
                </ChipButton>
              </div>
              <pre className={styles.receiptPre}>
                <PokerNotation>{receiptText}</PokerNotation>
              </pre>
              <div className={styles.inlineActionRow}>
                <Button
                  variant="secondary"
                  disabled={!isBalanced}
                  confirmed={receiptCopied}
                  onClick={handleCopyReceipt}
                >
                  {receiptCopied ? t('nights.receipt.copied') : t('nights.receipt.copyBtn')}
                </Button>
                <Button
                  variant="secondary"
                  disabled={!isBalanced}
                  onClick={handleDownloadReceipt}
                >
                  {t('nights.receipt.downloadBtn')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const pack = store.exportActiveNightPack();
                    if (!pack) return;
                    const blob = new Blob([pack.json], { type: 'application/json;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = pack.filename;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  {t('nights.pack.exportBtn')}
                </Button>
              </div>
            </div>
          </PanelSection>
        </Panel>
      </div>
    </div>
  );
}
