export type ListStatus = 'CURRENT' | 'PLANNING' | 'COMPLETED' | 'DROPPED' | 'PAUSED' | 'REPEATING';

export interface ListEntryState {
  status: ListStatus;
  progress: number;
}

export type UpdateDecision =
  | { action: 'update'; progress: number; status: 'CURRENT' | 'COMPLETED' }
  | { action: 'skip'; reason: 'already-completed' | 'repeating' | 'up-to-date' };

/**
 * Règles métier de mise à jour de la liste AniList :
 * - ne jamais faire reculer la progression (revisionnage, retour en arrière)
 * - ne pas toucher à un anime déjà terminé ni à un revisionnage en cours (non géré en v1)
 * - passer en COMPLETED au dernier épisode, sinon en CURRENT
 *
 * `isCorrection` : l'utilisateur corrige une valeur écrite par SyncKai sur cette même fiche.
 * Il a vérifié le numéro : on écrit tel quel, même vers le bas ou sur une fiche terminée.
 */
export function decideListUpdate(
  entry: ListEntryState | null,
  progress: number,
  totalEpisodes: number | null,
  isCorrection = false,
): UpdateDecision {
  const isLastEpisode = totalEpisodes !== null && progress >= totalEpisodes;
  if (isCorrection) {
    return entry?.progress === progress
      ? { action: 'skip', reason: 'up-to-date' }
      : { action: 'update', progress, status: isLastEpisode ? 'COMPLETED' : 'CURRENT' };
  }

  if (entry?.status === 'COMPLETED') return { action: 'skip', reason: 'already-completed' };
  if (entry?.status === 'REPEATING') return { action: 'skip', reason: 'repeating' };
  if (entry && progress <= entry.progress) return { action: 'skip', reason: 'up-to-date' };

  return { action: 'update', progress, status: isLastEpisode ? 'COMPLETED' : 'CURRENT' };
}
