import { useEffect } from 'preact/hooks';
import { langSignal, THEME_IDS, updateAppearance } from './domain/appearance';
import { getSharedHomeStore } from './domain/home';
import { getSharedSolverStore, type ExternalSolverSpotInput } from './domain/solver';
import {
  lazyStoreVersionSignal,
  loadEquityStore,
  loadHandStore,
  loadLearnStore,
  loadNightsStore,
  loadReviewStore,
  loadStrategyStore,
  loadTrainingStore,
  peekEquityStore,
  peekHandStore,
  peekLearnStore,
  peekNightsStore,
  peekReviewStore,
  peekStrategyStore,
  peekTrainingStore,
} from './domain/lazyStores';
import { getStudyStorageHealth } from './domain/storage';
import { allVillainProfilesSignal } from './domain/profiles/villainProfiles';
import {
  activeRouteSignal,
  navigateTo,
  paletteOpenSignal,
  returnContextSignal,
  SETTINGS_SECTION_IDS,
  settingsSectionSignal,
  setReturnContext,
  syncRouteFromBrowserLocation,
  toggleFocusMode,
} from './domain/shellState';
import {
  CARD_RANKS,
  LEARN_CONCEPT_IDS,
  STRATEGY_FAMILIES,
  STRATEGY_STACK_DEPTHS,
  type StrategyFamilyId,
  type StrategyStackDepthBb,
  type TrainingDrillTarget,
} from './engine-api';
import { CATALOGUES, formatNumber, t } from './i18n';
import type { CommandPaletteItem } from './ui/kit/overlay/CommandPalette';
import { AppShell } from './ui/kit/shell/AppShell';
import shellStyles from './ui/kit/shell/AppShell.module.css';
import type { SideRailSectionItem } from './ui/kit/shell/SideRail';
import { createLazyComponent } from './ui/kit/lazy';
import { HomeRoom } from './ui/rooms/home';

const KitSheet = createLazyComponent(() =>
  import('./ui/kit/sheet/KitSheet').then((m) => m.KitSheet),
);
const EquityRoom = createLazyComponent(() =>
  import('./ui/rooms/equity').then((m) => m.EquityRoom),
);
const HandRoom = createLazyComponent(() =>
  import('./ui/rooms/hand').then((m) => m.HandRoom),
);
const LearnRoom = createLazyComponent(() =>
  import('./ui/rooms/learn').then((m) => m.LearnRoom),
);
const NightsRoom = createLazyComponent(() =>
  import('./ui/rooms/nights').then((m) => m.NightsRoom),
);
const ReviewRoom = createLazyComponent(() =>
  import('./ui/rooms/review').then((m) => m.ReviewRoom),
);
const SettingsRoom = createLazyComponent(() =>
  import('./ui/rooms/SettingsRoom').then((m) => m.SettingsRoom),
);
const StrategyRoom = createLazyComponent(() =>
  import('./ui/rooms/strategy').then((m) => m.StrategyRoom),
);
const TrainingRoom = createLazyComponent(() =>
  import('./ui/rooms/training').then((m) => m.TrainingRoom),
);

export function App() {
  const route = activeRouteSignal.value;
  // Subscribe to language and lazy-store readiness at top level so rooms re-render cleanly.
  void langSignal.value;
  void lazyStoreVersionSignal.value;

  useEffect(() => {
    const onPopState = () => {
      syncRouteFromBrowserLocation();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const homeStore = route === 'home' ? getSharedHomeStore() : null;
  const equityStore = route === 'equity' ? peekEquityStore() : null;
  const handStore = route === 'hand' ? peekHandStore() : null;
  const reviewStore = route === 'review' ? peekReviewStore() : null;
  const strategyStore = route === 'strategy' ? peekStrategyStore() : null;
  const trainingStore = route === 'training' ? peekTrainingStore() : null;
  const nightsStore = route === 'nights' ? peekNightsStore() : null;
  const learnStore = route === 'learn' ? peekLearnStore() : null;

  const paletteOpen = paletteOpenSignal.value;
  const returnCtx = returnContextSignal.value;

  useEffect(() => {
    if (route === 'home') {
      void getSharedHomeStore().hydrate();
    } else if (route === 'equity') {
      void loadEquityStore();
    } else if (route === 'hand') {
      void loadHandStore();
    } else if (route === 'review') {
      void loadReviewStore();
    } else if (route === 'strategy') {
      void loadStrategyStore().then((s) => s.hydrate());
    } else if (route === 'training') {
      void loadTrainingStore().then((s) => s.hydrate());
    } else if (route === 'nights') {
      void loadNightsStore().then((s) => s.hydrate());
    } else if (route === 'learn') {
      void loadLearnStore().then((s) => s.hydrate());
    }
  }, [route]);

  useEffect(() => {
    if (!paletteOpen) return;
    void loadReviewStore().then((s) => s.refreshSavedLibrary());
    void loadEquityStore().then((s) => s.refreshSavedMatchups());
    void loadNightsStore().then((s) => s.hydrate());
  }, [paletteOpen]);

  const paletteItems: readonly CommandPaletteItem[] | undefined = paletteOpen
    ? (() => {
        const revForPalette = reviewStore ?? peekReviewStore();
        const eqForPalette = equityStore ?? peekEquityStore();
        const niForPalette = nightsStore ?? peekNightsStore();
        const handItems: CommandPaletteItem[] = (revForPalette?.savedHandsSignal.value ?? [])
          .filter((rec) => !rec.archived)
          .map((rec) => ({
            id: `hand:${rec.objectId}`,
            group: 'hands',
            label: rec.factTitle,
            hint: t('palette.hint.hand'),
            searchIndex: [
              rec.factTitle,
              rec.payload.shorthandLine,
              rec.payload.heroPositionLabel,
              rec.payload.handNote ?? '',
              ...rec.payload.heroNotes.map((n) => n.customText ?? ''),
              ...rec.tags,
            ]
              .join(' ')
              .toLowerCase(),
            iconRoute: 'review',
            onSelect: () => {
              navigateTo('review');
              void loadReviewStore().then((rev) => {
                rev.openSavedHand(rec);
                rev.setActiveSideTab('review');
              });
            },
          }));
        const conceptItems: CommandPaletteItem[] = LEARN_CONCEPT_IDS.map((conceptId) => ({
          id: `concept:${conceptId}`,
          group: 'concepts',
          label: t(`learn.concept.${conceptId}.name`),
          hint: t('palette.hint.concept'),
          searchIndex: [
            conceptId,
            CATALOGUES.en?.[`learn.concept.${conceptId}.name`],
            CATALOGUES.ru?.[`learn.concept.${conceptId}.name`],
            CATALOGUES.he?.[`learn.concept.${conceptId}.name`],
            CATALOGUES.en?.[`learn.concept.${conceptId}.term`],
            CATALOGUES.ru?.[`learn.concept.${conceptId}.term`],
            CATALOGUES.he?.[`learn.concept.${conceptId}.term`],
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase(),
          iconRoute: 'learn',
          onSelect: () => {
            navigateTo('learn');
            void loadLearnStore().then((ln) => {
              ln.selectConcept(conceptId);
              ln.setActiveSection('path');
            });
          },
        }));
        const nightItems: CommandPaletteItem[] = (niForPalette?.sessionsSignal.value ?? []).map(
          (night) => ({
            id: `night:${night.session.sessionId}`,
            group: 'nights',
            label: night.session.title,
            hint: t('palette.hint.night'),
            searchIndex: [night.session.title, night.sessionNote ?? ''].join(' ').toLowerCase(),
            iconRoute: 'nights',
            onSelect: () => {
              navigateTo('nights');
              void loadNightsStore().then((ni) => {
                ni.selectNight(night.session.sessionId);
                ni.setActiveTab('ledger');
              });
            },
          }),
        );
        const settingsItems: CommandPaletteItem[] = SETTINGS_SECTION_IDS.map((sectionId) => ({
          id: `settings:${sectionId}`,
          group: 'rooms',
          label: `${t('rooms.settings.title')} · ${t(`settings.tab.${sectionId}`)}`,
          hint: t('palette.hint.settings'),
          searchIndex: [
            'settings',
            sectionId,
            CATALOGUES.en?.[`settings.tab.${sectionId}`],
            CATALOGUES.ru?.[`settings.tab.${sectionId}`],
            CATALOGUES.he?.[`settings.tab.${sectionId}`],
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase(),
          iconRoute: 'settings',
          onSelect: () => {
            settingsSectionSignal.value = sectionId;
            navigateTo('settings');
          },
        }));
        const quickActionItems: CommandPaletteItem[] = [
          {
            id: 'action:new-hand',
            group: 'rooms',
            label: t('recorder.actions.newHand'),
            hint: t('rooms.hand.nav'),
            searchIndex: `new hand record ${CATALOGUES.en?.['recorder.actions.newHand'] ?? ''} ${CATALOGUES.ru?.['recorder.actions.newHand'] ?? ''} ${CATALOGUES.he?.['recorder.actions.newHand'] ?? ''}`.toLowerCase(),
            iconRoute: 'hand',
            onSelect: () => {
              navigateTo('hand');
              void loadHandStore().then((rec) => {
                rec.resetHand();
                rec.setActiveSideTab('record');
              });
            },
          },
          {
            id: 'action:new-night',
            group: 'rooms',
            label: t('nights.actions.newNight'),
            hint: t('rooms.nights.nav'),
            searchIndex: `new night game night ${CATALOGUES.en?.['nights.actions.newNight'] ?? ''} ${CATALOGUES.ru?.['nights.actions.newNight'] ?? ''} ${CATALOGUES.he?.['nights.actions.newNight'] ?? ''}`.toLowerCase(),
            iconRoute: 'nights',
            onSelect: () => {
              navigateTo('nights');
              void loadNightsStore().then((ni) => ni.hydrate().then(() => ni.setCreateModalOpen(true)));
            },
          },
          {
            id: 'action:random-matchup',
            group: 'rooms',
            label: t('equity.random.matchup'),
            hint: t('rooms.equity.nav'),
            searchIndex: `new matchup random equity ${CATALOGUES.en?.['equity.random.matchup'] ?? ''} ${CATALOGUES.ru?.['equity.random.matchup'] ?? ''} ${CATALOGUES.he?.['equity.random.matchup'] ?? ''}`.toLowerCase(),
            iconRoute: 'equity',
            onSelect: () => {
              navigateTo('equity');
              void loadEquityStore().then((eq) => {
                eq.activeSideTabSignal.value = 'matchup';
                eq.randomizeMatchup();
              });
            },
          },
          {
            id: 'action:quick-drill',
            group: 'rooms',
            label: t('training.hub.seat.drillTitle'),
            hint: t('rooms.training.nav'),
            searchIndex: `quick drill training spot ${CATALOGUES.en?.['training.hub.seat.drillTitle'] ?? ''} ${CATALOGUES.ru?.['training.hub.seat.drillTitle'] ?? ''} ${CATALOGUES.he?.['training.hub.seat.drillTitle'] ?? ''}`.toLowerCase(),
            iconRoute: 'training',
            onSelect: () => {
              navigateTo('training');
              void loadTrainingStore().then((tr) => tr.hydrate().then(() => tr.openQuickDrill()));
            },
          },
          {
            id: 'action:heads-up-duel',
            group: 'rooms',
            label: t('training.hub.seat.duelTitle'),
            hint: t('rooms.training.nav'),
            searchIndex: `heads up duel astra bot ${CATALOGUES.en?.['training.hub.seat.duelTitle'] ?? ''} ${CATALOGUES.ru?.['training.hub.seat.duelTitle'] ?? ''} ${CATALOGUES.he?.['training.hub.seat.duelTitle'] ?? ''}`.toLowerCase(),
            iconRoute: 'training',
            onSelect: () => {
              navigateTo('training');
              void loadTrainingStore().then((tr) => tr.hydrate().then(() => tr.startHeadsUpDuel()));
            },
          },
          {
            id: 'action:toggle-focus',
            group: 'rooms',
            label: t('topbar.focusEnter'),
            hint: t('settings.shortcut.focus'),
            searchIndex: `focus mode zen hide dock ${CATALOGUES.en?.['topbar.focusEnter'] ?? ''} ${CATALOGUES.ru?.['topbar.focusEnter'] ?? ''} ${CATALOGUES.he?.['topbar.focusEnter'] ?? ''}`.toLowerCase(),
            onSelect: () => {
              toggleFocusMode();
            },
          },
        ];
        const matchupItems: CommandPaletteItem[] = (eqForPalette?.savedMatchupsSignal.value ?? []).map(
          (m) => ({
            id: `matchup:${m.objectId}`,
            group: 'matchups',
            label: m.factTitle,
            hint: t('palette.hint.matchup'),
            searchIndex: [
              m.factTitle,
              m.payload.board.join(' '),
              ...m.payload.players.map((p) => p.rawInput),
            ]
              .join(' ')
              .toLowerCase(),
            iconRoute: 'equity',
            onSelect: () => {
              navigateTo('equity');
              void loadEquityStore().then((eq) => {
                eq.loadSavedMatchup(m);
                eq.activeSideTabSignal.value = 'matchup';
              });
            },
          }),
        );
        const themeItems: CommandPaletteItem[] = THEME_IDS.map((themeId) => ({
          id: `theme:${themeId}`,
          group: 'rooms',
          label: `${t('settings.themes.label')} · ${t(`settings.themes.${themeId}`)}`,
          hint: t('palette.hint.settings'),
          searchIndex: [
            'theme',
            themeId,
            CATALOGUES.en?.[`settings.themes.${themeId}`],
            CATALOGUES.ru?.[`settings.themes.${themeId}`],
            CATALOGUES.he?.[`settings.themes.${themeId}`],
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase(),
          iconRoute: 'settings',
          onSelect: () => {
            updateAppearance({ theme: themeId });
          },
        }));
        return [...quickActionItems, ...themeItems, ...settingsItems, ...handItems, ...matchupItems, ...conceptItems, ...nightItems];
      })()
    : undefined;

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
              navigateTo('review');
              void loadReviewStore().then((rev) => {
                rev.setActiveSideTab('saved');
                return rev.refreshSavedLibrary();
              });
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
            {
              id: 'myPlay',
              label: t('review.side.myPlay'),
              active: reviewStore.activeSideTabSignal.value === 'myPlay',
              onSelect: () => {
                reviewStore.setActiveSideTab('myPlay');
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
              {
                id: 'commitment',
                label: t('strategy.side.commitment'),
                active: strategyStore.activeViewSignal.value === 'commitment',
                onSelect: () => {
                  strategyStore.setActiveView('commitment');
                },
              },
              {
                id: 'rangeWalk',
                label: t('strategy.side.rangeWalk'),
                active: strategyStore.activeViewSignal.value === 'rangeWalk',
                onSelect: () => {
                  strategyStore.setActiveView('rangeWalk');
                },
              },
              {
                id: 'textureSubset',
                label: t('strategy.side.textureSubset'),
                active: strategyStore.activeViewSignal.value === 'textureSubset',
                onSelect: () => {
                  strategyStore.setActiveView('textureSubset');
                },
              },
              {
                id: 'postflopLab',
                label: t('strategy.side.postflopLab'),
                active: strategyStore.activeViewSignal.value === 'postflopLab',
                onSelect: () => {
                  strategyStore.setActiveView('postflopLab');
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
                    trainingStore.setActiveView('duel');
                  },
                },
                {
                  id: 'orbit',
                  label: t('training.rail.orbit'),
                  active: trainingStore.activeViewSignal.value === 'orbit',
                  onSelect: () => {
                    trainingStore.setActiveView('orbit');
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
                {
                  id: 'hand_reading',
                  label: t('training.handReading.nav'),
                  active: trainingStore.activeViewSignal.value === 'hand_reading',
                  onSelect: () => {
                    trainingStore.setActiveView('hand_reading');
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
                    badge:
                      nightsStore.sessionsSignal.value.filter(
                        (s) => s.session.status === 'completed',
                      ).length || undefined,
                    active: nightsStore.activeTabSignal.value === 'past',
                    onSelect: () => {
                      nightsStore.setActiveTab('past');
                    },
                  },
                ]
              : learnStore
                ? [
                    {
                      id: 'path',
                      label: t('learn.rail.path'),
                      active: learnStore.activeSectionSignal.value === 'path',
                      onSelect: () => {
                        learnStore.setActiveSection('path');
                      },
                    },
                    {
                      id: 'glossary',
                      label: t('learn.rail.glossary'),
                      active: learnStore.activeSectionSignal.value === 'glossary',
                      onSelect: () => {
                        learnStore.setActiveSection('glossary');
                      },
                    },
                    {
                      id: 'weaknesses',
                      label: t('learn.rail.weaknesses'),
                      active: learnStore.activeSectionSignal.value === 'weaknesses',
                      onSelect: () => {
                        learnStore.setActiveSection('weaknesses');
                      },
                    },
                  ]
                : route === 'settings'
                  ? SETTINGS_SECTION_IDS.map((sectionId) => ({
                      id: sectionId,
                      label: t(`settings.tab.${sectionId}`),
                      active: settingsSectionSignal.value === sectionId,
                      onSelect: () => {
                        settingsSectionSignal.value = sectionId;
                      },
                    }))
                  : undefined;

  const storageHealth = getStudyStorageHealth();

  const railPocket = (() => {
    if (homeStore) {
      const m = homeStore.studyMomentumSignal.value;
      return {
        title: t('home.momentum.heading'),
        content: (
          <>
            <span className={shellStyles.pocketStat}>
              {t('home.momentum.levelRank', {
                level: formatNumber(m.level),
                rank: t(`home.momentum.rank.${m.rankTier}`),
              })}
            </span>
            <span className={shellStyles.pocketHint}>
              {t('home.momentum.todayGoal', {
                today: formatNumber(m.todayUnits),
                goal: formatNumber(m.dailyGoal),
              })}
            </span>
          </>
        ),
      };
    }
    if (trainingStore) {
      const ds = trainingStore.drillSessionStatsSignal.value;
      const duel = trainingStore.duelStateSignal.value;
      return {
        title: t('rail.pocket.context.training'),
        content: duel && trainingStore.activeViewSignal.value === 'duel' ? (
          <span className={shellStyles.pocketStat}>
            {t('training.duel.handBadge', {
              hand: formatNumber(duel.handNumber),
              total: formatNumber(duel.totalHands),
            })}
          </span>
        ) : (
          <>
            <span className={shellStyles.pocketStat}>
              {t('training.drill.sessionProgress', {
                aligned: formatNumber(ds.baselineAlignedCount),
                total: formatNumber(ds.answeredCount),
              })}
            </span>
            <span className={shellStyles.pocketHint}>
              {t('training.drill.streakBadge', { count: formatNumber(ds.currentStreak) })}
            </span>
          </>
        ),
      };
    }
    if (equityStore) {
      const profiles = allVillainProfilesSignal.value.slice(0, 4);
      const firstVillain = equityStore.playersSignal.value.find((p) => !p.isHero);
      return {
        title: t('rail.pocket.context.equity'),
        content: (
          <div className={shellStyles.pocketChipRow}>
            {profiles.map((prof) => (
              <button
                key={prof.id}
                type="button"
                className={shellStyles.pocketChipBtn}
                onClick={() => {
                  if (firstVillain) {
                    equityStore.updatePlayerInput(firstVillain.id, prof.rangeText);
                  }
                }}
              >
                <bdi>{prof.name}</bdi>
              </button>
            ))}
          </div>
        ),
      };
    }
    if (strategyStore) {
      const ts = strategyStore.tableSizeSignal.value;
      const bb = strategyStore.stackDepthBbSignal.value;
      return {
        title: t('rail.pocket.context.strategy'),
        content: (
          <>
            <span className={shellStyles.pocketStat}>
              {`${ts}-max · ${bb} bb`}
            </span>
            <div className={shellStyles.pocketChipRow}>
              <button
                type="button"
                className={shellStyles.pocketChipBtn}
                onClick={() => strategyStore.setActiveView('rangeWalk')}
              >
                {t('strategy.side.rangeWalk')}
              </button>
              <button
                type="button"
                className={shellStyles.pocketChipBtn}
                onClick={() => strategyStore.setActiveView('commitment')}
              >
                {t('strategy.side.commitment')}
              </button>
            </div>
          </>
        ),
      };
    }
    if (handStore || reviewStore) {
      return {
        title: t('rail.pocket.context.shorthand'),
        content: (
          <span className={shellStyles.pocketHint} dir="ltr">
            r2.5 · c · x · f · ai · / flop
          </span>
        ),
      };
    }
    if (nightsStore) {
      const active = nightsStore.activeNightSignal.value;
      return active
        ? {
            title: t('rail.pocket.context.nights'),
            content: (
              <span className={shellStyles.pocketStat}>
                {active.session.title} ({formatNumber(active.session.participants.length)})
              </span>
            ),
          }
        : undefined;
    }
    if (learnStore) {
      const done = LEARN_CONCEPT_IDS.filter(
        (id) => learnStore.understoodMapSignal.value[id],
      ).length;
      return {
        title: t('rail.pocket.context.learn'),
        content: (
          <span className={shellStyles.pocketStat}>
            {t('learn.path.progress', {
              done: formatNumber(done),
              total: formatNumber(LEARN_CONCEPT_IDS.length),
            })}
          </span>
        ),
      };
    }
    return undefined;
  })();

  return (
    <AppShell sideSections={sideSections} paletteItems={paletteItems} railPocket={railPocket}>
      {storageHealth === 'degraded' && (
        <div role="status" className="storage-degraded-banner">
          {t('storage.degradedBanner')}
        </div>
      )}
      {route === 'home' && homeStore ? (
        <HomeRoom
          store={homeStore}
          onOpenTraining={(mode, leak) => {
            navigateTo('training');
            void loadTrainingStore().then((tr) =>
              tr.hydrate().then(() => {
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
              }),
            );
          }}
          onOpenStrategy={(view, spot) => {
            navigateTo('strategy');
            void loadStrategyStore().then((st) =>
              st.hydrate().then(() => {
                if (view === 'builder' && spot) {
                  st.openSpotInBuilder(spot.rowId, spot.position);
                } else {
                  st.setActiveView(view);
                  if (spot?.leakCellKey) {
                    st.selectedLeakCellKeySignal.value = spot.leakCellKey;
                  }
                }
              }),
            );
          }}
          onOpenReview={(handObjectId, filterTag) => {
            navigateTo('review');
            void loadReviewStore().then((rev) => {
              const record = handObjectId
                ? homeStore.savedHandsSignal.value.find((h) => h.objectId === handObjectId)
                : undefined;
              if (record) {
                rev.setSavedTagFilter('all');
                rev.openSavedHand(record);
                rev.setActiveSideTab('review');
              } else {
                rev.setSavedTagFilter(filterTag ?? 'all');
                rev.setActiveSideTab('saved');
              }
              return rev.refreshSavedLibrary();
            });
          }}
          onOpenHandRecorder={() => {
            navigateTo('hand');
            void loadHandStore().then((rec) => {
              rec.resetHand();
              rec.setActiveSideTab('record');
            });
          }}
          onOpenEquity={(matchupId, regular) => {
            navigateTo('equity');
            void loadEquityStore().then((eq) => {
              if (regular) {
                eq.loadExternalMatchup({
                  board: [],
                  players: [
                    { label: 'Hero', isHero: true, rawInput: 'AsKs' },
                    { label: regular.name, isHero: false, rawInput: regular.rangeText },
                  ],
                });
              } else {
                const record = matchupId
                  ? homeStore.savedMatchupsSignal.value.find((m) => m.objectId === matchupId)
                  : undefined;
                if (record) {
                  eq.loadSavedMatchup(record);
                }
              }
              eq.activeSideTabSignal.value = 'matchup';
              return eq.refreshSavedMatchups();
            });
          }}
          onOpenNights={(sessionId, tab) => {
            navigateTo('nights');
            void loadNightsStore().then((ni) =>
              ni.hydrate().then(() => {
                if (sessionId) ni.selectNight(sessionId);
                if (tab) ni.setActiveTab(tab);
              }),
            );
          }}
          onOpenLearn={() => navigateTo('learn')}
        />
      ) : route === 'settings' ? (
        <SettingsRoom
          activeSection={settingsSectionSignal.value}
          onSectionChange={(sec) => {
            settingsSectionSignal.value = sec;
          }}
        />
      ) : route === 'hand' && handStore ? (
        <HandRoom
          store={handStore}
          onReturnToNight={(nightSessionId) => {
            navigateTo('nights');
            void loadNightsStore().then((ni) =>
              ni.hydrate().then(() => {
                ni.selectNight(nightSessionId);
                ni.setActiveTab('hands');
              }),
            );
          }}
          onOpenInEquity={(input) => {
            setReturnContext({
              fromRoute: 'hand',
              label: t('rooms.hand.nav'),
              onReturn: () => navigateTo('hand'),
            });
            navigateTo('equity', { preserveReturn: true });
            void loadEquityStore().then((eq) => eq.loadExternalMatchup(input));
          }}
          onSolveSpot={(input: ExternalSolverSpotInput) => {
            setReturnContext({
              fromRoute: 'hand',
              label: t('rooms.hand.nav'),
              onReturn: () => navigateTo('hand'),
            });
            getSharedSolverStore().loadExternalSpot(input);
            navigateTo('strategy', { preserveReturn: true });
            void loadStrategyStore().then((st) => st.hydrate().then(() => st.setActiveView('postflopLab')));
          }}
        />
      ) : route === 'review' && reviewStore ? (
        <ReviewRoom
          store={reviewStore}
          onOpenInEquity={(input) => {
            setReturnContext({
              fromRoute: 'review',
              label: t('rooms.review.nav'),
              onReturn: () => navigateTo('review'),
            });
            navigateTo('equity', { preserveReturn: true });
            void loadEquityStore().then((eq) => eq.loadExternalMatchup(input));
          }}
          onSolveSpot={(input: ExternalSolverSpotInput) => {
            setReturnContext({
              fromRoute: 'review',
              label: t('rooms.review.nav'),
              onReturn: () => navigateTo('review'),
            });
            getSharedSolverStore().loadExternalSpot(input);
            navigateTo('strategy', { preserveReturn: true });
            void loadStrategyStore().then((st) => st.hydrate().then(() => st.setActiveView('postflopLab')));
          }}
          onPlayAgain={() => {
            navigateTo('training');
            void loadTrainingStore().then((tr) => tr.hydrate().then(() => tr.setActiveView('duel')));
          }}
          onDrillDecision={({ position, heroCards }) => {
            const rec = reviewStore.activeRecordSignal.value;
            const tableSize = rec.payload.seatCount === 8 ? 8 : 6;
            const closestStack = (STRATEGY_STACK_DEPTHS as readonly StrategyStackDepthBb[]).reduce<StrategyStackDepthBb>(
              (best: StrategyStackDepthBb, cand: StrategyStackDepthBb) =>
                Math.abs(cand - rec.payload.startingStackBb) <
                Math.abs(best - rec.payload.startingStackBb)
                  ? cand
                  : best,
              STRATEGY_STACK_DEPTHS[0] ?? 100,
            );
            const r0 = heroCards[0]?.[0]?.toUpperCase() ?? '';
            const r1 = heroCards[1]?.[0]?.toUpperCase() ?? '';
            const i0 = CARD_RANKS.indexOf(r0);
            const i1 = CARD_RANKS.indexOf(r1);
            const handClass =
              i0 >= 0 && i1 >= 0
                ? i0 === i1
                  ? `${r0}${r1}`
                  : i0 > i1
                    ? `${r0}${r1}${heroCards[0]?.[1] === heroCards[1]?.[1] ? 's' : 'o'}`
                    : `${r1}${r0}${heroCards[0]?.[1] === heroCards[1]?.[1] ? 's' : 'o'}`
                : null;
            const familyId: StrategyFamilyId | null = handClass
              ? (STRATEGY_FAMILIES.find((f) =>
                  f.hands.some((h) => h.handClass === handClass),
                )?.id ?? null)
              : null;
            const preflopRaisesBeforeHero = (() => {
              let raises = 0;
              for (const act of rec.payload.recordedActions) {
                if (act.street !== 'preflop') break;
                if (act.isHero) break;
                if (act.type === 'raise' || act.type === 'bet' || act.type === 'all_in') {
                  raises += 1;
                }
              }
              return raises;
            })();
            const target: TrainingDrillTarget =
              preflopRaisesBeforeHero === 0
                ? 'preflop_rfi'
                : preflopRaisesBeforeHero === 1
                  ? 'preflop_facing_open'
                  : 'preflop_facing_3bet';
            navigateTo('training');
            void loadTrainingStore().then((tr) =>
              tr
                .hydrate()
                .then(() =>
                  tr.setDrillFilters({
                    tableSize,
                    stackDepthBb: closestStack,
                    target,
                    focusPosition: position,
                    focusFamilyId: familyId,
                  }),
                )
                .then(() =>
                  tr.openQuickDrill({
                    focusPosition: position,
                    focusFamilyId: familyId,
                    target,
                  }),
                ),
            );
          }}
        />
      ) : route === 'equity' && equityStore ? (
        <EquityRoom
          store={equityStore}
          returnLabel={returnCtx ? t(`rooms.${returnCtx.fromRoute}.nav`) : undefined}
          onReturnToOrigin={returnCtx?.onReturn}
          onDrillMatchup={() => {
            navigateTo('training');
            void loadTrainingStore().then((tr) => tr.hydrate().then(() => tr.openQuickDrill()));
          }}
          onSolveSpot={(input: ExternalSolverSpotInput) => {
            setReturnContext({
              fromRoute: 'equity',
              label: t('rooms.equity.nav'),
              onReturn: () => navigateTo('equity'),
            });
            getSharedSolverStore().loadExternalSpot(input);
            navigateTo('strategy', { preserveReturn: true });
            void loadStrategyStore().then((st) => st.hydrate().then(() => st.setActiveView('postflopLab')));
          }}
        />
      ) : route === 'strategy' && strategyStore ? (
        <StrategyRoom
          store={strategyStore}
          onDrillSpot={({ position, familyId }) => {
            navigateTo('training');
            void loadTrainingStore().then((tr) =>
              tr.hydrate().then(() =>
                tr.openLeakLab({
                  key: `${position}:${familyId}`,
                  position,
                  familyId,
                  deltaPoints: null,
                  userCombos: 0,
                  baselineCombos: null,
                  drillCount: 0,
                }),
              ),
            );
          }}
          onDrillTexture={(texture) => {
            navigateTo('training');
            void loadTrainingStore().then((tr) =>
              tr.hydrate().then(() =>
                tr
                  .setDrillFilters({ target: 'postflop_texture', boardTextureFilter: texture })
                  .then(() => tr.openQuickDrill({ target: 'postflop_texture' })),
              ),
            );
          }}
        />
      ) : route === 'training' && trainingStore ? (
        <TrainingRoom
          store={trainingStore}
          onOpenReview={() => {
            navigateTo('review');
            void loadReviewStore().then((rev) => {
              rev.setActiveSideTab('saved');
              return rev.refreshSavedLibrary();
            });
          }}
        />
      ) : route === 'nights' && nightsStore ? (
        <NightsRoom
          store={nightsStore}
          onRecordFullHand={(
            nightSessionId,
            unitPreset,
            seatCount,
            nightTitle,
            heroCards,
            heroSeatIndex,
            startingStackBb,
          ) => {
            navigateTo('hand');
            void loadHandStore().then((rec) =>
              rec.configureFromNight({
                nightSessionId,
                nightTitle: nightTitle ?? '',
                unitPreset,
                seatCount: seatCount ?? 6,
                heroCards,
                heroSeatIndex,
                startingStackBb,
              }),
            );
          }}
          onOpenHandInReview={(handObjectId) => {
            const record = nightsStore.savedHandsByIdSignal.value[handObjectId];
            navigateTo('review');
            void loadReviewStore().then((rev) => {
              if (record) {
                rev.openSavedHand(record);
              } else {
                rev.setActiveSideTab('saved');
                void rev.refreshSavedLibrary();
              }
            });
          }}
        />
      ) : route === 'learn' && learnStore ? (
        <LearnRoom
          store={learnStore}
          onNavigateRoom={(target) => {
            navigateTo(target);
          }}
        />
      ) : route === 'kit' ? (
        <KitSheet />
      ) : (
        <section aria-busy="true" />
      )}
    </AppShell>
  );
}
