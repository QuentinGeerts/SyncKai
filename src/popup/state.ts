import type { AniListViewer } from '../shared/anilist.types';
import type { MalViewer } from '../shared/mal.types';
import type { PendingReview, RecentSync } from '../shared/review.types';
import type { SyncSettings } from '../shared/settings';
import type { TrackerId } from '../shared/tracker.types';
import type { WatchingList, WatchingSort } from '../shared/watching.types';

/** État de connexion d'un compte (AniList, MyAnimeList) : chaque vue est une fonction pure de cet état. */
export type AccountState<Viewer> =
  | { status: 'loading' }
  /** expired = la session a été invalidée (token expiré ou refusé) : « Reconnecter » */
  | { status: 'logged-out'; pending: boolean; error: string | null; expired: boolean }
  /** viewer à null = profil pas encore chargé (affichage skeleton) */
  | { status: 'logged-in'; viewer: Viewer | null; error: string | null };

export type AniListState = AccountState<AniListViewer>;
export type MalState = AccountState<MalViewer>;

export const LOGGED_OUT = { status: 'logged-out', pending: false, error: null, expired: false } as const;

/** Données de synchronisation lues depuis le stockage (vérifications, dernières synchros). */
export interface SyncData {
  reviews: PendingReview[];
  recentSyncs: RecentSync[];
  /** Clé de la synchro dont la correction est en cours de chargement */
  busyKey: string | null;
  recentError: string | null;
}

export type Screen = 'watching' | 'activity' | 'settings';

export interface UiState {
  screen: Screen;
  /** Écran à retrouver en quittant les réglages */
  previous: Exclude<Screen, 'settings'>;
  /** Source préférée de la liste « En cours » (utilisée seulement si les deux services sont connectés) */
  source: TrackerId;
  /** Tri de « Mes séries » (persisté avec la source) */
  sort: WatchingSort;
  /** Menu de tri ouvert : conservé dans l'état pour survivre aux nouveaux rendus */
  sortMenuOpen: boolean;
}

/** Liste « En cours » : cache affiché immédiatement puis revalidé (stale-while-revalidate). */
export type WatchingState =
  | { status: 'idle' }
  /** Aucun cache : skeleton */
  | { status: 'loading'; service: TrackerId }
  | { status: 'ready'; service: TrackerId; list: WatchingList; refreshing: boolean; error: string | null }
  | { status: 'error'; service: TrackerId; message: string };

export type SettingsState = { status: 'loading' } | { status: 'ready'; settings: SyncSettings } | { status: 'error' };

type Listener<T> = (state: T) => void;

export interface Store<T> {
  get(): T;
  set(next: T): void;
  subscribe(listener: Listener<T>): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener<T>>();

  return {
    get: () => state,
    set(next) {
      state = next;
      listeners.forEach((listener) => listener(state));
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
  };
}
