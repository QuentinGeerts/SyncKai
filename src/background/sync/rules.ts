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
 */
export function decideListUpdate(
  entry: ListEntryState | null,
  progress: number,
  totalEpisodes: number | null,
): UpdateDecision {
  if (entry?.status === 'COMPLETED') return { action: 'skip', reason: 'already-completed' };
  if (entry?.status === 'REPEATING') return { action: 'skip', reason: 'repeating' };
  if (entry && progress <= entry.progress) return { action: 'skip', reason: 'up-to-date' };

  const isLastEpisode = totalEpisodes !== null && progress >= totalEpisodes;
  return { action: 'update', progress, status: isLastEpisode ? 'COMPLETED' : 'CURRENT' };
}
