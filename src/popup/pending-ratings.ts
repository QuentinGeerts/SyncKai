import { isMediaRef, type PendingRating } from '../shared/engagement.types';

// Lecture directe des cartes « À noter » (écrites par le service worker sous `pendingRatings`)

export const PENDING_RATINGS_KEY = 'pendingRatings';

export function isPendingRating(value: unknown): value is PendingRating {
  if (!isMediaRef(value)) return false;
  const v: Record<string, unknown> = { ...value };
  return (
    typeof v.id === 'string' &&
    v.id.length > 0 &&
    v.id.length <= 200 &&
    (v.coverUrl === null || (typeof v.coverUrl === 'string' && /^https:\/\//.test(v.coverUrl))) &&
    typeof v.completedAt === 'number' &&
    Number.isFinite(v.completedAt)
  );
}

/** Entrées valides, de la plus récente à la plus ancienne (une entrée corrompue est ignorée) */
export function parsePendingRatings(raw: unknown): PendingRating[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isPendingRating).sort((a, b) => b.completedAt - a.completedAt);
}

export async function getPendingRatings(): Promise<PendingRating[]> {
  const stored = await chrome.storage.local.get(PENDING_RATINGS_KEY);
  return parsePendingRatings(stored[PENDING_RATINGS_KEY]);
}

/** « Ignorer » : retire la carte sans passer par le service worker */
export async function removePendingRating(id: string): Promise<void> {
  const stored = await chrome.storage.local.get(PENDING_RATINGS_KEY);
  const raw: unknown = stored[PENDING_RATINGS_KEY];
  if (!Array.isArray(raw)) return;
  // Filtrage sur le tableau brut : les entrées que ce popup ne sait pas lire ne sont pas effacées
  const next = raw.filter((item: unknown) => !(isPendingRating(item) && item.id === id));
  await chrome.storage.local.set({ [PENDING_RATINGS_KEY]: next });
}
