/** Attente maximale acceptée avant une nouvelle tentative (au-delà : échec immédiat, affiché à l'utilisateur) */
export const MAX_RETRY_WAIT_MS = 20_000;
/** Délai par défaut si AniList ne précise pas quand réessayer */
const DEFAULT_RETRY_WAIT_MS = 5_000;

/**
 * Délai à respecter après une réponse 429, d'après l'en-tête `Retry-After`
 * (secondes ou date HTTP). Retourne null si l'attente dépasse `MAX_RETRY_WAIT_MS`.
 */
export function retryDelayMs(retryAfter: string | null, now: number = Date.now()): number | null {
  let delay = DEFAULT_RETRY_WAIT_MS;
  if (retryAfter !== null && retryAfter.trim() !== '') {
    const seconds = Number(retryAfter);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(seconds)) delay = seconds * 1000;
    else if (Number.isFinite(date)) delay = date - now;
  }
  delay = Math.max(0, delay);
  return delay <= MAX_RETRY_WAIT_MS ? delay : null;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
