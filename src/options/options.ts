import { getSettings, PERCENTAGE_RANGE, saveSettings, type SyncSettings } from '../shared/settings';
import { clearMediaMappings, deleteMediaMapping, getMediaMappings, STORAGE_KEYS } from '../shared/storage';
import type { MediaMapping } from '../shared/sync.types';
import { h, nodes } from '../ui/dom';
import { icon } from '../ui/icons';

const SAVED_BADGE_MS = 1_500;
const SAVED_BADGE_CLASS = 'flex items-center gap-1 text-xs text-emerald-400 transition-opacity';

function getRoot(): HTMLDivElement {
  const el = document.querySelector<HTMLDivElement>('#app');
  if (!el) throw new Error('Élément #app introuvable');
  return el;
}

const CARD_CLASS = 'flex flex-col gap-4 rounded-2xl bg-zinc-900 p-5 ring-1 ring-zinc-800';
const BUTTON_GHOST =
  'cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium text-zinc-400 ring-1 ring-zinc-700 transition hover:bg-zinc-800 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400';

// ─── Composants ───────────────────────────────────────────────────────────

function renderSwitch(checked: boolean, label: string, onChange: (checked: boolean) => void): HTMLElement {
  const input = h('input', {
    class: 'peer sr-only',
    attrs: { type: 'checkbox', role: 'switch', 'aria-label': label },
    on: { change: () => onChange(input.checked) },
  });
  input.checked = checked;
  return h(
    'label',
    { class: 'relative inline-flex shrink-0 cursor-pointer items-center' },
    input,
    h('span', {
      class:
        'h-5 w-9 rounded-full bg-zinc-700 transition peer-checked:bg-sky-600 peer-focus-visible:ring-2 peer-focus-visible:ring-sky-400 after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4',
    }),
  );
}

function renderSettingRow(title: string, description: string, control: HTMLElement): HTMLElement {
  return h(
    'div',
    { class: 'flex items-start justify-between gap-6' },
    h('div', {}, h('p', { class: 'text-sm font-medium text-zinc-100' }, title), h('p', { class: 'mt-0.5 text-xs text-zinc-500' }, description)),
    control,
  );
}

function renderRadio(name: string, value: string, checked: boolean, title: string, description: string, onSelect: () => void): HTMLElement {
  const input = h('input', {
    class: 'mt-0.5 h-4 w-4 shrink-0 accent-sky-500',
    attrs: { type: 'radio', name, value },
    on: { change: () => input.checked && onSelect() },
  });
  input.checked = checked;
  return h(
    'label',
    { class: 'flex cursor-pointer items-start gap-3 rounded-lg p-2 ring-1 ring-transparent transition hover:bg-zinc-800/60 has-[:checked]:bg-sky-500/10 has-[:checked]:ring-sky-500/40' },
    input,
    h('span', {}, h('span', { class: 'block text-sm text-zinc-100' }, title), h('span', { class: 'block text-xs text-zinc-500' }, description)),
  );
}

// ─── Section "Synchronisation" ────────────────────────────────────────────

function createSettingsCard(initial: SyncSettings): HTMLElement {
  let settings = initial;
  const savedBadge = h('span', { class: `${SAVED_BADGE_CLASS} opacity-0`, attrs: { 'aria-live': 'polite' } });
  let badgeTimer: ReturnType<typeof setTimeout> | undefined;

  async function update(patch: Partial<SyncSettings>): Promise<void> {
    settings = { ...settings, ...patch };
    clearTimeout(badgeTimer);
    try {
      await saveSettings(settings);
    } catch (error: unknown) {
      // Affiché jusqu'au prochain enregistrement réussi : l'interface ne reflète plus le stockage
      console.error('[SyncKai] Enregistrement des réglages impossible :', error);
      savedBadge.className = SAVED_BADGE_CLASS.replace('text-emerald-400', 'text-red-400');
      savedBadge.replaceChildren(icon('alert', 'h-3.5 w-3.5'), 'Échec de l’enregistrement, recharge la page');
      return;
    }
    savedBadge.className = SAVED_BADGE_CLASS;
    savedBadge.replaceChildren(icon('check', 'h-3.5 w-3.5'), 'Enregistré');
    badgeTimer = setTimeout(() => savedBadge.classList.add('opacity-0'), SAVED_BADGE_MS);
  }

  const percentLabel = h('span', { class: 'w-12 text-right text-sm font-medium tabular-nums text-zinc-100' }, `${settings.completionPercentage} %`);
  const range = h('input', {
    class: 'w-48 accent-sky-500',
    attrs: {
      type: 'range',
      min: String(PERCENTAGE_RANGE.min),
      max: String(PERCENTAGE_RANGE.max),
      step: '1',
      'aria-label': 'Pourcentage de la vidéo',
    },
    on: {
      // "input" met à jour l'affichage en continu, "change" n'enregistre qu'au relâchement
      input: () => (percentLabel.textContent = `${range.value} %`),
      change: () => void update({ completionPercentage: Number(range.value) }),
    },
  });
  range.value = String(settings.completionPercentage);

  return h(
    'section',
    { class: CARD_CLASS },
    h('div', { class: 'flex items-center justify-between' }, h('h2', { class: 'text-base font-semibold' }, 'Synchronisation'), savedBadge),
    renderSettingRow(
      'Synchronisation automatique',
      'En pause, les épisodes terminés ne sont pas envoyés à AniList.',
      renderSwitch(settings.autoSync, 'Synchronisation automatique', (checked) => void update({ autoSync: checked })),
    ),
    h(
      'fieldset',
      { class: 'flex flex-col gap-1' },
      h('legend', { class: 'mb-1 text-sm font-medium text-zinc-100' }, 'Épisode considéré comme vu'),
      renderRadio(
        'trigger',
        'credits',
        settings.completionTrigger === 'credits',
        'Au début du générique de fin (recommandé)',
        'Si la plateforme ne fournit pas l’information, repli sur le pourcentage ci-dessous.',
        () => void update({ completionTrigger: 'credits' }),
      ),
      renderRadio(
        'trigger',
        'percentage',
        settings.completionTrigger === 'percentage',
        'À un pourcentage de la vidéo',
        'Toujours au même pourcentage, quel que soit l’épisode.',
        () => void update({ completionTrigger: 'percentage' }),
      ),
    ),
    renderSettingRow('Pourcentage', 'Appliqué à partir de l’épisode suivant.', h('div', { class: 'flex items-center gap-3' }, range, percentLabel)),
    renderSettingRow(
      'Notifications sur la page',
      'Toast de confirmation après chaque synchronisation. Les alertes (épisode à vérifier, erreurs) restent affichées.',
      renderSwitch(settings.showToast, 'Notifications sur la page', (checked) => void update({ showToast: checked })),
    ),
  );
}

// ─── Section "Correspondances mémorisées" ─────────────────────────────────

function numberingLabel(mapping: MediaMapping): string {
  const source = mapping.numbering === 'displayed' ? 'numéro affiché' : 'numéro dans la saison';
  return mapping.offset !== 0 ? `${source}, décalage de ${mapping.offset}` : source;
}

function createMappingsCard(): { element: HTMLElement; refresh(): Promise<void> } {
  const element = h('section', { class: CARD_CLASS });
  let confirmingReset = false;

  async function refresh(): Promise<void> {
    const mappings = Object.entries(await getMediaMappings()).sort(([a], [b]) => a.localeCompare(b));

    const rows = mappings.map(([key, mapping]) =>
      h(
        'li',
        { class: 'flex items-center gap-3 py-2.5' },
        h(
          'div',
          { class: 'min-w-0 flex-1' },
          h('p', { class: 'truncate text-sm text-zinc-100', attrs: { title: key } }, mapping.seriesLabel ?? key),
          h(
            'p',
            { class: 'truncate text-xs text-zinc-500' },
            '→ ',
            h(
              'a',
              {
                class: 'text-sky-400 hover:underline',
                attrs: { href: `https://anilist.co/anime/${mapping.mediaId}`, target: '_blank', rel: 'noopener noreferrer' },
              },
              mapping.mediaTitle ?? `Fiche AniList #${mapping.mediaId}`,
            ),
            ` · ${numberingLabel(mapping)}`,
          ),
        ),
        h(
          'button',
          {
            class: `${BUTTON_GHOST} flex items-center gap-1 hover:text-red-300`,
            attrs: { type: 'button', title: 'La correspondance sera recalculée au prochain épisode' },
            on: { click: () => void deleteMediaMapping(key).then(refresh) },
          },
          icon('trash', 'h-3.5 w-3.5'),
          'Oublier',
        ),
      ),
    );

    const resetControls = confirmingReset
      ? h(
          'div',
          { class: 'flex items-center gap-2' },
          h('span', { class: 'text-xs text-amber-300' }, 'Oublier toutes les correspondances ?'),
          h('button', { class: BUTTON_GHOST, attrs: { type: 'button' }, on: { click: () => ((confirmingReset = false), void refresh()) } }, 'Annuler'),
          h(
            'button',
            {
              class: 'cursor-pointer rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-500',
              attrs: { type: 'button' },
              on: { click: () => void clearMediaMappings().then(() => ((confirmingReset = false), refresh())) },
            },
            'Confirmer',
          ),
        )
      : mappings.length > 0 &&
        h('button', { class: `${BUTTON_GHOST} hover:text-red-300`, attrs: { type: 'button' }, on: { click: () => ((confirmingReset = true), void refresh()) } }, 'Tout réinitialiser');

    element.replaceChildren(
      ...nodes([
        h(
          'div',
          { class: 'flex items-center justify-between gap-4' },
          h('h2', { class: 'text-base font-semibold' }, `Correspondances mémorisées (${mappings.length})`),
          resetControls,
        ),
        h(
          'p',
          { class: 'text-xs text-zinc-500' },
          'SyncKai retient la fiche AniList utilisée pour chaque saison. Oublier une correspondance la fait recalculer au prochain épisode (utile si elle est fausse).',
        ),
        mappings.length > 0
          ? h('ul', { class: 'divide-y divide-zinc-800' }, ...rows)
          : h('p', { class: 'rounded-lg bg-zinc-950/50 px-3 py-4 text-center text-xs text-zinc-500' }, 'Aucune correspondance pour l’instant.'),
      ]),
    );
  }

  return { element, refresh };
}

// ─── Page ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const root = getRoot();
  const header = h(
    'header',
    { class: 'flex items-center gap-3' },
    h('img', { class: 'h-10 w-10', attrs: { src: chrome.runtime.getURL('icons/icon-128.png'), alt: '' } }),
    h(
      'div',
      {},
      h('h1', { class: 'text-xl font-semibold tracking-tight' }, 'SyncKai — Options'),
      h('p', { class: 'text-xs text-zinc-500' }, `Version ${chrome.runtime.getManifest().version}`),
    ),
  );

  let settings: SyncSettings;
  try {
    settings = await getSettings();
  } catch (error: unknown) {
    console.error('[SyncKai] Lecture des réglages impossible :', error);
    root.replaceChildren(header, h('p', { class: 'text-sm text-red-300' }, 'Impossible de lire les réglages. Recharge la page.'));
    return;
  }

  const mappingsCard = createMappingsCard();
  root.replaceChildren(header, createSettingsCard(settings), mappingsCard.element);
  await mappingsCard.refresh();

  // Une synchro en cours dans un onglet peut ajouter une correspondance
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STORAGE_KEYS.mediaMappings]) void mappingsCard.refresh();
  });
}

void main();
