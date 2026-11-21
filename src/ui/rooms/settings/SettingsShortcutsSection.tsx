import { useEffect, useState } from 'preact/hooks';
import {
  appearanceSignal,
  DEFAULT_SHORTCUTS,
  findShortcutClash,
  formatShortcutFromEvent,
  SHORTCUT_ACTION_IDS,
  updateAppearance,
  type ShortcutActionId,
} from '../../../domain/appearance';
import { t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { Panel } from '../../kit/panel/Panel';
import { cx } from '../../kit/state';
import styles from '../SettingsRoom.module.css';

interface ClashState {
  readonly action: ShortcutActionId;
  readonly other: ShortcutActionId;
}

export function SettingsShortcutsSection() {
  const prefs = appearanceSignal.value;
  const [listeningAction, setListeningAction] = useState<ShortcutActionId | null>(null);
  const [clash, setClash] = useState<ClashState | null>(null);

  useEffect(() => {
    if (!listeningAction) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation();
        }
        setListeningAction(null);
        setClash(null);
        return;
      }

      const combo = formatShortcutFromEvent(event);
      if (!combo) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }

      const existing = findShortcutClash(appearanceSignal.value.shortcuts, listeningAction, combo);
      if (existing) {
        setClash({ action: listeningAction, other: existing });
        return;
      }

      updateAppearance({
        shortcuts: {
          ...appearanceSignal.value.shortcuts,
          [listeningAction]: combo,
        },
      });
      setListeningAction(null);
      setClash(null);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [listeningAction]);

  const startListening = (actionId: ShortcutActionId) => {
    setClash(null);
    setListeningAction(actionId);
  };

  const cancelListening = () => {
    setClash(null);
    setListeningAction(null);
  };

  const resetDefaults = () => {
    setClash(null);
    setListeningAction(null);
    updateAppearance({ shortcuts: { ...DEFAULT_SHORTCUTS } });
  };

  return (
    <Panel as="div">
      <div
        className={styles.sectionHeaderRow}
        data-shortcut-capture={listeningAction ? 'true' : undefined}
      >
        <div className={styles.header}>
          <div className={styles.eyebrow}>{t('settings.shortcuts.heading')}</div>
          <p className={styles.subtitle}>{t('settings.shortcuts.hint')}</p>
        </div>
        <Button variant="secondary" onClick={resetDefaults}>
          {t('settings.shortcuts.reset')}
        </Button>
      </div>

      {listeningAction && (
        <p className={styles.hint} role="status">
          {t('settings.shortcuts.escapeHint')}
        </p>
      )}

      {clash && (
        <div className={styles.alertBox} role="alert">
          {t('settings.shortcuts.clash', {
            other: t(`settings.shortcut.${clash.other}`),
          })}
        </div>
      )}

      <div className={styles.shortcutList}>
        {SHORTCUT_ACTION_IDS.map((actionId) => {
          const isListening = listeningAction === actionId;
          const actionLabel = t(`settings.shortcut.${actionId}`);
          return (
            <div
              key={actionId}
              className={cx(styles.shortcutRow, isListening && styles.shortcutRowActive)}
            >
              <span className={styles.shortcutLabel}>{actionLabel}</span>
              <div className={styles.shortcutControls}>
                {isListening ? (
                  <>
                    <span className={styles.listeningBadge}>
                      {t('settings.shortcuts.listening')}
                    </span>
                    <Button variant="secondary" onClick={cancelListening}>
                      {t('settings.shortcuts.cancel')}
                    </Button>
                  </>
                ) : (
                  <>
                    <PokerNotation className={styles.shortcutBadge}>
                      {prefs.shortcuts[actionId]}
                    </PokerNotation>
                    <Button
                      variant="secondary"
                      ariaLabel={`${t('settings.shortcuts.rebind')}: ${actionLabel}`}
                      onClick={() => startListening(actionId)}
                    >
                      {t('settings.shortcuts.rebind')}
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        <div className={styles.shortcutRow}>
          <span className={styles.shortcutLabel}>{t('settings.shortcut.confirmAction')}</span>
          <div className={styles.shortcutControls}>
            <PokerNotation className={styles.shortcutBadge}>Enter</PokerNotation>
          </div>
        </div>
        <div className={styles.shortcutRow}>
          <span className={styles.shortcutLabel}>{t('settings.shortcut.nextSpot')}</span>
          <div className={styles.shortcutControls}>
            <PokerNotation className={styles.shortcutBadge}>Space / Enter</PokerNotation>
          </div>
        </div>
        <div className={styles.shortcutRow}>
          <span className={styles.shortcutLabel}>{t('settings.shortcut.reviewStep')}</span>
          <div className={styles.shortcutControls}>
            <PokerNotation className={styles.shortcutBadge}>J / K / ← / →</PokerNotation>
          </div>
        </div>
      </div>
    </Panel>
  );
}
