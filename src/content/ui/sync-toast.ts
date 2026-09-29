import { describeOutcome } from '../../shared/sync-feedback';
import type { SyncOutcome } from '../../shared/sync.types';
import type { ToastContent } from './toast';

export const SUCCESS_TOAST_MS = 5_000;
export const ALERT_TOAST_MS = 9_000;

/** Traduit le résultat d'une synchronisation en contenu de toast + durée d'affichage. */
export function toastForOutcome(outcome: SyncOutcome): { content: ToastContent; autoHideMs: number } {
  const content = describeOutcome(outcome);
  return { content, autoHideMs: content.tone === 'success' ? SUCCESS_TOAST_MS : ALERT_TOAST_MS };
}
