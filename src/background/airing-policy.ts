// Règles pures des alertes de sortie d'épisodes (testées sans chrome.*).

const HOUR_S = 3600;

/** Rattrapage maximal après une longue période sans vérification (navigateur fermé) */
export const MAX_LOOKBACK_S = 24 * HOUR_S;
/** Fenêtre par défaut au premier passage */
export const FIRST_RUN_LOOKBACK_S = 2 * HOUR_S;
/** Taille maximale de l'ensemble des sorties déjà notifiées */
export const MAX_NOTIFIED = 200;
/** Au-delà, les sorties sont regroupées en une seule notification */
export const GROUP_THRESHOLD = 3;
/** Taille d'un lot d'identifiants par requête (perPage AniList) */
export const MEDIA_CHUNK = 50;

/** Sortie renvoyée par AniList (airingSchedules) */
export interface AiringItem {
  scheduleId: number;
  mediaId: number;
  episode: number;
  /** UNIX secondes */
  airingAt: number;
  title: string;
  coverUrl: string | null;
}

export interface AiringWindow {
  /** UNIX secondes (exclu) */
  from: number;
  /** UNIX secondes (exclu) */
  to: number;
}

/**
 * Fenêtre de recherche : depuis la dernière vérification (2 h au premier passage, 24 h au plus),
 * décalée du délai choisi pour ne notifier qu'une fois le délai écoulé après la diffusion.
 */
export function computeWindow(nowS: number, lastCheckS: number | null, delayHours: number): AiringWindow {
  const delay = delayHours * HOUR_S;
  const start = lastCheckS === null ? nowS - FIRST_RUN_LOOKBACK_S : Math.min(nowS, Math.max(lastCheckS, nowS - MAX_LOOKBACK_S));
  return { from: start - delay, to: nowS - delay };
}

/** Découpe une liste en lots de `size` éléments. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** Ne garde que les sorties non notifiées et au-delà de la progression de l'utilisateur (sans doublon). */
export function filterNewEpisodes(
  items: readonly AiringItem[],
  progressByMedia: ReadonlyMap<number, number>,
  notified: readonly number[],
): AiringItem[] {
  const seen = new Set(notified);
  const result: AiringItem[] = [];
  for (const item of items) {
    const progress = progressByMedia.get(item.mediaId);
    if (progress === undefined || item.episode <= progress || seen.has(item.scheduleId)) continue;
    seen.add(item.scheduleId);
    result.push(item);
  }
  return result;
}

/** Ajoute les nouvelles sorties notifiées et ne garde que les `max` plus récentes. */
export function trimNotified(previous: readonly number[], added: readonly number[], max: number = MAX_NOTIFIED): number[] {
  const merged = [...previous.filter((id) => !added.includes(id)), ...added];
  return merged.slice(Math.max(0, merged.length - max));
}

export interface PlannedNotification {
  id: string;
  title: string;
  message: string;
  /** Séries ouvertes par un clic (la première pour un résumé) */
  mediaIds: number[];
}

export const AIRING_NOTIFICATION_PREFIX = 'synckai-airing:';
export const AIRING_MESSAGE = 'Diffusé au Japon · arrive généralement sur Crunchyroll/ADN dans les heures qui suivent';

/** Une notification par sortie, ou un résumé unique au-delà de GROUP_THRESHOLD. */
export function planNotifications(items: readonly AiringItem[]): PlannedNotification[] {
  if (items.length === 0) return [];
  if (items.length <= GROUP_THRESHOLD) {
    return items.map((item) => ({
      id: `${AIRING_NOTIFICATION_PREFIX}${item.scheduleId}`,
      title: `Ép. ${item.episode} de ${item.title} est sorti`,
      message: AIRING_MESSAGE,
      mediaIds: [item.mediaId],
    }));
  }
  const titles = [...new Set(items.map((item) => item.title))];
  return [
    {
      id: `${AIRING_NOTIFICATION_PREFIX}group:${Math.max(...items.map((item) => item.scheduleId))}`,
      title: `${items.length} nouveaux épisodes : ${titles.join(', ')}`,
      message: AIRING_MESSAGE,
      mediaIds: [...new Set(items.map((item) => item.mediaId))],
    },
  ];
}
