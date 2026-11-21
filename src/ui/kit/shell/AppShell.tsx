import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
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

export interface AppShellProps {
  children: ComponentChildren;
  sideSections?: readonly SideRailSectionItem[];
  paletteItems?: readonly CommandPaletteItem[];
}

const POCKET_POT_ODDS = [
  { key: '1/3', pct: '20%' },
  { key: '1/2', pct: '25%' },
  { key: '2/3', pct: '29%' },
  { key: 'pot', pct: '33%' },
] as const;

export function AppShell({ children, sideSections, paletteItems }: AppShellProps) {
  const activeRoute = activeRouteSignal.value;
  const railCollapsed = railCollapsedSignal.value;
  const focusMode = focusModeSignal.value;
  const paletteOpen = paletteOpenSignal.value;
  const searchButtonRef = useRef<HTMLButtonElement | null>(null);

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
                <div className={styles.cornerList}>
                  {POCKET_POT_ODDS.map((row) => (
                    <div key={row.key} className={styles.cornerRow}>
                      <span className={styles.cornerSize}>
                        {row.key === 'pot' ? t('rail.pocket.pot') : `${row.key} ${t('rail.pocket.pot').toLowerCase()}`}
                      </span>
                      <span className={styles.cornerPct} dir="ltr">{row.pct}</span>
                    </div>
                  ))}
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
