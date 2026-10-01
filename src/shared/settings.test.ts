import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, normalizeSettings } from './settings';

describe('normalizeSettings', () => {
  it('retourne les valeurs par défaut sans données', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('corrompu')).toEqual(DEFAULT_SETTINGS);
  });

  it('conserve des réglages valides', () => {
    const settings = {
      autoSync: false,
      completionTrigger: 'percentage',
      completionPercentage: 90,
      notificationLevel: 'detailed',
      preferredPlayer: 'adn',
      ratingPrompt: false,
      airingAlerts: false,
      airingDelayHours: 3,
      language: 'de',
    } as const;
    expect(normalizeSettings(settings)).toEqual(settings);
  });

  it('migre l’ancien réglage showToast (≤ 1.3)', () => {
    expect(normalizeSettings({ showToast: false }).notificationLevel).toBe('alerts-only');
    expect(normalizeSettings({ showToast: true }).notificationLevel).toBe('discreet');
    expect(normalizeSettings({ showToast: false, notificationLevel: 'detailed' }).notificationLevel).toBe('detailed');
  });

  it('rejette un niveau de notification ou un lecteur inconnus', () => {
    expect(normalizeSettings({ notificationLevel: 'bruyant', preferredPlayer: 'netflix' })).toMatchObject({
      notificationLevel: 'discreet',
      preferredPlayer: 'crunchyroll',
    });
  });

  it('rejette une langue inconnue (auto par défaut)', () => {
    expect(normalizeSettings({ language: 'es' }).language).toBe('auto');
    expect(normalizeSettings({ language: 'fr' }).language).toBe('fr');
    expect(normalizeSettings({}).language).toBe('auto');
  });

  it('borne et arrondit le pourcentage, rejette les valeurs invalides', () => {
    expect(normalizeSettings({ completionPercentage: 40 }).completionPercentage).toBe(70);
    expect(normalizeSettings({ completionPercentage: 100 }).completionPercentage).toBe(98);
    expect(normalizeSettings({ completionPercentage: 87.6 }).completionPercentage).toBe(88);
    expect(normalizeSettings({ completionPercentage: Number.NaN }).completionPercentage).toBe(85);
    expect(normalizeSettings({ completionTrigger: 'autre' }).completionTrigger).toBe('credits');
  });
});
