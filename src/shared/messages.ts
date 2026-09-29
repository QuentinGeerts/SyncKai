import type { AniListErrorCode, ViewerResult } from './anilist.types';
import type { AuthResult } from './auth.types';
import { isEpisodeInfo, type EpisodeInfo } from './episode.types';
import { isRecord } from './guards';
import type { Result } from './result';
import type { CandidateSummary } from './review.types';
import type { SyncOutcome } from './sync.types';

export interface ResolveReviewPayload {
  key: string;
  mediaId: number;
  progress: number;
}

/** Type de message → payload envoyé et réponse renvoyée par le service worker. */
export interface MessageMap {
  LOGIN_ANILIST: { payload: null; response: AuthResult };
  GET_VIEWER: { payload: null; response: ViewerResult };
  EPISODE_COMPLETED: { payload: EpisodeInfo; response: SyncOutcome };
  SEARCH_ANIME: { payload: { query: string }; response: Result<CandidateSummary[], AniListErrorCode> };
  RESOLVE_REVIEW: { payload: ResolveReviewPayload; response: SyncOutcome };
  REOPEN_REVIEW: { payload: { key: string }; response: Result<null, AniListErrorCode | 'NOT_FOUND'> };
}

/** Messages réservés aux pages de l'extension (popup) : refusés s'ils viennent d'un content script */
export const EXTENSION_PAGE_ONLY: ReadonlySet<MessageType> = new Set(['LOGIN_ANILIST', 'SEARCH_ANIME', 'RESOLVE_REVIEW', 'REOPEN_REVIEW']);

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
const isPositiveInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1;
const isKey = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200;

const isSearchPayload = (p: unknown): p is { query: string } =>
  isRecord(p) && typeof p.query === 'string' && p.query.trim().length > 0 && p.query.length <= 100;
const isResolveReviewPayload = (p: unknown): p is ResolveReviewPayload =>
  isRecord(p) && isKey(p.key) && isPositiveInt(p.mediaId) && isPositiveInt(p.progress);
const isReopenReviewPayload = (p: unknown): p is { key: string } => isRecord(p) && isKey(p.key);

// Record exhaustif : TypeScript impose un validateur de payload pour chaque MessageType
const PAYLOAD_GUARDS: { [K in MessageType]: (payload: unknown) => payload is MessagePayload<K> } = {
  LOGIN_ANILIST: isNull,
  GET_VIEWER: isNull,
  EPISODE_COMPLETED: isEpisodeInfo,
  SEARCH_ANIME: isSearchPayload,
  RESOLVE_REVIEW: isResolveReviewPayload,
  REOPEN_REVIEW: isReopenReviewPayload,
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
