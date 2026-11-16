import { useEffect } from 'preact/hooks';
import { appearanceSignal } from './domain/appearance';
import { getSharedEquityStore } from './domain/equity';
import { getSharedHandRecorderStore } from './domain/hand';
import { getSharedHomeStore } from './domain/home';
import { getSharedNightsStore } from './domain/nights';
import { getSharedReviewStore } from './domain/review';
import { getSharedStrategyStore } from './domain/strategy';
import { getSharedTrainingStore } from './domain/training';
import { activeRouteSignal, navigateTo, syncRouteFromBrowserLocation } from './domain/shellState';
import { t } from './i18n';
import { AppShell } from './ui/kit/shell/AppShell';
import type { SideRailSectionItem } from './ui/kit/shell/SideRail';
import { KitSheet } from './ui/kit/sheet/KitSheet';
import { EmptyRoom } from './ui/rooms/EmptyRoom';
import { EquityRoom } from './ui/rooms/equity';
import { HandRoom } from './ui/rooms/hand';
import { HomeRoom } from './ui/rooms/home';
import { NightsRoom } from './ui/rooms/nights';
import { ReviewRoom } from './ui/rooms/review';
import { SettingsRoom } from './ui/rooms/SettingsRoom';
import { StrategyRoom } from './ui/rooms/strategy';
import { TrainingRoom } from './ui/rooms/training';

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

  const homeStore = route === 'home' ? getSharedHomeStore() : null;
  const equityStore = route === 'equity' ? getSharedEquityStore() : null;
  const handStore = route === 'hand' ? getSharedHandRecorderStore() : null;
  const reviewStore = route === 'review' ? getSharedReviewStore() : null;
  const strategyStore = route === 'strategy' ? getSharedStrategyStore() : null;
  const trainingStore = route === 'training' ? getSharedTrainingStore() : null;
  const nightsStore = route === 'nights' ? getSharedNightsStore() : null;

  useEffect(() => {
    if (route === 'home') {
      void getSharedHomeStore().hydrate();
    } else if (route === 'strategy') {
      void getSharedStrategyStore().hydrate();
    } else if (route === 'training') {
      void getSharedTrainingStore().hydrate();
    } else if (route === 'nights') {
      void getSharedNightsStore().hydrate();
    }
  }, [route]);

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
          : trainingStore
            ? [
                {
                  id: 'hub',
                  label: t('training.rail.modes'),
                  active: trainingStore.activeViewSignal.value === 'hub',
                  onSelect: () => {
                    trainingStore.setActiveView('hub');
                  },
                },
                {
                  id: 'drill',
                  label: t('training.rail.drill'),
                  active: trainingStore.activeViewSignal.value === 'drill',
                  onSelect: () => {
                    if (trainingStore.drillExerciseSignal.value) {
                      trainingStore.setActiveView('drill');
                    } else {
                      void trainingStore.openQuickDrill();
                    }
                  },
                },
                {
                  id: 'duel',
                  label: t('training.rail.duel'),
                  active: trainingStore.activeViewSignal.value === 'duel',
                  onSelect: () => {
                    if (trainingStore.duelStateSignal.value) {
                      trainingStore.setActiveView('duel');
                    } else {
                      void trainingStore.startHeadsUpDuel();
                    }
                  },
                },
                {
                  id: 'leak_lab',
                  label: t('training.rail.leakLab'),
                  active: trainingStore.activeViewSignal.value === 'leak_lab',
                  onSelect: () => {
                    void trainingStore.openLeakLab();
                  },
                },
              ]
            : nightsStore
              ? [
                  {
                    id: 'ledger',
                    label: t('nights.rail.ledger'),
                    active: nightsStore.activeTabSignal.value === 'ledger',
                    onSelect: () => {
                      nightsStore.setActiveTab('ledger');
                    },
                  },
                  {
                    id: 'hands',
                    label: t('nights.rail.hands'),
                    badge: nightsStore.activeNightSignal.value?.linkedHands.length || undefined,
                    active: nightsStore.activeTabSignal.value === 'hands',
                    onSelect: () => {
                      nightsStore.setActiveTab('hands');
                    },
                  },
                  {
                    id: 'settle',
                    label: t('nights.rail.settle'),
                    active: nightsStore.activeTabSignal.value === 'settle',
                    onSelect: () => {
                      nightsStore.setActiveTab('settle');
                    },
                  },
                  {
                    id: 'past',
                    label: t('nights.rail.past'),
                    badge: nightsStore.sessionsSignal.value.length || undefined,
                    active: nightsStore.activeTabSignal.value === 'past',
                    onSelect: () => {
                      nightsStore.setActiveTab('past');
                    },
                  },
                ]
              : undefined;

  return (
    <AppShell sideSections={sideSections}>
      {route === 'home' && homeStore ? (
        <HomeRoom
          store={homeStore}
          onOpenTraining={(mode, leak) => {
            const tr = getSharedTrainingStore();
            navigateTo('training');
            void tr.hydrate().then(() => {
              if (mode === 'leak_lab' && leak) {
                return tr.openLeakLab({
                  key: `${leak.position}:${leak.familyId}`,
                  position: leak.position,
                  familyId: leak.familyId,
                  deltaPoints: null,
                  userCombos: 0,
                  baselineCombos: null,
                  drillCount: 0,
                });
              }
              if (mode === 'quick_drill') return tr.openQuickDrill();
              if (mode === 'duel') return tr.startHeadsUpDuel();
              tr.setActiveView('hub');
            });
          }}
          onOpenStrategy={(view, spot) => {
            const st = getSharedStrategyStore();
            navigateTo('strategy');
            void st.hydrate().then(() => {
              if (view === 'builder' && spot) {
                st.openSpotInBuilder(spot.rowId, spot.position);
              } else {
                st.setActiveView(view);
                if (spot?.leakCellKey) {
                  st.selectedLeakCellKeySignal.value = spot.leakCellKey;
                }
              }
            });
          }}
          onOpenReview={(handObjectId) => {
            const rev = getSharedReviewStore();
            const record = handObjectId
              ? homeStore.savedHandsSignal.value.find((h) => h.objectId === handObjectId)
              : undefined;
            if (record) {
              rev.openSavedHand(record);
              rev.setActiveSideTab('review');
            } else {
              rev.setActiveSideTab('saved');
            }
            void rev.refreshSavedLibrary();
            navigateTo('review');
          }}
          onOpenHandRecorder={() => {
            const rec = getSharedHandRecorderStore();
            rec.resetHand();
            rec.setActiveSideTab('record');
            navigateTo('hand');
          }}
          onOpenEquity={(matchupId) => {
            const eq = getSharedEquityStore();
            const record = matchupId
              ? homeStore.savedMatchupsSignal.value.find((m) => m.objectId === matchupId)
              : undefined;
            if (record) {
              eq.loadSavedMatchup(record);
            }
            eq.activeSideTabSignal.value = 'matchup';
            void eq.refreshSavedMatchups();
            navigateTo('equity');
          }}
          onOpenNights={(sessionId, tab) => {
            const ni = getSharedNightsStore();
            navigateTo('nights');
            void ni.hydrate().then(() => {
              if (sessionId) ni.selectNight(sessionId);
              if (tab) ni.setActiveTab(tab);
            });
          }}
        />
      ) : route === 'settings' ? (
        <SettingsRoom />
      ) : route === 'hand' && handStore ? (
        <HandRoom store={handStore} />
      ) : route === 'review' && reviewStore ? (
        <ReviewRoom store={reviewStore} />
      ) : route === 'equity' && equityStore ? (
        <EquityRoom store={equityStore} />
      ) : route === 'strategy' && strategyStore ? (
        <StrategyRoom store={strategyStore} />
      ) : route === 'training' && trainingStore ? (
        <TrainingRoom
          store={trainingStore}
          onOpenReview={() => {
            const rev = getSharedReviewStore();
            rev.setActiveSideTab('saved');
            void rev.refreshSavedLibrary();
            navigateTo('review');
          }}
        />
      ) : route === 'nights' && nightsStore ? (
        <NightsRoom
          store={nightsStore}
          onRecordFullHand={(nightSessionId, unitPreset) => {
            const rec = getSharedHandRecorderStore();
            rec.resetHand();
            rec.setTablePreset(unitPreset === 'ils' ? 'home_game_50bb' : 'six_max_100bb');
            rec.setLinkedNightSessionId(nightSessionId);
            rec.setActiveSideTab('record');
            navigateTo('hand');
          }}
          onOpenHandInReview={(handObjectId) => {
            const record = nightsStore.savedHandsByIdSignal.value[handObjectId];
            const rev = getSharedReviewStore();
            if (record) {
              rev.openSavedHand(record);
            } else {
              rev.setActiveSideTab('saved');
              void rev.refreshSavedLibrary();
            }
            navigateTo('review');
          }}
        />
      ) : route === 'kit' ? (
        <KitSheet />
      ) : (
        <EmptyRoom route={route} />
      )}
    </AppShell>
  );
}
