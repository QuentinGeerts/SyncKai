import type { EpisodeInfo } from '../../shared/episode.types';
import { isExcluded, platformSeriesKey } from '../../shared/exclusions';
import { sendMessage } from '../../shared/messages';
import { failedServices } from '../../shared/sync.types';
import type { TrackerId } from '../../shared/tracker.types';
import { DEFAULT_SETTINGS, getSettings, type NotificationLevel, type SyncSettings } from '../../shared/settings';
import type { StreamingAdapter } from '../adapters/adapter';
import { showEngagementPrompt } from '../ui/engagement-prompt';
import { isAlertTone, promptForOutcome, showsProgress } from '../ui/notification-policy';
import { ALERT_TOAST_MS, RETRY_TOAST_MS, bubbleForOutcome, toastForOutcome } from '../ui/sync-toast';
import { showToast, type ToastContent, type ToastOptions } from '../ui/toast';
import { createLogger } from './logger';
import { trackVideoProgress } from './video-tracker';
import { waitFor } from './wait-for';

const MIN_EPISODE_DURATION_S = 120;
const VIDEO_WAIT_TIMEOUT_MS = 30_000;
const METADATA_WAIT_TIMEOUT_MS = 15_000;

const log = createLogger('session');

/** Réglages de la page d'options ; valeurs par défaut si le stockage est illisible */
async function loadSettings(): Promise<SyncSettings> {
  try {
    return await getSettings();
  } catch (error: unknown) {
    log.warn('Réglages illisibles, valeurs par défaut utilisées :', error);
    return DEFAULT_SETTINGS;
  }
}

/** Résumé lisible sur une ligne (la console tronque les objets) : "One Piece · S24 E25 (affiché E1180) · GE00376431JAJP" */
function formatEpisode(e: EpisodeInfo): string {
  const season = e.seasonNumber !== null ? `S${e.seasonNumber}` : 'S?';
  const episode = e.seasonEpisodeNumber !== null ? `E${e.seasonEpisodeNumber}` : 'E?';
  const displayed = e.displayedEpisodeNumber !== null ? ` (affiché E${e.displayedEpisodeNumber})` : '';
  return `${e.animeTitle} · ${season} ${episode}${displayed} · ${e.episodeId}`;
}

/** "One Piece · épisode 1180" pour le toast */
function formatEpisodeShort(e: EpisodeInfo): string {
  const number = e.displayedEpisodeNumber ?? e.seasonEpisodeNumber;
  return number !== null ? `${e.animeTitle} · épisode ${number}` : e.animeTitle;
}

export interface WatchSession {
  readonly episodeId: string;
  /** Raccourci « valider l'épisode en cours » : complétion immédiate, sans attendre le % ni le générique */
  forceComplete(): void;
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
  /** Début du générique de fin, renseigné dès que la plateforme répond */
  let creditsStart: number | null = null;

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
      showToast({ tone: 'warning', title: 'SyncKai a été mis à jour', message: 'Recharge la page pour synchroniser cet épisode.' }, { autoHideMs: ALERT_TOAST_MS });
      destroy();
      return;
    }

    // Relecture à la complétion (DOM complet), avec repli sur les métadonnées du démarrage
    const episode = extract() ?? metadata;
    if (!episode) {
      log.error('Épisode terminé mais métadonnées introuvables : complétion non envoyée');
      showToast({ tone: 'error', title: 'Épisode non identifié', message: 'Impossible de lire les informations de l’épisode sur la page.' }, { autoHideMs: ALERT_TOAST_MS });
      return;
    }

    completionReported = true;
    log.info(`✔ Épisode terminé : ${formatEpisode(episode)}`, episode);

    // Relus maintenant : une pause activée pendant l'épisode s'applique immédiatement
    const settings = await loadSettings();
    if (!settings.autoSync) {
      log.info('Synchronisation en pause (options) : épisode non envoyé');
      return;
    }
    if (await isSeriesExcluded(episode)) {
      log.info(`Série exclue (Réglages › Séries exclues) : épisode non envoyé (${platformSeriesKey(episode)})`);
      return;
    }
    await syncWithFeedback(episode, settings.notificationLevel);
  }

  /** Exclusion côté plateforme ; stockage illisible → non exclu (le service worker revérifie après résolution) */
  async function isSeriesExcluded(episode: EpisodeInfo): Promise<boolean> {
    try {
      return await isExcluded({ platformKey: platformSeriesKey(episode) });
    } catch (error: unknown) {
      log.warn('Exclusions illisibles :', error);
      return false;
    }
  }

  function forceComplete(): void {
    if (signal.aborted) return;
    if (completionReported) {
      log.info('Raccourci « valider l’épisode » : épisode déjà synchronisé');
      return;
    }
    log.info('Raccourci « valider l’épisode » : complétion immédiate');
    void reportCompletion();
  }

  /**
   * Envoie l'épisode au service worker et affiche le résultat selon le niveau de notification
   * (voir notification-policy) : les alertes (à vérifier, erreurs) restent toujours affichées.
   * Une erreur (réseau, AniList indisponible…) propose "Réessayer" : l'épisode n'est pas perdu.
   */
  async function syncWithFeedback(episode: EpisodeInfo, level: NotificationLevel, services: TrackerId[] | null = null): Promise<void> {
    const toast = showsProgress(level)
      ? showToast({ tone: 'info', title: 'Synchronisation…', message: formatEpisodeShort(episode) })
      : null;
    const notify = (content: ToastContent, options: ToastOptions): void => {
      if (toast) toast.update(content, options);
      else if (isAlertTone(content.tone)) showToast(content, options);
    };

    try {
      const outcome = await sendMessage('EPISODE_COMPLETED', { episode, services });
      log.info('Résultat de la synchronisation :', outcome);
      // Échec global → tout relancer ; échec partiel → seulement les services en erreur
      const retry = outcome.status === 'error' ? null : failedServices(outcome);
      if (retry === null || retry.length > 0) {
        // Nouvelle tentative explicite : mode détaillé forcé pour voir la progression et le résultat
        const action = { label: 'Réessayer', onClick: () => void syncWithFeedback(episode, 'detailed', retry) };
        notify({ ...bubbleForOutcome(outcome), action }, { variant: 'bubble', autoHideMs: RETRY_TOAST_MS });
        return;
      }
      // Note de fin de série / revisionnage : bulle à tous les niveaux (même en plein écran), à la place du résultat
      const prompt = promptForOutcome(outcome);
      if (prompt) {
        showEngagementPrompt(prompt);
        return;
      }
      const result = toastForOutcome(outcome, level, document.fullscreenElement !== null);
      if (result) {
        // Pas de toast de progression (discret) : la pastille de succès est créée ici
        if (toast) toast.update(result.content, { variant: result.variant, autoHideMs: result.autoHideMs });
        else showToast(result.content, { variant: result.variant, autoHideMs: result.autoHideMs });
      } else {
        toast?.dismiss();
      }
    } catch (error: unknown) {
      completionReported = false;
      log.error('Service worker injoignable :', error);
      notify({ tone: 'error', title: 'SyncKai injoignable', message: 'Recharge la page puis réessaie.' }, { variant: 'bubble', autoHideMs: ALERT_TOAST_MS });
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

  async function waitForVideo(settings: SyncSettings): Promise<void> {
    const video = await waitFor(() => adapter.findVideo(), { signal, timeoutMs: VIDEO_WAIT_TIMEOUT_MS });
    if (signal.aborted) return;
    if (!video) {
      log.warn(`Aucune balise <video> trouvée après ${VIDEO_WAIT_TIMEOUT_MS / 1000} s`);
      return;
    }
    log.info('Lecteur vidéo trouvé :', video.id || '(sans id)');

    trackVideoProgress(video, {
      fallbackRatio: settings.completionPercentage / 100,
      getCreditsStart: () => creditsStart,
      minDurationSeconds: MIN_EPISODE_DURATION_S,
      onCompleted: () => void reportCompletion(),
      signal,
      logger: log,
    });
  }

  async function init(): Promise<void> {
    // Déclenchement fixé pour l'épisode : un changement de réglage s'applique au suivant
    const settings = await loadSettings();
    if (signal.aborted) return;
    log.info(
      settings.completionTrigger === 'credits'
        ? `Déclenchement : générique de fin (repli à ${settings.completionPercentage} %)`
        : `Déclenchement : ${settings.completionPercentage} % de la vidéo`,
    );
    if (settings.completionTrigger === 'credits') {
      void adapter.getCreditsStart?.(episodeId, signal).then((start) => {
        creditsStart = start;
      });
    }
    await waitForVideo(settings);
  }

  void waitForMetadata();
  void init();

  return { episodeId, forceComplete, destroy };
}
