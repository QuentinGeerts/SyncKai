import type { RecentSync } from '../../shared/review.types';
import { h, nodes } from '../../ui/dom';
import { icon } from '../../ui/icons';
import { renderAlert } from './alert';
import { BTN_GHOST, CARD, sectionTitle } from './ui';

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
  return n !== null ? ` · E${n}` : '';
}

export function renderRecentSyncs({ syncs, pendingKeys, busyKey, error, onCorrect }: RecentSyncsProps): HTMLElement {
  const rows = syncs.map((sync) => {
    const isPending = pendingKeys.has(sync.key);
    const isBusy = busyKey === sync.key;
    const title = `${sync.episode.animeTitle}${episodeNumber(sync)}`;
    return h(
      'li',
      { class: 'flex min-h-[52px] items-center gap-2 rounded-lg bg-surface py-1.5 pr-1 pl-3' },
      icon('check', 'h-3.5 w-3.5 text-mint', '3'),
      h(
        'div',
        { class: 'flex min-w-0 flex-1 flex-col gap-0.5' },
        h('span', { class: 'truncate text-[13px] font-bold', attrs: { title } }, title),
        h('span', { class: 'truncate text-[11px] font-semibold text-muted', attrs: { title: sync.mediaTitle } }, `→ ${sync.mediaTitle} · épisode ${sync.progress}`),
      ),
      h(
        'button',
        {
          class: `${BTN_GHOST} px-2.5 text-sakura`,
          attrs: {
            type: 'button',
            'aria-label': isPending ? `${title} : déjà à vérifier` : `Corriger ${title}`,
            'data-focus': `correct-${sync.key}`,
            ...(isPending || busyKey !== null ? { disabled: '' } : {}),
          },
          on: { click: () => onCorrect(sync.key) },
        },
        isBusy && icon('spinner', 'h-3 w-3 motion-safe:animate-spin'),
        isPending ? 'À vérifier ↑' : 'Corriger',
      ),
    );
  });

  return h(
    'section',
    { class: 'flex flex-col gap-2' },
    ...nodes([
      sectionTitle('Dernières synchros'),
      rows.length > 0
        ? h('ul', { class: 'm-0 flex list-none flex-col gap-1 p-0' }, ...rows)
        : h('p', { class: `${CARD} m-0 p-3 text-[12px] text-muted` }, 'Aucune synchro pour l’instant.'),
      error && renderAlert({ message: error }),
    ]),
  );
}
