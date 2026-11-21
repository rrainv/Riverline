import { useEffect } from 'preact/hooks';
import { langSignal, THEME_IDS, updateAppearance } from './domain/appearance';
import { getSharedEquityStore } from './domain/equity';
import { getSharedHandRecorderStore } from './domain/hand';
import { getSharedHomeStore } from './domain/home';
import { getSharedLearnStore } from './domain/learn';
import { getSharedNightsStore } from './domain/nights';
import { getSharedReviewStore } from './domain/review';
import { getStudyStorageHealth } from './domain/storage';
import { getSharedStrategyStore } from './domain/strategy';
import { getSharedTrainingStore } from './domain/training';
import {
  activeRouteSignal,
  navigateTo,
  paletteOpenSignal,
  returnContextSignal,
  SETTINGS_SECTION_IDS,
  settingsSectionSignal,
  setReturnContext,
  syncRouteFromBrowserLocation,
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
import { CATALOGUES, t } from './i18n';
import type { CommandPaletteItem } from './ui/kit/overlay/CommandPalette';
import { AppShell } from './ui/kit/shell/AppShell';
import type { SideRailSecondaryGroup, SideRailSectionItem } from './ui/kit/shell/SideRail';
import { KitSheet } from './ui/kit/sheet/KitSheet';
import { EquityRoom } from './ui/rooms/equity';
import { HandRoom } from './ui/rooms/hand';
import { HomeRoom } from './ui/rooms/home';
import { LearnRoom } from './ui/rooms/learn';
import { NightsRoom } from './ui/rooms/nights';
import { ReviewRoom } from './ui/rooms/review';
import { SettingsRoom } from './ui/rooms/SettingsRoom';
import { StrategyRoom } from './ui/rooms/strategy';
import { TrainingRoom } from './ui/rooms/training';

export function App() {
  const route = activeRouteSignal.value;
  // Subscribe to language changes at top level so all translated strings re-render cleanly.
  void langSignal.value;

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
  const learnStore = route === 'learn' ? getSharedLearnStore() : null;

  const paletteOpen = paletteOpenSignal.value;
  const returnCtx = returnContextSignal.value;

  useEffect(() => {
    if (route === 'home') {
      void getSharedHomeStore().hydrate();
    } else if (route === 'strategy') {
      void getSharedStrategyStore().hydrate();
    } else if (route === 'training') {
      void getSharedTrainingStore().hydrate();
    } else if (route === 'nights') {
      void getSharedNightsStore().hydrate();
    } else if (route === 'learn') {
      void getSharedLearnStore().hydrate();
    }
  }, [route]);

  useEffect(() => {
    if (!paletteOpen) return;
    void getSharedReviewStore().refreshSavedLibrary();
    void getSharedNightsStore().hydrate();
  }, [paletteOpen]);

  const paletteItems: readonly CommandPaletteItem[] | undefined = paletteOpen
    ? (() => {
        const revForPalette = reviewStore ?? getSharedReviewStore();
        const niForPalette = nightsStore ?? getSharedNightsStore();
        const handItems: CommandPaletteItem[] = revForPalette.savedHandsSignal.value
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
              const rev = getSharedReviewStore();
              rev.openSavedHand(rec);
              rev.setActiveSideTab('review');
              navigateTo('review');
            },
          }));
        const conceptItems: CommandPaletteItem[] = LEARN_CONCEPT_IDS.map((conceptId) => ({
          id: `concept:${conceptId}`,
          group: 'concepts',
          label: t(`learn.concept.${conceptId}.name`),
          hint: t('palette.hint.concept'),
          searchIndex: [
            conceptId,
            CATALOGUES.en[`learn.concept.${conceptId}.name`],
            CATALOGUES.ru[`learn.concept.${conceptId}.name`],
            CATALOGUES.he[`learn.concept.${conceptId}.name`],
            CATALOGUES.en[`learn.concept.${conceptId}.term`],
            CATALOGUES.ru[`learn.concept.${conceptId}.term`],
            CATALOGUES.he[`learn.concept.${conceptId}.term`],
          ]
            .join(' ')
            .toLowerCase(),
          iconRoute: 'learn',
          onSelect: () => {
            const ln = getSharedLearnStore();
            ln.selectConcept(conceptId);
            ln.setActiveSection('path');
            navigateTo('learn');
          },
        }));
        const nightItems: CommandPaletteItem[] = niForPalette.sessionsSignal.value.map(
          (night) => ({
            id: `night:${night.session.sessionId}`,
            group: 'nights',
            label: night.session.title,
            hint: t('palette.hint.night'),
            searchIndex: [night.session.title, night.sessionNote ?? ''].join(' ').toLowerCase(),
            iconRoute: 'nights',
            onSelect: () => {
              const ni = getSharedNightsStore();
              ni.selectNight(night.session.sessionId);
              ni.setActiveTab('ledger');
              navigateTo('nights');
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
            CATALOGUES.en[`settings.tab.${sectionId}`],
            CATALOGUES.ru[`settings.tab.${sectionId}`],
            CATALOGUES.he[`settings.tab.${sectionId}`],
          ]
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
            searchIndex: `new hand record ${CATALOGUES.en['recorder.actions.newHand']} ${CATALOGUES.ru['recorder.actions.newHand']} ${CATALOGUES.he['recorder.actions.newHand']}`.toLowerCase(),
            iconRoute: 'hand',
            onSelect: () => {
              const rec = getSharedHandRecorderStore();
              rec.resetHand();
              rec.setActiveSideTab('record');
              navigateTo('hand');
            },
          },
          {
            id: 'action:new-night',
            group: 'rooms',
            label: t('nights.actions.newNight'),
            hint: t('rooms.nights.nav'),
            searchIndex: `new night game night ${CATALOGUES.en['nights.actions.newNight']} ${CATALOGUES.ru['nights.actions.newNight']} ${CATALOGUES.he['nights.actions.newNight']}`.toLowerCase(),
            iconRoute: 'nights',
            onSelect: () => {
              const ni = getSharedNightsStore();
              navigateTo('nights');
              void ni.hydrate().then(() => ni.setCreateModalOpen(true));
            },
          },
          {
            id: 'action:random-matchup',
            group: 'rooms',
            label: t('equity.random.matchup'),
            hint: t('rooms.equity.nav'),
            searchIndex: `new matchup random equity ${CATALOGUES.en['equity.random.matchup']} ${CATALOGUES.ru['equity.random.matchup']} ${CATALOGUES.he['equity.random.matchup']}`.toLowerCase(),
            iconRoute: 'equity',
            onSelect: () => {
              const eq = getSharedEquityStore();
              eq.activeSideTabSignal.value = 'matchup';
              eq.randomizeMatchup();
              navigateTo('equity');
            },
          },
        ];
        const themeItems: CommandPaletteItem[] = THEME_IDS.map((themeId) => ({
          id: `theme:${themeId}`,
          group: 'rooms',
          label: `${t('settings.themes.label')} · ${t(`settings.themes.${themeId}`)}`,
          hint: t('palette.hint.settings'),
          searchIndex: [
            'theme',
            themeId,
            CATALOGUES.en[`settings.themes.${themeId}`],
            CATALOGUES.ru[`settings.themes.${themeId}`],
            CATALOGUES.he[`settings.themes.${themeId}`],
          ]
            .join(' ')
            .toLowerCase(),
          iconRoute: 'settings',
          onSelect: () => {
            updateAppearance({ theme: themeId });
          },
        }));
        return [...quickActionItems, ...themeItems, ...settingsItems, ...handItems, ...conceptItems, ...nightItems];
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

  const sideGroups: readonly SideRailSecondaryGroup[] | undefined = homeStore
    ? [
        {
          id: 'home-quick',
          heading: t('rail.group.quickLaunch'),
          items: [
            {
              id: 'ql-drill',
              label: t('training.rail.drill'),
              active: false,
              onSelect: () => {
                const tr = getSharedTrainingStore();
                navigateTo('training');
                void tr.hydrate().then(() => tr.openQuickDrill());
              },
            },
            {
              id: 'ql-duel',
              label: t('training.rail.duel'),
              active: false,
              onSelect: () => {
                const tr = getSharedTrainingStore();
                navigateTo('training');
                void tr.hydrate().then(() => tr.startHeadsUpDuel());
              },
            },
            {
              id: 'ql-hand',
              label: t('recorder.actions.newHand'),
              active: false,
              onSelect: () => navigateTo('hand'),
            },
            {
              id: 'ql-equity',
              label: t('rooms.equity.nav'),
              active: false,
              onSelect: () => navigateTo('equity'),
            },
            {
              id: 'ql-nights',
              label: t('rooms.nights.nav'),
              active: false,
              onSelect: () => navigateTo('nights'),
            },
          ],
        },
      ]
    : equityStore
      ? [
          {
            id: 'eq-streets',
            heading: t('rail.group.streets'),
            items: (['preflop', 'flop', 'turn', 'river'] as const).map((st) => ({
              id: `st-${st}`,
              label: t(`recorder.street.${st}`),
              active: equityStore.streetSignal.value === st,
              onSelect: () => equityStore.setStreet(st),
            })),
          },
          {
            id: 'eq-presets',
            heading: t('rail.group.presets'),
            items: [
              {
                id: 'pr-flop',
                label: t('equity.row.hero'),
                active: false,
                onSelect: () => equityStore.applyPreset('flop'),
              },
              {
                id: 'pr-3way',
                label: '3-way',
                active: false,
                onSelect: () => equityStore.applyPreset('players_3'),
              },
              {
                id: 'pr-range',
                label: t('equity.editor.presetTop15'),
                active: false,
                onSelect: () => equityStore.applyPreset('range_row'),
              },
              {
                id: 'pr-rand',
                label: t('random.fullMatchup'),
                active: false,
                onSelect: () => equityStore.randomizeMatchup(),
              },
            ],
          },
        ]
      : handStore
        ? [
            {
              id: 'hand-formats',
              heading: t('rail.group.tableFormat'),
              items: [
                {
                  id: 'fmt-6max',
                  label: '6-max · 100 bb',
                  active:
                    handStore.seatCountSignal.value === 6 &&
                    handStore.startingStackBbSignal.value === 100,
                  onSelect: () => {
                    handStore.setSeatCount(6);
                    handStore.setStartingStackBb(100);
                  },
                },
                {
                  id: 'fmt-8max',
                  label: '8-max · 100 bb',
                  active:
                    handStore.seatCountSignal.value === 8 &&
                    handStore.startingStackBbSignal.value === 100,
                  onSelect: () => {
                    handStore.setSeatCount(8);
                    handStore.setStartingStackBb(100);
                  },
                },
                {
                  id: 'fmt-home',
                  label: '6-max · 50 bb',
                  active:
                    handStore.seatCountSignal.value === 6 &&
                    handStore.startingStackBbSignal.value === 50,
                  onSelect: () => {
                    handStore.setSeatCount(6);
                    handStore.setStartingStackBb(50);
                  },
                },
                {
                  id: 'fmt-deep',
                  label: '6-max · 200 bb',
                  active:
                    handStore.seatCountSignal.value === 6 &&
                    handStore.startingStackBbSignal.value === 200,
                  onSelect: () => {
                    handStore.setSeatCount(6);
                    handStore.setStartingStackBb(200);
                  },
                },
              ],
            },
            {
              id: 'hand-mode',
              heading: t('rail.group.quickLaunch'),
              items: [
                {
                  id: 'hm-tap',
                  label: t('recorder.mode.tap'),
                  active: handStore.inputModeSignal.value === 'tap',
                  onSelect: () => handStore.setInputMode('tap'),
                },
                {
                  id: 'hm-sh',
                  label: t('recorder.mode.shorthand'),
                  active: handStore.inputModeSignal.value === 'shorthand',
                  onSelect: () => handStore.setInputMode('shorthand'),
                },
                {
                  id: 'hm-new',
                  label: t('recorder.actions.newHand'),
                  active: false,
                  onSelect: () => handStore.resetHand(),
                },
              ],
            },
          ]
        : reviewStore
          ? [
              {
                id: 'rev-range',
                heading: t('rail.group.villainRange'),
                items: (
                  [
                    ['showed', 'review.decision.rangeShowed'],
                    ['tight', 'review.decision.rangeTight'],
                    ['standard', 'review.decision.rangeStandard'],
                    ['loose', 'review.decision.rangeLoose'],
                  ] as const
                ).map(([mode, key]) => ({
                  id: `vr-${mode}`,
                  label: t(key),
                  active: reviewStore.counterfactualRangeSignal.value === mode,
                  onSelect: () => reviewStore.setCounterfactualRange(mode),
                })),
              },
              {
                id: 'rev-recent',
                heading: t('rail.group.recentHands'),
                items: reviewStore.savedHandsSignal.value
                  .filter((h) => !h.archived)
                  .slice(0, 3)
                  .map((h) => ({
                    id: `rh-${h.objectId}`,
                    label: `${h.payload.heroPositionLabel} ${h.payload.heroCards.join('')}`,
                    badge:
                      h.payload.pokerState.board.length > 0
                        ? h.payload.pokerState.board.slice(0, 3).join('')
                        : undefined,
                    active: reviewStore.activeRecordSignal.value.objectId === h.objectId,
                    onSelect: () => {
                      reviewStore.openSavedHand(h);
                      reviewStore.setActiveSideTab('review');
                    },
                  })),
              },
            ]
          : strategyStore
            ? [
                {
                  id: 'str-formats',
                  heading: t('rail.group.tableFormat'),
                  items: [
                    {
                      id: 'sf-6',
                      label: '6-max · 100 bb',
                      active:
                        strategyStore.tableSizeSignal.value === 6 &&
                        strategyStore.stackDepthBbSignal.value === 100,
                      onSelect: () => {
                        strategyStore.setTableSize(6);
                        strategyStore.setStackDepthBb(100);
                      },
                    },
                    {
                      id: 'sf-8',
                      label: '8-max · 50 bb',
                      active:
                        strategyStore.tableSizeSignal.value === 8 &&
                        strategyStore.stackDepthBbSignal.value === 50,
                      onSelect: () => {
                        strategyStore.setTableSize(8);
                        strategyStore.setStackDepthBb(50);
                      },
                    },
                  ],
                },
                {
                  id: 'str-seats',
                  heading: t('rail.group.openSeat'),
                  items: (['UTG', 'HJ', 'CO', 'BTN', 'SB'] as const).map((pos) => ({
                    id: `pos-${pos}`,
                    label: pos,
                    active:
                      strategyStore.activeViewSignal.value === 'builder' &&
                      strategyStore.selectedSpotSignal.value.position === pos,
                    onSelect: () => strategyStore.openSpotInBuilder('first_in', pos),
                  })),
                },
              ]
            : trainingStore
              ? [
                  {
                    id: 'tr-bots',
                    heading: t('rail.group.opponents'),
                    items: (
                      [
                        ['balanced', 'training.duel.style.balanced'],
                        ['loose_aggressive', 'training.duel.style.loose_aggressive'],
                        ['tight_aggressive', 'training.duel.style.tight_aggressive'],
                      ] as const
                    ).map(([styleId, key]) => ({
                      id: `bot-${styleId}`,
                      label: t(key),
                      active:
                        trainingStore.activeViewSignal.value === 'duel' &&
                        trainingStore.duelStateSignal.value?.botStyle === styleId,
                      onSelect: () => {
                        void trainingStore.startHeadsUpDuel(undefined, styleId);
                      },
                    })),
                  },
                ]
              : nightsStore
                ? [
                    {
                      id: 'ni-quick',
                      heading: t('rail.group.quickLaunch'),
                      items: [
                        {
                          id: 'ni-new',
                          label: t('nights.actions.newNight'),
                          active: false,
                          onSelect: () => nightsStore.setCreateModalOpen(true),
                        },
                      ],
                    },
                    {
                      id: 'ni-sessions',
                      heading: t('rail.group.sessions'),
                      items: nightsStore.sessionsSignal.value.slice(0, 3).map((n) => ({
                        id: `ns-${n.session.sessionId}`,
                        label: n.session.title,
                        active:
                          nightsStore.activeNightSignal.value?.session.sessionId ===
                          n.session.sessionId,
                        onSelect: () => nightsStore.selectNight(n.session.sessionId),
                      })),
                    },
                  ]
                : learnStore
                  ? [
                      {
                        id: 'ln-trainers',
                        heading: t('rail.group.trainers'),
                        items: [
                          {
                            id: 'lt-odds',
                            label: t('learn.trainer.modePotOdds'),
                            active:
                              learnStore.activeSectionSignal.value === 'path' &&
                              learnStore.trainerModeSignal.value === 'pot_odds',
                            onSelect: () => {
                              learnStore.setTrainerMode('pot_odds');
                              learnStore.setActiveSection('path');
                            },
                          },
                          {
                            id: 'lt-outs',
                            label: t('learn.trainer.modeOuts'),
                            active:
                              learnStore.activeSectionSignal.value === 'path' &&
                              learnStore.trainerModeSignal.value === 'outs',
                            onSelect: () => {
                              learnStore.setTrainerMode('outs');
                              learnStore.setActiveSection('path');
                            },
                          },
                        ],
                      },
                      {
                        id: 'ln-concepts',
                        heading: t('rail.group.concepts'),
                        items: LEARN_CONCEPT_IDS.slice(0, 4).map((cid) => ({
                          id: `lc-${cid}`,
                          label: t(`learn.concept.${cid}.name`),
                          active:
                            learnStore.activeSectionSignal.value === 'path' &&
                            learnStore.selectedConceptIdSignal.value === cid,
                          onSelect: () => {
                            learnStore.selectConcept(cid);
                            learnStore.setActiveSection('path');
                          },
                        })),
                      },
                    ]
                  : undefined;

  const storageHealth = getStudyStorageHealth();

  return (
    <AppShell sideSections={sideSections} sideGroups={sideGroups} paletteItems={paletteItems}>
      {storageHealth === 'degraded' && (
        <div role="status" className="storage-degraded-banner">
          {t('storage.degradedBanner')}
        </div>
      )}
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
            const ni = getSharedNightsStore();
            navigateTo('nights');
            void ni.hydrate().then(() => {
              ni.selectNight(nightSessionId);
              ni.setActiveTab('hands');
            });
          }}
          onOpenInEquity={(input) => {
            const eq = getSharedEquityStore();
            eq.loadExternalMatchup(input);
            setReturnContext({
              fromRoute: 'hand',
              label: t('rooms.hand.nav'),
              onReturn: () => navigateTo('hand'),
            });
            navigateTo('equity', { preserveReturn: true });
          }}
        />
      ) : route === 'review' && reviewStore ? (
        <ReviewRoom
          store={reviewStore}
          onOpenInEquity={(input) => {
            const eq = getSharedEquityStore();
            eq.loadExternalMatchup(input);
            setReturnContext({
              fromRoute: 'review',
              label: t('rooms.review.nav'),
              onReturn: () => navigateTo('review'),
            });
            navigateTo('equity', { preserveReturn: true });
          }}
          onDrillDecision={({ position, heroCards }) => {
            const tr = getSharedTrainingStore();
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
            void tr
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
              );
          }}
        />
      ) : route === 'equity' && equityStore ? (
        <EquityRoom
          store={equityStore}
          returnLabel={returnCtx ? t(`rooms.${returnCtx.fromRoute}.nav`) : undefined}
          onReturnToOrigin={returnCtx?.onReturn}
          onDrillMatchup={() => {
            const tr = getSharedTrainingStore();
            navigateTo('training');
            void tr.hydrate().then(() => tr.openQuickDrill());
          }}
        />
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
          onRecordFullHand={(
            nightSessionId,
            unitPreset,
            seatCount,
            nightTitle,
            heroCards,
            heroSeatIndex,
            startingStackBb,
          ) => {
            const rec = getSharedHandRecorderStore();
            rec.configureFromNight({
              nightSessionId,
              nightTitle: nightTitle ?? '',
              unitPreset,
              seatCount: seatCount ?? 6,
              heroCards,
              heroSeatIndex,
              startingStackBb,
            });
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
      ) : route === 'learn' && learnStore ? (
        <LearnRoom
          store={learnStore}
          onNavigateRoom={(target) => {
            navigateTo(target);
          }}
        />
      ) : (
        <KitSheet />
      )}
    </AppShell>
  );
}
