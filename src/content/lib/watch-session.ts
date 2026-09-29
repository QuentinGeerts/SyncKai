import type { EpisodeInfo } from '../../shared/episode.types';
import { sendMessage } from '../../shared/messages';
import type { StreamingAdapter } from '../adapters/adapter';
import { createLogger } from './logger';
import { trackVideoProgress } from './video-tracker';
import { waitFor } from './wait-for';

const COMPLETION_THRESHOLD = 0.9;
const MIN_EPISODE_DURATION_S = 120;
const VIDEO_WAIT_TIMEOUT_MS = 30_000;
const METADATA_WAIT_TIMEOUT_MS = 15_000;

const log = createLogger('session');

/** Résumé lisible sur une ligne (la console tronque les objets) : "One Piece · S24 E25 (affiché E1180) · GE00376431JAJP" */
function formatEpisode(e: EpisodeInfo): string {
  const season = e.seasonNumber !== null ? `S${e.seasonNumber}` : 'S?';
  const episode = e.seasonEpisodeNumber !== null ? `E${e.seasonEpisodeNumber}` : 'E?';
  const displayed = e.displayedEpisodeNumber !== null ? ` (affiché E${e.displayedEpisodeNumber})` : '';
  return `${e.animeTitle} · ${season} ${episode}${displayed} · ${e.episodeId}`;
}

export interface WatchSession {
  readonly episodeId: string;
  /** Retire tous les écouteurs/observers liés à cet épisode */
  destroy(): void;
}

/** Vrai si l'extension a été rechargée/mise à jour : ce content script est alors orphelin. */
function isExtensionContextInvalidated(): boolean {
  return typeof chrome.runtime?.id !== 'string';
}

/** Suit la lecture d'un épisode, de la détection du lecteur jusqu'à l'envoi de la complétion. */
export function startWatchSession(adapter: StreamingAdapter, episodeId: string): WatchSession {
  const controller = new AbortController();
  const { signal } = controller;
  let completionReported = false;
  /** Métadonnées obtenues au démarrage, en réserve si la relecture échoue à la complétion */
  let metadata: EpisodeInfo | null = null;

  log.info(`▶ Page de lecture détectée (${adapter.platform}, épisode ${episodeId})`);

  const isCurrentEpisode = (): boolean => adapter.getEpisodeId(new URL(location.href)) === episodeId;
  const extract = (): EpisodeInfo | null => (isCurrentEpisode() ? adapter.extractEpisodeInfo(new URL(location.href)) : null);

  function destroy(): void {
    if (signal.aborted) return;
    controller.abort();
    log.info(`■ Session terminée (épisode ${episodeId})`);
  }

  async function reportCompletion(): Promise<void> {
    // Un seul envoi par épisode, même si le lecteur recharge sa source
    if (completionReported || signal.aborted || !isCurrentEpisode()) return;

    if (isExtensionContextInvalidated()) {
      log.warn('Extension rechargée depuis l’ouverture de la page : recharge l’onglet pour réactiver SyncKai');
      destroy();
      return;
    }

    // Relecture à la complétion (DOM complet), avec repli sur les métadonnées du démarrage
    const episode = extract() ?? metadata;
    if (!episode) {
      log.error('Épisode terminé mais métadonnées introuvables : complétion non envoyée');
      return;
    }

    completionReported = true;
    log.info(`✔ Épisode terminé : ${formatEpisode(episode)}`, episode);
    try {
      const result = await sendMessage('EPISODE_COMPLETED', episode);
      if (result.ok) log.info('Complétion transmise au service worker');
      else log.warn('Complétion refusée par le service worker :', result.message);
    } catch (error: unknown) {
      completionReported = false;
      log.error('Service worker injoignable :', error);
    }
  }

  async function waitForMetadata(): Promise<void> {
    // Après une navigation SPA, le DOM/JSON-LD peut encore décrire l'épisode précédent :
    // l'adapter rejette ces données périmées, on attend donc qu'elles soient à jour
    metadata = await waitFor(extract, { signal, timeoutMs: METADATA_WAIT_TIMEOUT_MS });
    if (signal.aborted) return;
    if (metadata) log.info(`Épisode identifié : ${formatEpisode(metadata)}`, metadata);
    else log.warn('Métadonnées indisponibles pour l’instant, nouvel essai à la fin de l’épisode');
  }

  async function waitForVideo(): Promise<void> {
    const video = await waitFor(() => adapter.findVideo(), { signal, timeoutMs: VIDEO_WAIT_TIMEOUT_MS });
    if (signal.aborted) return;
    if (!video) {
      log.warn(`Aucune balise <video> trouvée après ${VIDEO_WAIT_TIMEOUT_MS / 1000} s`);
      return;
    }
    log.info('Lecteur vidéo trouvé :', video.id || '(sans id)');

    trackVideoProgress(video, {
      threshold: COMPLETION_THRESHOLD,
      minDurationSeconds: MIN_EPISODE_DURATION_S,
      onThresholdReached: () => void reportCompletion(),
      signal,
      logger: log,
    });
  }

  void waitForMetadata();
  void waitForVideo();

  return { episodeId, destroy };
}
