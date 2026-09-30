import { canComplete, formatTimecode, resolveCompletionPoint } from './completion';
import type { Logger } from './logger';

interface VideoTrackerOptions {
  /** Seuil de repli (0 à 1) si le début du générique de fin est inconnu */
  fallbackRatio: number;
  /** Début du générique de fin (s), lu à chaque tick : la donnée peut arriver après le démarrage */
  getCreditsStart: () => number | null;
  /** Durée minimale (s) pour considérer la vidéo comme un épisode : ignore pubs et bandes-annonces */
  minDurationSeconds: number;
  onCompleted: () => void;
  /** Annuler ce signal retire tous les écouteurs posés sur la vidéo */
  signal: AbortSignal;
  logger: Logger;
}

/**
 * Suit la progression d'une <video> et déclenche `onCompleted` une seule fois par source,
 * au début du générique de fin (ou au seuil de repli).
 * Le listener `timeupdate` (~4 appels/s) est retiré dès la complétion, puis réarmé
 * si le lecteur charge une nouvelle source (`loadstart`, ex : épisode suivant en autoplay).
 */
export function trackVideoProgress(video: HTMLVideoElement, options: VideoTrackerOptions): void {
  const { fallbackRatio, getCreditsStart, minDurationSeconds, onCompleted, signal, logger } = options;
  let progressController: AbortController | null = null;
  let lastLoggedDecile = -1;
  let lastLoggedPoint = '';
  /** Lecture observée avant le point de fin depuis l'armement */
  let seenBeforePoint = false;
  /** Source chargée (loadstart) après le début du suivi : elle appartient forcément à cet épisode */
  let hasFreshSource = false;

  const onTimeUpdate = (): void => {
    const { currentTime, duration } = video;
    if (!Number.isFinite(duration) || duration <= 0) return; // Métadonnées pas encore chargées
    if (duration < minDurationSeconds) return; // Pub ou vidéo trop courte pour être un épisode

    const point = resolveCompletionPoint(duration, getCreditsStart(), fallbackRatio);
    const pointLabel =
      point.source === 'credits'
        ? `générique de fin à ${formatTimecode(point.seconds)}`
        : `${Math.round(fallbackRatio * 100)} % (${formatTimecode(point.seconds)}, pas de données de générique)`;
    if (pointLabel !== lastLoggedPoint) {
      lastLoggedPoint = pointLabel;
      logger.info(`Fin d’épisode : ${pointLabel}`);
    }

    const decile = Math.floor((currentTime / duration) * 10);
    if (decile !== lastLoggedDecile) {
      lastLoggedDecile = decile;
      logger.info(`Progression : ${Math.round((currentTime / duration) * 100)} % (${formatTimecode(currentTime)})`);
    }

    if (currentTime < point.seconds) seenBeforePoint = true;
    if (canComplete(currentTime, point.seconds, seenBeforePoint, hasFreshSource)) {
      logger.info(`Fin d’épisode atteinte (${pointLabel})`);
      disarm();
      onCompleted();
    }
  };

  const arm = (): void => {
    disarm();
    lastLoggedDecile = -1;
    lastLoggedPoint = '';
    seenBeforePoint = false;
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
      hasFreshSource = true;
      arm();
    },
    { signal },
  );
  signal.addEventListener('abort', disarm, { once: true });

  arm();
}
