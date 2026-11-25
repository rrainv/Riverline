import { beforeEach, describe, expect, it } from 'vitest';
import {
  activeGameSettingsSignal,
  applyGamePreset,
  deleteCustomGameProfile,
  GAME_SETTINGS_PRESETS,
  resetGameSettings,
  saveCustomGameProfile,
  savedGameProfilesSignal,
  updateGameSettings,
} from './gameSettingsStore';

describe('Central Game Settings store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetGameSettings();
  });

  it('applies non-limiting presets and allows customizing any parameter', () => {
    expect(GAME_SETTINGS_PRESETS.length).toBeGreaterThanOrEqual(5);
    applyGamePreset('home_game_8max');
    expect(activeGameSettingsSignal.value.tableSize).toBe(8);
    expect(activeGameSettingsSignal.value.rakePct).toBe(0);

    updateGameSettings({ tableSize: 9, rakePct: 5, rakeCapBb: 3, defaultStackBb: 120 });
    expect(activeGameSettingsSignal.value.profileId).toBe('custom');
    expect(activeGameSettingsSignal.value.tableSize).toBe(9);
    expect(activeGameSettingsSignal.value.rakePct).toBe(5);
    expect(activeGameSettingsSignal.value.rakeCapBb).toBe(3);
    expect(activeGameSettingsSignal.value.defaultStackBb).toBe(120);
  });

  it('saves and deletes custom game profiles', () => {
    updateGameSettings({ tableSize: 7, rakePct: 2.5, rakeCapBb: 2 });
    const saved = saveCustomGameProfile('Friday 1/2');
    expect(savedGameProfilesSignal.value.some((p) => p.profileId === saved.profileId)).toBe(true);
    deleteCustomGameProfile(saved.profileId);
    expect(savedGameProfilesSignal.value.some((p) => p.profileId === saved.profileId)).toBe(false);
  });
});
