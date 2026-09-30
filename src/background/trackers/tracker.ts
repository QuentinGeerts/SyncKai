import type { TrackerId } from '../../shared/tracker.types';
import type { ListEntryState } from '../sync/rules';

/**
 * Fiche du catalogue (AniList) choisie par la correspondance.
 * Chaque service de suivi la traduit vers son propre identifiant (ex : idMal).
 */
export interface CatalogMedia {
  mediaId: number;
  idMal: number | null;
  title: string;
  episodes: number | null;
}

export interface TrackerEntry {
  title: string;
  episodes: number | null;
  /** Entrée de la liste de l'utilisateur, null si l'anime n'y est pas */
  entry: ListEntryState | null;
}

/**
 * Contrat commun aux services de suivi (pattern Adapter, comme les plateformes de streaming).
 * Les règles métier (jamais de recul, statuts) restent dans sync-service / rules.
 */
export interface TrackerService {
  readonly id: TrackerId;
  isConnected(): Promise<boolean>;
  /** Identifiant de la fiche sur ce service, null s'il n'a pas d'équivalent */
  resolveId(media: CatalogMedia): number | null;
  getEntry(id: number): Promise<TrackerEntry>;
  saveProgress(id: number, progress: number, status: 'CURRENT' | 'COMPLETED'): Promise<ListEntryState>;
}
