import { isRecord } from '../../shared/guards';
import type { ListEntryState, ListStatus } from '../sync/rules';
import { AniListApiError, anilistQuery } from './client';

export interface MediaListInfo {
  mediaId: number;
  title: string;
  episodes: number | null;
  /** Entrée de la liste de l'utilisateur, null si l'anime n'y est pas */
  entry: ListEntryState | null;
}

const MEDIA_ENTRY_QUERY = /* GraphQL */ `
  query MediaEntry($id: Int!) {
    Media(id: $id, type: ANIME) {
      id
      episodes
      title { userPreferred }
      mediaListEntry { status progress }
    }
  }
`;

const SAVE_PROGRESS_MUTATION = /* GraphQL */ `
  mutation SaveProgress($mediaId: Int!, $progress: Int!, $status: MediaListStatus!) {
    SaveMediaListEntry(mediaId: $mediaId, progress: $progress, status: $status) {
      status
      progress
    }
  }
`;

const LIST_STATUSES: Record<ListStatus, true> = {
  CURRENT: true,
  PLANNING: true,
  COMPLETED: true,
  DROPPED: true,
  PAUSED: true,
  REPEATING: true,
};

function parseEntry(value: unknown): ListEntryState | null {
  if (!isRecord(value) || typeof value.status !== 'string' || !Object.hasOwn(LIST_STATUSES, value.status)) return null;
  return { status: value.status as ListStatus, progress: typeof value.progress === 'number' ? value.progress : 0 };
}

interface MediaEntryData {
  Media: { id: number; episodes: unknown; title: unknown; mediaListEntry: unknown };
}

function isMediaEntryData(data: unknown): data is MediaEntryData {
  return isRecord(data) && isRecord(data.Media) && typeof data.Media.id === 'number';
}

interface SaveProgressData {
  SaveMediaListEntry: unknown;
}

function isSaveProgressData(data: unknown): data is SaveProgressData {
  return isRecord(data) && isRecord(data.SaveMediaListEntry);
}

/** Lit la fiche et l'entrée de liste de l'utilisateur (juste avant d'écrire, pour une donnée fraîche). */
export async function getMediaListInfo(mediaId: number): Promise<MediaListInfo> {
  const { Media } = await anilistQuery(MEDIA_ENTRY_QUERY, isMediaEntryData, { id: mediaId });
  const title = isRecord(Media.title) && typeof Media.title.userPreferred === 'string' ? Media.title.userPreferred : `#${mediaId}`;
  return {
    mediaId,
    title,
    episodes: typeof Media.episodes === 'number' ? Media.episodes : null,
    entry: parseEntry(Media.mediaListEntry),
  };
}

export async function saveProgress(mediaId: number, progress: number, status: ListStatus): Promise<ListEntryState> {
  const data = await anilistQuery(SAVE_PROGRESS_MUTATION, isSaveProgressData, { mediaId, progress, status });
  const entry = parseEntry(data.SaveMediaListEntry);
  if (!entry) throw new AniListApiError('INVALID_RESPONSE', 'Réponse d’AniList inattendue après la mise à jour.');
  return entry;
}
