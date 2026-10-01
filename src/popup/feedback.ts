import { describeOutcome, type FeedbackTone } from '../shared/sync-feedback';
import type { SyncOutcome } from '../shared/sync.types';
import { TRACKER_LABELS } from '../shared/tracker.types';
import type { InlineFeedback } from './state';

/** Pastilles de retour (bordure + fond teinté), partagées par « En cours » et « Activité » */
export const TONE_CHIP: Record<FeedbackTone, string> = {
  success: 'border-mint/40 bg-mint/10 text-mint',
  info: 'border-lavender/40 bg-lavender/10 text-lavender',
  warning: 'border-butter/40 bg-butter/10 text-butter',
  error: 'border-danger/40 bg-danger/10 text-danger',
};

function detailOf(outcome: SyncOutcome): string {
  const { title, message } = describeOutcome(outcome);
  return message ? `${title} — ${message}` : title;
}

/** Texte court d'un résultat de +1 / −1 (« Ép. 5 vu »), le détail complet passant en infobulle */
export function adjustFeedback(outcome: SyncOutcome, delta: 1 | -1): InlineFeedback {
  const detail = detailOf(outcome);
  switch (outcome.status) {
    case 'synced': {
      const written = outcome.results.flatMap((r) => (r.outcome.status === 'updated' || r.outcome.status === 'up-to-date' ? [r.outcome.progress] : []));
      const failed = outcome.results.filter((r) => r.outcome.status === 'error').map((r) => TRACKER_LABELS[r.service]);
      const progress = written[0];
      if (progress === undefined) {
        return { tone: failed.length > 0 ? 'error' : 'warning', text: failed.length > 0 ? 'Échec de la mise à jour' : 'Rien n’a été modifié', detail };
      }
      const text = delta === 1 ? `Ép. ${progress} vu` : `Retour à l’ép. ${progress}`;
      // Succès partiel : le service en échec est nommé (relance automatique éventuelle dans le détail)
      if (failed.length > 0) return { tone: 'warning', text: `${text} · échec ${failed.join(', ')}`, detail };
      return { tone: 'success', text, detail };
    }
    case 'excluded':
      return { tone: 'info', text: 'Série exclue', detail };
    case 'not-connected':
      return { tone: 'warning', text: 'Aucun compte connecté', detail };
    case 'needs-review':
      return { tone: 'warning', text: 'À vérifier', detail };
    case 'error':
      return { tone: 'error', text: outcome.message, detail };
  }
}

/** Résultat d'un « Réessayer » de la file : phrase complète (affichée en bandeau) */
export function retryFeedback(outcome: SyncOutcome): InlineFeedback {
  const { tone, title, message } = describeOutcome(outcome);
  return { tone, text: message ? `${title} : ${message}` : title, detail: detailOf(outcome) };
}

export function errorFeedback(text: string): InlineFeedback {
  return { tone: 'error', text, detail: text };
}
