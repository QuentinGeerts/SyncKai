import type { Logger } from './logger';

interface VideoTrackerOptions {
  /** Seuil de complétion entre 0 et 1 (ex : 0.9) */
  threshold: number;
  /** Durée minimale (s) pour considérer la vidéo comme un épisode : ignore pubs et bandes-annonces */
  minDurationSeconds: number;
  onThresholdReached: () => void;
  /** Annuler ce signal retire tous les écouteurs posés sur la vidéo */
  signal: AbortSignal;
  logger: Logger;
}

/**
 * Suit la progression d'une <video> et déclenche `onThresholdReached` une seule fois par source.
 * Le listener `timeupdate` (~4 appels/s) est retiré dès le seuil atteint, puis réarmé
 * si le lecteur charge une nouvelle source (`loadstart`, ex : épisode suivant en autoplay).
 */
export function trackVideoProgress(video: HTMLVideoElement, options: VideoTrackerOptions): void {
  const { threshold, minDurationSeconds, onThresholdReached, signal, logger } = options;
  let progressController: AbortController | null = null;
  let lastLoggedDecile = -1;

  const onTimeUpdate = (): void => {
    const { currentTime, duration } = video;
    if (!Number.isFinite(duration) || duration <= 0) return; // Métadonnées pas encore chargées
    if (duration < minDurationSeconds) return; // Pub ou vidéo trop courte pour être un épisode

    const progress = currentTime / duration;
    const decile = Math.floor(progress * 10);
    if (decile !== lastLoggedDecile) {
      lastLoggedDecile = decile;
      logger.info(`Progression : ${Math.round(progress * 100)} %`);
    }

    if (progress >= threshold) {
      logger.info(`Seuil de ${threshold * 100} % franchi`);
      disarm();
      onThresholdReached();
    }
  };

  const arm = (): void => {
    disarm();
    lastLoggedDecile = -1;
    progressController = new AbortController();
    // Le signal combiné garantit le nettoyage même si la session est détruite
    const combined = AbortSignal.any([signal, progressController.signal]);
    video.addEventListener('timeupdate', onTimeUpdate, { signal: combined });
  };

  const disarm = (): void => {
    progressController?.abort();
    progressController = null;
  };

  video.addEventListener(
    'loadstart',
    () => {
      logger.info('Nouvelle source vidéo : suivi réarmé');
      arm();
    },
    { signal },
  );
  signal.addEventListener('abort', disarm, { once: true });

  arm();
}
