import { useState } from 'preact/hooks';
import {
  appearanceSignal,
  LOCALE_IDS,
  MOTION_MODES,
  PACE_IDS,
  THEME_IDS,
  updateAppearance,
  type LocaleId,
  type MotionMode,
  type PaceId,
  type ThemeId,
} from '../../../domain/appearance';
import {
  KIT_SECTION_IDS,
  kitSectionSignal,
  type KitSectionId,
} from '../../../domain/shellState';
import { t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { ButtonSheetEntry } from '../button/Button.sheet';
import { Chip } from '../chip/Chip';
import { ChipSheetEntry } from '../chip/Chip.sheet';
import { ChoiceSheetEntry } from '../choice/Choice.sheet';
import { SegmentedControl } from '../choice/Choice';
import { EquityRowSheetEntry } from '../equity-row/EquityRow.sheet';
import { FactTileSheetEntry } from '../fact-tile/FactTile.sheet';
import { FamilyStripSheetEntry } from '../family-strip/FamilyStrip.sheet';
import { FeltTableSheetEntry } from '../felt-table/FeltTable.sheet';
import { HeatGridSheetEntry } from '../heat-grid/HeatGrid.sheet';
import { HistoryRailSheetEntry } from '../history-rail/HistoryRail.sheet';
import { TokenInputSheetEntry } from '../input/TokenInput.sheet';
import { LampSheetEntry } from '../lamp/Lamp.sheet';
import { MixBarSheetEntry } from '../mix-bar/MixBar.sheet';
import { OptionTicketsSheetEntry } from '../option-tickets/OptionTickets.sheet';
import { OverlaySheetEntry } from '../overlay/Overlay.sheet';
import { PanelSheetEntry } from '../panel/Panel.sheet';
import { PlayingCardSheetEntry } from '../playing-card/PlayingCard.sheet';
import { StepperSheetEntry } from '../stepper/Stepper.sheet';
import styles from './KitSheet.module.css';

type ViewportMode = 'inline' | '1920' | '1366' | '390';

const PACE_MULTIPLIER: Record<PaceId, string> = {
  calm: '1.35',
  normal: '1',
  fast: '0.6',
};

const VIEWPORT_DIMENSIONS: Record<Exclude<ViewportMode, 'inline'>, { width: number; height: number }> = {
  '1920': { width: 1920, height: 1080 },
  '1366': { width: 1366, height: 768 },
  '390': { width: 390, height: 844 },
};

const SECTION_LABEL_KEYS: Record<KitSectionId, Parameters<typeof t>[0]> = {
  panel: 'kit.panel.sectionTitle',
  button: 'kit.button.sectionTitle',
  chip: 'kit.chip.sectionTitle',
  choice: 'kit.choice.sectionTitle',
  input: 'kit.input.sectionTitle',
  factTile: 'kit.factTile.sectionTitle',
  overlay: 'kit.overlay.sectionTitle',
  stepper: 'kit.stepper.sectionTitle',
  playingCard: 'kit.card.sectionTitle',
  feltTable: 'kit.table.sectionTitle',
  optionTickets: 'kit.tickets.sectionTitle',
  mixBar: 'kit.mix.sectionTitle',
  equityRow: 'kit.equity.sectionTitle',
  historyRail: 'kit.history.sectionTitle',
  lamp: 'kit.lamp.sectionTitle',
  heatGrid: 'kit.heat.sectionTitle',
  familyStrip: 'kit.strip.sectionTitle',
};

export function KitSheet() {
  const prefs = appearanceSignal.value;
  const activeSection = kitSectionSignal.value;
  const [viewportMode, setViewportMode] = useState<ViewportMode>('inline');

  const themeOptions = THEME_IDS.map((id) => ({
    value: id,
    label: t(`settings.themes.${id}`),
  }));

  const langOptions = LOCALE_IDS.map((id) => ({
    value: id,
    label: t(`settings.language.${id}`),
  }));

  const paceOptions = PACE_IDS.map((id) => ({
    value: id,
    label: t(`settings.pace.${id}`),
  }));

  const motionOptions = MOTION_MODES.map((id) => ({
    value: id,
    label: t(`settings.motion.${id}`),
  }));

  const viewportOptions: Array<{ value: ViewportMode; label: string }> = [
    { value: 'inline', label: t('kit.harness.viewportInline') },
    { value: '1920', label: t('kit.harness.viewport1920') },
    { value: '1366', label: t('kit.harness.viewport1366') },
    { value: '390', label: t('kit.harness.viewport390') },
  ];

  const sectionOptions = KIT_SECTION_IDS.map((id) => ({
    value: id,
    label: t(SECTION_LABEL_KEYS[id]).replace(/^\d+\s*·\s*/, '').replace(/\s*\(#\d+\)$/, ''),
  }));

  const iframeFrame =
    viewportMode !== 'inline' ? VIEWPORT_DIMENSIONS[viewportMode] : null;
  const iframeSrc = `/?room=kit&kitSection=${activeSection}&theme=${prefs.theme}&lang=${prefs.lang}&pace=${prefs.pace}&motion=${prefs.motion}&focus=1`;

  return (
    <div className={styles.sheet}>
      <div className={styles.toolbar} role="region" aria-label={t('rooms.kit.title')}>
        <div className={styles.toolbarHeader}>
          <div className={styles.toolbarBrand}>
            <h1 id="kit-heading" className={styles.toolbarTitle}>
              {t('rooms.kit.title')}
            </h1>
            <Chip>
              <PokerNotation>
                {t('kit.harness.paceResolved', { pace: PACE_MULTIPLIER[prefs.pace] })}
              </PokerNotation>
            </Chip>
          </div>
          <div className={styles.harnessGrid}>
            <SegmentedControl<LocaleId>
              ariaLabel={t('settings.language.label')}
              options={langOptions}
              value={prefs.lang}
              onChange={(lang) => updateAppearance({ lang })}
            />
            <SegmentedControl<PaceId>
              ariaLabel={t('settings.pace.label')}
              options={paceOptions}
              value={prefs.pace}
              onChange={(pace) => updateAppearance({ pace })}
            />
            <SegmentedControl<MotionMode>
              ariaLabel={t('settings.motion.label')}
              options={motionOptions}
              value={prefs.motion}
              onChange={(motion) => updateAppearance({ motion })}
            />
          </div>
        </div>

        <div className={styles.harnessGrid}>
          <SegmentedControl<ThemeId>
            ariaLabel={t('settings.themes.label')}
            options={themeOptions}
            value={prefs.theme}
            onChange={(theme) => updateAppearance({ theme })}
          />
          <SegmentedControl<ViewportMode>
            ariaLabel={t('kit.harness.viewportLabel')}
            options={viewportOptions}
            value={viewportMode}
            onChange={setViewportMode}
          />
        </div>

        <div className={styles.sectionPills} role="group" aria-label={t('rail.kitSheet')}>
          {sectionOptions.map((sec) => (
            <button
              key={sec.value}
              type="button"
              className={activeSection === sec.value ? `${styles.sectionTab} ${styles.sectionTabSelected}` : styles.sectionTab}
              aria-pressed={activeSection === sec.value}
              onClick={() => {
                kitSectionSignal.value = sec.value;
              }}
            >
              {sec.label}
            </button>
          ))}
        </div>
      </div>

      {iframeFrame ? (
        <div className={styles.viewportStage}>
          <iframe
            title={`${t('kit.harness.viewportLabel')} ${iframeFrame.width}x${iframeFrame.height}`}
            src={iframeSrc}
            width={iframeFrame.width}
            height={iframeFrame.height}
            className={styles.viewportIframe}
          />
        </div>
      ) : (
        <div className={styles.entries}>
          {activeSection === 'panel' && <PanelSheetEntry />}
          {activeSection === 'button' && <ButtonSheetEntry />}
          {activeSection === 'chip' && <ChipSheetEntry />}
          {activeSection === 'choice' && <ChoiceSheetEntry />}
          {activeSection === 'input' && <TokenInputSheetEntry />}
          {activeSection === 'factTile' && <FactTileSheetEntry />}
          {activeSection === 'overlay' && <OverlaySheetEntry />}
          {activeSection === 'stepper' && <StepperSheetEntry />}
          {activeSection === 'playingCard' && <PlayingCardSheetEntry />}
          {activeSection === 'feltTable' && <FeltTableSheetEntry />}
          {activeSection === 'optionTickets' && <OptionTicketsSheetEntry />}
          {activeSection === 'mixBar' && <MixBarSheetEntry />}
          {activeSection === 'equityRow' && <EquityRowSheetEntry />}
          {activeSection === 'historyRail' && <HistoryRailSheetEntry />}
          {activeSection === 'lamp' && <LampSheetEntry />}
          {activeSection === 'heatGrid' && <HeatGridSheetEntry />}
          {activeSection === 'familyStrip' && <FamilyStripSheetEntry />}
        </div>
      )}
    </div>
  );
}
