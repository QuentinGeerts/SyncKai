import type { AniListErrorCode } from '../../shared/anilist.types';
import { flashSyncBadge, refreshReviewBadge } from '../../shared/badge';
import type { EpisodeInfo } from '../../shared/episode.types';
import { isExcluded, platformSeriesKey } from '../../shared/exclusions';
import type { ResolveReviewPayload } from '../../shared/messages';
import type { Result } from '../../shared/result';
import type { CandidateSummary, PendingReview } from '../../shared/review.types';
import {
  addRecentSync,
  deletePendingReview,
  getPendingReviews,
  getRecentSyncs,
  saveMediaMapping,
  savePendingReview,
} from '../../shared/storage';
import type { ServiceResult, SyncOutcome } from '../../shared/sync.types';
import { TRACKER_LABELS, type TrackerId } from '../../shared/tracker.types';
import { ApiError } from '../api/errors';
import { getAnimeById, searchAnime } from '../api/media';
import { getConnectedTrackers } from '../trackers';
import type { CatalogMedia, TrackerService } from '../trackers/tracker';
import { mappingFromManualChoice, mappingKey, seasonLabel } from './matching';
import { findReviewCandidates, resolveEpisode, toCandidateSummary } from './resolver';
import { decideListUpdate } from './rules';

const LOG_PREFIX = '[SyncKai:sync]';
const MAX_SEARCH_RESULTS = 10;

const SKIP_REASONS = {
  'already-completed': 'Déjà marqué comme terminé',
  repeating: 'Revisionnage en cours : progression non modifiée',
} as const;

/** Convertit une erreur en résultat affichable (les handlers de messages ne lèvent jamais). */
function toErrorOutcome(error: unknown): SyncOutcome {
  if (error instanceof ApiError) {
    console.error(LOG_PREFIX, error.code, error.message);
    return { status: 'error', message: error.message, code: error.code };
  }
  console.error(LOG_PREFIX, 'Erreur inattendue :', error);
  return { status: 'error', message: 'Erreur inattendue pendant la synchronisation.' };
}

function toErrorResult(error: unknown): { ok: false; code: AniListErrorCode; message: string } {
  if (error instanceof ApiError) return { ok: false, code: error.code, message: error.message };
  console.error(LOG_PREFIX, 'Erreur inattendue :', error);
  return { ok: false, code: 'API_ERROR', message: 'Erreur inattendue.' };
}

async function queueReview(review: PendingReview): Promise<void> {
  await savePendingReview(review);
  await refreshReviewBadge();
}

/** Fiche du catalogue AniList (titre, nombre d'épisodes, identifiant MAL) : aucun compte requis. */
export async function getCatalogMedia(mediaId: number): Promise<CatalogMedia> {
  const media = await getAnimeById(mediaId);
  return { mediaId, idMal: media.idMal, title: media.displayTitle, episodes: media.episodes };
}

/** Applique les règles métier et écrit sur UN service. Ne lève jamais : l'échec est un résultat. */
async function writeToService(
  tracker: TrackerService,
  catalog: CatalogMedia,
  progress: number,
  isCorrection: boolean,
): Promise<ServiceResult> {
  const label = TRACKER_LABELS[tracker.id];
  const id = tracker.resolveId(catalog);
  if (id === null) return { service: tracker.id, outcome: { status: 'skipped', reason: 'Pas de fiche équivalente' } };

  try {
    // Lecture fraîche juste avant l'écriture (la liste a pu changer depuis un autre appareil)
    const current = await tracker.getEntry(id);
    // Découpage différent entre services : on n'écrit pas au-delà de la fiche de ce service
    if (current.episodes !== null && progress > current.episodes) {
      return {
        service: tracker.id,
        outcome: { status: 'skipped', reason: `Épisode ${progress} au-delà des ${current.episodes} épisodes de la fiche` },
      };
    }

    const decision = decideListUpdate(current.entry, progress, current.episodes ?? catalog.episodes, isCorrection);
    if (decision.action === 'skip') {
      console.info(LOG_PREFIX, `${label} : pas de mise à jour (${decision.reason})`, current);
      return {
        service: tracker.id,
        outcome:
          decision.reason === 'up-to-date'
            ? { status: 'up-to-date', progress: current.entry?.progress ?? progress }
            : { status: 'skipped', reason: SKIP_REASONS[decision.reason] },
      };
    }

    const saved = await tracker.saveProgress(id, decision.progress, decision.status);
    console.info(LOG_PREFIX, `✔ ${label} : ${current.title} → épisode ${saved.progress} (${saved.status})`);
    return { service: tracker.id, outcome: { status: 'updated', progress: saved.progress, completed: saved.status === 'COMPLETED' } };
  } catch (error: unknown) {
    console.error(LOG_PREFIX, `${label} : échec`, error);
    return {
      service: tracker.id,
      outcome: error instanceof ApiError ? { status: 'error', message: error.message, code: error.code } : { status: 'error', message: 'Erreur inattendue.' },
    };
  }
}

interface WriteOptions {
  isCorrection?: boolean;
  /** Restreint l'écriture à ces services (nouvelle tentative après un échec partiel) */
  only?: readonly TrackerId[] | null;
}

/**
 * Écrit la progression sur chaque service connecté. Commun à la synchro automatique, au choix
 * manuel et à la correction. Seules les écritures réelles alimentent les "dernières synchros".
 */
async function writeToServices(
  key: string,
  episode: EpisodeInfo,
  catalog: CatalogMedia,
  progress: number,
  options: WriteOptions = {},
): Promise<SyncOutcome> {
  const trackers = await getConnectedTrackers(options.only ?? null);
  if (trackers.length === 0) return { status: 'not-connected' };

  const results = await Promise.all(trackers.map((t) => writeToService(t, catalog, progress, options.isCorrection ?? false)));

  if (results.some((r) => r.outcome.status === 'updated')) {
    await addRecentSync({ key, episode, mediaId: catalog.mediaId, mediaTitle: catalog.title, progress, syncedAt: Date.now() });
    // Coche sur l'icône (visible en plein écran) : décorative, ne bloque ni ne fait échouer la synchro
    void flashSyncBadge();
  }
  // Correspondance appliquée pour cette saison : une éventuelle vérification en attente est caduque
  if (results.some((r) => r.outcome.status !== 'error') && (await getPendingReviews()).some((r) => r.key === key)) {
    await deletePendingReview(key);
    await refreshReviewBadge();
  }
  return { status: 'synced', mediaTitle: catalog.title, results };
}

/**
 * Synchronise un épisode terminé avec les services connectés (tous, ou `only` après un échec partiel).
 * La correspondance passe toujours par le catalogue AniList, même sans compte AniList. Ne lève jamais.
 */
export async function syncEpisode(episode: EpisodeInfo, only: readonly TrackerId[] | null = null): Promise<SyncOutcome> {
  try {
    if ((await getConnectedTrackers(only)).length === 0) return { status: 'not-connected' };
    // Série exclue côté plateforme (filet de sécurité : le content script vérifie déjà avant l'envoi)
    if (await isExcluded({ platformKey: platformSeriesKey(episode) })) {
      console.info(LOG_PREFIX, 'Série exclue (plateforme) : rien n’est écrit', episode);
      return { status: 'excluded', mediaTitle: episode.animeTitle };
    }
    const key = mappingKey(episode);
    const { result, candidates } = await resolveEpisode(episode);

    if (!result.ok || result.target.confidence === 'low') {
      // Fiche suggérée exclue : pas de carte de vérification pour une série que l'utilisateur ignore
      if (result.ok && (await isExcluded({ mediaId: result.target.mediaId }))) {
        console.info(LOG_PREFIX, `Fiche suggérée ${result.target.mediaId} exclue : aucune vérification créée`);
        return { status: 'excluded', mediaTitle: episode.animeTitle };
      }
      const reason = result.ok ? result.target.reason : result.reason;
      console.warn(LOG_PREFIX, 'Correspondance incertaine :', reason, episode);
      await queueReview({
        key,
        episode,
        reason,
        suggestion: result.ok ? { mediaId: result.target.mediaId, progress: result.target.progress } : null,
        candidates,
        previous: null,
        createdAt: Date.now(),
      });
      return { status: 'needs-review', reason };
    }

    const { target } = result;
    console.info(LOG_PREFIX, `Fiche ${target.mediaId}, progression ${target.progress} : ${target.reason}`);
    const catalog = await getCatalogMedia(target.mediaId);
    if (await isExcluded({ mediaId: target.mediaId })) {
      console.info(LOG_PREFIX, `Fiche ${target.mediaId} exclue : rien n’est écrit`);
      return { status: 'excluded', mediaTitle: catalog.title };
    }
    return await writeToServices(key, episode, catalog, target.progress, { only });
  } catch (error: unknown) {
    return toErrorOutcome(error);
  }
}

/** Choix manuel depuis le popup : mémorise la correspondance pour la saison puis synchronise. */
export async function resolveReview({ key, mediaId, progress }: ResolveReviewPayload): Promise<SyncOutcome> {
  try {
    const review = (await getPendingReviews()).find((r) => r.key === key);
    if (!review) return { status: 'error', message: 'Cette vérification n’existe plus.' };

    const catalog = await getCatalogMedia(mediaId);
    const mapping = mappingFromManualChoice(review.episode, mediaId, progress, catalog.episodes);
    if (!mapping) {
      return { status: 'error', message: `Épisode ${progress} invalide pour « ${catalog.title} » (${catalog.episodes ?? '?'} épisodes).` };
    }

    await saveMediaMapping(key, { ...mapping, seriesLabel: seasonLabel(review.episode), mediaTitle: catalog.title });
    console.info(LOG_PREFIX, `Correspondance manuelle enregistrée pour ${key} :`, mapping);
    // Correction sur la fiche déjà utilisée : la valeur choisie remplace celle écrite (même plus basse)
    const isCorrection = review.previous?.mediaId === mediaId;
    return await writeToServices(key, review.episode, catalog, progress, { isCorrection });
  } catch (error: unknown) {
    return toErrorOutcome(error);
  }
}

/** "Corriger" une synchro passée : rouvre une carte de vérification avec les fiches candidates. */
export async function reopenReview(key: string): Promise<Result<null, AniListErrorCode | 'NOT_FOUND'>> {
  try {
    const recent = (await getRecentSyncs()).find((s) => s.key === key);
    if (!recent) return { ok: false, code: 'NOT_FOUND', message: 'Synchronisation introuvable.' };

    let candidates: CandidateSummary[] = await findReviewCandidates(recent.episode, recent.mediaId);
    // La fiche actuelle doit rester sélectionnable, même si la recherche ne la renvoie plus
    if (!candidates.some((c) => c.id === recent.mediaId)) {
      candidates = [{ id: recent.mediaId, title: recent.mediaTitle, format: null, episodes: null, year: null, coverUrl: null }, ...candidates];
    }

    await queueReview({
      key,
      episode: recent.episode,
      reason: `Correction : actuellement synchronisé avec « ${recent.mediaTitle} »`,
      suggestion: { mediaId: recent.mediaId, progress: recent.progress },
      candidates,
      previous: { mediaId: recent.mediaId, title: recent.mediaTitle, progress: recent.progress },
      createdAt: Date.now(),
    });
    return { ok: true, data: null };
  } catch (error: unknown) {
    return toErrorResult(error);
  }
}

/** Recherche libre depuis une carte de vérification. */
export async function searchCandidates(query: string): Promise<Result<CandidateSummary[], AniListErrorCode>> {
  try {
    const media = await searchAnime(query.trim());
    return { ok: true, data: media.filter((m) => m.format !== 'MUSIC').slice(0, MAX_SEARCH_RESULTS).map(toCandidateSummary) };
  } catch (error: unknown) {
    return toErrorResult(error);
  }
}
