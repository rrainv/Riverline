import { useEffect } from 'preact/hooks';
import { appearanceSignal } from './domain/appearance';
import { getSharedEquityStore } from './domain/equity';
import { getSharedHandRecorderStore } from './domain/hand';
import { getSharedReviewStore } from './domain/review';
import { getSharedStrategyStore } from './domain/strategy';
import { activeRouteSignal, navigateTo, syncRouteFromBrowserLocation } from './domain/shellState';
import { t } from './i18n';
import { AppShell } from './ui/kit/shell/AppShell';
import type { SideRailSectionItem } from './ui/kit/shell/SideRail';
import { KitSheet } from './ui/kit/sheet/KitSheet';
import { EmptyRoom } from './ui/rooms/EmptyRoom';
import { EquityRoom } from './ui/rooms/equity';
import { HandRoom } from './ui/rooms/hand';
import { ReviewRoom } from './ui/rooms/review';
import { SettingsRoom } from './ui/rooms/SettingsRoom';
import { StrategyRoom } from './ui/rooms/strategy';

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
  const handStore = route === 'hand' ? getSharedHandRecorderStore() : null;
  const reviewStore = route === 'review' ? getSharedReviewStore() : null;
  const strategyStore = route === 'strategy' ? getSharedStrategyStore() : null;

  const sideSections: readonly SideRailSectionItem[] | undefined = equityStore
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
    : handStore
      ? [
          {
            id: 'record',
            label: t('recorder.side.record'),
            active: handStore.activeSideTabSignal.value === 'record',
            onSelect: () => {
              handStore.setActiveSideTab('record');
            },
          },
          {
            id: 'saved',
            label: t('recorder.side.saved'),
            badge: handStore.savedHandsSignal.value.length || undefined,
            active: false,
            onSelect: () => {
              const rev = getSharedReviewStore();
              rev.setActiveSideTab('saved');
              void rev.refreshSavedLibrary();
              navigateTo('review');
            },
          },
        ]
      : reviewStore
        ? [
            {
              id: 'review',
              label: t('review.side.review'),
              active: reviewStore.activeSideTabSignal.value === 'review',
              onSelect: () => {
                reviewStore.setActiveSideTab('review');
              },
            },
            {
              id: 'saved',
              label: t('review.side.saved'),
              badge: reviewStore.savedHandsSignal.value.length || undefined,
              active: reviewStore.activeSideTabSignal.value === 'saved',
              onSelect: () => {
                reviewStore.setActiveSideTab('saved');
                void reviewStore.refreshSavedLibrary();
              },
            },
          ]
        : strategyStore
          ? [
              {
                id: 'spotMap',
                label: t('strategy.side.spotMap'),
                active: strategyStore.activeViewSignal.value === 'spotMap',
                onSelect: () => {
                  strategyStore.setActiveView('spotMap');
                },
              },
              {
                id: 'builder',
                label: t('strategy.side.builder'),
                active: strategyStore.activeViewSignal.value === 'builder',
                onSelect: () => {
                  strategyStore.setActiveView('builder');
                },
              },
              {
                id: 'leakMap',
                label: t('strategy.side.leakMap'),
                active: strategyStore.activeViewSignal.value === 'leakMap',
                onSelect: () => {
                  strategyStore.setActiveView('leakMap');
                },
              },
            ]
          : undefined;

  return (
    <AppShell sideSections={sideSections}>
      {route === 'settings' ? (
        <SettingsRoom />
      ) : route === 'hand' && handStore ? (
        <HandRoom store={handStore} />
      ) : route === 'review' && reviewStore ? (
        <ReviewRoom store={reviewStore} />
      ) : route === 'equity' && equityStore ? (
        <EquityRoom store={equityStore} />
      ) : route === 'strategy' && strategyStore ? (
        <StrategyRoom store={strategyStore} />
      ) : route === 'kit' ? (
        <KitSheet />
      ) : (
        <EmptyRoom route={route} />
      )}
    </AppShell>
  );
}
