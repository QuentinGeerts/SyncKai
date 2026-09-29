import { isViewerQueryData, type AniListViewer, type ViewerResult } from '../../shared/anilist.types';
import { saveCachedViewer } from '../../shared/storage';
import { AniListApiError, anilistQuery } from './client';

const VIEWER_QUERY = /* GraphQL */ `
  query Viewer {
    Viewer {
      id
      name
      siteUrl
      avatar { medium }
    }
  }
`;

/** N'accepte que des URLs https (optionnellement restreintes à un domaine) venant de l'API. */
function toSafeUrl(value: string | null | undefined, allowedHost?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    if (allowedHost && url.hostname !== allowedHost) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Récupère le profil de l'utilisateur connecté et le met en cache. */
export async function getViewer(): Promise<ViewerResult> {
  try {
    const { Viewer } = await anilistQuery(VIEWER_QUERY, isViewerQueryData);
    const viewer: AniListViewer = {
      id: Viewer.id,
      name: Viewer.name,
      siteUrl: toSafeUrl(Viewer.siteUrl, 'anilist.co') ?? `https://anilist.co/user/${Viewer.id}`,
      avatarUrl: toSafeUrl(Viewer.avatar?.medium),
    };
    await saveCachedViewer(viewer);
    return { ok: true, data: viewer };
  } catch (error: unknown) {
    if (error instanceof AniListApiError) {
      return { ok: false, code: error.code, message: error.message };
    }
    console.error('[SyncKai] Erreur inattendue (getViewer) :', error);
    return { ok: false, code: 'API_ERROR', message: 'Erreur inattendue lors du chargement du profil.' };
  }
}
