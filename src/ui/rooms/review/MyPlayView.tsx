import { useMemo } from 'preact/hooks';
import { computeMyPlayReport } from '../../../domain/review/myPlayAnalytics';
import type { ReviewStore } from '../../../domain/review';
import { formatNumber, formatPercent, t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { Chip } from '../../kit/chip/Chip';
import { FactTile, FactTileRow } from '../../kit/fact-tile/FactTile';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import styles from './ReviewRoom.module.css';

interface MyPlayViewProps {
  readonly store: ReviewStore;
}

export function MyPlayView({ store }: MyPlayViewProps) {
  const savedHands = store.savedHandsSignal.value;
  const report = useMemo(() => computeMyPlayReport(savedHands), [savedHands]);

  return (
    <section className={styles.room} aria-label={t('review.myPlay.heading')}>
      <header className={styles.roomHeader}>
        <div className={styles.headingGroup}>
          <h1 className={styles.roomTitle}>{t('review.myPlay.heading')}</h1>
          <p className={styles.roomSubtitle}>{t('review.myPlay.subtitle')}</p>
        </div>
      </header>

      <Panel
        title={t('review.myPlay.summaryHeading')}
        tier={
          report.isWatching
            ? {
                tier: 'estimated',
                detail: t('review.myPlay.watchingBadge', { count: report.totalHands }),
              }
            : { tier: 'exact', detail: t('review.myPlay.exactBadge') }
        }
      >
        <FactTileRow>
          <FactTile
            label={t('review.myPlay.handsLabel')}
            value={report.totalHands}
            decimals={0}
            instant
          />
          <FactTile
            label={t('review.myPlay.vpipLabel')}
            value={report.totalHands > 0 ? report.overallVpipPct : null}
            decimals={1}
            unit="%"
            instant
          />
          <FactTile
            label={t('review.myPlay.pfrLabel')}
            value={report.totalHands > 0 ? report.overallPfrPct : null}
            decimals={1}
            unit="%"
            instant
          />
          <FactTile
            label={t('review.myPlay.netBbLabel')}
            value={report.totalHands > 0 ? report.totalNetBb : null}
            decimals={1}
            unit="bb"
            instant
          />
        </FactTileRow>

        <PanelSection label={t('review.myPlay.byPositionHeading')}>
          {report.rows.length === 0 ? (
            <p className={styles.honestyNote}>{t('review.myPlay.empty')}</p>
          ) : (
            <div className={styles.myPlayTable}>
              {report.rows.map((row) => (
                <div key={row.position} className={styles.myPlayRow}>
                  <div className={styles.myPlayPos}>
                    <PokerNotation>{row.position}</PokerNotation>
                    <Chip>{t('review.myPlay.handsCount', { count: row.handsCount })}</Chip>
                    {row.isWatching && (
                      <Chip>{t('review.myPlay.watchingShort')}</Chip>
                    )}
                  </div>
                  <div className={styles.myPlayMetrics}>
                    <span>
                      VPIP <PokerNotation>{formatPercent(row.vpipPct / 100, 1)}</PokerNotation>
                    </span>
                    <span>
                      PFR <PokerNotation>{formatPercent(row.pfrPct / 100, 1)}</PokerNotation>
                    </span>
                    <span>
                      3B <PokerNotation>{formatPercent(row.threeBetPct / 100, 1)}</PokerNotation>
                    </span>
                    <span>
                      <PokerNotation>
                        {`${row.netBb >= 0 ? '+' : ''}${formatNumber(row.netBb)} bb`}
                      </PokerNotation>
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      store.setSavedSeatFilter(row.position);
                      store.setActiveSideTab('saved');
                      void store.refreshSavedLibrary();
                    }}
                  >
                    {t('review.myPlay.filterHands')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </PanelSection>
      </Panel>
    </section>
  );
}
