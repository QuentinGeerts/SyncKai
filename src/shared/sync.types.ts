import type { TrackerId } from './tracker.types';
import { isRecord } from './guards';

/** Numéro d'épisode utilisé pour calculer la progression AniList */
export type NumberingMode = 'displayed' | 'season';

/**
 * Correspondance résolue et mise en cache pour une saison d'une plateforme.
 * progression AniList = numéro (selon `numbering`) - `offset`
 */
export interface MediaMapping {
  mediaId: number;
  numbering: NumberingMode;
  offset: number;
  /** Nombre d'épisodes de la fiche au moment de la résolution (null = inconnu / en cours) */
  episodes: number | null;
  /** Affichage dans la page d'options (absents des correspondances enregistrées avant la 1.1) */
  seriesLabel?: string;
  mediaTitle?: string;
}

export function isMediaMapping(value: unknown): value is MediaMapping {
  return (
    isRecord(value) &&
    typeof value.mediaId === 'number' &&
    (value.numbering === 'displayed' || value.numbering === 'season') &&
    typeof value.offset === 'number' &&
    (value.episodes === null || typeof value.episodes === 'number') &&
    (value.seriesLabel === undefined || typeof value.seriesLabel === 'string') &&
    (value.mediaTitle === undefined || typeof value.mediaTitle === 'string')
  );
}

/** Résultat de l'écriture sur UN service de suivi */
export type ServiceOutcome =
  | { status: 'updated'; progress: number; completed: boolean }
  | { status: 'up-to-date'; progress: number }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; message: string };

export interface ServiceResult {
  service: TrackerId;
  outcome: ServiceOutcome;
}

/** Résultat d'une synchronisation, renvoyé au content script (toast) et au popup. */
export type SyncOutcome =
  /** Fiche identifiée : un résultat par service connecté (succès partiel possible) */
  | { status: 'synced'; mediaTitle: string; results: ServiceResult[] }
  | { status: 'needs-review'; reason: string }
  | { status: 'not-connected' }
  | { status: 'error'; message: string };

/** Services à relancer après un échec partiel ("Réessayer" ne réécrit pas les services déjà à jour) */
export function failedServices(outcome: SyncOutcome): TrackerId[] {
  return outcome.status === 'synced' ? outcome.results.filter((r) => r.outcome.status === 'error').map((r) => r.service) : [];
}
