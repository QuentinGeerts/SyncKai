import type { MalViewer } from '../shared/mal.types';
import type { AniListViewer } from '../shared/anilist.types';
import type { PendingReview, RecentSync } from '../shared/review.types';

/** État de connexion d'un compte (AniList, MyAnimeList) : chaque vue est une fonction pure de cet état. */
export type AccountState<Viewer> =
  | { status: 'loading' }
  | { status: 'logged-out'; pending: boolean; error: string | null }
  /** viewer à null = profil pas encore chargé (affichage skeleton) */
  | { status: 'logged-in'; viewer: Viewer | null; error: string | null };

export type PopupState = AccountState<AniListViewer>;
export type MalState = AccountState<MalViewer>;

/** Données de synchronisation lues depuis le stockage (vérifications, dernières synchros). */
export interface SyncData {
  reviews: PendingReview[];
  recentSyncs: RecentSync[];
  /** Clé de la synchro dont la correction est en cours de chargement */
  busyKey: string | null;
  recentError: string | null;
}

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
