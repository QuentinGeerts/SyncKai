import type { ViewerResult } from './anilist.types';
import type { AuthResult } from './auth.types';
import { isRecord } from './guards';

/** Type de message → type de la réponse renvoyée par le service worker. */
export interface MessageResponseMap {
  LOGIN_ANILIST: AuthResult;
  GET_VIEWER: ViewerResult;
}

export type MessageType = keyof MessageResponseMap;

export interface RuntimeMessage<K extends MessageType = MessageType> {
  type: K;
}

// Record exhaustif : TypeScript impose d'y ajouter chaque nouveau MessageType
const MESSAGE_TYPES: Record<MessageType, true> = {
  LOGIN_ANILIST: true,
  GET_VIEWER: true,
};

export function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  return isRecord(value) && typeof value.type === 'string' && Object.hasOwn(MESSAGE_TYPES, value.type);
}

/** Envoie un message typé au service worker et retourne sa réponse typée. */
export function sendMessage<K extends MessageType>(type: K): Promise<MessageResponseMap[K]> {
  const message: RuntimeMessage<K> = { type };
  return chrome.runtime.sendMessage<RuntimeMessage<K>, MessageResponseMap[K]>(message);
}
