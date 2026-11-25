import type { JSX } from 'preact';
import { SPOT_COLLECTIONS } from '../../../engine-api';
import type { TrainingStore } from '../../../domain/training';
import { formatNumber, t, tNodes } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { ChipButton } from '../../kit/choice/Choice';
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
      subtitle: tNodes('training.hub.seat.duelSub', {
        hands: <PokerNotation>{formatNumber(10)}</PokerNotation>,
        stack: (
          <PokerNotation>
            {formatNumber(100)} {t('training.duel.unitBb')}
          </PokerNotation>
        ),
      }),
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
      <div className={styles.hubTableCol}>
        <Panel label={t('training.title')} title={t('training.hub.eyebrow')} fullHeight>
          <FeltTable
            mode="menu"
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
        </Panel>
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
                {leaks.map((item, idx) => {
                  const signedDelta =
                    item.deltaPoints === null
                      ? '0'
                      : item.deltaPoints > 0
                        ? `+${item.deltaPoints}`
                        : `${item.deltaPoints}`;
                  return (
                    <li
                      key={item.key}
                      className={styles.leakRow}
                      style={{ '--row-idx': idx } as JSX.CSSProperties}
                    >
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

          <PanelSection label={t('training.hub.packsHeading')}>
            <div className={styles.filterGroup}>
              {SPOT_COLLECTIONS.map((pack) => (
                <ChipButton
                  key={pack.id}
                  selected={false}
                  onToggle={() => {
                    void store.startSpotCollection(pack.id);
                  }}
                >
                  {t(`training.pack.${pack.id}`)}
                </ChipButton>
              ))}
            </div>
          </PanelSection>

          <PanelSection label={t('training.hub.prepHeading')}>
            <div className={styles.filterGroup}>
              <Button
                variant="secondary"
                onClick={() => {
                  void store.startPreGameWarmUp();
                }}
              >
                {t('training.hub.warmUpBtn')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  store.openLimpLab();
                }}
              >
                {t('training.hub.limpLabBtn')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  store.setActiveView('orbit');
                }}
              >
                {t('training.hub.orbitBtn')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  store.setActiveView('hand_reading');
                }}
              >
                {t('training.handReading.heading')}
              </Button>
            </div>
          </PanelSection>

          <PanelSection label={t('rail.group.opponents')}>
            <div className={styles.filterGroup}>
              {(
                [
                  ['balanced', 'training.duel.style.balanced'],
                  ['loose_aggressive', 'training.duel.style.loose_aggressive'],
                  ['tight_aggressive', 'training.duel.style.tight_aggressive'],
                ] as const
              ).map(([styleId, key]) => (
                <ChipButton
                  key={styleId}
                  selected={false}
                  onToggle={() => {
                    void store.startHeadsUpDuel(undefined, styleId);
                  }}
                >
                  {t(key)}
                </ChipButton>
              ))}
            </div>
          </PanelSection>
        </Panel>
      </div>
    </div>
  );
}
