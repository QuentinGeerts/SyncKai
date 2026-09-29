import { ANILIST_TOKEN_KEY, isAniListToken, type AuthResult, type RuntimeMessage } from '../shared/types';

console.log('Popup chargé');

function getEl<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Élément introuvable : ${selector}`);
  return el;
}

const loggedOutView = getEl<HTMLElement>('#logged-out-view');
const loggedInView = getEl<HTMLElement>('#logged-in-view');
const loginBtn = getEl<HTMLButtonElement>('#login-btn');
const loginSpinner = getEl<SVGSVGElement>('#login-spinner');
const loginLabel = getEl<HTMLSpanElement>('#login-label');
const errorBox = getEl<HTMLParagraphElement>('#error-box');
const statusDot = getEl<HTMLSpanElement>('#status-dot');
const statusLabel = getEl<HTMLSpanElement>('#status-label');

function renderAuthState(connected: boolean): void {
  loggedInView.classList.toggle('hidden', !connected);
  loggedOutView.classList.toggle('hidden', connected);
  loggedOutView.classList.toggle('flex', !connected);
  statusDot.classList.toggle('bg-emerald-500', connected);
  statusDot.classList.toggle('bg-red-500', !connected);
  statusDot.classList.remove('bg-zinc-500');
  statusLabel.textContent = connected ? 'Connecté' : 'Déconnecté';
}

function setLoading(loading: boolean): void {
  loginBtn.disabled = loading;
  loginSpinner.classList.toggle('hidden', !loading);
  loginLabel.textContent = loading ? 'Connexion…' : 'Se connecter à AniList';
}

function showError(message: string | null): void {
  errorBox.textContent = message ?? '';
  errorBox.classList.toggle('hidden', message === null);
}

async function hasValidToken(): Promise<boolean> {
  const stored = await chrome.storage.local.get(ANILIST_TOKEN_KEY);
  const token: unknown = stored[ANILIST_TOKEN_KEY];
  return isAniListToken(token) && token.expiresAt > Date.now();
}

async function handleLogin(): Promise<void> {
  showError(null);
  setLoading(true);
  try {
    const message: RuntimeMessage = { type: 'LOGIN_ANILIST' };
    const result: AuthResult = await chrome.runtime.sendMessage(message);
    if (result.success) {
      renderAuthState(true);
    } else {
      console.warn('[SyncKai] Échec de connexion :', result.code, result.message);
      showError(result.message);
    }
  } catch (error: unknown) {
    console.error('[SyncKai] Service worker injoignable :', error);
    showError('Impossible de contacter l’extension. Réessaie.');
  } finally {
    setLoading(false);
  }
}

loginBtn.addEventListener('click', (): void => {
  void handleLogin();
});

// La popup peut se fermer pendant le flux OAuth : on réagit aussi aux changements de stockage
chrome.storage.onChanged.addListener((changes, areaName): void => {
  if (areaName === 'local' && ANILIST_TOKEN_KEY in changes) {
    void hasValidToken().then(renderAuthState);
  }
});

void hasValidToken()
  .then(renderAuthState)
  .catch((error: unknown): void => {
    console.error('[SyncKai] Lecture du stockage impossible :', error);
    renderAuthState(false);
    showError('Impossible de lire la session.');
  });
