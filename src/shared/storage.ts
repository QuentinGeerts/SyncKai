import { isAniListViewer, type AniListViewer } from './anilist.types';
import { isAniListToken, type AniListToken } from './auth.types';
import { isRecord } from './guards';
import { isMalToken, isMalViewer, type MalToken, type MalViewer } from './mal.types';
import { isPendingReview, isRecentSync, type PendingReview, type RecentSync } from './review.types';
import { isMediaMapping, type MediaMapping } from './sync.types';

const MAX_PENDING_REVIEWS = 20;
const MAX_RECENT_SYNCS = 5;
const STORAGE_LOCK = 'synckai:storage';

/**
 * Sérialise les lectures-modifications-écritures du stockage. Le popup, la page d'options et le
 * service worker partagent l'origine chrome-extension:// : le même verrou Web Locks les coordonne,
 * ce qui évite qu'une écriture en écrase une autre (ex : "Ignorer" pendant une synchro).
 */
function withStorageLock<T>(task: () => Promise<T>): Promise<T> {
  return navigator.locks.request(STORAGE_LOCK, task);
}

/** Clés utilisées dans chrome.storage.local */
export const STORAGE_KEYS = {
  anilistToken: 'anilistToken',
  anilistViewer: 'anilistViewer',
  mediaMappings: 'mediaMappings',
  pendingReviews: 'pendingReviews',
  recentSyncs: 'recentSyncs',
  malToken: 'malToken',
  malViewer: 'malViewer',
} as const;

/** Retourne le token AniList s'il existe et n'a pas expiré. */
export async function getValidToken(): Promise<AniListToken | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.anilistToken);
  const token: unknown = stored[STORAGE_KEYS.anilistToken];
  return isAniListToken(token) && token.expiresAt > Date.now() ? token : null;
}

export async function saveToken(token: AniListToken): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.anilistToken]: token });
}

export async function getCachedViewer(): Promise<AniListViewer | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.anilistViewer);
  const viewer: unknown = stored[STORAGE_KEYS.anilistViewer];
  return isAniListViewer(viewer) ? viewer : null;
}

export async function saveCachedViewer(viewer: AniListViewer): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.anilistViewer]: viewer });
}

// Les correspondances ne dépendent pas de l'utilisateur (mediaId global) : conservées à la déconnexion
export async function getMediaMappings(): Promise<Record<string, MediaMapping>> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.mediaMappings);
  const raw: unknown = stored[STORAGE_KEYS.mediaMappings];
  if (!isRecord(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, MediaMapping] => isMediaMapping(entry[1])));
}

export async function getMediaMapping(key: string): Promise<MediaMapping | null> {
  return (await getMediaMappings())[key] ?? null;
}

export function saveMediaMapping(key: string, mapping: MediaMapping): Promise<void> {
  return withStorageLock(async () => {
    const mappings = await getMediaMappings();
    await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: { ...mappings, [key]: mapping } });
  });
}

export function deleteMediaMapping(key: string): Promise<void> {
  return withStorageLock(async () => {
    const { [key]: _removed, ...rest } = await getMediaMappings();
    await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: rest });
  });
}

export function clearMediaMappings(): Promise<void> {
  return withStorageLock(() => chrome.storage.local.remove(STORAGE_KEYS.mediaMappings));
}

// ─── Vérifications manuelles & dernières synchros (propres à l'utilisateur) ───

/** Cartes en attente, la plus récente en premier */
export async function getPendingReviews(): Promise<PendingReview[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.pendingReviews);
  const raw: unknown = stored[STORAGE_KEYS.pendingReviews];
  return (Array.isArray(raw) ? raw.filter(isPendingReview) : []).sort((a, b) => b.createdAt - a.createdAt);
}

/** Ajoute ou remplace la carte d'une saison (une seule par clé : le dernier épisode l'emporte). */
export function savePendingReview(review: PendingReview): Promise<void> {
  return withStorageLock(async () => {
    const others = (await getPendingReviews()).filter((r) => r.key !== review.key);
    await chrome.storage.local.set({ [STORAGE_KEYS.pendingReviews]: [review, ...others].slice(0, MAX_PENDING_REVIEWS) });
  });
}

export function deletePendingReview(key: string): Promise<void> {
  return withStorageLock(async () => {
    const remaining = (await getPendingReviews()).filter((r) => r.key !== key);
    await chrome.storage.local.set({ [STORAGE_KEYS.pendingReviews]: remaining });
  });
}

/** Dernières synchros, la plus récente en premier */
export async function getRecentSyncs(): Promise<RecentSync[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.recentSyncs);
  const raw: unknown = stored[STORAGE_KEYS.recentSyncs];
  return (Array.isArray(raw) ? raw.filter(isRecentSync) : []).sort((a, b) => b.syncedAt - a.syncedAt);
}

/** Une entrée par saison : la synchro la plus récente remplace la précédente. */
export function addRecentSync(sync: RecentSync): Promise<void> {
  return withStorageLock(async () => {
    const others = (await getRecentSyncs()).filter((s) => s.key !== sync.key);
    await chrome.storage.local.set({ [STORAGE_KEYS.recentSyncs]: [sync, ...others].slice(0, MAX_RECENT_SYNCS) });
  });
}

/** Supprime les données de session AniList : token, profil, vérifications et synchros de l'utilisateur. */
export function clearAniListSession(): Promise<void> {
  return withStorageLock(() => chrome.storage.local.remove([STORAGE_KEYS.anilistToken, STORAGE_KEYS.anilistViewer]));
}

/**
 * Vérifications et dernières synchros : propres à l'utilisateur, effacées quand plus aucun
 * service de suivi n'est connecté (déconnexion du dernier compte).
 */
export function clearUserSyncData(): Promise<void> {
  return withStorageLock(() => chrome.storage.local.remove([STORAGE_KEYS.pendingReviews, STORAGE_KEYS.recentSyncs]));
}

// ─── Session MyAnimeList ──────────────────────────────────────────────────

/** Token MAL stocké, même expiré : le refresh token permet de le renouveler. */
export async function getMalToken(): Promise<MalToken | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.malToken);
  const token: unknown = stored[STORAGE_KEYS.malToken];
  return isMalToken(token) ? token : null;
}

export async function saveMalToken(token: MalToken): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.malToken]: token });
}

export async function getCachedMalViewer(): Promise<MalViewer | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.malViewer);
  const viewer: unknown = stored[STORAGE_KEYS.malViewer];
  return isMalViewer(viewer) ? viewer : null;
}

export async function saveCachedMalViewer(viewer: MalViewer): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.malViewer]: viewer });
}

export function clearMalSession(): Promise<void> {
  return withStorageLock(() => chrome.storage.local.remove([STORAGE_KEYS.malToken, STORAGE_KEYS.malViewer]));
}
