import { loginWithAniList } from './auth';
import { isRuntimeMessage, type AuthResult } from '../shared/types';

chrome.runtime.onInstalled.addListener((): void => {
  console.log('SyncKai installé et prêt');
  console.log('Redirect URL OAuth :', chrome.identity.getRedirectURL());
});

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender: chrome.runtime.MessageSender, sendResponse: (response: AuthResult) => void): boolean => {
    if (!isRuntimeMessage(message)) return false;

    if (message.type === 'LOGIN_ANILIST') {
      void loginWithAniList().then(sendResponse);
      return true; // Garde le canal ouvert pour la réponse asynchrone
    }
    return false;
  },
);
