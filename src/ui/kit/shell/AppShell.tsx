import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { matchesShortcutEvent, shortcutsSignal } from '../../../domain/appearance';
import {
  activeRouteSignal,
  closePalette,
  focusModeSignal,
  navigateTo,
  openPalette,
  paletteOpenSignal,
  railCollapsedSignal,
  toggleFocusMode,
} from '../../../domain/shellState';
import { formatNumber, t } from '../../../i18n';
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

export interface AppShellProps {
  children: ComponentChildren;
  sideSections?: readonly SideRailSectionItem[];
  paletteItems?: readonly CommandPaletteItem[];
}

export function AppShell({ children, sideSections, paletteItems }: AppShellProps) {
  const activeRoute = activeRouteSignal.value;
  const railCollapsed = railCollapsedSignal.value;
  const focusMode = focusModeSignal.value;
  const paletteOpen = paletteOpenSignal.value;
  const searchButtonRef = useRef<HTMLButtonElement | null>(null);
  const [quickPot, setQuickPot] = useState('10');
  const [quickBet, setQuickBet] = useState('5');

  const potNum = Math.max(0, Number(quickPot) || 0);
  const betNum = Math.max(0, Number(quickBet) || 0);
  const callNeedPct =
    betNum > 0 && potNum + 2 * betNum > 0 ? (betNum / (potNum + 2 * betNum)) * 100 : 0;
  const bluffFoldPct =
    betNum > 0 && potNum + betNum > 0 ? (betNum / (potNum + betNum)) * 100 : 0;

  useEscapeLayer(focusMode, () => {
    focusModeSignal.value = false;
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

  return (
    <div className={styles.shell}>
      <TopBar
        activeRoute={activeRoute}
        focusMode={focusMode}
        onSearchButtonRef={(el) => {
          searchButtonRef.current = el;
        }}
      />

      <div className={workspaceClass}>
        {!focusMode && (
          <div className={styles.railColumn}>
            <SideRail
              activeRoute={activeRoute}
              collapsed={railCollapsed}
              sections={sideSections}
            />
            {!railCollapsed && (!sideSections || sideSections.length <= 5) && (
              <div className={styles.cornerCard} aria-label={t('rail.pocket.title')}>
                <div className={styles.cornerTitle}>{t('rail.pocket.title')}</div>
                <div className={styles.cornerInputs}>
                  <label className={styles.cornerField}>
                    <span className={styles.cornerFieldLabel}>{t('rail.pocket.pot')}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      className={styles.cornerInput}
                      value={quickPot}
                      aria-label={t('rail.pocket.pot')}
                      onInput={(e) => setQuickPot((e.target as HTMLInputElement).value)}
                      dir="ltr"
                    />
                  </label>
                  <label className={styles.cornerField}>
                    <span className={styles.cornerFieldLabel}>{t('rail.pocket.bet')}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      className={styles.cornerInput}
                      value={quickBet}
                      aria-label={t('rail.pocket.bet')}
                      onInput={(e) => setQuickBet((e.target as HTMLInputElement).value)}
                      dir="ltr"
                    />
                  </label>
                </div>
                <div className={styles.cornerList}>
                  <div className={styles.cornerRow}>
                    <span className={styles.cornerSize}>{t('rail.pocket.callNeed')}</span>
                    <span className={styles.cornerPct} dir="ltr">
                      {`${formatNumber(callNeedPct, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
                    </span>
                  </div>
                  <div className={styles.cornerRow}>
                    <span className={styles.cornerSize}>{t('rail.pocket.bluffFold')}</span>
                    <span className={styles.cornerPct} dir="ltr">
                      {`${formatNumber(bluffFoldPct, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
                    </span>
                  </div>
                </div>
                <div className={styles.cornerKeys}>{t('rail.pocket.keys')}</div>
              </div>
            )}
          </div>
        )}

        <main key={activeRoute} className={styles.main} tabindex={-1}>
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
    </div>
  );
}
