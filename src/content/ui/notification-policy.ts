import type { FeedbackTone } from '../../shared/sync-feedback';
import type { MediaRef } from '../../shared/engagement.types';
import type { NotificationLevel } from '../../shared/settings';
import type { SyncOutcome } from '../../shared/sync.types';

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

/**
 * Série exclue par l'utilisateur : information, pas un succès ni une alerte.
 * Bulle uniquement en mode détaillé ; rien en discret ni en « alertes seulement ».
 */
export function decideExcludedNotification(level: NotificationLevel): NotificationDisplay {
  return level === 'detailed' ? 'bubble' : 'none';
}

/** Demande affichée sur la page après une synchro (note de fin de série ou revisionnage) */
export type EngagementPrompt = { kind: 'rate'; media: MediaRef } | { kind: 'rewatch'; media: MediaRef; progress: number };

/**
 * Demande à afficher pour un résultat de synchro : une seule à la fois (la note d'abord).
 * Affichée à tous les niveaux de notification et en plein écran : elle attend une réponse.
 */
export function promptForOutcome(outcome: SyncOutcome): EngagementPrompt | null {
  if (outcome.status !== 'synced' || !outcome.prompts) return null;
  const { rate, rewatch } = outcome.prompts;
  if (rate) return { kind: 'rate', media: toMediaRef(rate) };
  if (rewatch) return { kind: 'rewatch', media: toMediaRef(rewatch), progress: rewatch.progress };
  return null;
}

/** Copie limitée aux champs de MediaRef (le payload renvoyé au service worker reste minimal) */
function toMediaRef({ mediaId, malId, title }: MediaRef): MediaRef {
  return { mediaId, malId, title };
}
