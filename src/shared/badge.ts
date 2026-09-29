import { getPendingReviews } from './storage';

const BADGE_COLOR = '#f59e0b'; // amber-500, cohérent avec les alertes "à vérifier"

/** Affiche le nombre d'épisodes à vérifier sur l'icône de l'extension (vide si aucun). */
export async function refreshReviewBadge(): Promise<void> {
  const count = (await getPendingReviews()).length;
  await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  if (count > 0) await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
}
