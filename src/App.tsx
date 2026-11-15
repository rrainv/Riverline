import { useEffect } from 'preact/hooks';
import { appearanceSignal } from './domain/appearance';
import { getSharedEquityStore } from './domain/equity';
import { activeRouteSignal, syncRouteFromBrowserLocation } from './domain/shellState';
import { t } from './i18n';
import { AppShell } from './ui/kit/shell/AppShell';
import type { SideRailSectionItem } from './ui/kit/shell/SideRail';
import { KitSheet } from './ui/kit/sheet/KitSheet';
import { EmptyRoom } from './ui/rooms/EmptyRoom';
import { EquityRoom } from './ui/rooms/equity';
import { SettingsRoom } from './ui/rooms/SettingsRoom';

export function App() {
  const route = activeRouteSignal.value;
  // Subscribe to appearance changes at top level so all translated strings re-render cleanly.
  void appearanceSignal.value.lang;

  useEffect(() => {
    const onPopState = () => {
      syncRouteFromBrowserLocation();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const equityStore = route === 'equity' ? getSharedEquityStore() : null;
  const equitySections: readonly SideRailSectionItem[] | undefined = equityStore
    ? [
        {
          id: 'matchup',
          label: t('equity.rail.matchup'),
          active: equityStore.activeSideTabSignal.value === 'matchup',
          onSelect: () => {
            equityStore.activeSideTabSignal.value = 'matchup';
          },
        },
        {
          id: 'saved',
          label: t('equity.rail.saved'),
          badge: equityStore.savedMatchupsSignal.value.length || undefined,
          active: equityStore.activeSideTabSignal.value === 'saved',
          onSelect: () => {
            equityStore.activeSideTabSignal.value = 'saved';
            void equityStore.refreshSavedMatchups();
          },
        },
      ]
    : undefined;

  return (
    <AppShell sideSections={equitySections}>
      {route === 'settings' ? (
        <SettingsRoom />
      ) : route === 'equity' && equityStore ? (
        <EquityRoom store={equityStore} />
      ) : route === 'kit' ? (
        <KitSheet />
      ) : (
        <EmptyRoom route={route} />
      )}
    </AppShell>
  );
}
