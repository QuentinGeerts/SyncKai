import { isViewerQueryData, type AniListViewer, type ViewerResult } from '../../shared/anilist.types';
import { saveCachedViewer } from '../../shared/storage';
import { toSafeUrl } from '../../shared/url';
import { anilistQuery } from './client';
import { ApiError } from './errors';

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
    if (error instanceof ApiError) {
      return { ok: false, code: error.code, message: error.message };
    }
    console.error('[SyncKai] Erreur inattendue (getViewer) :', error);
    return { ok: false, code: 'API_ERROR', message: 'Erreur inattendue lors du chargement du profil.' };
  }
}
