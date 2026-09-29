import type { AniListErrorCode } from '../../shared/anilist.types';
import { refreshReviewBadge } from '../../shared/badge';
import type { EpisodeInfo } from '../../shared/episode.types';
import type { ResolveReviewPayload } from '../../shared/messages';
import type { Result } from '../../shared/result';
import type { CandidateSummary, PendingReview } from '../../shared/review.types';
import {
  addRecentSync,
  deletePendingReview,
  getPendingReviews,
  getRecentSyncs,
  getValidToken,
  saveMediaMapping,
  savePendingReview,
} from '../../shared/storage';
import type { SyncOutcome } from '../../shared/sync.types';
import { AniListApiError } from '../api/client';
import { getMediaListInfo, saveProgress, type MediaListInfo } from '../api/list';
import { searchAnime } from '../api/media';
import { mappingFromManualChoice, mappingKey } from './matching';
import { findReviewCandidates, resolveEpisode, toCandidateSummary } from './resolver';
import { decideListUpdate } from './rules';

const LOG_PREFIX = '[SyncKai:sync]';
const MAX_SEARCH_RESULTS = 10;

const SKIP_REASONS = {
  'already-completed': 'Déjà marqué comme terminé sur AniList',
  repeating: 'Revisionnage en cours : progression non modifiée',
} as const;

/** Convertit une erreur en résultat affichable (les handlers de messages ne lèvent jamais). */
function toErrorOutcome(error: unknown): SyncOutcome {
  if (error instanceof AniListApiError) {
    console.error(LOG_PREFIX, error.code, error.message);
    return error.code === 'TOKEN_INVALID' || error.code === 'NOT_AUTHENTICATED'
      ? { status: 'not-connected' }
      : { status: 'error', message: error.message };
  }
  console.error(LOG_PREFIX, 'Erreur inattendue :', error);
  return { status: 'error', message: 'Erreur inattendue pendant la synchronisation.' };
}

function toErrorResult(error: unknown): { ok: false; code: AniListErrorCode; message: string } {
  if (error instanceof AniListApiError) return { ok: false, code: error.code, message: error.message };
  console.error(LOG_PREFIX, 'Erreur inattendue :', error);
  return { ok: false, code: 'API_ERROR', message: 'Erreur inattendue.' };
}

async function queueReview(review: PendingReview): Promise<void> {
  await savePendingReview(review);
  await refreshReviewBadge();
}

/**
 * Applique les règles métier puis écrit la progression. Commun à la synchro automatique,
 * au choix manuel et à la correction. Seules les écritures réelles sont ajoutées aux "dernières synchros"
 * (un épisode déjà vu ou un anime terminé n'a rien modifié : rien à corriger).
 */
async function writeProgress(key: string, episode: EpisodeInfo, info: MediaListInfo, progress: number): Promise<SyncOutcome> {
  const decision = decideListUpdate(info.entry, progress, info.episodes);

  let outcome: SyncOutcome;
  if (decision.action === 'skip') {
    console.info(LOG_PREFIX, `Pas de mise à jour (${decision.reason})`, info);
    outcome =
      decision.reason === 'up-to-date'
        ? { status: 'up-to-date', mediaTitle: info.title, progress: info.entry?.progress ?? progress }
        : { status: 'skipped', mediaTitle: info.title, reason: SKIP_REASONS[decision.reason] };
  } else {
    const saved = await saveProgress(info.mediaId, decision.progress, decision.status);
    console.info(LOG_PREFIX, `✔ ${info.title} → épisode ${saved.progress} (${saved.status})`);
    outcome = { status: 'updated', mediaTitle: info.title, progress: saved.progress, completed: saved.status === 'COMPLETED' };
    await addRecentSync({ key, episode, mediaId: info.mediaId, mediaTitle: info.title, progress: saved.progress, syncedAt: Date.now() });
  }

  // Une synchro aboutie pour cette saison rend caduque une éventuelle vérification en attente
  if ((await getPendingReviews()).some((r) => r.key === key)) {
    await deletePendingReview(key);
    await refreshReviewBadge();
  }
  return outcome;
}

/** Synchronise un épisode terminé avec la liste AniList de l'utilisateur. Ne lève jamais. */
export async function syncEpisode(episode: EpisodeInfo): Promise<SyncOutcome> {
  if (!(await getValidToken())) return { status: 'not-connected' };

  try {
    const key = mappingKey(episode);
    const { result, candidates } = await resolveEpisode(episode);

    if (!result.ok || result.target.confidence === 'low') {
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
    // Lecture fraîche juste avant l'écriture (la liste a pu changer depuis un autre appareil)
    return await writeProgress(key, episode, await getMediaListInfo(target.mediaId), target.progress);
  } catch (error: unknown) {
    return toErrorOutcome(error);
  }
}

/** Choix manuel depuis le popup : mémorise la correspondance pour la saison puis synchronise. */
export async function resolveReview({ key, mediaId, progress }: ResolveReviewPayload): Promise<SyncOutcome> {
  try {
    const review = (await getPendingReviews()).find((r) => r.key === key);
    if (!review) return { status: 'error', message: 'Cette vérification n’existe plus.' };

    const info = await getMediaListInfo(mediaId);
    const mapping = mappingFromManualChoice(review.episode, mediaId, progress, info.episodes);
    if (!mapping) {
      return { status: 'error', message: `Épisode ${progress} invalide pour « ${info.title} » (${info.episodes ?? '?'} épisodes).` };
    }

    await saveMediaMapping(key, mapping);
    console.info(LOG_PREFIX, `Correspondance manuelle enregistrée pour ${key} :`, mapping);
    return await writeProgress(key, review.episode, info, progress);
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
