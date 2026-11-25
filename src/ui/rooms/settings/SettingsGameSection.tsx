import { useState } from 'preact/hooks';
import {
  activeGameSettingsSignal,
  applyGamePreset,
  deleteCustomGameProfile,
  GAME_SETTINGS_PRESETS,
  resetGameSettings,
  saveCustomGameProfile,
  savedGameProfilesSignal,
  updateGameSettings,
  type GameAnteMode,
  type GameCurrencyUnit,
} from '../../../domain/gameSettings';
import type { PreflopPoolStyle } from '../../../engine-api';
import { t } from '../../../i18n';
import { PokerNotation } from '../../../i18n/PokerNotation';
import { Button } from '../../kit/button/Button';
import { ChipButton, SegmentedControl } from '../../kit/choice/Choice';
import { TextField } from '../../kit/input/TextField';
import { Panel, PanelSection } from '../../kit/panel/Panel';
import { Stepper } from '../../kit/stepper/Stepper';
import styles from '../SettingsRoom.module.css';

export function SettingsGameSection() {
  const active = activeGameSettingsSignal.value;
  const customProfiles = savedGameProfilesSignal.value;
  const [profileName, setProfileName] = useState('');

  return (
    <div className={styles.stack}>
      <Panel
        title={t('settings.game.heading')}
        label={t('settings.tab.game')}
      >
        <p className={styles.hint}>{t('settings.game.subtitle')}</p>

        <PanelSection label={t('settings.game.presetsLabel')}>
          <div className={styles.chipRow}>
            {GAME_SETTINGS_PRESETS.map((preset) => (
              <ChipButton
                key={preset.profileId}
                selected={active.profileId === preset.profileId}
                onToggle={() => applyGamePreset(preset.profileId)}
              >
                <PokerNotation>{preset.name}</PokerNotation>
              </ChipButton>
            ))}
            <Button variant="secondary" onClick={() => resetGameSettings()}>
              {t('settings.appearance.resetAll')}
            </Button>
          </div>
        </PanelSection>

        <PanelSection label={t('settings.game.tableLabel')}>
          <div className={styles.chipRow}>
            <Stepper
              label={t('settings.game.tableSize')}
              ariaLabel={t('settings.game.tableSize')}
              value={active.tableSize}
              onChange={(v) => updateGameSettings({ tableSize: v })}
              min={2}
              max={10}
              step={1}
            />
            <Stepper
              label={t('settings.game.defaultStack')}
              ariaLabel={t('settings.game.defaultStack')}
              value={active.defaultStackBb}
              onChange={(v) => updateGameSettings({ defaultStackBb: v })}
              min={10}
              max={300}
              step={5}
              unit="bb"
            />
            <SegmentedControl<GameCurrencyUnit>
              ariaLabel={t('settings.game.currencyUnit')}
              value={active.currencyUnit}
              onChange={(u) => updateGameSettings({ currencyUnit: u })}
              options={[
                { value: 'bb', label: 'bb' },
                { value: '₪', label: '₪' },
                { value: '$', label: '$' },
                { value: '€', label: '€' },
              ]}
            />
          </div>
        </PanelSection>

        <PanelSection label={t('settings.game.rakeAndAntesLabel')}>
          <div className={styles.chipRow}>
            <Stepper
              label={t('settings.game.rakePct')}
              ariaLabel={t('settings.game.rakePct')}
              value={active.rakePct}
              onChange={(v) => updateGameSettings({ rakePct: v })}
              min={0}
              max={15}
              step={0.5}
              unit="%"
            />
            <Stepper
              label={t('settings.game.rakeCap')}
              ariaLabel={t('settings.game.rakeCap')}
              value={active.rakeCapBb}
              onChange={(v) => updateGameSettings({ rakeCapBb: v })}
              min={0}
              max={20}
              step={0.5}
              unit="bb"
            />
            <SegmentedControl<GameAnteMode>
              ariaLabel={t('settings.game.anteMode')}
              value={active.anteMode}
              onChange={(m) => updateGameSettings({ anteMode: m, anteBb: m === 'none' ? 0 : 1 })}
              options={[
                { value: 'none', label: t('settings.game.ante.none') },
                { value: 'bb_ante', label: t('settings.game.ante.bbAnte') },
                { value: 'per_seat', label: t('settings.game.ante.perSeat') },
              ]}
            />
          </div>
        </PanelSection>

        <PanelSection label={t('settings.game.poolLabel')}>
          <SegmentedControl<PreflopPoolStyle>
            ariaLabel={t('settings.game.poolLabel')}
            value={active.poolStyle}
            onChange={(p) => updateGameSettings({ poolStyle: p })}
            options={[
              { value: 'standard', label: t('settings.game.pool.standard') },
              { value: 'loose_calling', label: t('settings.game.pool.looseCalling') },
              { value: 'tight_passive', label: t('settings.game.pool.tightPassive') },
            ]}
          />
        </PanelSection>

        <PanelSection label={t('settings.game.customProfilesLabel')}>
          <div className={styles.chipRow}>
            <TextField
              value={profileName}
              ariaLabel={t('settings.game.profileNameAria')}
              placeholder={t('settings.game.profileNamePlaceholder')}
              onValueChange={setProfileName}
            />
            <Button
              variant="primary"
              onClick={() => {
                saveCustomGameProfile(profileName);
                setProfileName('');
              }}
            >
              {t('settings.game.saveProfileBtn')}
            </Button>
          </div>
          {customProfiles.length > 0 && (
            <div className={styles.chipRow}>
              {customProfiles.map((prof) => (
                <div key={prof.profileId} className={styles.chipRow}>
                  <ChipButton
                    selected={active.profileId === prof.profileId}
                    onToggle={() => applyGamePreset(prof.profileId)}
                  >
                    <PokerNotation>
                      {`${prof.name} · ${prof.tableSize}p · ${prof.defaultStackBb}bb · ${prof.rakePct}%`}
                    </PokerNotation>
                  </ChipButton>
                  <Button
                    variant="secondary"
                    onClick={() => deleteCustomGameProfile(prof.profileId)}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          )}
        </PanelSection>
      </Panel>
    </div>
  );
}
