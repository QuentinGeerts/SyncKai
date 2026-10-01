import type { NotificationLevel } from '../../shared/settings';
import { describeOutcome, describeServiceOutcome } from '../../shared/sync-feedback';
import type { ServiceOutcome, SyncOutcome } from '../../shared/sync.types';
import { TRACKER_LABELS } from '../../shared/tracker.types';
import { decideNotification } from './notification-policy';
import type { ToastContent, ToastLine, ToastLineTone, ToastVariant } from './toast';

export const PILL_TOAST_MS = 3_000;
export const SUCCESS_TOAST_MS = 5_000;
export const ALERT_TOAST_MS = 9_000;
/** Toast d'erreur avec "Réessayer" : laissé plus longtemps pour avoir le temps de cliquer */
export const RETRY_TOAST_MS = 15_000;

export interface OutcomeToast {
  content: ToastContent;
  variant: ToastVariant;
  autoHideMs: number;
}

const LINE_TONES: Record<ServiceOutcome['status'], ToastLineTone> = {
  updated: 'ok',
  'up-to-date': 'neutral',
  skipped: 'warning',
  error: 'error',
};

/** Une ligne par service : "AniList · épisode 2 enregistré" */
function serviceLines(outcome: SyncOutcome): ToastLine[] | undefined {
  if (outcome.status !== 'synced') return undefined;
  return outcome.results.map((r) => ({
    label: TRACKER_LABELS[r.service],
    text: describeServiceOutcome(r.outcome),
    tone: LINE_TONES[r.outcome.status],
  }));
}

/** Pastille compacte : "Ép. 2 enregistré · Tougen Anki" (premier service réellement mis à jour) */
export function pillForOutcome(outcome: SyncOutcome): ToastContent {
  if (outcome.status !== 'synced') return { ...describeOutcome(outcome) };
  const updated = outcome.results.find((r) => r.outcome.status === 'updated')?.outcome;
  if (updated?.status === 'updated') {
    return { tone: 'success', title: `Ép. ${updated.progress} enregistré`, message: outcome.mediaTitle };
  }
  // Aucun service modifié (tout déjà à jour) : on le dit sans inventer d'écriture
  const upToDate = outcome.results.find((r) => r.outcome.status === 'up-to-date')?.outcome;
  const title = upToDate?.status === 'up-to-date' ? `Ép. ${upToDate.progress} déjà à jour` : 'Déjà à jour';
  return { tone: 'success', title, message: outcome.mediaTitle };
}

/** Bulle complète : titre + détail par service (ou message pour les autres statuts) */
export function bubbleForOutcome(outcome: SyncOutcome): ToastContent {
  const feedback = describeOutcome(outcome);
  const lines = serviceLines(outcome);
  return lines ? { tone: feedback.tone, title: feedback.title, lines } : { ...feedback };
}

/**
 * Traduit le résultat d'une synchronisation en toast selon le niveau de notification.
 * `null` : rien à afficher (succès en mode "alertes seulement", ou discret en plein écran).
 */
export function toastForOutcome(outcome: SyncOutcome, level: NotificationLevel, isFullscreen: boolean): OutcomeToast | null {
  const tone = describeOutcome(outcome).tone;
  const display = decideNotification(level, tone, isFullscreen);
  switch (display) {
    case 'none':
      return null;
    case 'pill':
      return { content: pillForOutcome(outcome), variant: 'pill', autoHideMs: PILL_TOAST_MS };
    case 'bubble':
      return { content: bubbleForOutcome(outcome), variant: 'bubble', autoHideMs: tone === 'success' ? SUCCESS_TOAST_MS : ALERT_TOAST_MS };
  }
}
