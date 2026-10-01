import { isAniListViewer, type ViewerErrorCode, type ViewerResult } from '../shared/anilist.types';
import { isAniListToken, type AuthResult } from '../shared/auth.types';
import { refreshReviewBadge } from '../shared/badge';
import { isMalViewer, type MalViewerResult } from '../shared/mal.types';
import { sendMessage } from '../shared/messages';
import { DEFAULT_SETTINGS, getSettings, normalizeSettings, SETTINGS_STORAGE_KEY } from '../shared/settings';
import {
  clearAniListSession,
  clearMalSession,
  clearUserSyncData,
  deletePendingReview,
  getCachedMalViewer,
  getCachedViewer,
  getCachedWatching,
  getMalToken,
  getPendingReviews,
  getRecentSyncs,
  getValidToken,
  STORAGE_KEYS,
} from '../shared/storage';
import { isTrackerId, TRACKER_IDS, TRACKER_LABELS, type TrackerId } from '../shared/tracker.types';
import { formatRelativeTime } from '../shared/watching';
import { DEFAULT_WATCHING_SORT, isWatchingSort, type WatchingResult, type WatchingSort } from '../shared/watching.types';
import { h, nodes, preserveFocus } from '../ui/dom';
import { renderFooter, type FooterStatus } from './components/footer';
import { renderHeader, renderNav, renderSettingsBar } from './components/header';
import { renderOnboarding } from './components/onboarding';
import { renderRecentSyncs } from './components/recent-syncs';
import type { ReviewActions } from './components/review-card';
import { createReviewSection } from './components/review-section';
import { createSettingsScreen } from './components/settings-screen';
import { renderWatchingScreen } from './components/watching-screen';
import {
  createStore,
  LOGGED_OUT,
  type AccountState,
  type AniListState,
  type MalState,
  type Screen,
  type SettingsState,
  type Store,
  type SyncData,
  type UiState,
  type WatchingState,
} from './state';

const SW_UNREACHABLE = 'Impossible de contacter l’extension. Réessaie.';
/** Erreurs qui invalident la session : « Session expirée » + reconnexion */
const AUTH_ERRORS: ReadonlySet<ViewerErrorCode> = new Set(['NOT_AUTHENTICATED', 'TOKEN_INVALID']);
const PREFS_KEY = 'popupPrefs';
const CLOCK_TICK_MS = 60_000;

interface PopupPrefs {
  source: TrackerId;
  sort: WatchingSort;
}

function getRoot(): HTMLDivElement {
  const el = document.querySelector<HTMLDivElement>('#app');
  if (!el) throw new Error('Élément #app introuvable');
  return el;
}

const anilistStore = createStore<AniListState>({ status: 'loading' });
const malStore = createStore<MalState>({ status: 'loading' });
const syncStore = createStore<SyncData>({ reviews: [], recentSyncs: [], busyKey: null, recentError: null });
const uiStore = createStore<UiState>({ screen: 'watching', previous: 'watching', source: 'anilist', sort: DEFAULT_WATCHING_SORT, sortMenuOpen: false });
const watchingStore = createStore<WatchingState>({ status: 'idle' });
const settingsStore = createStore<SettingsState>({ status: 'loading' });
const version = chrome.runtime.getManifest().version;
let now = Date.now();

function accountStore(service: TrackerId): Store<AccountState<unknown>> {
  // Les deux stores ne diffèrent que par le type du profil : les transitions génériques les manipulent pareil
  return (service === 'anilist' ? anilistStore : malStore) as Store<AccountState<unknown>>;
}

function connectedServices(): TrackerId[] {
  return TRACKER_IDS.filter((service) => accountStore(service).get().status === 'logged-in');
}

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

// ─── Mise en page ───────────────────────────────────────────────────────────
// En-tête, navigation et barre d'état fixes ; seule la zone centrale défile.
// Les écrans à état local (Activité, Réglages) sont masqués plutôt que recréés.

const headerSlot = h('div', { class: 'contents' });
const barSlot = h('div', { class: 'contents' });
const watchingSlot = h('div', { class: 'min-h-full' });
const onboardingSlot = h('div', { class: 'min-h-full' });
const reviewSection = createReviewSection(reviewActions);
const recentSlot = h('div', { class: 'contents' });
const activityScreen = h('div', { class: 'flex flex-col gap-4 pb-1' }, reviewSection.element, recentSlot);
const settingsScreen = createSettingsScreen();
const footerSlot = h('div', { class: 'contents' });
const main = h(
  'main',
  { class: 'sk-scroll min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-3' },
  watchingSlot,
  activityScreen,
  settingsScreen.element,
  onboardingSlot,
);
const root = getRoot();
root.replaceChildren(headerSlot, barSlot, main, footerSlot);

// ─── Navigation ───────────────────────────────────────────────────────────

function navigate(screen: Screen): void {
  const ui = uiStore.get();
  if (ui.screen === screen) return;
  // Changement d'écran : le menu de tri éventuellement ouvert se ferme
  uiStore.set({ ...ui, screen, previous: ui.screen === 'settings' ? ui.previous : ui.screen, sortMenuOpen: false });
  main.scrollTop = 0;
}

function goBack(): void {
  navigate(uiStore.get().previous);
}

function toggleSettings(): void {
  if (uiStore.get().screen === 'settings') goBack();
  else navigate('settings');
}

async function savePrefs(): Promise<void> {
  const { source, sort } = uiStore.get();
  try {
    await chrome.storage.local.set({ [PREFS_KEY]: { source, sort } satisfies PopupPrefs });
  } catch (error: unknown) {
    console.warn('[SyncKai] Préférences du popup non enregistrées :', error);
  }
}

async function pickSource(source: TrackerId): Promise<void> {
  uiStore.set({ ...uiStore.get(), source, sortMenuOpen: false });
  await savePrefs();
}

async function loadPrefs(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(PREFS_KEY);
    const raw: unknown = stored[PREFS_KEY];
    if (typeof raw !== 'object' || raw === null) return;
    // Chaque champ est validé séparément : une valeur inconnue retombe sur la valeur par défaut
    const ui = uiStore.get();
    uiStore.set({
      ...ui,
      source: 'source' in raw && isTrackerId(raw.source) ? raw.source : ui.source,
      sort: 'sort' in raw && isWatchingSort(raw.sort) ? raw.sort : DEFAULT_WATCHING_SORT,
    });
  } catch (error: unknown) {
    console.warn('[SyncKai] Préférences du popup illisibles :', error);
  }
}

// ─── Menu de tri « Mes séries » ─────────────────────────────────────────────
// Ouvert/fermé dans uiStore (survit aux nouveaux rendus) ; les écouteurs globaux
// (clic extérieur, Échap) n'existent que pendant l'ouverture.

function focusInWatching(selector: string): void {
  watchingSlot.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
}

function setSortMenu(open: boolean, restoreFocus = true): void {
  const ui = uiStore.get();
  if (ui.sortMenuOpen === open) return;
  uiStore.set({ ...ui, sortMenuOpen: open });
  // Le rendu est synchrone : à l'ouverture, focus sur l'option cochée ; à la fermeture, retour au bouton
  if (open) focusInWatching('[role="menuitemradio"][aria-checked="true"]');
  else if (restoreFocus) focusInWatching('[data-focus="sort-trigger"]');
}

async function pickSort(sort: WatchingSort): Promise<void> {
  uiStore.set({ ...uiStore.get(), sort, sortMenuOpen: false });
  focusInWatching('[data-focus="sort-trigger"]');
  await savePrefs();
}

function onSortMenuPointerDown(event: PointerEvent): void {
  if (event.target instanceof Element && event.target.closest('[data-sort-root]')) return;
  setSortMenu(false, false);
}

function onSortMenuKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return;
  // Échap ferme le menu sans fermer le popup
  event.preventDefault();
  event.stopPropagation();
  setSortMenu(false);
}

let sortMenuListening = false;

function syncSortMenuListeners({ sortMenuOpen }: UiState): void {
  if (sortMenuOpen === sortMenuListening) return;
  sortMenuListening = sortMenuOpen;
  if (sortMenuOpen) {
    document.addEventListener('pointerdown', onSortMenuPointerDown, true);
    document.addEventListener('keydown', onSortMenuKeyDown, true);
  } else {
    document.removeEventListener('pointerdown', onSortMenuPointerDown, true);
    document.removeEventListener('keydown', onSortMenuKeyDown, true);
  }
}

// ─── Rendu ────────────────────────────────────────────────────────────────

function footerStatus(): FooterStatus {
  const connected = connectedServices();
  const expired = TRACKER_IDS.find((service) => {
    const state = accountStore(service).get();
    return state.status === 'logged-out' && state.expired;
  });
  const { reviews, recentSyncs } = syncStore.get();

  if (connected.length > 0 && reviews.length > 0) return { kind: 'pending', count: reviews.length };
  if (expired) return { kind: 'expired', service: expired };
  if (connected.length === 0) return { kind: 'none' };
  const latest = recentSyncs[0];
  return { kind: 'ok', relative: latest ? formatRelativeTime(latest.syncedAt, now) : null };
}

type FooterChip = { service: TrackerId; state: 'ok' | 'expired' };

function footerChips(): FooterChip[] {
  return TRACKER_IDS.flatMap((service): FooterChip[] => {
    const state = accountStore(service).get();
    if (state.status === 'logged-in') return [{ service, state: 'ok' }];
    if (state.status === 'logged-out' && state.expired) return [{ service, state: 'expired' }];
    return [];
  });
}

/** Onboarding : plus aucun chargement en cours et aucun compte connecté */
function isOnboarding(): boolean {
  return TRACKER_IDS.every((service) => accountStore(service).get().status === 'logged-out');
}

/** Dernières entrées du rendu de « En cours » : on ne redessine la liste que si elles changent */
let watchingMemo: readonly unknown[] = [];

function renderWatching(): void {
  const preferredPlayer = (() => {
    const state = settingsStore.get();
    return state.status === 'ready' ? state.settings.preferredPlayer : DEFAULT_SETTINGS.preferredPlayer;
  })();
  const services = connectedServices();
  const { sort, sortMenuOpen } = uiStore.get();
  const inputs = [watchingStore.get(), now, preferredPlayer, services.join(), sort, sortMenuOpen];
  if (inputs.length === watchingMemo.length && inputs.every((value, i) => value === watchingMemo[i])) return;
  watchingMemo = inputs;

  preserveFocus(watchingSlot, () =>
    watchingSlot.replaceChildren(
      renderWatchingScreen({
        state: watchingStore.get(),
        now,
        preferredPlayer,
        services,
        onPickSource: (source) => void pickSource(source),
        sort,
        sortMenuOpen,
        onSortMenu: (open) => setSortMenu(open),
        onPickSort: (value) => void pickSort(value),
        onRetry: () => void reloadWatching(),
      }),
    ),
  );
  // Menu ouvert mais contrôle absent (liste vide, chargement, erreur) : on le referme après ce rendu
  if (sortMenuOpen && !watchingSlot.querySelector('[data-sort-root]')) queueMicrotask(() => setSortMenu(false, false));
}

function render(): void {
  const ui = uiStore.get();
  const onboarding = isOnboarding();
  const isSettings = ui.screen === 'settings';
  const data = syncStore.get();
  const pending = connectedServices().length > 0 ? data.reviews.length : 0;

  preserveFocus(root, () => {
    headerSlot.replaceChildren(renderHeader({ isSettings, onSettings: toggleSettings }));
    barSlot.replaceChildren(
      ...nodes([
        isSettings
          ? renderSettingsBar(goBack, settingsScreen.status)
          : !onboarding && renderNav({ screen: ui.screen === 'activity' ? 'activity' : 'watching', pending, onNavigate: navigate }),
      ]),
    );

    watchingSlot.hidden = isSettings || onboarding || ui.screen !== 'watching';
    activityScreen.hidden = isSettings || onboarding || ui.screen !== 'activity';
    settingsScreen.element.hidden = !isSettings;
    onboardingSlot.hidden = isSettings || !onboarding;

    if (!watchingSlot.hidden) renderWatching();
    if (!onboardingSlot.hidden) {
      onboardingSlot.replaceChildren(
        renderOnboarding({ anilist: anilistStore.get(), mal: malStore.get(), onLogin: (service) => void login(service) }),
      );
    }

    reviewSection.update(connectedServices().length > 0 ? data.reviews : []);
    recentSlot.replaceChildren(
      renderRecentSyncs({
        syncs: data.recentSyncs,
        pendingKeys: new Set(data.reviews.map((r) => r.key)),
        busyKey: data.busyKey,
        error: data.recentError,
        onCorrect: (key) => void handleCorrect(key),
      }),
    );

    settingsScreen.updateAccounts({
      anilist: anilistStore.get(),
      mal: malStore.get(),
      onLogin: (service) => void login(service),
      onLogout: (service) => void logout(service),
      onRetry: (service) => void refreshAccount(service),
    });

    footerSlot.replaceChildren(
      renderFooter({
        version,
        chips: footerChips(),
        status: footerStatus(),
        onOpenSettings: () => navigate('settings'),
        onOpenActivity: () => navigate('activity'),
        onReconnect: (service) => void login(service),
      }),
    );
  });
}

// ─── Comptes (AniList, MyAnimeList) ─────────────────────────────────────────

/** Rafraîchit le profil depuis l'API (stale-while-revalidate : le cache reste affiché). */
async function refreshAccount(service: TrackerId): Promise<void> {
  let result: ViewerResult | MalViewerResult;
  try {
    result = service === 'anilist' ? await sendMessage('GET_VIEWER', null) : await sendMessage('GET_MAL_VIEWER', null);
  } catch (error: unknown) {
    console.error('[SyncKai] Service worker injoignable :', error);
    result = { ok: false, code: 'NETWORK', message: SW_UNREACHABLE };
  }

  if (!result.ok && AUTH_ERRORS.has(result.code)) {
    markExpired(service);
    return;
  }

  if (service === 'anilist') {
    const current = anilistStore.get();
    if (current.status !== 'logged-in') return; // Déconnecté entre-temps
    anilistStore.set(result.ok && isAniListViewer(result.data) ? { ...current, viewer: result.data, error: null } : { ...current, error: result.ok ? null : result.message });
  } else {
    const current = malStore.get();
    if (current.status !== 'logged-in') return;
    malStore.set(result.ok && isMalViewer(result.data) ? { ...current, viewer: result.data, error: null } : { ...current, error: result.ok ? null : result.message });
  }
}

function markExpired(service: TrackerId): void {
  accountStore(service).set({ ...LOGGED_OUT, expired: true });
}

async function loadCachedViewer(service: TrackerId): Promise<void> {
  if (service === 'anilist') anilistStore.set({ status: 'logged-in', viewer: await getCachedViewer(), error: null });
  else malStore.set({ status: 'logged-in', viewer: await getCachedMalViewer(), error: null });
}

async function login(service: TrackerId): Promise<void> {
  const store = accountStore(service);
  const before = store.get();
  const expired = before.status === 'logged-out' && before.expired;
  store.set({ status: 'logged-out', pending: true, error: null, expired });

  let result: AuthResult;
  try {
    result = await sendMessage(service === 'anilist' ? 'LOGIN_ANILIST' : 'LOGIN_MAL', null);
  } catch (error: unknown) {
    console.error('[SyncKai] Service worker injoignable :', error);
    result = { ok: false, code: 'UNKNOWN', message: SW_UNREACHABLE };
  }

  if (!result.ok) {
    console.warn(`[SyncKai] Échec de connexion ${TRACKER_LABELS[service]} :`, result.code, result.message);
    store.set({ status: 'logged-out', pending: false, error: result.message, expired });
    return;
  }

  // Le service worker a déjà préchargé le profil après l'OAuth
  await loadCachedViewer(service);
  const state = store.get();
  if (state.status === 'logged-in' && !state.viewer) await refreshAccount(service);
}

/** Après une déconnexion : plus aucun service connecté → effacement des données de l'utilisateur */
async function clearUserDataIfLastService(): Promise<void> {
  const [anilistToken, malToken] = await Promise.all([getValidToken(), getMalToken()]);
  if (!anilistToken && !malToken) await clearUserSyncData();
  await refreshReviewBadge();
}

async function logout(service: TrackerId): Promise<void> {
  const store = accountStore(service);
  try {
    await (service === 'anilist' ? clearAniListSession() : clearMalSession());
    await clearUserDataIfLastService();
    store.set(LOGGED_OUT);
  } catch (error: unknown) {
    console.error(`[SyncKai] Échec de la déconnexion ${TRACKER_LABELS[service]} :`, error);
    const current = store.get();
    if (current.status === 'logged-in') store.set({ ...current, error: 'Impossible de se déconnecter. Réessaie.' });
  }
}

/** Token AniList présent mais expiré : on propose « Reconnecter » plutôt que l'accueil */
async function hasExpiredAniListToken(): Promise<boolean> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.anilistToken);
  return isAniListToken(stored[STORAGE_KEYS.anilistToken]);
}

async function bootstrap(service: TrackerId): Promise<void> {
  const store = accountStore(service);
  try {
    // MAL : token présent, même expiré (le service worker le renouvellera)
    const token = service === 'anilist' ? await getValidToken() : await getMalToken();
    if (!token) {
      store.set({ ...LOGGED_OUT, expired: service === 'anilist' && (await hasExpiredAniListToken()) });
      return;
    }
    await loadCachedViewer(service);
    await refreshAccount(service);
  } catch (error: unknown) {
    console.error('[SyncKai] Lecture du stockage impossible :', error);
    store.set({ ...LOGGED_OUT, error: 'Impossible de lire la session.' });
  }
}

// ─── Liste « En cours » ─────────────────────────────────────────────────────

/** Service affiché : la source choisie si elle est connectée, sinon le seul service connecté */
function activeService(): TrackerId | null {
  const connected = connectedServices();
  const { source } = uiStore.get();
  return connected.includes(source) ? source : (connected[0] ?? null);
}

let loadedService: TrackerId | null = null;
/** Jeton de requête : une réponse arrivée après un changement de source est ignorée */
let watchingRequest = 0;

async function loadWatching(service: TrackerId): Promise<void> {
  const request = ++watchingRequest;
  const current = watchingStore.get();

  // 1. Cache immédiat (ou liste déjà affichée pour ce service), sinon skeleton
  const cached = current.status === 'ready' && current.service === service ? current.list : await getCachedWatching(service).catch(() => null);
  if (request !== watchingRequest) return;
  watchingStore.set(cached ? { status: 'ready', service, list: cached, refreshing: true, error: null } : { status: 'loading', service });

  // 2. Revalidation par le service worker
  let result: WatchingResult;
  try {
    result = await sendMessage('GET_WATCHING', { service });
  } catch (error: unknown) {
    console.error('[SyncKai] Service worker injoignable :', error);
    result = { ok: false, code: 'NETWORK', message: SW_UNREACHABLE };
  }
  if (request !== watchingRequest) return;

  if (result.ok) {
    watchingStore.set({ status: 'ready', service, list: result.data, refreshing: false, error: null });
    return;
  }
  if (AUTH_ERRORS.has(result.code)) {
    // markExpired re-résout la source (nouvelle requête) : cette réponse devient obsolète
    markExpired(service);
    if (request !== watchingRequest) return;
  }
  watchingStore.set(cached ? { status: 'ready', service, list: cached, refreshing: false, error: result.message } : { status: 'error', service, message: result.message });
}

function reloadWatching(): Promise<void> {
  const service = activeService();
  return service ? loadWatching(service) : Promise.resolve();
}

/** Recharge la liste quand le service affiché change (connexion, déconnexion, choix de source) */
function syncWatchingSource(): void {
  // Comptes encore en lecture : attendre les deux évite de charger (et d'afficher) la mauvaise liste
  if (TRACKER_IDS.some((id) => accountStore(id).get().status === 'loading')) return;
  const service = activeService();
  if (service === loadedService) return;
  loadedService = service;
  if (service) {
    void loadWatching(service);
  } else {
    watchingRequest++;
    watchingStore.set({ status: 'idle' });
  }
}

// ─── Données de synchro ───────────────────────────────────────────────────

/** "Corriger" : le service worker recharge les fiches candidates et rouvre une carte. */
async function handleCorrect(key: string): Promise<void> {
  syncStore.set({ ...syncStore.get(), busyKey: key, recentError: null });
  let error: string | null = null;
  try {
    const result = await sendMessage('REOPEN_REVIEW', { key });
    if (!result.ok) error = result.message;
    else navigate('activity');
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

async function loadSettings(): Promise<void> {
  try {
    settingsStore.set({ status: 'ready', settings: await getSettings() });
  } catch (error: unknown) {
    console.error('[SyncKai] Lecture des réglages impossible :', error);
    settingsStore.set({ status: 'error' });
  }
}

// ─── Synchronisation avec le stockage ──────────────────────────────────────
// La popup se ferme souvent pendant l'OAuth, et le service worker peut invalider une session
// ou ajouter des vérifications : on suit donc les changements du stockage.

function onTokenChange(service: TrackerId, change: chrome.storage.StorageChange | undefined): void {
  if (!change) return;
  const store = accountStore(service);
  const state = store.get();
  const hasToken = change.newValue !== undefined;
  if (!hasToken && state.status === 'logged-in') store.set(LOGGED_OUT);
  else if (hasToken && state.status === 'logged-out' && !state.pending) void bootstrap(service);
}

chrome.storage.onChanged.addListener((changes, areaName): void => {
  if (areaName !== 'local') return;

  onTokenChange('anilist', changes[STORAGE_KEYS.anilistToken]);
  onTokenChange('mal', changes[STORAGE_KEYS.malToken]);

  const viewerChange = changes[STORAGE_KEYS.anilistViewer];
  const anilist = anilistStore.get();
  if (viewerChange && anilist.status === 'logged-in' && isAniListViewer(viewerChange.newValue)) {
    anilistStore.set({ ...anilist, viewer: viewerChange.newValue });
  }

  const malViewerChange = changes[STORAGE_KEYS.malViewer];
  const mal = malStore.get();
  if (malViewerChange && mal.status === 'logged-in' && isMalViewer(malViewerChange.newValue)) {
    malStore.set({ ...mal, viewer: malViewerChange.newValue });
  }

  if (changes[STORAGE_KEYS.pendingReviews] || changes[STORAGE_KEYS.recentSyncs]) void loadSyncData();

  const settingsChange = changes[SETTINGS_STORAGE_KEY];
  if (settingsChange) settingsStore.set({ status: 'ready', settings: normalizeSettings(settingsChange.newValue) });

  if (changes[STORAGE_KEYS.mediaMappings]) void settingsScreen.refreshMappings();

  // Synchro dans un onglet : le service worker ne met pas le cache « En cours » à jour → revalidation
  if (changes[STORAGE_KEYS.recentSyncs]) scheduleWatchingRevalidation();
});

const REVALIDATE_DEBOUNCE_MS = 1_000;
let revalidateTimer: ReturnType<typeof setTimeout> | undefined;

/** Revalidation silencieuse (liste actuelle conservée, pas de skeleton), regroupée sur ~1 s */
function scheduleWatchingRevalidation(): void {
  clearTimeout(revalidateTimer);
  revalidateTimer = setTimeout(() => {
    revalidateTimer = undefined;
    const shown = watchingStore.get();
    if (shown.status === 'ready' && shown.service === activeService()) void loadWatching(shown.service);
  }, REVALIDATE_DEBOUNCE_MS);
}

// ─── Démarrage ────────────────────────────────────────────────────────────

anilistStore.subscribe(syncWatchingSource);
malStore.subscribe(syncWatchingSource);
uiStore.subscribe(syncWatchingSource);
uiStore.subscribe(syncSortMenuListeners);
for (const store of [anilistStore, malStore, syncStore, uiStore, watchingStore]) store.subscribe(render);
settingsStore.subscribe((state) => {
  settingsScreen.updateSettings(state);
  render();
});

// Les comptes à rebours et « il y a… » vieillissent tant que le popup reste ouvert
setInterval(() => {
  now = Date.now();
  render();
}, CLOCK_TICK_MS);

void loadSettings();
void loadSyncData();
void settingsScreen.refreshMappings();
// La source préférée est lue avant les comptes : évite de charger la mauvaise liste puis de basculer
void loadPrefs().then(() => Promise.all([bootstrap('anilist'), bootstrap('mal')]));
