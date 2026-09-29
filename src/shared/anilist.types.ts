import { isRecord } from './guards';
import type { Result } from './result';

/** Profil AniList normalisé, tel que consommé par le popup (et mis en cache). */
export interface AniListViewer {
  id: number;
  name: string;
  siteUrl: string;
  avatarUrl: string | null;
}

export function isAniListViewer(value: unknown): value is AniListViewer {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.name === 'string' &&
    typeof value.siteUrl === 'string' &&
    (value.avatarUrl === null || typeof value.avatarUrl === 'string')
  );
}

export type ViewerErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'TOKEN_INVALID'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'API_ERROR'
  | 'INVALID_RESPONSE';

export type ViewerResult = Result<AniListViewer, ViewerErrorCode>;

/** Champ `data` brut de la requête GraphQL `Viewer`. */
export interface ViewerQueryData {
  Viewer: {
    id: number;
    name: string;
    siteUrl: string;
    avatar?: { medium: string | null } | null;
  };
}

export function isViewerQueryData(value: unknown): value is ViewerQueryData {
  if (!isRecord(value) || !isRecord(value.Viewer)) return false;
  const { id, name, siteUrl, avatar } = value.Viewer;
  const isAvatarValid =
    avatar === undefined ||
    avatar === null ||
    (isRecord(avatar) && (avatar.medium === null || typeof avatar.medium === 'string'));
  return typeof id === 'number' && typeof name === 'string' && typeof siteUrl === 'string' && isAvatarValid;
}
