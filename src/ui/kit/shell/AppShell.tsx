import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  matchesShortcutEvent,
  sessionPadVersionSignal,
  shortcutsSignal,
} from '../../../domain/appearance';
import {
  activeRouteSignal,
  closePalette,
  focusModeSignal,
  navigateTo,
  openPalette,
  paletteOpenSignal,
  railCollapsedSignal,
  SESSION_PAD_STORAGE_KEY,
  toggleFocusMode,
  type RouteId,
} from '../../../domain/shellState';
import { t } from '../../../i18n';
import { CommandPalette, type CommandPaletteItem } from '../overlay/CommandPalette';
import { useEscapeLayer } from '../overlay/Overlay';
import { FloatingDock } from './FloatingDock';
import { SideRail, type SideRailSectionItem } from './SideRail';
import { TopBar } from './TopBar';
import styles from './AppShell.module.css';

function isEditableTarget(node: EventTarget | null): boolean {
  if (!(node instanceof Element)) return false;
  const tag = node.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (node instanceof HTMLElement && node.isContentEditable) return true;
  return Boolean(node.closest('[contenteditable="true"], [contenteditable=""]'));
}

function readInitialSessionPad(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(SESSION_PAD_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const FLOW_ROUTE_CONFIG: Partial<
  Record<
    RouteId,
    {
      readonly step: 1 | 2 | 3 | 4;
      readonly tipKey:
        | 'flow.tip.home'
        | 'flow.tip.learn'
        | 'flow.tip.hand'
        | 'flow.tip.nights'
        | 'flow.tip.equity'
        | 'flow.tip.strategy'
        | 'flow.tip.review'
        | 'flow.tip.training';
      readonly nextRoute: RouteId;
      readonly nextKey:
        | 'flow.next.learn'
        | 'flow.next.hand'
        | 'flow.next.equity'
        | 'flow.next.strategy'
        | 'flow.next.review'
        | 'flow.next.training';
    }
  >
> = {
  learn: { step: 1, tipKey: 'flow.tip.learn', nextRoute: 'hand', nextKey: 'flow.next.hand' },
  hand: { step: 1, tipKey: 'flow.tip.hand', nextRoute: 'equity', nextKey: 'flow.next.equity' },
  nights: { step: 1, tipKey: 'flow.tip.nights', nextRoute: 'review', nextKey: 'flow.next.review' },
  equity: { step: 2, tipKey: 'flow.tip.equity', nextRoute: 'strategy', nextKey: 'flow.next.strategy' },
  strategy: { step: 2, tipKey: 'flow.tip.strategy', nextRoute: 'review', nextKey: 'flow.next.review' },
  review: { step: 3, tipKey: 'flow.tip.review', nextRoute: 'training', nextKey: 'flow.next.training' },
  training: { step: 4, tipKey: 'flow.tip.training', nextRoute: 'review', nextKey: 'flow.next.review' },
};

const FLOW_BAR_HIDDEN_KEY = 'riverline.flow-bar-hidden.v1';

export interface AppShellProps {
  children: ComponentChildren;
  sideSections?: readonly SideRailSectionItem[];
  paletteItems?: readonly CommandPaletteItem[];
  railPocket?: {
    readonly title: string;
    readonly content: ComponentChildren;
  };
}

export function AppShell({ children, sideSections, paletteItems, railPocket }: AppShellProps) {
  const activeRoute = activeRouteSignal.value;
  const railCollapsed = railCollapsedSignal.value;
  const focusMode = focusModeSignal.value;
  const paletteOpen = paletteOpenSignal.value;
  const searchButtonRef = useRef<HTMLButtonElement | null>(null);
  const [padNotes, setPadNotes] = useState<string>(readInitialSessionPad);
  const padVersion = sessionPadVersionSignal.value;
  useEffect(() => {
    setPadNotes(readInitialSessionPad());
  }, [padVersion]);
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [pocketMode, setPocketMode] = useState<'context' | 'pad'>('context');
  const [flowHidden, setFlowHidden] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem(FLOW_BAR_HIDDEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  const flowConfig = !focusMode ? FLOW_ROUTE_CONFIG[activeRoute] : undefined;

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  const handlePadChange = (next: string) => {
    setPadNotes(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(SESSION_PAD_STORAGE_KEY, next);
      } catch {
        // Ignore storage quota errors
      }
    }
  };

  useEscapeLayer(focusMode && !shortcutsOpen, () => {
    focusModeSignal.value = false;
  });
  useEscapeLayer(shortcutsOpen, () => {
    setShortcutsOpen(false);
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      if (document.querySelector('[data-shortcut-capture="true"]')) {
        return;
      }

      const shortcuts = shortcutsSignal.value;

      if (matchesShortcutEvent(event, shortcuts.palette)) {
        event.preventDefault();
        if (paletteOpenSignal.value) {
          closePalette();
        } else {
          openPalette();
        }
        return;
      }

      if (isEditableTarget(event.target) || isEditableTarget(document.activeElement)) {
        return;
      }

      if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }

      if (document.querySelector('[role="dialog"]')) {
        return;
      }

      if (matchesShortcutEvent(event, shortcuts.focus)) {
        event.preventDefault();
        toggleFocusMode();
        return;
      }

      if (matchesShortcutEvent(event, shortcuts.settings)) {
        event.preventDefault();
        navigateTo('settings');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const workspaceClass = focusMode
    ? `${styles.workspace} ${styles.workspaceFocus}`
    : railCollapsed
      ? `${styles.workspace} ${styles.workspaceCollapsed}`
      : styles.workspace;

  const activeSectionLabel = sideSections?.find((s) => s.active)?.label;

  return (
    <div className={styles.shell}>
      <TopBar
        activeRoute={activeRoute}
        focusMode={focusMode}
        activeSectionLabel={activeSectionLabel}
        onSearchButtonRef={(el) => {
          searchButtonRef.current = el;
        }}
      />

      <div className={workspaceClass}>
        <div
          className={
            focusMode ? `${styles.railColumn} ${styles.railColumnHidden}` : styles.railColumn
          }
          aria-hidden={focusMode || undefined}
        >
          <SideRail
            activeRoute={activeRoute}
            collapsed={railCollapsed}
            sections={sideSections}
          />
          {!railCollapsed && (!sideSections || sideSections.length <= 5) && (
            <div
              className={styles.cornerCard}
              aria-label={
                railPocket && pocketMode === 'context' ? railPocket.title : t('rail.pocket.title')
              }
            >
              <div className={styles.cornerHeader}>
                <div className={styles.cornerTitle}>
                  {railPocket && pocketMode === 'context'
                    ? railPocket.title
                    : t('rail.pocket.title')}
                </div>
                {railPocket ? (
                  <div className={styles.cornerModeSwitch} role="group" aria-label={t('rail.pocket.title')}>
                    <button
                      type="button"
                      className={
                        pocketMode === 'context'
                          ? `${styles.cornerModeBtn} ${styles.cornerModeBtnActive}`
                          : styles.cornerModeBtn
                      }
                      aria-pressed={pocketMode === 'context'}
                      onClick={() => setPocketMode('context')}
                    >
                      {t('rail.pocket.modeGuide')}
                    </button>
                    <button
                      type="button"
                      className={
                        pocketMode === 'pad'
                          ? `${styles.cornerModeBtn} ${styles.cornerModeBtnActive}`
                          : styles.cornerModeBtn
                      }
                      aria-pressed={pocketMode === 'pad'}
                      onClick={() => setPocketMode('pad')}
                    >
                      {t('rail.pocket.modePad')}
                    </button>
                  </div>
                ) : null}
              </div>

              {railPocket && pocketMode === 'context' ? (
                <div className={styles.cornerContextBody}>{railPocket.content}</div>
              ) : (
                <>
                  <div className={styles.cornerTimerRow}>
                    <div className={styles.cornerTimerGroup}>
                      <button
                        type="button"
                        className={
                          timerRunning
                            ? `${styles.cornerTimerBtn} ${styles.cornerTimerRunning}`
                            : styles.cornerTimerBtn
                        }
                        aria-pressed={timerRunning ? 'true' : 'false'}
                        aria-label={
                          timerRunning ? t('rail.pocket.timerPause') : t('rail.pocket.timerStart')
                        }
                        onClick={() => setTimerRunning((prev) => !prev)}
                        dir="ltr"
                        tabIndex={focusMode ? -1 : undefined}
                      >
                        {formatTimer(elapsedSec)}
                      </button>
                      <button
                        type="button"
                        className={
                          elapsedSec > 0 && !timerRunning
                            ? styles.cornerResetBtn
                            : `${styles.cornerResetBtn} ${styles.cornerResetHidden}`
                        }
                        aria-label={t('rail.pocket.timerReset')}
                        aria-hidden={!(elapsedSec > 0 && !timerRunning) || undefined}
                        tabIndex={elapsedSec > 0 && !timerRunning && !focusMode ? undefined : -1}
                        onClick={() => setElapsedSec(0)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={3}
                    className={styles.cornerTextarea}
                    value={padNotes}
                    placeholder={t('rail.pocket.placeholder')}
                    aria-label={t('rail.pocket.title')}
                    tabIndex={focusMode ? -1 : undefined}
                    onInput={(e) => handlePadChange((e.target as HTMLTextAreaElement).value)}
                  />
                </>
              )}

              <button
                type="button"
                className={styles.cornerKeysBtn}
                tabIndex={focusMode ? -1 : undefined}
                onClick={() => setShortcutsOpen(true)}
              >
                {t('rail.pocket.keys')}
              </button>
            </div>
          )}
        </div>

        <main key={activeRoute} className={styles.main} tabindex={-1}>
          {flowConfig && !flowHidden && (
            <div className={styles.flowStrip} role="region" aria-label={t('flow.ariaLabel')}>
              <div className={styles.flowStripLeft}>
                <span className={styles.flowStepBadge}>
                  {t('flow.stepLabel', { step: flowConfig.step })}
                </span>
                <p className={styles.flowTipText}>{t(flowConfig.tipKey)}</p>
              </div>
              <div className={styles.flowStripActions}>
                <button
                  type="button"
                  className={styles.flowNextBtn}
                  onClick={() => navigateTo(flowConfig.nextRoute)}
                >
                  {t(flowConfig.nextKey)}
                </button>
                <button
                  type="button"
                  className={styles.flowHideBtn}
                  onClick={() => {
                    setFlowHidden(true);
                    try {
                      window.localStorage.setItem(FLOW_BAR_HIDDEN_KEY, '1');
                    } catch {
                      // Ignore storage errors
                    }
                  }}
                >
                  {t('flow.hide')}
                </button>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>

      <FloatingDock activeRoute={activeRoute} focusMode={focusMode} />

      <CommandPalette
        open={paletteOpen}
        activeRoute={activeRoute}
        returnFocusTo={searchButtonRef.current}
        extraItems={paletteItems}
      />

      {shortcutsOpen && (
        <div
          className={styles.shortcutsBackdrop}
          onClick={() => setShortcutsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('shortcuts.overlay.title')}
            className={styles.shortcutsDialog}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.shortcutsHeader}>
              <h2 className={styles.shortcutsTitle}>{t('shortcuts.overlay.title')}</h2>
              <button
                type="button"
                className={styles.shortcutsCloseBtn}
                onClick={() => setShortcutsOpen(false)}
                aria-label={t('kit.overlay.close')}
              >
                ×
              </button>
            </div>
            <p className={styles.shortcutsHint}>{t('shortcuts.overlay.hint')}</p>
            <div className={styles.shortcutsGrid}>
              {(
                [
                  ['shortcuts.overlay.palette', shortcutsSignal.value.palette],
                  ['shortcuts.overlay.focus', shortcutsSignal.value.focus],
                  ['shortcuts.overlay.inlineEquity', shortcutsSignal.value.inlineEquity],
                  ['shortcuts.overlay.settings', shortcutsSignal.value.settings],
                  ['shortcuts.overlay.fold', shortcutsSignal.value.fold],
                  ['shortcuts.overlay.call', shortcutsSignal.value.call],
                  ['shortcuts.overlay.raise', shortcutsSignal.value.raise],
                  ['shortcuts.overlay.help', '?'],
                ] as const
              ).map(([labelKey, binding]) => (
                <div key={labelKey} className={styles.shortcutsRow}>
                  <span className={styles.shortcutsLabel}>{t(labelKey)}</span>
                  <kbd className={styles.shortcutsKbd} dir="ltr">{binding}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
