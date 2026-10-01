import type { StreamingPlatform } from './episode.types';
import { AIRING_DELAYS, type AiringDelayHours } from './engagement.types';
import { isRecord } from './guards';

export type CompletionTrigger = 'credits' | 'percentage';

/**
 * Notifications affichées sur la page de lecture :
 * - discreet    : petite pastille de succès 3 s (rien en plein écran), aucun toast de progression
 * - detailed    : bulle complète avec le résultat par service
 * - alerts-only : uniquement quand il faut agir (à vérifier, erreur, reconnexion)
 * Les alertes s'affichent dans tous les cas.
 */
export type NotificationLevel = 'discreet' | 'detailed' | 'alerts-only';

export interface SyncSettings {
  /** Synchronisation automatique active (false = pause) */
  autoSync: boolean;
  /** "credits" : début du générique de fin si connu, sinon pourcentage */
  completionTrigger: CompletionTrigger;
  /** Pourcentage de la vidéo (repli, ou déclencheur unique en mode "percentage") */
  completionPercentage: number;
  notificationLevel: NotificationLevel;
  /** Plateforme ouverte par « Ouvrir » quand l'anime est disponible sur plusieurs plateformes */
  preferredPlayer: StreamingPlatform;
  /** Proposer une note quand une série passe en Terminé */
  ratingPrompt: boolean;
  /** Notifications Chrome à la sortie d'un nouvel épisode d'une série en cours */
  airingAlerts: boolean;
  /** Délai après la diffusion japonaise avant de notifier */
  airingDelayHours: AiringDelayHours;
}

export const DEFAULT_SETTINGS: SyncSettings = {
  autoSync: true,
  completionTrigger: 'credits',
  completionPercentage: 85,
  notificationLevel: 'discreet',
  preferredPlayer: 'crunchyroll',
  ratingPrompt: true,
  airingAlerts: true,
  airingDelayHours: 0,
};

export const PERCENTAGE_RANGE = { min: 70, max: 98 } as const;

const SETTINGS_KEY = 'settings';
const NOTIFICATION_LEVELS: readonly NotificationLevel[] = ['discreet', 'detailed', 'alerts-only'];
const PLAYERS: readonly StreamingPlatform[] = ['crunchyroll', 'adn'];

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

  // Migration ≤ 1.3 : "showToast: false" correspondait à n'afficher que les alertes
  const legacyLevel: NotificationLevel | null = value.showToast === false ? 'alerts-only' : null;
  const notificationLevel = NOTIFICATION_LEVELS.find((level) => level === value.notificationLevel) ?? legacyLevel ?? DEFAULT_SETTINGS.notificationLevel;

  return {
    autoSync: typeof value.autoSync === 'boolean' ? value.autoSync : DEFAULT_SETTINGS.autoSync,
    completionTrigger:
      value.completionTrigger === 'credits' || value.completionTrigger === 'percentage'
        ? value.completionTrigger
        : DEFAULT_SETTINGS.completionTrigger,
    completionPercentage: percentage,
    notificationLevel,
    preferredPlayer: PLAYERS.find((p) => p === value.preferredPlayer) ?? DEFAULT_SETTINGS.preferredPlayer,
    ratingPrompt: typeof value.ratingPrompt === 'boolean' ? value.ratingPrompt : DEFAULT_SETTINGS.ratingPrompt,
    airingAlerts: typeof value.airingAlerts === 'boolean' ? value.airingAlerts : DEFAULT_SETTINGS.airingAlerts,
    airingDelayHours: AIRING_DELAYS.find((d) => d === value.airingDelayHours) ?? DEFAULT_SETTINGS.airingDelayHours,
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

export const SETTINGS_STORAGE_KEY = SETTINGS_KEY;
