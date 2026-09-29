import type { EpisodeInfo } from '../../shared/episode.types';
import { getValidToken } from '../../shared/storage';
import type { SyncOutcome } from '../../shared/sync.types';
import { AniListApiError } from '../api/client';
import { getMediaListInfo, saveProgress } from '../api/list';
import { resolveEpisode } from './resolver';
import { decideListUpdate } from './rules';

const LOG_PREFIX = '[SyncKai:sync]';

const SKIP_REASONS = {
  'already-completed': 'Déjà marqué comme terminé sur AniList',
  repeating: 'Revisionnage en cours : progression non modifiée',
} as const;

/** Synchronise un épisode terminé avec la liste AniList de l'utilisateur. Ne lève jamais. */
export async function syncEpisode(episode: EpisodeInfo): Promise<SyncOutcome> {
  if (!(await getValidToken())) return { status: 'not-connected' };

  try {
    const resolution = await resolveEpisode(episode);
    if (!resolution.ok) {
      console.warn(LOG_PREFIX, 'Aucune correspondance :', resolution.reason, episode);
      return { status: 'needs-review', reason: resolution.reason };
    }

    const { target } = resolution;
    console.info(LOG_PREFIX, `Fiche ${target.mediaId}, progression ${target.progress} (${target.confidence}) : ${target.reason}`);
    if (target.confidence === 'low') return { status: 'needs-review', reason: target.reason };

    // Lecture fraîche juste avant l'écriture (la liste a pu changer depuis un autre appareil)
    const info = await getMediaListInfo(target.mediaId);
    const decision = decideListUpdate(info.entry, target.progress, info.episodes);

    if (decision.action === 'skip') {
      console.info(LOG_PREFIX, `Pas de mise à jour (${decision.reason})`, info);
      return decision.reason === 'up-to-date'
        ? { status: 'up-to-date', mediaTitle: info.title, progress: info.entry?.progress ?? target.progress }
        : { status: 'skipped', mediaTitle: info.title, reason: SKIP_REASONS[decision.reason] };
    }

    const saved = await saveProgress(target.mediaId, decision.progress, decision.status);
    console.info(LOG_PREFIX, `✔ ${info.title} → épisode ${saved.progress} (${saved.status})`);
    return { status: 'updated', mediaTitle: info.title, progress: saved.progress, completed: saved.status === 'COMPLETED' };
  } catch (error: unknown) {
    if (error instanceof AniListApiError) {
      console.error(LOG_PREFIX, error.code, error.message);
      return error.code === 'TOKEN_INVALID' || error.code === 'NOT_AUTHENTICATED'
        ? { status: 'not-connected' }
        : { status: 'error', message: error.message };
    }
    console.error(LOG_PREFIX, 'Erreur inattendue :', error);
    return { status: 'error', message: 'Erreur inattendue pendant la synchronisation.' };
  }
}
