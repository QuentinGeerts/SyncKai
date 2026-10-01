import { isEpisodeInfo, type EpisodeInfo } from './episode.types';
import { isRecord } from './guards';
import { isTrackerId, type TrackerId } from './tracker.types';

/**
 * Synchronisation en échec passager (réseau, limite de requêtes, erreur serveur), relancée
 * automatiquement par le service worker via chrome.alarms.
 * - pending : sera retentée à `nextAttemptAt`
 * - failed  : abandonnée après la dernière tentative ; l'utilisateur choisit « Réessayer » ou « Abandonner »
 */
export interface SyncQueueItem {
  /** Identifiant stable : `${platform}:${episodeId}` (une seule entrée par épisode) */
  id: string;
  episode: EpisodeInfo;
  /** Services à relancer (seulement ceux en échec) ; null = tous les services connectés */
  services: TrackerId[] | null;
  attempts: number;
  status: 'pending' | 'failed';
  /** Prochaine tentative (ms) — sans objet si status = failed */
  nextAttemptAt: number;
  /** Premier échec (ms) : sert au délai d'abandon (~24 h) */
  firstFailedAt: number;
  /** Dernière erreur, en français, affichée dans le popup */
  lastError: string;
}

export function queueItemId(episode: Pick<EpisodeInfo, 'platform' | 'episodeId'>): string {
  return `${episode.platform}:${episode.episodeId}`;
}

export function isSyncQueueItem(value: unknown): value is SyncQueueItem {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isEpisodeInfo(value.episode) &&
    (value.services === null || (Array.isArray(value.services) && value.services.every(isTrackerId))) &&
    typeof value.attempts === 'number' &&
    (value.status === 'pending' || value.status === 'failed') &&
    typeof value.nextAttemptAt === 'number' &&
    typeof value.firstFailedAt === 'number' &&
    typeof value.lastError === 'string'
  );
}
