export interface CompletionPoint {
  /** Position (s) à partir de laquelle l'épisode est considéré comme vu */
  seconds: number;
  source: 'credits' | 'ratio';
}

/** En dessous, un "générique" est suspect (générique d'ouverture mal étiqueté, données erronées) */
const MIN_CREDITS_RATIO = 0.5;

/**
 * Point de complétion d'un épisode : début du générique de fin s'il est connu et plausible,
 * sinon un pourcentage fixe de la durée.
 */
export function resolveCompletionPoint(duration: number, creditsStart: number | null, fallbackRatio: number): CompletionPoint {
  const isPlausible =
    creditsStart !== null && Number.isFinite(creditsStart) && creditsStart >= duration * MIN_CREDITS_RATIO && creditsStart < duration;
  return isPlausible ? { seconds: creditsStart, source: 'credits' } : { seconds: duration * fallbackRatio, source: 'ratio' };
}

/**
 * Garde-fou contre les fausses complétions : après une navigation SPA, le tracker du nouvel épisode
 * reçoit encore quelques ticks de l'ancienne source (déjà au-delà du point de fin).
 * On n'accepte donc la complétion que si la lecture a été vue avant le point de fin,
 * ou si le lecteur a chargé une nouvelle source depuis le début du suivi.
 */
export function canComplete(currentTime: number, pointSeconds: number, seenBeforePoint: boolean, hasFreshSource: boolean): boolean {
  return currentTime >= pointSeconds && (seenBeforePoint || hasFreshSource);
}

/** 1344 → "22:24" */
export function formatTimecode(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
