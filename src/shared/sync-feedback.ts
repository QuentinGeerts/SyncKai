import type { SyncOutcome } from './sync.types';

export type FeedbackTone = 'info' | 'success' | 'warning' | 'error';

export interface SyncFeedback {
  tone: FeedbackTone;
  title: string;
  message?: string;
}

/** Texte affiché pour un résultat de synchronisation (toast de la page et popup). */
export function describeOutcome(outcome: SyncOutcome): SyncFeedback {
  switch (outcome.status) {
    case 'updated':
      return outcome.completed
        ? { tone: 'success', title: `${outcome.mediaTitle} terminé !`, message: `Épisode ${outcome.progress} enregistré, anime marqué comme terminé.` }
        : { tone: 'success', title: outcome.mediaTitle, message: `Épisode ${outcome.progress} enregistré sur AniList.` };
    case 'up-to-date':
      return { tone: 'success', title: outcome.mediaTitle, message: `Déjà à jour (épisode ${outcome.progress}).` };
    case 'skipped':
      return { tone: 'warning', title: outcome.mediaTitle, message: outcome.reason };
    case 'needs-review':
      return {
        tone: 'warning',
        title: 'À vérifier dans SyncKai',
        message: `${outcome.reason}. Clique sur l’icône SyncKai pour choisir la fiche AniList.`,
      };
    case 'not-connected':
      return { tone: 'warning', title: 'Non connecté à AniList', message: 'Clique sur l’icône SyncKai pour te connecter.' };
    case 'error':
      return { tone: 'error', title: 'Échec de la synchronisation', message: outcome.message };
  }
}
