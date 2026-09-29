import { getViewer } from './api/anilist';
import { loginWithAniList } from './auth';
import {
  isRuntimeMessage,
  type MessagePayload,
  type MessageResponse,
  type MessageType,
  type RuntimeMessage,
} from '../shared/messages';

chrome.runtime.onInstalled.addListener((): void => {
  console.log('SyncKai installé et prêt');
  console.log('Redirect URL OAuth :', chrome.identity.getRedirectURL());
});

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
  EPISODE_COMPLETED: async (episode, sender) => {
    // TODO (feature suivante) : mettre à jour la progression sur AniList
    console.log('[SyncKai] Épisode terminé (onglet %s) :', sender.tab?.id ?? '?', episode);
    return { ok: true, data: null };
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

    void dispatch(message, sender).then(sendResponse);
    return true; // Garde le canal ouvert pour la réponse asynchrone
  },
);
