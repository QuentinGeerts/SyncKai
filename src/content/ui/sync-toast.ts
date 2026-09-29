import type { SyncOutcome } from '../../shared/sync.types';
import type { ToastContent } from './toast';

export const SUCCESS_TOAST_MS = 5_000;
export const ALERT_TOAST_MS = 9_000;

/** Traduit le résultat d'une synchronisation en contenu de toast + durée d'affichage. */
export function toastForOutcome(outcome: SyncOutcome): { content: ToastContent; autoHideMs: number } {
  switch (outcome.status) {
    case 'updated':
      return {
        content: outcome.completed
          ? { tone: 'success', title: `${outcome.mediaTitle} terminé !`, message: `Épisode ${outcome.progress} enregistré, anime marqué comme terminé.` }
          : { tone: 'success', title: outcome.mediaTitle, message: `Épisode ${outcome.progress} enregistré sur AniList.` },
        autoHideMs: SUCCESS_TOAST_MS,
      };
    case 'up-to-date':
      return {
        content: { tone: 'success', title: outcome.mediaTitle, message: `Déjà à jour (épisode ${outcome.progress}).` },
        autoHideMs: SUCCESS_TOAST_MS,
      };
    case 'skipped':
      return { content: { tone: 'warning', title: outcome.mediaTitle, message: outcome.reason }, autoHideMs: ALERT_TOAST_MS };
    case 'needs-review':
      return {
        content: { tone: 'warning', title: 'Correspondance AniList incertaine', message: `${outcome.reason}. Épisode non synchronisé.` },
        autoHideMs: ALERT_TOAST_MS,
      };
    case 'not-connected':
      return {
        content: { tone: 'warning', title: 'Non connecté à AniList', message: 'Clique sur l’icône SyncKai pour te connecter.' },
        autoHideMs: ALERT_TOAST_MS,
      };
    case 'error':
      return { content: { tone: 'error', title: 'Échec de la synchronisation', message: outcome.message }, autoHideMs: ALERT_TOAST_MS };
  }
}
