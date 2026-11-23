import { beforeEach, describe, expect, it } from 'vitest';
import {
  allVillainProfilesSignal,
  BUILT_IN_VILLAIN_PROFILES,
  deleteVillainProfile,
  reloadVillainProfiles,
  saveVillainProfile,
} from './villainProfiles';

describe('villainProfiles', () => {
  beforeEach(() => {
    window.localStorage.clear();
    reloadVillainProfiles();
  });

  it('provides built-in profiles and persists custom profiles in localStorage', () => {
    expect(allVillainProfilesSignal.value.length).toBe(BUILT_IN_VILLAIN_PROFILES.length);

    const saved = saveVillainProfile('Dan', '22+, A9s+, KQs, AJo+');
    expect(saved).not.toBeNull();
    expect(allVillainProfilesSignal.value.some((p) => p.name === 'Dan')).toBe(true);

    reloadVillainProfiles();
    expect(allVillainProfilesSignal.value.some((p) => p.name === 'Dan')).toBe(true);

    deleteVillainProfile(saved!.id);
    expect(allVillainProfilesSignal.value.some((p) => p.name === 'Dan')).toBe(false);
  });
});
