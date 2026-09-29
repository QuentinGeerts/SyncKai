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

/** 1344 → "22:24" */
export function formatTimecode(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
