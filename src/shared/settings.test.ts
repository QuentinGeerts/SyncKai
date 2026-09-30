import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, normalizeSettings } from './settings';

describe('normalizeSettings', () => {
  it('retourne les valeurs par défaut sans données', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('corrompu')).toEqual(DEFAULT_SETTINGS);
  });

  it('conserve des réglages valides', () => {
    const settings = { autoSync: false, completionTrigger: 'percentage', completionPercentage: 90, showToast: false } as const;
    expect(normalizeSettings(settings)).toEqual(settings);
  });

  it('complète les champs manquants (réglages d’une ancienne version)', () => {
    expect(normalizeSettings({ showToast: false })).toEqual({ ...DEFAULT_SETTINGS, showToast: false });
  });

  it('borne et arrondit le pourcentage, rejette les valeurs invalides', () => {
    expect(normalizeSettings({ completionPercentage: 40 }).completionPercentage).toBe(70);
    expect(normalizeSettings({ completionPercentage: 100 }).completionPercentage).toBe(98);
    expect(normalizeSettings({ completionPercentage: 87.6 }).completionPercentage).toBe(88);
    expect(normalizeSettings({ completionPercentage: Number.NaN }).completionPercentage).toBe(85);
    expect(normalizeSettings({ completionTrigger: 'autre' }).completionTrigger).toBe('credits');
  });
});
