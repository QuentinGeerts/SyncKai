import { getMalViewer } from './api/mal';
import { getViewer } from './api/viewer';
import { getWatchingList } from './api/watching';
import { loginWithAniList } from './auth/anilist';
import { loginWithMal } from './auth/mal';
import { AIRING_ALARM, checkNewEpisodes, ensureAiringAlarm, handleNotificationButton, handleNotificationClick } from './airing';
import { adjustProgress, handleCommand } from './controls';
import { declineRewatch, deferRating, rateMedia, startRewatch } from './engagement';
import { ensureQueueAlarm, processSyncQueue, QUEUE_ALARM, recordSyncOutcome, retryQueued } from './sync/queue';
import { reopenReview, resolveReview, searchCandidates, syncEpisode } from './sync/sync-service';
import { refreshReviewBadge } from '../shared/badge';
import { SETTINGS_STORAGE_KEY } from '../shared/settings';
import { STORAGE_KEYS } from '../shared/storage';
import {
  EXTENSION_PAGE_ONLY,
  isRuntimeMessage,
  type MessagePayload,
  type MessageResponse,
  type MessageType,
  type RuntimeMessage,
} from '../shared/messages';

chrome.runtime.onInstalled.addListener((): void => {
  console.log('SyncKai installé et prêt');
  console.log('Redirect URL OAuth :', chrome.identity.getRedirectURL());
  void refreshReviewBadge();
});

// Le texte du badge n'est pas conservé au redémarrage du navigateur
chrome.runtime.onStartup.addListener((): void => {
  void refreshReviewBadge();
});

/** Réponse de secours par type de message si un handler lève une exception inattendue */
const UNEXPECTED_ERRORS: { [K in MessageType]: MessageResponse<K> } = {
  LOGIN_ANILIST: { ok: false, code: 'UNKNOWN', message: 'Erreur inattendue.' },
  GET_VIEWER: { ok: false, code: 'API_ERROR', message: 'Erreur inattendue.' },
  LOGIN_MAL: { ok: false, code: 'UNKNOWN', message: 'Erreur inattendue.' },
  GET_MAL_VIEWER: { ok: false, code: 'API_ERROR', message: 'Erreur inattendue.' },
  EPISODE_COMPLETED: { status: 'error', message: 'Erreur inattendue pendant la synchronisation.' },
  ADJUST_PROGRESS: { status: 'error', message: 'Erreur inattendue.' },
  RETRY_QUEUED: { status: 'error', message: 'Erreur inattendue.' },
  SEARCH_ANIME: { ok: false, code: 'API_ERROR', message: 'Erreur inattendue.' },
  RESOLVE_REVIEW: { status: 'error', message: 'Erreur inattendue pendant la synchronisation.' },
  REOPEN_REVIEW: { ok: false, code: 'API_ERROR', message: 'Erreur inattendue.' },
  GET_WATCHING: { ok: false, code: 'API_ERROR', message: 'Erreur inattendue.' },
  RATE_MEDIA: { status: 'error', message: 'Erreur inattendue pendant l’enregistrement de la note.' },
  DEFER_RATING: { ok: false, code: 'API_ERROR', message: 'Erreur inattendue.' },
  START_REWATCH: { status: 'error', message: 'Erreur inattendue pendant le démarrage du revisionnage.' },
  DECLINE_REWATCH: { ok: false, code: 'API_ERROR', message: 'Erreur inattendue.' },
  CHECK_AIRING: { checkedAt: 0, notified: 0, skipped: null, error: 'Erreur inattendue.' },
};

type MessageHandlers = {
  [K in MessageType]: (payload: MessagePayload<K>, sender: chrome.runtime.MessageSender) => Promise<MessageResponse<K>>;
};

const handlers: MessageHandlers = {
  LOGIN_ANILIST: async () => {
    const result = await loginWithAniList();
    // Précharge le profil : la popup, souvent fermée pendant l'OAuth, l'affichera instantanément
    if (result.ok) await getViewer();
    return result;
  },
  GET_VIEWER: () => getViewer(),
  LOGIN_MAL: async () => {
    const result = await loginWithMal();
    if (result.ok) await getMalViewer();
    return result;
  },
  GET_MAL_VIEWER: () => getMalViewer(),
  // Échec passager → mise en file de relance automatique (le résultat porte alors `queued: true`)
  EPISODE_COMPLETED: async ({ episode, services }) => recordSyncOutcome(episode, services, await syncEpisode(episode, services)),
  ADJUST_PROGRESS: (payload) => adjustProgress(payload),
  RETRY_QUEUED: ({ id }) => retryQueued(id),
  SEARCH_ANIME: ({ query }) => searchCandidates(query),
  RESOLVE_REVIEW: (payload) => resolveReview(payload),
  REOPEN_REVIEW: ({ key }) => reopenReview(key),
  GET_WATCHING: ({ service }) => getWatchingList(service),
  RATE_MEDIA: ({ media, score }) => rateMedia(media, score),
  DEFER_RATING: ({ media, coverUrl }) => deferRating(media, coverUrl),
  START_REWATCH: ({ media, progress }) => startRewatch(media, progress),
  DECLINE_REWATCH: ({ media }) => declineRewatch(media),
  // Vérification manuelle : (re)crée aussi l'alarme horaire si elle a disparu
  CHECK_AIRING: async () => {
    await ensureAiringAlarm();
    return checkNewEpisodes();
  },
};

// Générique pour conserver la corrélation type ↔ payload ↔ handler
function dispatch<K extends MessageType>(
  message: RuntimeMessage<K>,
  sender: chrome.runtime.MessageSender,
): Promise<MessageResponse<K>> {
  const handler: MessageHandlers[K] = handlers[message.type];
  return handler(message.payload, sender);
}

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse<MessageType>) => void,
  ): boolean => {
    // N'accepte que les messages provenant de l'extension elle-même (popup ou content scripts)
    if (sender.id !== chrome.runtime.id || !isRuntimeMessage(message)) return false;
    // Les actions sur le compte ne viennent que du popup : un content script (sender.tab) est refusé
    if (EXTENSION_PAGE_ONLY.has(message.type) && sender.tab !== undefined) {
      console.warn('[SyncKai] Message refusé depuis un onglet :', message.type);
      return false;
    }

    dispatch(message, sender)
      .then(sendResponse)
      .catch((error: unknown) => {
        console.error('[SyncKai] Erreur non gérée pour', message.type, error);
        sendResponse(UNEXPECTED_ERRORS[message.type]);
      });
    return true; // Garde le canal ouvert pour la réponse asynchrone
  },
);

// ─── File de relance et raccourci clavier ─────────────────────────────────

chrome.alarms.onAlarm.addListener((alarm): void => {
  if (alarm.name === QUEUE_ALARM) void processSyncQueue();
});

chrome.commands.onCommand.addListener((command): void => {
  void handleCommand(command);
});

chrome.runtime.onStartup.addListener((): void => {
  void ensureQueueAlarm();
});
chrome.runtime.onInstalled.addListener((): void => {
  void ensureQueueAlarm();
});

// ─── Alertes de nouveaux épisodes ──────────────────────────────────────────

chrome.alarms.onAlarm.addListener((alarm): void => {
  if (alarm.name === AIRING_ALARM) void checkNewEpisodes();
});
chrome.notifications.onClicked.addListener((id): void => {
  void handleNotificationClick(id);
});
chrome.notifications.onButtonClicked.addListener((id, index): void => {
  void handleNotificationButton(id, index);
});
chrome.runtime.onStartup.addListener((): void => {
  void ensureAiringAlarm();
});
chrome.runtime.onInstalled.addListener((): void => {
  void ensureAiringAlarm();
});
// Réglage modifié ou compte (dé)connecté : l'alarme suit
chrome.storage.onChanged.addListener((changes, area): void => {
  if (area === 'local' && (SETTINGS_STORAGE_KEY in changes || STORAGE_KEYS.anilistToken in changes || STORAGE_KEYS.malToken in changes)) {
    void ensureAiringAlarm();
  }
});
