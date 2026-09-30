import { isRecord } from './guards';

export type CompletionTrigger = 'credits' | 'percentage';

export interface SyncSettings {
  /** Synchronisation automatique active (false = pause) */
  autoSync: boolean;
  /** "credits" : début du générique de fin si connu, sinon pourcentage */
  completionTrigger: CompletionTrigger;
  /** Pourcentage de la vidéo (repli, ou déclencheur unique en mode "percentage") */
  completionPercentage: number;
  showToast: boolean;
}

export const DEFAULT_SETTINGS: SyncSettings = {
  autoSync: true,
  completionTrigger: 'credits',
  completionPercentage: 85,
  showToast: true,
};

export const PERCENTAGE_RANGE = { min: 70, max: 98 } as const;

const SETTINGS_KEY = 'settings';

/**
 * Complète et borne des réglages lus du stockage : les valeurs absentes ou invalides
 * (ancienne version, stockage corrompu) retombent sur les valeurs par défaut.
 */
export function normalizeSettings(raw: unknown): SyncSettings {
  const value = isRecord(raw) ? raw : {};
  const percentage =
    typeof value.completionPercentage === 'number' && Number.isFinite(value.completionPercentage)
      ? Math.min(PERCENTAGE_RANGE.max, Math.max(PERCENTAGE_RANGE.min, Math.round(value.completionPercentage)))
      : DEFAULT_SETTINGS.completionPercentage;

  return {
    autoSync: typeof value.autoSync === 'boolean' ? value.autoSync : DEFAULT_SETTINGS.autoSync,
    completionTrigger:
      value.completionTrigger === 'credits' || value.completionTrigger === 'percentage'
        ? value.completionTrigger
        : DEFAULT_SETTINGS.completionTrigger,
    completionPercentage: percentage,
    showToast: typeof value.showToast === 'boolean' ? value.showToast : DEFAULT_SETTINGS.showToast,
  };
}

// Module volontairement séparé de storage.ts : il est aussi chargé par le content script

export async function getSettings(): Promise<SyncSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(stored[SETTINGS_KEY]);
}

export async function saveSettings(settings: SyncSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: normalizeSettings(settings) });
}
