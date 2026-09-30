import { isAniListViewer, type ViewerErrorCode, type ViewerResult } from '../shared/anilist.types';
import type { AuthResult } from '../shared/auth.types';
import { refreshReviewBadge } from '../shared/badge';
import { sendMessage } from '../shared/messages';
import {
  clearAniListSession,
  deletePendingReview,
  getCachedViewer,
  getPendingReviews,
  getRecentSyncs,
  getValidToken,
  STORAGE_KEYS,
} from '../shared/storage';
import { renderAlert } from './components/alert';
import { renderFooter } from './components/footer';
import { renderHeader } from './components/header';
import { renderLoginCard } from './components/login-card';
import { renderProfileCard } from './components/profile-card';
import { renderRecentSyncs } from './components/recent-syncs';
import type { ReviewActions } from './components/review-card';
import { createReviewSection } from './components/review-section';
import { h, nodes, type Child } from '../ui/dom';
import { createStore, type PopupState, type SyncData } from './state';

const SW_UNREACHABLE = 'Impossible de contacter l’extension. Réessaie.';
/** Erreurs qui invalident la session : retour à l'écran de connexion */
const AUTH_ERRORS: ReadonlySet<ViewerErrorCode> = new Set(['NOT_AUTHENTICATED', 'TOKEN_INVALID']);

function getRoot(): HTMLDivElement {
  const el = document.querySelector<HTMLDivElement>('#app');
  if (!el) throw new Error('Élément #app introuvable');
  return el;
}

const store = createStore<PopupState>({ status: 'loading' });
const syncStore = createStore<SyncData>({ reviews: [], recentSyncs: [], busyKey: null, recentError: null });
const version = chrome.runtime.getManifest().version;

// ─── Actions des cartes "À vérifier" ────────────────────────────────────────

const reviewActions: ReviewActions = {
  async search(query) {
    try {
      return await sendMessage('SEARCH_ANIME', { query });
    } catch (error: unknown) {
      console.error('[SyncKai] Service worker injoignable :', error);
      return { ok: false, code: 'NETWORK', message: SW_UNREACHABLE };
    }
  },
  async confirm(key, mediaId, progress) {
    try {
      return await sendMessage('RESOLVE_REVIEW', { key, mediaId, progress });
    } catch (error: unknown) {
      console.error('[SyncKai] Service worker injoignable :', error);
      return { status: 'error', message: SW_UNREACHABLE };
    }
  },
  // Pas besoin du service worker : simple suppression dans le stockage
  async dismiss(key) {
    await deletePendingReview(key);
    await refreshReviewBadge();
  },
};

// ─── Rendu ────────────────────────────────────────────────────────────────
// Mise en page fixe : les zones sont redessinées séparément, et la section "À vérifier"
// est réconciliée (jamais recréée) pour préserver les saisies en cours.

const headerSlot = h('div', { class: 'contents' });
const authSlot = h('div', { class: 'flex flex-col gap-3' });
const reviewSection = createReviewSection(reviewActions);
const recentSlot = h('div', { class: 'contents' });
const footerSlot = h('div', { class: 'contents' });

getRoot().replaceChildren(
  headerSlot,
  h('main', { class: 'flex min-h-[88px] flex-col gap-4 px-4 py-4' }, authSlot, reviewSection.element, recentSlot),
  footerSlot,
);

function renderAuth(state: PopupState): Child[] {
  switch (state.status) {
    case 'loading':
      return [];
    case 'logged-out':
      return [
        renderLoginCard({ pending: state.pending, onLogin: () => void handleLogin() }),
        state.error && renderAlert({ message: state.error }),
      ];
    case 'logged-in':
      return [
        renderProfileCard(state.viewer),
        state.error && renderAlert({ message: state.error, action: { label: 'Réessayer', onClick: () => void refreshViewer() } }),
      ];
  }
}

function render(): void {
  const state = store.get();
  const data = syncStore.get();
  const isLoggedIn = state.status === 'logged-in';

  headerSlot.replaceChildren(renderHeader(state));
  authSlot.replaceChildren(...nodes(renderAuth(state)));
  reviewSection.update(isLoggedIn ? data.reviews : []);
  recentSlot.replaceChildren(
    ...nodes([
      isLoggedIn &&
        renderRecentSyncs({
          syncs: data.recentSyncs,
          pendingKeys: new Set(data.reviews.map((r) => r.key)),
          busyKey: data.busyKey,
          error: data.recentError,
          onCorrect: (key) => void handleCorrect(key),
        }),
    ]),
  );
  footerSlot.replaceChildren(renderFooter({ version, onLogout: isLoggedIn ? () => void handleLogout() : undefined }));
}

// ─── Actions ──────────────────────────────────────────────────────────────

/** Rafraîchit le profil depuis l'API (stale-while-revalidate : le cache reste affiché). */
async function refreshViewer(): Promise<void> {
  let result: ViewerResult;
  try {
    result = await sendMessage('GET_VIEWER', null);
  } catch (error: unknown) {
    console.error('[SyncKai] Service worker injoignable :', error);
    result = { ok: false, code: 'NETWORK', message: SW_UNREACHABLE };
  }

  if (!result.ok && AUTH_ERRORS.has(result.code)) {
    store.set({ status: 'logged-out', pending: false, error: result.message });
    return;
  }

  const current = store.get();
  if (current.status !== 'logged-in') return; // Déconnecté entre-temps
  store.set(result.ok ? { ...current, viewer: result.data, error: null } : { ...current, error: result.message });
}

async function handleLogin(): Promise<void> {
  store.set({ status: 'logged-out', pending: true, error: null });

  let result: AuthResult;
  try {
    result = await sendMessage('LOGIN_ANILIST', null);
  } catch (error: unknown) {
    console.error('[SyncKai] Service worker injoignable :', error);
    result = { ok: false, code: 'UNKNOWN', message: SW_UNREACHABLE };
  }

  if (!result.ok) {
    console.warn('[SyncKai] Échec de connexion :', result.code, result.message);
    store.set({ status: 'logged-out', pending: false, error: result.message });
    return;
  }

  // Le service worker a déjà préchargé le profil après l'OAuth
  const viewer = await getCachedViewer();
  store.set({ status: 'logged-in', viewer, error: null });
  if (!viewer) await refreshViewer();
}

async function handleLogout(): Promise<void> {
  try {
    await clearAniListSession();
    await refreshReviewBadge();
    store.set({ status: 'logged-out', pending: false, error: null });
  } catch (error: unknown) {
    console.error('[SyncKai] Échec de la déconnexion :', error);
    const current = store.get();
    if (current.status === 'logged-in') store.set({ ...current, error: 'Impossible de se déconnecter. Réessaie.' });
  }
}

/** "Corriger" : le service worker recharge les fiches candidates et rouvre une carte. */
async function handleCorrect(key: string): Promise<void> {
  syncStore.set({ ...syncStore.get(), busyKey: key, recentError: null });
  let error: string | null = null;
  try {
    const result = await sendMessage('REOPEN_REVIEW', { key });
    if (!result.ok) error = result.message;
  } catch (e: unknown) {
    console.error('[SyncKai] Service worker injoignable :', e);
    error = SW_UNREACHABLE;
  }
  syncStore.set({ ...syncStore.get(), busyKey: null, recentError: error });
}

async function loadSyncData(): Promise<void> {
  const [reviews, recentSyncs] = await Promise.all([getPendingReviews(), getRecentSyncs()]);
  syncStore.set({ ...syncStore.get(), reviews, recentSyncs });
}

async function bootstrap(): Promise<void> {
  try {
    void loadSyncData();
    if (!(await getValidToken())) {
      store.set({ status: 'logged-out', pending: false, error: null });
      return;
    }
    store.set({ status: 'logged-in', viewer: await getCachedViewer(), error: null });
    await refreshViewer();
  } catch (error: unknown) {
    console.error('[SyncKai] Lecture du stockage impossible :', error);
    store.set({ status: 'logged-out', pending: false, error: 'Impossible de lire la session.' });
  }
}

// ─── Synchronisation avec le stockage ──────────────────────────────────────
// La popup se ferme souvent pendant l'OAuth, et le service worker peut invalider la session
// ou ajouter des vérifications : on suit donc les changements du stockage.

chrome.storage.onChanged.addListener((changes, areaName): void => {
  if (areaName !== 'local') return;

  const tokenChange = changes[STORAGE_KEYS.anilistToken];
  if (tokenChange) {
    const state = store.get();
    const hasToken = tokenChange.newValue !== undefined;
    if (!hasToken && state.status === 'logged-in') {
      store.set({ status: 'logged-out', pending: false, error: null });
    } else if (hasToken && state.status === 'logged-out' && !state.pending) {
      void bootstrap();
    }
  }

  const viewerChange = changes[STORAGE_KEYS.anilistViewer];
  const state = store.get();
  if (viewerChange && state.status === 'logged-in' && isAniListViewer(viewerChange.newValue)) {
    store.set({ ...state, viewer: viewerChange.newValue });
  }

  if (changes[STORAGE_KEYS.pendingReviews] || changes[STORAGE_KEYS.recentSyncs]) void loadSyncData();
});

store.subscribe(render);
syncStore.subscribe(render);
void bootstrap();
