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

/** Résultat d'une synchronisation, renvoyé au content script pour affichage (toast). */
export type SyncOutcome =
  | { status: 'updated'; mediaTitle: string; progress: number; completed: boolean }
  | { status: 'up-to-date'; mediaTitle: string; progress: number }
  | { status: 'skipped'; mediaTitle: string; reason: string }
  | { status: 'needs-review'; reason: string }
  | { status: 'not-connected' }
  | { status: 'error'; message: string };
