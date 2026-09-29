import { isAniListViewer, type AniListViewer } from './anilist.types';
import { isAniListToken, type AniListToken } from './auth.types';
import { isRecord } from './guards';
import { isMediaMapping, type MediaMapping } from './sync.types';

/** Clés utilisées dans chrome.storage.local */
export const STORAGE_KEYS = {
  anilistToken: 'anilistToken',
  anilistViewer: 'anilistViewer',
  mediaMappings: 'mediaMappings',
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
async function getMediaMappings(): Promise<Record<string, MediaMapping>> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.mediaMappings);
  const raw: unknown = stored[STORAGE_KEYS.mediaMappings];
  if (!isRecord(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, MediaMapping] => isMediaMapping(entry[1])));
}

export async function getMediaMapping(key: string): Promise<MediaMapping | null> {
  return (await getMediaMappings())[key] ?? null;
}

export async function saveMediaMapping(key: string, mapping: MediaMapping): Promise<void> {
  const mappings = await getMediaMappings();
  await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: { ...mappings, [key]: mapping } });
}

export async function deleteMediaMapping(key: string): Promise<void> {
  const { [key]: _removed, ...rest } = await getMediaMappings();
  await chrome.storage.local.set({ [STORAGE_KEYS.mediaMappings]: rest });
}

/** Supprime toutes les données de session AniList (token + profil en cache). */
export async function clearAniListSession(): Promise<void> {
  await chrome.storage.local.remove([STORAGE_KEYS.anilistToken, STORAGE_KEYS.anilistViewer]);
}
