import { useEffect } from 'preact/hooks';
import { appearanceSignal } from './domain/appearance';
import { activeRouteSignal, syncRouteFromBrowserLocation } from './domain/shellState';
import { AppShell } from './ui/kit/AppShell';
import { EmptyRoom } from './ui/rooms/EmptyRoom';
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

  return (
    <AppShell>
      {route === 'settings' ? <SettingsRoom /> : <EmptyRoom route={route} />}
    </AppShell>
  );
}
