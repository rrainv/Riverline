import type { LearnStore } from '../../../domain/learn';
import type { RouteId } from '../../../domain/shellState';
import type { LearnWeaknessId } from '../../../engine-api';
import { t } from '../../../i18n';
import type { MessageKey } from '../../../i18n/types';
import { Button } from '../../kit/button/Button';
import { TeacherCallout } from '../../kit/lamp/Lamp';
import { Panel } from '../../kit/panel/Panel';
import styles from './LearnRoom.module.css';

interface LearnWeaknessesViewProps {
  readonly store: LearnStore;
  readonly onNavigateRoom: (room: RouteId) => void;
}

const WEAKNESS_KEYS: Record<
  LearnWeaknessId,
  { readonly title: MessageKey; readonly body: MessageKey }
> = {
  postflop_fallbacks: {
    title: 'learn.weak.postflop_fallbacks.title',
    body: 'learn.weak.postflop_fallbacks.body',
  },
  facing_3bet_4bet: {
    title: 'learn.weak.facing_3bet_4bet.title',
    body: 'learn.weak.facing_3bet_4bet.body',
  },
  multiway_postflop: {
    title: 'learn.weak.multiway_postflop.title',
    body: 'learn.weak.multiway_postflop.body',
  },
  duel_bot_model: {
    title: 'learn.weak.duel_bot_model.title',
    body: 'learn.weak.duel_bot_model.body',
  },
  postflop_personal_plan: {
    title: 'learn.weak.postflop_personal_plan.title',
    body: 'learn.weak.postflop_personal_plan.body',
  },
  solver_and_imports: {
    title: 'learn.weak.solver_and_imports.title',
    body: 'learn.weak.solver_and_imports.body',
  },
};

const ROOM_NAV_KEYS: Record<RouteId, MessageKey> = {
  home: 'rooms.home.nav',
  training: 'rooms.training.nav',
  strategy: 'rooms.strategy.nav',
  hand: 'rooms.hand.nav',
  equity: 'rooms.equity.nav',
  review: 'rooms.review.nav',
  nights: 'rooms.nights.nav',
  learn: 'rooms.learn.nav',
  settings: 'rooms.settings.nav',
  kit: 'rooms.kit.nav',
};

export function LearnWeaknessesView({ store, onNavigateRoom }: LearnWeaknessesViewProps) {
  const specs = store.weaknessesSignal.value;

  return (
    <div className={styles.weaknessesStack}>
      <TeacherCallout
        surface="panel"
        lampSize={72}
        mood="curious"
        heading={t('learn.weak.lampTitle')}
        text={t('learn.weak.lampBody')}
        tier={{ tier: 'estimated' }}
        typingSpeed="instant"
      />

      <h2 className={styles.nodeName}>{t('learn.weak.heading')}</h2>
      <p className={styles.roomSubtitle}>{t('learn.weak.intro')}</p>

      <div className={styles.weakGrid}>
        {specs.map((item) => {
          const keys = WEAKNESS_KEYS[item.id];
          return (
            <Panel
              key={item.id}
              title={t(keys.title)}
              headingLevel="h2"
              tier={{ tier: item.tier }}
            >
              <div className={styles.weakCardBody}>
                <p className={styles.weakText}>{t(keys.body)}</p>
                <div className={styles.weakMetaRow}>
                  <Button
                    variant="secondary"
                    onClick={() => onNavigateRoom(item.targetRoom)}
                  >
                    {t('learn.weak.openRoom', {
                      room: t(ROOM_NAV_KEYS[item.targetRoom]),
                    })}
                  </Button>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
