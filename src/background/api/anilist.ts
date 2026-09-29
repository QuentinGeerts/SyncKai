import {
  isViewerQueryData,
  type AniListViewer,
  type ViewerErrorCode,
  type ViewerResult,
} from '../../shared/anilist.types';
import { isRecord } from '../../shared/guards';
import { clearAniListSession, getValidToken, saveCachedViewer } from '../../shared/storage';

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';

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

class AniListApiError extends Error {
  readonly code: ViewerErrorCode;

  constructor(code: ViewerErrorCode, message: string) {
    super(message);
    this.name = 'AniListApiError';
    this.code = code;
  }
}

/**
 * Exécute une requête GraphQL authentifiée et valide le champ `data` avec `isData`.
 * Lève une AniListApiError typée en cas d'échec.
 */
async function anilistQuery<T>(
  query: string,
  isData: (data: unknown) => data is T,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const token = await getValidToken();
  if (!token) throw new AniListApiError('NOT_AUTHENTICATED', 'Non connecté à AniList.');

  let response: Response;
  try {
    response = await fetch(ANILIST_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token.accessToken}`,
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new AniListApiError('NETWORK', 'AniList est injoignable. Vérifie ta connexion.');
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Corps non JSON (page d'erreur proxy…) : traité plus bas via le statut HTTP
  }

  const errors: unknown[] = isRecord(body) && Array.isArray(body.errors) ? body.errors : [];

  // AniList répond souvent 400 + "Invalid token" (et pas 401) pour un token révoqué
  const isTokenInvalid =
    response.status === 401 ||
    errors.some((e) => isRecord(e) && typeof e.message === 'string' && /invalid token/i.test(e.message));
  if (isTokenInvalid) {
    await clearAniListSession();
    throw new AniListApiError('TOKEN_INVALID', 'Session AniList expirée. Reconnecte-toi.');
  }

  if (response.status === 429) {
    throw new AniListApiError('RATE_LIMITED', 'Trop de requêtes vers AniList. Réessaie dans une minute.');
  }

  if (!response.ok || errors.length > 0) {
    console.error('[SyncKai] Erreur API AniList :', response.status, errors);
    throw new AniListApiError('API_ERROR', `Erreur AniList (${response.status}).`);
  }

  const data: unknown = isRecord(body) ? body.data : undefined;
  if (!isData(data)) {
    console.error('[SyncKai] Réponse AniList inattendue :', body);
    throw new AniListApiError('INVALID_RESPONSE', 'Réponse d’AniList inattendue.');
  }
  return data;
}

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
