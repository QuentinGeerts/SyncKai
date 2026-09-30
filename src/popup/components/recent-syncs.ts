import type { RecentSync } from '../../shared/review.types';
import { h } from '../../ui/dom';
import { renderAlert } from './alert';
import { icon } from '../../ui/icons';

interface RecentSyncsProps {
  syncs: RecentSync[];
  /** Saisons ayant déjà une carte "À vérifier" ouverte */
  pendingKeys: ReadonlySet<string>;
  busyKey: string | null;
  error: string | null;
  onCorrect: (key: string) => void;
}

function episodeNumber(sync: RecentSync): string {
  const n = sync.episode.displayedEpisodeNumber ?? sync.episode.seasonEpisodeNumber;
  return n !== null ? `E${n}` : '';
}

export function renderRecentSyncs({ syncs, pendingKeys, busyKey, error, onCorrect }: RecentSyncsProps): HTMLElement | null {
  if (syncs.length === 0) return null;

  const rows = syncs.map((sync) => {
    const isPending = pendingKeys.has(sync.key);
    const isBusy = busyKey === sync.key;
    return h(
      'li',
      { class: 'flex items-center gap-2 px-3 py-2' },
      h(
        'div',
        { class: 'min-w-0 flex-1' },
        h('p', { class: 'truncate text-xs text-zinc-200' }, `${sync.episode.animeTitle} · ${episodeNumber(sync)}`),
        h('p', { class: 'truncate text-[10px] text-zinc-500', attrs: { title: sync.mediaTitle } }, `→ ${sync.mediaTitle} · épisode ${sync.progress}`),
      ),
      h(
        'button',
        {
          class: 'flex shrink-0 cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-zinc-400 hover:bg-zinc-800 hover:text-sky-300 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-zinc-400',
          attrs: { type: 'button', ...(isPending || busyKey !== null ? { disabled: '' } : {}) },
          on: { click: () => onCorrect(sync.key) },
        },
        isBusy && icon('spinner', 'h-3 w-3 animate-spin'),
        isPending ? 'À vérifier ↑' : 'Corriger',
      ),
    );
  });

  return h(
    'section',
    { class: 'flex flex-col gap-2' },
    h('h2', { class: 'text-[11px] font-medium uppercase tracking-wide text-zinc-500' }, 'Dernières synchros'),
    h('ul', { class: 'divide-y divide-zinc-800 rounded-xl bg-zinc-900 ring-1 ring-zinc-800' }, ...rows),
    error && renderAlert({ message: error }),
  );
}
