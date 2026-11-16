import type { TrainingStore } from '../../../domain/training';
import { t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { FactTile, FactTileRow } from '../../kit/fact-tile/FactTile';
import { FeltTable, type TableMenuSeat } from '../../kit/felt-table/FeltTable';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import styles from './TrainingRoom.module.css';

interface TrainingHubViewProps {
  readonly store: TrainingStore;
}

export function TrainingHubView({ store }: TrainingHubViewProps) {
  const week = store.thisWeekStatsSignal.value;
  const leaks = store.leakLabTargetsSignal.value.slice(0, 3);

  const menuSeats: TableMenuSeat[] = [
    {
      id: 'drill',
      title: t('training.hub.seat.drillTitle'),
      subtitle: t('training.hub.seat.drillSub'),
      emblem: 'pie',
      selected: true,
      onClick: () => {
        void store.openQuickDrill();
      },
    },
    {
      id: 'duel',
      title: t('training.hub.seat.duelTitle'),
      subtitle: t('training.hub.seat.duelSub'),
      emblem: 'orbits',
      onClick: () => {
        void store.startHeadsUpDuel();
      },
    },
    {
      id: 'leak',
      title: t('training.hub.seat.leakTitle'),
      subtitle: t('training.hub.seat.leakSub'),
      emblem: 'chart',
      onClick: () => {
        void store.openLeakLab();
      },
    },
  ];

  return (
    <div className={styles.hubGrid}>
      <div className={styles.column}>
        <FeltTable
          mode="menu"
          eyebrow={t('training.hub.eyebrow')}
          heading={t('training.hub.heading')}
          body={t('training.hub.body')}
          menuSeats={menuSeats}
          centerAction={
            <Button
              variant="primary"
              onClick={() => {
                void store.openQuickDrill();
              }}
            >
              {t('training.hub.centerAction')}
            </Button>
          }
        />
      </div>

      <div className={styles.column}>
        <Panel title={t('training.hub.weekHeading')}>
          <FactTileRow>
            <FactTile
              label={t('training.hub.weekSessions')}
              value={week.sessionsCount}
              decimals={0}
              instant
            />
            <FactTile
              label={t('training.hub.weekSpots')}
              value={week.spotsCount}
              decimals={0}
              instant
            />
            <FactTile
              label={t('training.hub.weekDuelNet')}
              value={week.netDuelBb}
              decimals={1}
              unit="bb"
              instant
            />
          </FactTileRow>

          <PanelSection label={t('training.hub.topLeaksHeading')}>
            {leaks.length === 0 ? (
              <p className={styles.planBody}>{t('training.hub.topLeaksEmpty')}</p>
            ) : (
              <ul className={styles.leakList}>
                {leaks.map((item) => {
                  const signedDelta =
                    item.deltaPoints === null
                      ? '0'
                      : item.deltaPoints > 0
                        ? `+${item.deltaPoints}`
                        : `${item.deltaPoints}`;
                  return (
                    <li key={item.key} className={styles.leakRow}>
                      <span className={styles.leakLabel}>
                        {tNodes('training.hub.topLeaksDelta', {
                          position: <PokerNotation>{item.position}</PokerNotation>,
                          family: t(`strategy.family.${item.familyId}`),
                          delta: <PokerNotation>{signedDelta}</PokerNotation>,
                        })}
                      </span>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          void store.openLeakLab(item);
                        }}
                      >
                        {t('training.hub.practiceBtn')}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </PanelSection>
        </Panel>
      </div>
    </div>
  );
}
