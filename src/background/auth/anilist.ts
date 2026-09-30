import type { AniListToken, AuthResult } from '../../shared/auth.types';
import { saveToken } from '../../shared/storage';

const ANILIST_CLIENT_ID = '52346';
const ANILIST_AUTHORIZE_URL = 'https://anilist.co/api/v2/oauth/authorize';

/**
 * Lance le flux OAuth2 Implicit Grant d'AniList et stocke le token obtenu.
 * Ne lève jamais : toute erreur est convertie en AuthResult.
 */
export async function loginWithAniList(): Promise<AuthResult> {
  const redirectUri = chrome.identity.getRedirectURL();
  const authUrl = new URL(ANILIST_AUTHORIZE_URL);
  authUrl.searchParams.set('client_id', ANILIST_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'token');
  // Pas de redirect_uri : AniList redirige vers l'URL enregistrée sur le client (= redirectUri),
  // ce qui évite un rejet sur une différence mineure (slash final…).

  let responseUrl: string | undefined;
  try {
    responseUrl = await chrome.identity.launchWebAuthFlow({ url: authUrl.toString(), interactive: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[SyncKai] launchWebAuthFlow a échoué :', message, '| redirect_uri :', redirectUri);

    // Seul ce message correspond à une fermeture volontaire de la fenêtre par l'utilisateur
    if (/did not approve/i.test(message)) {
      return { ok: false, code: 'USER_CANCELLED', message: 'Connexion annulée.' };
    }
    // Page d'auth en erreur (client_id invalide, redirect_uri non enregistrée chez AniList…)
    if (/could not be loaded/i.test(message)) {
      return {
        ok: false,
        code: 'AUTH_FLOW_FAILED',
        message: `AniList a rejeté la requête. Vérifie que la Redirect URL du client est : ${redirectUri}`,
      };
    }
    return { ok: false, code: 'AUTH_FLOW_FAILED', message: `Échec de l’authentification : ${message}` };
  }

  if (!responseUrl) {
    return { ok: false, code: 'INVALID_RESPONSE', message: 'Aucune réponse reçue d’AniList.' };
  }

  // Implicit Grant : le token est dans le fragment (#access_token=...&expires_in=...).
  // Une erreur (refus) peut arriver dans le fragment ou la query string.
  const url = new URL(responseUrl);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const error = fragment.get('error') ?? url.searchParams.get('error');
  if (error) {
    console.warn('[SyncKai] AniList a refusé l’accès :', error);
    return { ok: false, code: 'ACCESS_DENIED', message: 'Accès refusé par AniList.' };
  }

  const accessToken = fragment.get('access_token');
  const expiresIn = Number(fragment.get('expires_in'));
  if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    console.error('[SyncKai] Réponse OAuth invalide :', url.origin + url.pathname);
    return { ok: false, code: 'INVALID_RESPONSE', message: 'Réponse d’AniList invalide.' };
  }

  const token: AniListToken = { accessToken, expiresAt: Date.now() + expiresIn * 1000 };
  try {
    await saveToken(token);
  } catch (storageError: unknown) {
    console.error('[SyncKai] Échec de la sauvegarde du token :', storageError);
    return { ok: false, code: 'UNKNOWN', message: 'Impossible de sauvegarder la session.' };
  }

  return { ok: true, data: null };
}
