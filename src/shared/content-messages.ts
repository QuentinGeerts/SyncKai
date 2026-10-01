import { isRecord } from './guards';

/**
 * Messages envoyés par le service worker AU content script d'un onglet (chrome.tabs.sendMessage).
 * FORCE_COMPLETE : raccourci clavier « valider l'épisode en cours » → synchronise tout de suite.
 */
export type ContentMessage = { type: 'FORCE_COMPLETE' };

export function isContentMessage(value: unknown): value is ContentMessage {
  return isRecord(value) && value.type === 'FORCE_COMPLETE';
}
