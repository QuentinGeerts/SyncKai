import type { FeedbackTone } from '../../shared/sync-feedback';
import type { NotificationLevel } from '../../shared/settings';

/** Forme de la notification sur la page : rien, pastille compacte ou bulle complète */
export type NotificationDisplay = 'none' | 'pill' | 'bubble';

/** Vrai si le résultat demande une action de l'utilisateur (toujours affiché, même en plein écran) */
export function isAlertTone(tone: FeedbackTone): boolean {
  return tone === 'warning' || tone === 'error';
}

/** Toast "Synchronisation…" affiché pendant l'envoi : uniquement en mode détaillé */
export function showsProgress(level: NotificationLevel): boolean {
  return level === 'detailed';
}

/**
 * Décide comment afficher un résultat de synchronisation.
 * Les alertes passent toujours en bulle ; un succès dépend du niveau choisi dans les options.
 */
export function decideNotification(level: NotificationLevel, tone: FeedbackTone, isFullscreen: boolean): NotificationDisplay {
  if (isAlertTone(tone)) return 'bubble';
  switch (level) {
    case 'detailed':
      return 'bubble';
    case 'discreet':
      // En plein écran, la coche sur l'icône de l'extension suffit : on ne masque pas la vidéo
      return isFullscreen ? 'none' : 'pill';
    case 'alerts-only':
      return 'none';
  }
}
