import type { AniListViewer } from '../shared/anilist.types';

/** État unique du popup : chaque vue est une fonction pure de cet état. */
export type PopupState =
  | { status: 'loading' }
  | { status: 'logged-out'; pending: boolean; error: string | null }
  /** viewer à null = profil pas encore chargé (affichage skeleton) */
  | { status: 'logged-in'; viewer: AniListViewer | null; error: string | null };

type Listener = (state: PopupState) => void;

export interface Store {
  get(): PopupState;
  set(next: PopupState): void;
  subscribe(listener: Listener): () => void;
}

export function createStore(initial: PopupState): Store {
  let state = initial;
  const listeners = new Set<Listener>();

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
