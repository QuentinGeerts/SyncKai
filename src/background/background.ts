import { getViewer } from './api/anilist';
import { loginWithAniList } from './auth';
import { isRuntimeMessage, type MessageResponseMap, type MessageType } from '../shared/messages';

chrome.runtime.onInstalled.addListener((): void => {
  console.log('SyncKai installé et prêt');
  console.log('Redirect URL OAuth :', chrome.identity.getRedirectURL());
});

type MessageHandlers = { [K in MessageType]: () => Promise<MessageResponseMap[K]> };

const handlers: MessageHandlers = {
  LOGIN_ANILIST: async () => {
    const result = await loginWithAniList();
    // Précharge le profil : la popup, souvent fermée pendant l'OAuth, l'affichera instantanément
    if (result.ok) await getViewer();
    return result;
  },
  GET_VIEWER: getViewer,
};

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponseMap[MessageType]) => void,
  ): boolean => {
    // N'accepte que les messages provenant de l'extension elle-même
    if (sender.id !== chrome.runtime.id || !isRuntimeMessage(message)) return false;

    void handlers[message.type]().then(sendResponse);
    return true; // Garde le canal ouvert pour la réponse asynchrone
  },
);
