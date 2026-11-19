import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import {
  activeRouteSignal,
  closePalette,
  focusModeSignal,
  openPalette,
  paletteOpenSignal,
  railCollapsedSignal,
} from '../../../domain/shellState';
import { CommandPalette } from '../overlay/CommandPalette';
import { useEscapeLayer } from '../overlay/Overlay';
import { FloatingDock } from './FloatingDock';
import { SideRail, type SideRailSectionItem } from './SideRail';
import { TopBar } from './TopBar';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: ComponentChildren;
  sideSections?: readonly SideRailSectionItem[];
}

export function AppShell({ children, sideSections }: AppShellProps) {
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
      const isPaletteShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'k';

      if (isPaletteShortcut) {
        event.preventDefault();
        if (paletteOpenSignal.value) {
          closePalette();
        } else {
          openPalette();
        }
        return;
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
          <SideRail activeRoute={activeRoute} collapsed={railCollapsed} sections={sideSections} />
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
      />
    </div>
  );
}
