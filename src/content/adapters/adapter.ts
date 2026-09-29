import type { EpisodeInfo, StreamingPlatform } from '../../shared/episode.types';

/**
 * Contrat commun à toutes les plateformes (Crunchyroll, ADN…).
 * Toute la logique spécifique au DOM/URL d'un site est isolée dans son adapter.
 */
export interface StreamingAdapter {
  readonly platform: StreamingPlatform;

  /** Vrai si l'adapter gère ce domaine */
  supportsHost(hostname: string): boolean;

  /** Identifiant de l'épisode si l'URL est une page de lecture, sinon null */
  getEpisodeId(url: URL): string | null;

  /** Extrait les métadonnées de l'épisode ; null si le DOM n'est pas encore prêt */
  extractEpisodeInfo(url: URL): EpisodeInfo | null;

  /** Retourne l'élément <video> du lecteur s'il est présent */
  findVideo(): HTMLVideoElement | null;
}
