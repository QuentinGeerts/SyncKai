import type { AniListErrorCode, ViewerResult } from './anilist.types';
import type { AuthResult } from './auth.types';
import { isEpisodeInfo, type EpisodeInfo } from './episode.types';
import { isRecord } from './guards';
import type { Result } from './result';
import type { CandidateSummary } from './review.types';
import type { MalViewerResult } from './mal.types';
import type { SyncOutcome } from './sync.types';
import { isTrackerId, type TrackerId } from './tracker.types';
import type { WatchingResult } from './watching.types';

export interface AdjustProgressPayload {
  /** Fiche AniList (catalogue) ; null pour une entrée MAL sans équivalent AniList */
  mediaId: number | null;
  malId: number | null;
  delta: 1 | -1;
}

export interface EpisodeCompletedPayload {
  episode: EpisodeInfo;
  /** null = tous les services connectés ; sinon nouvelle tentative ciblée après un échec partiel */
  services: TrackerId[] | null;
}

export interface ResolveReviewPayload {
  key: string;
  mediaId: number;
  progress: number;
}

/** Type de message → payload envoyé et réponse renvoyée par le service worker. */
export interface MessageMap {
  LOGIN_ANILIST: { payload: null; response: AuthResult };
  GET_VIEWER: { payload: null; response: ViewerResult };
  LOGIN_MAL: { payload: null; response: AuthResult };
  GET_MAL_VIEWER: { payload: null; response: MalViewerResult };
  EPISODE_COMPLETED: { payload: EpisodeCompletedPayload; response: SyncOutcome };
  SEARCH_ANIME: { payload: { query: string }; response: Result<CandidateSummary[], AniListErrorCode> };
  RESOLVE_REVIEW: { payload: ResolveReviewPayload; response: SyncOutcome };
  REOPEN_REVIEW: { payload: { key: string }; response: Result<null, AniListErrorCode | 'NOT_FOUND'> };
  /** Liste "en cours" d'un service (réponse fraîche ; le popup affiche d'abord le cache du stockage) */
  GET_WATCHING: { payload: { service: TrackerId }; response: WatchingResult };
  /** +1 / −1 manuel depuis le popup, écrit sur tous les services connectés où la série existe */
  ADJUST_PROGRESS: { payload: AdjustProgressPayload; response: SyncOutcome };
  /** « Réessayer » sur une synchro en échec de la file (Activité) */
  RETRY_QUEUED: { payload: { id: string }; response: SyncOutcome };
}

/** Messages réservés aux pages de l'extension (popup) : refusés s'ils viennent d'un content script */
export const EXTENSION_PAGE_ONLY: ReadonlySet<MessageType> = new Set([
  'LOGIN_ANILIST',
  'LOGIN_MAL',
  'SEARCH_ANIME',
  'RESOLVE_REVIEW',
  'REOPEN_REVIEW',
  'GET_WATCHING',
  'ADJUST_PROGRESS',
  'RETRY_QUEUED',
]);

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

const isEpisodeCompletedPayload = (p: unknown): p is EpisodeCompletedPayload =>
  isRecord(p) &&
  isEpisodeInfo(p.episode) &&
  (p.services === null || (Array.isArray(p.services) && p.services.length > 0 && p.services.every(isTrackerId)));

const isSearchPayload = (p: unknown): p is { query: string } =>
  isRecord(p) && typeof p.query === 'string' && p.query.trim().length > 0 && p.query.length <= 100;
const isResolveReviewPayload = (p: unknown): p is ResolveReviewPayload =>
  isRecord(p) && isKey(p.key) && isPositiveInt(p.mediaId) && isPositiveInt(p.progress);
const isWatchingPayload = (p: unknown): p is { service: TrackerId } => isRecord(p) && isTrackerId(p.service);
const isAdjustProgressPayload = (p: unknown): p is AdjustProgressPayload =>
  isRecord(p) &&
  (p.mediaId === null || isPositiveInt(p.mediaId)) &&
  (p.malId === null || isPositiveInt(p.malId)) &&
  (p.mediaId !== null || p.malId !== null) &&
  (p.delta === 1 || p.delta === -1);
const isRetryQueuedPayload = (p: unknown): p is { id: string } => isRecord(p) && isKey(p.id);
const isReopenReviewPayload = (p: unknown): p is { key: string } => isRecord(p) && isKey(p.key);

// Record exhaustif : TypeScript impose un validateur de payload pour chaque MessageType
const PAYLOAD_GUARDS: { [K in MessageType]: (payload: unknown) => payload is MessagePayload<K> } = {
  LOGIN_ANILIST: isNull,
  GET_VIEWER: isNull,
  LOGIN_MAL: isNull,
  GET_MAL_VIEWER: isNull,
  EPISODE_COMPLETED: isEpisodeCompletedPayload,
  SEARCH_ANIME: isSearchPayload,
  RESOLVE_REVIEW: isResolveReviewPayload,
  REOPEN_REVIEW: isReopenReviewPayload,
  GET_WATCHING: isWatchingPayload,
  ADJUST_PROGRESS: isAdjustProgressPayload,
  RETRY_QUEUED: isRetryQueuedPayload,
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
