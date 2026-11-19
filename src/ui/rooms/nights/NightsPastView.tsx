import { t } from '../../../i18n';
import type { NightsStore } from '../../../domain/nights';
import { Button } from '../../kit/button/Button';
import { Chip } from '../../kit/chip/Chip';
import { ChipButton } from '../../kit/choice/Choice';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import { NightAmount } from './nightsFormatters';
import styles from './NightsRoom.module.css';

interface NightsPastViewProps {
  readonly store: NightsStore;
}

export function NightsPastView({ store }: NightsPastViewProps) {
  const showArchived = store.showArchivedSignal.value;
  const sessions = store.sessionsSignal.value.filter(
    (s) => showArchived || !s.session.archived,
  );
  const activeId = store.activeNightSignal.value?.session.sessionId ?? null;

  return (
    <Panel label={t('nights.rail.past')} title={t('nights.past.heading')}>
      <PanelSection>
        <div className={styles.inlineActionRow}>
          <ChipButton
            selected={showArchived}
            onToggle={(next) => {
              store.showArchivedSignal.value = next;
            }}
          >
            {t('nights.past.showArchived')}
          </ChipButton>
          <Button variant="primary" onClick={() => store.setCreateModalOpen(true)}>
            {t('nights.actions.newNight')}
          </Button>
        </div>
      </PanelSection>

      <PanelSection>
        {sessions.length === 0 ? (
          <p className={styles.mutedNote}>{t('nights.past.empty')}</p>
        ) : (
          <div className={styles.entryList}>
            {sessions.map((record) => {
              const s = record.session;
              const accRes = store.engine.sync.calculateHomeGameAccounting(
                s,
                record.transactions,
              );
              const totalInMinor = accRes.ok ? accRes.data.totalInMinor : 0;
              const statusLabel = s.archived
                ? t('nights.status.archived')
                : s.status === 'completed'
                  ? t('nights.status.settled')
                  : t('nights.status.active');

              return (
                <div key={s.sessionId} className={styles.handCardRow}>
                  <div className={styles.handCardMeta}>
                    <span className={styles.handCardTitle}>{s.title}</span>
                    <span className={styles.handCardSub}>
                      {t('nights.past.rowMeta', {
                        players: s.participants.length,
                        status: statusLabel,
                        hands: record.linkedHands.length,
                      })}
                      {' · '}
                      <NightAmount
                        engine={store.engine}
                        amountMinor={totalInMinor}
                        currency={s.currency}
                      />
                    </span>
                  </div>
                  <div className={styles.inlineActionRow}>
                    {s.sessionId === activeId && s.status === 'active' && (
                      <Chip>{t('nights.status.active')}</Chip>
                    )}
                    <Button
                      variant="secondary"
                      onClick={() => {
                        store.selectNight(s.sessionId);
                        store.setActiveTab('ledger');
                      }}
                    >
                      {t('nights.past.open')}
                    </Button>
                    {s.status === 'completed' && (
                      <Button
                        variant="secondary"
                        onClick={() => void store.archiveNight(s.sessionId, !s.archived)}
                      >
                        {s.archived
                          ? t('nights.actions.restoreNight')
                          : t('nights.actions.archiveNight')}
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
  );
}
