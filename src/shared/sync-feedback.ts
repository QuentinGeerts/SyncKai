import type { ServiceOutcome, ServiceResult, SyncOutcome } from './sync.types';
import { TRACKER_LABELS } from './tracker.types';

export type FeedbackTone = 'info' | 'success' | 'warning' | 'error';

export interface SyncFeedback {
  tone: FeedbackTone;
  title: string;
  message?: string;
}

/** "AniList : épisode 5 enregistré" */
export function describeServiceOutcome(outcome: ServiceOutcome): string {
  switch (outcome.status) {
    case 'updated':
      return outcome.completed ? `épisode ${outcome.progress}, anime terminé` : `épisode ${outcome.progress} enregistré`;
    case 'up-to-date':
      return `déjà à jour (épisode ${outcome.progress})`;
    case 'skipped':
      return outcome.reason.charAt(0).toLowerCase() + outcome.reason.slice(1);
    case 'error':
      return `échec : ${outcome.message}`;
  }
}

/** Ton global : une erreur l'emporte, puis un service ignoré, sinon succès */
function toneOf(results: ServiceResult[]): FeedbackTone {
  if (results.some((r) => r.outcome.status === 'error')) return 'error';
  if (results.some((r) => r.outcome.status === 'skipped')) return 'warning';
  return 'success';
}

/** Texte affiché pour un résultat de synchronisation (toast de la page et popup). */
export function describeOutcome(outcome: SyncOutcome): SyncFeedback {
  switch (outcome.status) {
    case 'synced': {
      const isCompleted = outcome.results.some((r) => r.outcome.status === 'updated' && r.outcome.completed);
      return {
        tone: toneOf(outcome.results),
        title: isCompleted ? `${outcome.mediaTitle} terminé !` : outcome.mediaTitle,
        message:
          outcome.results.map((r) => `${TRACKER_LABELS[r.service]} : ${describeServiceOutcome(r.outcome)}`).join(' · ') +
          (outcome.queued ? '. Nouvel essai automatique bientôt.' : ''),
      };
    }
    case 'needs-review':
      return {
        tone: 'warning',
        title: 'À vérifier dans SyncKai',
        message: `${outcome.reason}. Clique sur l’icône SyncKai pour choisir la fiche.`,
      };
    case 'not-connected':
      return { tone: 'warning', title: 'Aucun compte connecté', message: 'Clique sur l’icône SyncKai pour connecter AniList ou MyAnimeList.' };
    case 'excluded':
      return { tone: 'info', title: outcome.mediaTitle, message: 'Série exclue de la synchronisation.' };
    case 'error':
      return {
        tone: 'error',
        title: 'Échec de la synchronisation',
        message: outcome.queued ? `${outcome.message} Nouvel essai automatique bientôt.` : outcome.message,
      };
  }
}
