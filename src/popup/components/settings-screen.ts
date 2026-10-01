import { formatAiringStatus, type AiringCheckResult } from '../../shared/airing.types';
import type { AniListViewer } from '../../shared/anilist.types';
import type { StreamingPlatform } from '../../shared/episode.types';
import { includeSeries, type ExcludedSeries } from '../../shared/exclusions';
import { sendMessage } from '../../shared/messages';
import type { MalViewer } from '../../shared/mal.types';
import { AIRING_DELAYS, type AiringDelayHours } from '../../shared/engagement.types';
import { normalizeSettings, PERCENTAGE_RANGE, saveSettings, type NotificationLevel, type SyncSettings } from '../../shared/settings';
import { clearMediaMappings, deleteMediaMapping, getMediaMappings } from '../../shared/storage';
import type { MediaMapping } from '../../shared/sync.types';
import { TRACKER_LABELS, type TrackerId } from '../../shared/tracker.types';
import { h, nodes, preserveFocus, type Child } from '../../ui/dom';
import { icon } from '../../ui/icons';
import type { AccountState, ExclusionsState, SettingsState } from '../state';
import { renderAlert } from './alert';
import { BTN_GHOST, CARD, LINK, sectionLabel, segmented, SERVICE_CHIPS, serviceAvatar } from './ui';

const REPO_URL = 'https://github.com/QuentinGeerts/SyncKai';
const ISSUES_URL = 'https://github.com/QuentinGeerts/SyncKai/issues';
const SAVED_BADGE_MS = 1_500;
const DIVIDER = 'border-t border-dotted border-line';
const COMMAND_NAME = 'complete-episode';
const SHORTCUTS_URL = 'chrome://extensions/shortcuts';

/** "Alt+Shift+S" → "Alt+Maj+S" (libellés de clavier français) */
function formatShortcut(shortcut: string): string {
  return shortcut.replace(/Shift/g, 'Maj');
}

export interface AccountsProps {
  anilist: AccountState<AniListViewer>;
  mal: AccountState<MalViewer>;
  onLogin: (service: TrackerId) => void;
  onLogout: (service: TrackerId) => void;
  onRetry: (service: TrackerId) => void;
}

export interface SettingsScreen {
  readonly element: HTMLElement;
  /** Retour d'enregistrement, affiché dans la barre « Réglages » */
  readonly status: HTMLElement;
  updateAccounts(props: AccountsProps): void;
  updateSettings(state: SettingsState): void;
  refreshMappings(): Promise<void>;
  updateExclusions(state: ExclusionsState): void;
  /** Dernier résumé de vérification des sorties (`airingLastResult`) ; `now` pour le « il y a… » */
  updateAiring(result: AiringCheckResult | null, now: number): void;
}

// ─── Contrôles ────────────────────────────────────────────────────────────

function renderSwitch(id: string, checked: boolean, describedBy: string, onChange: (checked: boolean) => void): HTMLElement {
  const input = h('input', {
    class: 'peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0',
    attrs: { id, type: 'checkbox', role: 'switch', 'aria-describedby': describedBy, 'data-focus': id },
    on: { change: () => onChange(input.checked) },
  });
  input.checked = checked;
  return h(
    'span',
    { class: 'relative inline-block h-8 w-11 shrink-0' },
    input,
    h('span', {
      class:
        "pointer-events-none absolute inset-x-0.5 inset-y-1 rounded-full bg-line transition-colors peer-checked:bg-sakura peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lavender after:absolute after:top-[3px] after:left-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:after:translate-x-4",
    }),
  );
}

function renderRadio(name: string, checked: boolean, label: string, onSelect: () => void): HTMLElement {
  const input = h('input', {
    class: 'm-0 h-4 w-4 shrink-0 cursor-pointer',
    attrs: { type: 'radio', name, 'data-focus': `${name}-${label}` },
    on: { change: () => input.checked && onSelect() },
  });
  input.checked = checked;
  return h('label', { class: 'flex min-h-8 cursor-pointer items-center gap-2 text-[12px]' }, input, label);
}

const PLAYER_OPTIONS = [
  { value: 'crunchyroll', label: 'Crunchyroll' },
  { value: 'adn', label: 'ADN' },
] as const satisfies readonly { value: StreamingPlatform; label: string }[];

type NotifGlyph = 'pill' | 'bubble' | 'alert';

const NOTIFICATION_OPTIONS: readonly { value: NotificationLevel; title: string; desc: string; glyph: NotifGlyph; recommended: boolean }[] = [
  {
    value: 'discreet',
    title: 'Discrètes',
    desc: 'Petite pastille 3 s dans un coin. Rien en plein écran, l’icône de l’extension affiche une coche.',
    glyph: 'pill',
    recommended: true,
  },
  { value: 'detailed', title: 'Détaillées', desc: 'Bulle complète avec le résultat AniList et MyAnimeList.', glyph: 'bubble', recommended: false },
  { value: 'alerts-only', title: 'Alertes seulement', desc: 'Uniquement s’il faut agir : à vérifier, erreur, reconnexion.', glyph: 'alert', recommended: false },
];

type DelayKey = `${AiringDelayHours}`;

/** Délais du segmenté (valeurs texte : le contrôle segmenté travaille sur des chaînes) */
const DELAY_OPTIONS = AIRING_DELAYS.map((hours) => ({ value: `${hours}` as DelayKey, label: `${hours} h`, aria: `${hours} heure${hours > 1 ? 's' : ''} après la diffusion` }));

function delayFromKey(key: DelayKey): AiringDelayHours {
  return AIRING_DELAYS.find((hours) => `${hours}` === key) ?? AIRING_DELAYS[0];
}

/** Miniature d'écran illustrant chaque niveau de notification */
function notifGlyph(glyph: NotifGlyph): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] => {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };
  const svg = el('svg', { viewBox: '0 0 32 24', 'aria-hidden': 'true', class: 'mt-0.5 h-6 w-8 shrink-0' });
  svg.append(el('rect', { x: '0.75', y: '0.75', width: '30.5', height: '22.5', rx: '4', fill: '#16131F', stroke: '#3D3554', 'stroke-width': '1.5' }));
  if (glyph === 'pill') svg.append(el('rect', { x: '18', y: '16', width: '10', height: '4', rx: '2', fill: '#7EE0C3' }));
  if (glyph === 'bubble') {
    svg.append(
      el('rect', { x: '12', y: '8', width: '16', height: '12', rx: '2.5', fill: '#FF8FB8' }),
      el('rect', { x: '15', y: '11', width: '10', height: '1.5', rx: '0.75', fill: '#1A0F1C' }),
      el('rect', { x: '15', y: '15', width: '7', height: '1.5', rx: '0.75', fill: '#1A0F1C' }),
    );
  }
  if (glyph === 'alert') {
    svg.append(
      el('path', { d: 'M23 8 28.5 18H17.5Z', fill: '#FFD37A', stroke: '#FFD37A', 'stroke-width': '1.5', 'stroke-linejoin': 'round' }),
      el('path', { d: 'M23 11.5V14', stroke: '#1A0F1C', 'stroke-width': '1.5', 'stroke-linecap': 'round' }),
      el('circle', { cx: '23', cy: '16.2', r: '0.8', fill: '#1A0F1C' }),
    );
  }
  return svg;
}

// ─── Comptes ──────────────────────────────────────────────────────────────

function viewerAvatar(service: TrackerId, url: string | null): HTMLElement {
  if (!url) return serviceAvatar(service, 'ok');
  const img = h('img', { class: 'h-8 w-8 rounded-full object-cover', attrs: { src: url, alt: '', referrerpolicy: 'no-referrer' } });
  img.addEventListener('error', () => img.replaceWith(SERVICE_CHIPS[service].short), { once: true });
  return serviceAvatar(service, 'ok', img);
}

function accountRow(service: TrackerId, state: AccountState<AniListViewer | MalViewer>, props: AccountsProps, first: boolean): Child[] {
  const label = TRACKER_LABELS[service];
  const row = (...children: Child[]): HTMLElement =>
    h('div', { class: `flex min-h-[52px] items-center gap-3 ${first ? '' : DIVIDER}` }, ...children);
  const text = (title: Child, sub: string, subClass = 'text-muted'): HTMLElement =>
    h(
      'div',
      { class: 'flex min-w-0 flex-1 flex-col gap-0.5' },
      h('span', { class: 'truncate text-[13px] font-bold' }, title),
      h('span', { class: `text-[11px] font-semibold ${subClass}` }, sub),
    );

  if (state.status === 'loading' || (state.status === 'logged-in' && !state.viewer)) {
    return [
      row(
        h('span', { class: 'h-8 w-8 shrink-0 rounded-full bg-raised motion-safe:animate-pulse' }),
        h('div', { class: 'flex flex-1 flex-col gap-1.5 motion-safe:animate-pulse', attrs: { 'aria-busy': 'true', 'aria-label': `Chargement du compte ${label}` } },
          h('span', { class: 'h-3 w-24 rounded bg-raised' }), h('span', { class: 'h-2.5 w-20 rounded bg-raised' })),
      ),
    ];
  }

  if (state.status === 'logged-out') {
    return [
      row(
        serviceAvatar(service, state.expired ? 'expired' : null),
        text(label, state.expired ? 'Session expirée' : 'Non connecté', state.expired ? 'text-danger' : 'text-muted'),
        h(
          'button',
          {
            class: `${BTN_GHOST} text-sakura`,
            attrs: { type: 'button', 'aria-label': `${state.expired ? 'Reconnecter' : 'Connecter'} ${label}`, 'data-focus': `login-${service}`, ...(state.pending ? { disabled: '' } : {}) },
            on: { click: () => props.onLogin(service) },
          },
          state.pending && icon('spinner', 'h-3.5 w-3.5 motion-safe:animate-spin'),
          state.pending ? 'Connexion…' : state.expired ? 'Reconnecter' : 'Connecter',
        ),
      ),
      state.error && h('div', { class: 'pr-2 pb-2' }, renderAlert({ message: state.error })),
    ];
  }

  const viewer = state.viewer;
  if (!viewer) return []; // Garde de type : cas couvert par le skeleton
  const avatarUrl = 'avatarUrl' in viewer ? viewer.avatarUrl : viewer.pictureUrl;
  const profileUrl = 'siteUrl' in viewer ? viewer.siteUrl : `https://myanimelist.net/profile/${encodeURIComponent(viewer.name)}`;

  return [
    row(
      viewerAvatar(service, avatarUrl),
      text(
        h('a', { class: 'text-ink hover:underline', attrs: { href: profileUrl, target: '_blank', rel: 'noopener noreferrer', title: `Ouvrir mon profil ${label}` } }, viewer.name),
        `${label} · connecté`,
      ),
      h(
        'button',
        {
          class: `${BTN_GHOST} text-danger`,
          attrs: { type: 'button', 'aria-label': `Déconnecter ${label}`, 'data-focus': `logout-${service}` },
          on: { click: () => props.onLogout(service) },
        },
        'Déconnecter',
      ),
    ),
    state.error && h('div', { class: 'pr-2 pb-2' }, renderAlert({ message: state.error, action: { label: 'Réessayer', onClick: () => props.onRetry(service) } })),
  ];
}

// ─── Correspondances ──────────────────────────────────────────────────────

function numberingLabel(mapping: MediaMapping): string {
  const source = mapping.numbering === 'displayed' ? 'numéro affiché' : 'numéro de saison';
  return mapping.offset !== 0 ? `${source}, décalage de ${mapping.offset}` : source;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n > 1 ? 's' : ''}`;
}

// ─── Écran ────────────────────────────────────────────────────────────────

export function createSettingsScreen(): SettingsScreen {
  const status = h('span', { class: 'flex items-center gap-1 text-[11px] font-bold opacity-0 transition-opacity', attrs: { 'aria-live': 'polite' } });
  const accountsCard = h('div', { class: `${CARD} flex flex-col py-1 pr-1 pl-3` });
  const formSlot = h('div', { class: 'flex flex-col gap-4' });
  const mappingsCard = h('div', { class: `${CARD} overflow-hidden` });

  let settings: SyncSettings | null = null;
  let loadError = false;
  let badgeTimer: ReturnType<typeof setTimeout> | undefined;

  let mappings: [string, MediaMapping][] = [];
  let mappingsError: string | null = null;
  let expanded = false;
  let confirmingReset = false;

  const version = chrome.runtime.getManifest().version;

  /** Raccourci clavier « valider l'épisode » : undefined = en lecture, '' = non défini */
  let shortcut: string | undefined;
  const exclusionsCard = h('div', { class: `${CARD} overflow-hidden` });
  let exclusions: ExclusionsState = { status: 'loading' };
  let reactivatingId: string | null = null;
  let exclusionsError: string | null = null;

  // Ligne d'état des alertes : emplacement persistant, redessiné seul (tic d'horloge, stockage) sans refaire le formulaire
  const airingSlot = h('div', { class: `flex items-center justify-between gap-2 pt-2 ${DIVIDER}` });
  let airingResult: AiringCheckResult | null = null;
  let airingNow = Date.now();
  let airingPending = false;

  function drawAiring(): void {
    preserveFocus(airingSlot, () => airingSlot.replaceChildren(...nodes(renderAiring())));
  }

  function renderAiring(): Child[] {
    const enabled = settings?.airingAlerts ?? false;
    const line = formatAiringStatus(airingResult, airingNow);
    return [
      h(
        'span',
        { class: `min-w-0 text-[11px] font-semibold ${line.tone === 'danger' ? 'text-danger' : 'text-muted'}`, attrs: { role: 'status', 'aria-live': 'polite' } },
        airingPending ? 'Vérification en cours…' : line.text,
      ),
      h(
        'button',
        {
          class: `${BTN_GHOST} text-sakura`,
          attrs: {
            type: 'button',
            'data-focus': 'airing-check',
            title: enabled ? 'Interroger le calendrier AniList maintenant' : 'Active les alertes pour vérifier',
            ...(!enabled || airingPending ? { disabled: '' } : {}),
          },
          on: { click: () => void checkAiringNow() },
        },
        airingPending && icon('spinner', 'h-3 w-3 motion-safe:animate-spin'),
        'Vérifier maintenant',
      ),
    ];
  }

  /** Ligne réinsérée à chaque rendu du formulaire (l'état « alertes actives » du bouton en dépend) */
  function airingRow(): HTMLElement {
    drawAiring();
    return airingSlot;
  }

  async function checkAiringNow(): Promise<void> {
    if (airingPending) return;
    airingPending = true;
    drawAiring();
    try {
      const result = await sendMessage('CHECK_AIRING', null);
      // Réponse de secours du service worker : horodatage absent
      airingResult = { ...result, checkedAt: result.checkedAt || Date.now() };
    } catch (error: unknown) {
      console.error('[SyncKai] Vérification des sorties impossible :', error);
      airingResult = { checkedAt: Date.now(), notified: 0, skipped: null, error: 'service indisponible, réessaie' };
    }
    airingNow = Date.now();
    airingPending = false;
    drawAiring();
  }

  function showStatus(ok: boolean): void {
    clearTimeout(badgeTimer);
    status.className = `flex items-center gap-1 text-[11px] font-bold transition-opacity ${ok ? 'text-mint' : 'text-danger'}`;
    status.replaceChildren(icon(ok ? 'check' : 'alert', 'h-3 w-3', ok ? '3' : '2'), ok ? 'Enregistré' : 'Échec');
    status.title = ok ? '' : 'Échec de l’enregistrement, rouvre le popup';
    // L'erreur reste affichée : l'interface ne reflète plus le stockage
    if (ok) badgeTimer = setTimeout(() => status.classList.add('opacity-0'), SAVED_BADGE_MS);
  }

  async function update(patch: Partial<SyncSettings>, redraw = false): Promise<void> {
    if (!settings) return;
    settings = { ...settings, ...patch };
    if (redraw) drawForm();
    try {
      await saveSettings(settings);
      showStatus(true);
    } catch (error: unknown) {
      console.error('[SyncKai] Enregistrement des réglages impossible :', error);
      showStatus(false);
    }
  }

  function drawForm(): void {
    preserveFocus(formSlot, () => formSlot.replaceChildren(...renderForm()));
  }

  function renderForm(): Node[] {
    if (loadError) return [renderAlert({ message: 'Impossible de lire les réglages. Rouvre le popup.' })];
    const s = settings;
    if (!s) {
      return [h('div', { class: `${CARD} h-40 motion-safe:animate-pulse`, attrs: { 'aria-busy': 'true', 'aria-label': 'Chargement des réglages' } })];
    }

    const percentLabel = h('span', { class: 'shrink-0 text-[12px] font-bold tabular-nums', attrs: { 'aria-hidden': 'true' } }, `${s.completionPercentage} %`);
    const range = h('input', {
      class: 'm-0 h-6 w-full cursor-pointer',
      attrs: {
        id: 'sk-pct',
        type: 'range',
        min: String(PERCENTAGE_RANGE.min),
        max: String(PERCENTAGE_RANGE.max),
        step: '1',
        'aria-describedby': 'sk-pct-help',
        'aria-valuetext': `${s.completionPercentage} %`,
        'data-focus': 'pct',
      },
      on: {
        // "input" met à jour l'affichage en continu, "change" n'enregistre qu'au relâchement
        input: () => {
          percentLabel.textContent = `${range.value} %`;
          range.setAttribute('aria-valuetext', `${range.value} %`);
        },
        change: () => void update({ completionPercentage: Number(range.value) }),
      },
    });
    range.value = String(s.completionPercentage);

    const notifCards = NOTIFICATION_OPTIONS.map((opt) => {
      const input = h('input', {
        class: 'm-0 mt-0.5 h-4 w-4 shrink-0 cursor-pointer',
        attrs: { type: 'radio', name: 'sk-notif', value: opt.value, 'data-focus': `notif-${opt.value}` },
        on: { change: () => input.checked && void update({ notificationLevel: opt.value }) },
      });
      input.checked = s.notificationLevel === opt.value;
      return h(
        'label',
        {
          class:
            'flex min-h-11 cursor-pointer items-start gap-3 rounded-[10px] border-[1.5px] border-line p-2 transition-colors has-checked:border-sakura has-checked:bg-raised has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-lavender',
        },
        notifGlyph(opt.glyph),
        h(
          'span',
          { class: 'flex min-w-0 flex-1 flex-col gap-0.5' },
          h(
            'span',
            { class: 'flex items-center gap-1.5' },
            h('span', { class: 'text-[13px] font-bold' }, opt.title),
            opt.recommended && h('span', { class: 'inline-flex h-[18px] items-center rounded-full bg-mint px-2 text-[11px] font-bold text-on-fill' }, 'Recommandé'),
          ),
          h('span', { class: 'text-[11px] leading-[15px] font-semibold text-muted' }, opt.desc),
        ),
        input,
      );
    });

    return [
      h(
        'section',
        { class: 'flex flex-col gap-2' },
        sectionLabel('Lecture'),
        h(
          'div',
          { class: `${CARD} flex flex-col gap-2 p-3` },
          h(
            'div',
            { class: 'flex items-center justify-between gap-2' },
            h('span', { class: 'text-[13px] font-bold', attrs: { id: 'sk-player-label' } }, 'Lecteur préféré'),
            segmented({
              options: PLAYER_OPTIONS,
              current: s.preferredPlayer,
              onPick: (value) => void update({ preferredPlayer: value }, true),
              attrs: { 'aria-labelledby': 'sk-player-label' },
              focusKey: 'player',
              activeClass: 'bg-sakura',
              trackClass: 'bg-ground',
            }),
          ),
          h('span', { class: 'text-[11px] font-semibold text-muted' }, 'Utilisé par « Ouvrir » quand l’anime est disponible sur les deux plateformes'),
        ),
      ),
      h(
        'section',
        { class: 'flex flex-col gap-2' },
        sectionLabel('Synchronisation'),
        h(
          'div',
          { class: `${CARD} flex flex-col gap-2 px-3 pt-2 pb-3` },
          h(
            'div',
            { class: 'flex flex-col' },
            h(
              'div',
              { class: 'flex items-center justify-between gap-3' },
              h('label', { class: 'cursor-pointer text-[13px] font-bold', attrs: { for: 'sk-auto' } }, 'Synchro automatique'),
              renderSwitch('sk-auto', s.autoSync, 'sk-auto-help', (checked) => void update({ autoSync: checked })),
            ),
            h('span', { class: 'text-[11px] font-semibold text-muted', attrs: { id: 'sk-auto-help' } }, 'En pause, aucun épisode n’est envoyé'),
          ),
          h(
            'fieldset',
            { class: `m-0 flex flex-col border-0 p-0 pt-2 ${DIVIDER}` },
            h('legend', { class: 'float-left mb-0.5 w-full p-0 text-[13px] font-bold' }, 'Épisode vu'),
            renderRadio('sk-trigger', s.completionTrigger === 'credits', 'Au début du générique (recommandé)', () => void update({ completionTrigger: 'credits' }, true)),
            renderRadio('sk-trigger', s.completionTrigger === 'percentage', 'À un pourcentage fixe', () => void update({ completionTrigger: 'percentage' }, true)),
          ),
          h(
            'div',
            { class: 'flex flex-col gap-1' },
            h(
              'div',
              { class: 'flex items-center justify-between gap-3' },
              h('label', { class: 'text-[12px] font-bold', attrs: { for: 'sk-pct' } }, s.completionTrigger === 'percentage' ? 'Pourcentage' : 'Pourcentage de repli'),
              percentLabel,
            ),
            range,
            h(
              'span',
              { class: 'text-[11px] font-semibold text-muted', attrs: { id: 'sk-pct-help' } },
              s.completionTrigger === 'percentage' ? 'Appliqué à partir de l’épisode suivant' : 'Utilisé si la plateforme ne fournit pas le générique (ADN)',
            ),
          ),
          renderShortcutHint(),
        ),
      ),
      h(
        'section',
        { class: 'flex flex-col gap-2' },
        sectionLabel('Notifications sur la page', 'sk-notif-title'),
        h(
          'div',
          { class: `${CARD} flex flex-col gap-2 p-2` },
          h('div', { class: 'flex flex-col gap-1', attrs: { role: 'radiogroup', 'aria-labelledby': 'sk-notif-title' } }, ...notifCards),
          h('span', { class: 'px-1 text-[11px] font-semibold text-muted' }, 'Les alertes s’affichent toujours, quel que soit ce réglage.'),
          h(
            'div',
            { class: `flex flex-col px-1 pt-2 pb-1 ${DIVIDER}` },
            h(
              'div',
              { class: 'flex items-center justify-between gap-3' },
              h('label', { class: 'cursor-pointer text-[13px] font-bold', attrs: { for: 'sk-rating' } }, 'Proposer de noter en fin de série'),
              renderSwitch('sk-rating', s.ratingPrompt, 'sk-rating-help', (checked) => void update({ ratingPrompt: checked })),
            ),
            h('span', { class: 'text-[11px] font-semibold text-muted', attrs: { id: 'sk-rating-help' } }, 'Une bulle « Ta note ? » quand une série passe en Terminé'),
          ),
        ),
      ),
      h(
        'section',
        { class: 'flex flex-col gap-2' },
        sectionLabel('Nouveaux épisodes'),
        h(
          'div',
          { class: `${CARD} flex flex-col gap-2 px-3 pt-2 pb-3` },
          h(
            'div',
            { class: 'flex items-center justify-between gap-3' },
            h('label', { class: 'cursor-pointer text-[13px] font-bold', attrs: { for: 'sk-airing' } }, 'Me notifier à la sortie d’un épisode'),
            renderSwitch('sk-airing', s.airingAlerts, 'sk-airing-help', (checked) => void update({ airingAlerts: checked }, true)),
          ),
          h(
            'div',
            { class: `flex items-center justify-between gap-2 pt-2 ${DIVIDER}` },
            h('span', { class: `text-[12px] font-bold ${s.airingAlerts ? '' : 'text-muted'}`, attrs: { id: 'sk-delay-label' } }, 'Délai'),
            segmented({
              options: DELAY_OPTIONS,
              current: `${s.airingDelayHours}`,
              onPick: (value) => void update({ airingDelayHours: delayFromKey(value) }, true),
              attrs: { 'aria-labelledby': 'sk-delay-label', 'aria-describedby': 'sk-airing-help' },
              focusKey: 'delay',
              activeClass: 'bg-sakura',
              trackClass: 'bg-ground',
              disabled: !s.airingAlerts,
            }),
          ),
          h(
            'span',
            { class: 'text-[11px] font-semibold text-muted', attrs: { id: 'sk-airing-help' } },
            'Heure de diffusion au Japon ; Crunchyroll et ADN publient souvent un peu plus tard.',
          ),
          airingRow(),
        ),
      ),
    ];
  }

  function renderShortcutHint(): HTMLElement {
    const text =
      shortcut === undefined
        ? 'Raccourci clavier…'
        : shortcut
          ? h('span', {}, 'Raccourci : ', h('kbd', { class: 'font-body font-bold text-ink' }, formatShortcut(shortcut)), ' pour valider l’épisode en cours')
          : 'Aucun raccourci défini pour valider l’épisode en cours';
    return h(
      'div',
      { class: `flex items-center justify-between gap-2 pt-2 ${DIVIDER}` },
      h('span', { class: 'min-w-0 text-[11px] font-semibold text-muted' }, text),
      h(
        'button',
        {
          class: `${LINK} inline-flex min-h-8 shrink-0 cursor-pointer items-center bg-transparent px-1 text-[12px] font-bold`,
          attrs: { type: 'button', 'aria-label': 'Modifier le raccourci clavier (page des raccourcis de Chrome)', 'data-focus': 'shortcut' },
          // Les pages chrome:// ne s'ouvrent pas via un lien : passage par l'API tabs
          on: { click: () => void chrome.tabs.create({ url: SHORTCUTS_URL }) },
        },
        shortcut ? 'Modifier' : 'Définir',
      ),
    );
  }

  async function loadShortcut(): Promise<void> {
    try {
      const commands = await chrome.commands.getAll();
      shortcut = commands.find((c) => c.name === COMMAND_NAME)?.shortcut ?? '';
    } catch (error: unknown) {
      console.warn('[SyncKai] Lecture du raccourci impossible :', error);
      shortcut = '';
    }
    drawForm();
  }

  // ─── Séries exclues ─────────────────────────────────────────────────────

  function drawExclusions(): void {
    preserveFocus(exclusionsCard, () => exclusionsCard.replaceChildren(...nodes(renderExclusions())));
  }

  function renderExclusionRow(item: ExcludedSeries, first: boolean): HTMLElement {
    const busy = reactivatingId === item.id;
    return h(
      'li',
      { class: `flex min-h-11 items-center gap-2 ${first ? '' : DIVIDER}` },
      icon('ban', 'h-3.5 w-3.5 text-muted'),
      h('span', { class: 'min-w-0 flex-1 truncate text-[12px] font-bold', attrs: { title: item.label } }, item.label),
      h(
        'button',
        {
          class: `${BTN_GHOST} text-sakura`,
          attrs: { type: 'button', 'aria-label': `Réactiver la synchro de ${item.label}`, 'data-focus': `include-${item.id}`, ...(reactivatingId !== null ? { disabled: '' } : {}) },
          on: { click: () => void reactivate(item.id) },
        },
        busy && icon('spinner', 'h-3 w-3 motion-safe:animate-spin'),
        'Réactiver',
      ),
    );
  }

  function renderExclusions(): Child[] {
    if (exclusions.status === 'loading') {
      return [h('div', { class: 'm-3 h-5 rounded bg-raised motion-safe:animate-pulse', attrs: { 'aria-busy': 'true', 'aria-label': 'Chargement des séries exclues' } })];
    }
    if (exclusions.status === 'error') return [h('div', { class: 'p-3' }, renderAlert({ message: 'Impossible de lire les séries exclues.' }))];
    const { items } = exclusions;
    return [
      items.length > 0
        ? h('ul', { class: 'm-0 list-none py-0 pr-1 pl-3' }, ...items.map((item, i) => renderExclusionRow(item, i === 0)))
        : h('p', { class: 'm-0 flex min-h-11 items-center px-3 text-[12px] text-muted' }, 'Aucune série exclue.'),
      exclusionsError && h('div', { class: 'px-3 pb-3' }, renderAlert({ message: exclusionsError })),
    ];
  }

  async function reactivate(id: string): Promise<void> {
    reactivatingId = id;
    exclusionsError = null;
    drawExclusions();
    try {
      // La liste est relue par le popup via storage.onChanged
      await includeSeries(id);
    } catch (error: unknown) {
      console.error('[SyncKai] Réactivation de la série impossible :', error);
      exclusionsError = 'La série n’a pas pu être réactivée. Réessaie.';
    }
    reactivatingId = null;
    drawExclusions();
  }

  function drawMappings(): void {
    preserveFocus(mappingsCard, () => mappingsCard.replaceChildren(...nodes(renderMappings())));
  }

  function renderMappings(): Child[] {
    const count = mappings.length;
    const summary = count > 0 ? `${plural(count, 'série')} ${count > 1 ? 'mémorisées' : 'mémorisée'}` : 'Aucune correspondance pour l’instant';

    const header =
      count > 0
        ? h(
            'button',
            {
              class: 'flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 bg-transparent px-3 text-left text-ink transition-colors hover:bg-raised',
              attrs: { type: 'button', 'aria-expanded': String(expanded), 'aria-controls': 'sk-maps', 'data-focus': 'maps-toggle' },
              on: {
                click: () => {
                  expanded = !expanded;
                  confirmingReset = false;
                  drawMappings();
                },
              },
            },
            h('span', { class: 'text-[13px] font-bold' }, summary),
            h(
              'span',
              { class: 'inline-flex items-center gap-1 text-[12px] font-bold text-sakura' },
              expanded ? 'Masquer' : 'Gérer',
              icon('chevronDown', `h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`, '2.6'),
            ),
          )
        : h('p', { class: 'm-0 flex min-h-11 items-center px-3 text-[12px] text-muted' }, summary);

    if (!expanded || count === 0) return [header, mappingsError && h('div', { class: 'px-3 pb-3' }, renderAlert({ message: mappingsError }))];

    const rows = mappings.map(([key, mapping]) => {
      const label = mapping.seriesLabel ?? key;
      return h(
        'li',
        { class: `flex min-h-12 items-center gap-2 ${DIVIDER}` },
        h(
          'div',
          { class: 'flex min-w-0 flex-1 flex-col gap-0.5' },
          h('span', { class: 'truncate text-[12px] font-bold', attrs: { title: key } }, label),
          h(
            'span',
            { class: 'truncate text-[11px] font-semibold text-muted' },
            '→ ',
            h(
              'a',
              { class: LINK, attrs: { href: `https://anilist.co/anime/${mapping.mediaId}`, target: '_blank', rel: 'noopener noreferrer' } },
              mapping.mediaTitle ?? `Fiche AniList #${mapping.mediaId}`,
            ),
            ` · ${numberingLabel(mapping)}`,
          ),
        ),
        h(
          'button',
          {
            class: `${BTN_GHOST} text-danger`,
            attrs: { type: 'button', 'aria-label': `Oublier ${label}`, title: 'La correspondance sera recalculée au prochain épisode', 'data-focus': `forget-${key}` },
            on: { click: () => void runMappingAction(() => deleteMediaMapping(key)) },
          },
          'Oublier',
        ),
      );
    });

    const resetControls = confirmingReset
      ? h(
          'div',
          { class: 'flex flex-wrap items-center justify-end gap-2' },
          h('span', { class: 'text-[12px] font-semibold text-butter' }, 'Oublier toutes les correspondances ?'),
          h(
            'button',
            {
              class: `${BTN_GHOST} text-muted`,
              attrs: { type: 'button', 'data-focus': 'reset-cancel' },
              on: {
                click: () => {
                  confirmingReset = false;
                  drawMappings();
                },
              },
            },
            'Annuler',
          ),
          h(
            'button',
            {
              class: 'inline-flex h-8 cursor-pointer items-center rounded-full bg-danger px-3.5 text-[12px] font-bold text-on-fill transition hover:brightness-105',
              attrs: { type: 'button', 'data-focus': 'reset-confirm' },
              on: {
                click: () => {
                  confirmingReset = false;
                  void runMappingAction(clearMediaMappings);
                },
              },
            },
            'Confirmer',
          ),
        )
      : h(
          'div',
          { class: 'flex justify-end' },
          h(
            'button',
            {
              class: `${BTN_GHOST} border border-danger px-3.5 text-danger`,
              attrs: { type: 'button', 'data-focus': 'reset' },
              on: {
                click: () => {
                  confirmingReset = true;
                  drawMappings();
                },
              },
            },
            'Tout réinitialiser',
          ),
        );

    return [
      header,
      h('p', { class: 'm-0 px-3 pb-2 text-[11px] font-semibold text-muted' }, 'Oublier une correspondance la fait recalculer au prochain épisode (utile si elle est fausse).'),
      h('ul', { class: 'm-0 list-none py-0 pr-1 pl-3', attrs: { id: 'sk-maps' } }, ...rows),
      mappingsError && h('div', { class: 'px-3 pb-2' }, renderAlert({ message: mappingsError })),
      h('div', { class: `px-3 pt-2 pb-3 ${DIVIDER}` }, resetControls),
    ];
  }

  async function runMappingAction(action: () => Promise<void>): Promise<void> {
    try {
      await action();
      mappingsError = null;
    } catch (error: unknown) {
      console.error('[SyncKai] Modification des correspondances impossible :', error);
      mappingsError = 'La modification n’a pas pu être enregistrée. Réessaie.';
    }
    await refreshMappings();
  }

  async function refreshMappings(): Promise<void> {
    try {
      mappings = Object.entries(await getMediaMappings()).sort(([a], [b]) => a.localeCompare(b));
    } catch (error: unknown) {
      console.error('[SyncKai] Lecture des correspondances impossible :', error);
      mappingsError = 'Impossible de lire les correspondances.';
    }
    if (mappings.length === 0) expanded = false;
    drawMappings();
  }

  const element = h(
    'div',
    { class: 'flex flex-col gap-4 pb-3' },
    h('section', { class: 'flex flex-col gap-2' }, sectionLabel('Comptes'), accountsCard),
    formSlot,
    h('section', { class: 'flex flex-col gap-2' }, sectionLabel('Correspondances'), mappingsCard),
    h('section', { class: 'flex flex-col gap-2' }, sectionLabel('Séries exclues'), exclusionsCard),
    h(
      'section',
      { class: 'flex flex-col gap-2' },
      sectionLabel('À propos'),
      h(
        'div',
        { class: `${CARD} flex flex-col px-3 py-1` },
        h(
          'div',
          { class: 'flex min-h-10 items-center justify-between gap-2' },
          h('span', { class: 'text-[13px] font-bold' }, 'SyncKai'),
          h('span', { class: 'text-[11px] font-semibold text-muted tabular-nums' }, `v${version}`),
        ),
        h(
          'div',
          { class: `flex min-h-10 items-center gap-4 ${DIVIDER}` },
          h('a', { class: `${LINK} inline-flex min-h-8 items-center text-[12px] font-bold`, attrs: { href: REPO_URL, target: '_blank', rel: 'noopener noreferrer' } }, 'Code source sur GitHub'),
          h('a', { class: `${LINK} inline-flex min-h-8 items-center text-[12px] font-bold`, attrs: { href: ISSUES_URL, target: '_blank', rel: 'noopener noreferrer' } }, 'Signaler un problème'),
        ),
      ),
    ),
  );

  drawForm();
  drawMappings();
  drawExclusions();
  void loadShortcut();

  return {
    element,
    status,
    updateAccounts(props) {
      preserveFocus(accountsCard, () =>
        accountsCard.replaceChildren(...nodes([...accountRow('anilist', props.anilist, props, true), ...accountRow('mal', props.mal, props, false)])),
      );
    },
    updateSettings(state) {
      loadError = state.status === 'error';
      if (state.status !== 'ready') {
        settings = null;
        drawForm();
        return;
      }
      // Nos propres enregistrements reviennent par storage.onChanged : pas de nouveau rendu s'ils sont identiques
      const next = normalizeSettings(state.settings);
      if (settings && JSON.stringify(normalizeSettings(settings)) === JSON.stringify(next)) return;
      settings = next;
      drawForm();
    },
    refreshMappings,
    updateAiring(result, now) {
      airingResult = result;
      airingNow = now;
      drawAiring();
    },
    updateExclusions(state) {
      exclusions = state;
      drawExclusions();
    },
  };
}
