import type { ViewerResult } from './anilist.types';
import type { AuthResult } from './auth.types';
import { isEpisodeInfo, type EpisodeInfo } from './episode.types';
import { isRecord } from './guards';
import type { SyncOutcome } from './sync.types';

/** Type de message → payload envoyé et réponse renvoyée par le service worker. */
export interface MessageMap {
  LOGIN_ANILIST: { payload: null; response: AuthResult };
  GET_VIEWER: { payload: null; response: ViewerResult };
  EPISODE_COMPLETED: { payload: EpisodeInfo; response: SyncOutcome };
}

export type MessageType = keyof MessageMap;
export type MessagePayload<K extends MessageType> = MessageMap[K]['payload'];
export type MessageResponse<K extends MessageType> = MessageMap[K]['response'];

export interface RuntimeMessage<K extends MessageType = MessageType> {
  type: K;
  payload: MessagePayload<K>;
}

/** Union discriminée de tous les messages possibles */
export type AnyRuntimeMessage = { [K in MessageType]: RuntimeMessage<K> }[MessageType];

const isNull = (value: unknown): value is null => value === null;

// Record exhaustif : TypeScript impose un validateur de payload pour chaque MessageType
const PAYLOAD_GUARDS: { [K in MessageType]: (payload: unknown) => payload is MessagePayload<K> } = {
  LOGIN_ANILIST: isNull,
  GET_VIEWER: isNull,
  EPISODE_COMPLETED: isEpisodeInfo,
};

/** Valide le type ET le payload d'un message reçu (les content scripts tournent sur des pages tierces). */
export function isRuntimeMessage(value: unknown): value is AnyRuntimeMessage {
  if (!isRecord(value) || typeof value.type !== 'string' || !Object.hasOwn(PAYLOAD_GUARDS, value.type)) {
    return false;
  }
  return PAYLOAD_GUARDS[value.type as MessageType](value.payload);
}

/** Envoie un message typé au service worker et retourne sa réponse typée. */
export function sendMessage<K extends MessageType>(type: K, payload: MessagePayload<K>): Promise<MessageResponse<K>> {
  const message: RuntimeMessage<K> = { type, payload };
  return chrome.runtime.sendMessage<RuntimeMessage<K>, MessageResponse<K>>(message);
}
