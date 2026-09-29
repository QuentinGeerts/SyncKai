import { isAniListViewer, type ViewerErrorCode, type ViewerResult } from '../shared/anilist.types';
import type { AuthResult } from '../shared/auth.types';
import { sendMessage } from '../shared/messages';
import { clearAniListSession, getCachedViewer, getValidToken, STORAGE_KEYS } from '../shared/storage';
import { renderAlert } from './components/alert';
import { renderFooter } from './components/footer';
import { renderHeader } from './components/header';
import { renderLoginCard } from './components/login-card';
import { renderProfileCard } from './components/profile-card';
import { h, type Child } from './lib/dom';
import { createStore, type PopupState } from './state';

const SW_UNREACHABLE = 'Impossible de contacter l’extension. Réessaie.';
/** Erreurs qui invalident la session : retour à l'écran de connexion */
const AUTH_ERRORS: ReadonlySet<ViewerErrorCode> = new Set(['NOT_AUTHENTICATED', 'TOKEN_INVALID']);

function getRoot(): HTMLDivElement {
  const el = document.querySelector<HTMLDivElement>('#app');
  if (!el) throw new Error('Élément #app introuvable');
  return el;
}

const root = getRoot();

const store = createStore({ status: 'loading' });
const version = chrome.runtime.getManifest().version;

// ─── Rendu ────────────────────────────────────────────────────────────────

function renderMain(state: PopupState): Child[] {
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

function render(state: PopupState): void {
  root.replaceChildren(
    renderHeader(state),
    h('main', { class: 'flex min-h-[88px] flex-col gap-3 px-4 py-4' }, ...renderMain(state)),
    renderFooter({ version, onLogout: state.status === 'logged-in' ? () => void handleLogout() : undefined }),
  );
}

// ─── Actions ──────────────────────────────────────────────────────────────

/** Rafraîchit le profil depuis l'API (stale-while-revalidate : le cache reste affiché). */
async function refreshViewer(): Promise<void> {
  let result: ViewerResult;
  try {
    result = await sendMessage('GET_VIEWER');
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
    result = await sendMessage('LOGIN_ANILIST');
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
    store.set({ status: 'logged-out', pending: false, error: null });
  } catch (error: unknown) {
    console.error('[SyncKai] Échec de la déconnexion :', error);
    const current = store.get();
    if (current.status === 'logged-in') store.set({ ...current, error: 'Impossible de se déconnecter. Réessaie.' });
  }
}

async function bootstrap(): Promise<void> {
  try {
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
// La popup se ferme souvent pendant l'OAuth, et le service worker peut invalider la session :
// on suit donc les changements du stockage plutôt que de se fier aux seules réponses.

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
});

store.subscribe(render);
void bootstrap();
