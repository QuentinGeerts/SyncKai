import { getViewer } from './api/viewer';
import { loginWithAniList } from './auth';
import { reopenReview, resolveReview, searchCandidates, syncEpisode } from './sync/sync-service';
import { refreshReviewBadge } from '../shared/badge';
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
  EPISODE_COMPLETED: { status: 'error', message: 'Erreur inattendue pendant la synchronisation.' },
  SEARCH_ANIME: { ok: false, code: 'API_ERROR', message: 'Erreur inattendue.' },
  RESOLVE_REVIEW: { status: 'error', message: 'Erreur inattendue pendant la synchronisation.' },
  REOPEN_REVIEW: { ok: false, code: 'API_ERROR', message: 'Erreur inattendue.' },
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
  EPISODE_COMPLETED: (episode) => syncEpisode(episode),
  SEARCH_ANIME: ({ query }) => searchCandidates(query),
  RESOLVE_REVIEW: (payload) => resolveReview(payload),
  REOPEN_REVIEW: ({ key }) => reopenReview(key),
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
