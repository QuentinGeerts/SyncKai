import type { AniListViewer } from '../../shared/anilist.types';
import { h } from '../lib/dom';
import { icon } from './icons';

const CARD_CLASS = 'flex items-center gap-3 rounded-xl bg-zinc-900 p-3 ring-1 ring-zinc-800';
const AVATAR_CLASS = 'h-10 w-10 shrink-0 rounded-full';

/** Avatar avec repli sur l'initiale si l'image est absente ou ne charge pas. */
function renderAvatar(viewer: AniListViewer): HTMLElement {
  const fallback = h(
    'div',
    { class: `${AVATAR_CLASS} flex items-center justify-center bg-zinc-800 text-sm font-semibold text-zinc-300` },
    viewer.name.charAt(0).toUpperCase(),
  );
  if (!viewer.avatarUrl) return fallback;

  const img = h('img', {
    class: `${AVATAR_CLASS} bg-zinc-800 object-cover ring-1 ring-zinc-700`,
    attrs: { src: viewer.avatarUrl, alt: '', referrerpolicy: 'no-referrer' },
  });
  img.addEventListener('error', () => img.replaceWith(fallback), { once: true });
  return img;
}

function renderSkeleton(): HTMLElement {
  return h(
    'div',
    { class: `${CARD_CLASS} animate-pulse`, attrs: { 'aria-busy': 'true', 'aria-label': 'Chargement du profil' } },
    h('div', { class: `${AVATAR_CLASS} bg-zinc-800` }),
    h(
      'div',
      { class: 'flex flex-1 flex-col gap-1.5' },
      h('div', { class: 'h-3 w-24 rounded bg-zinc-800' }),
      h('div', { class: 'h-2.5 w-32 rounded bg-zinc-800' }),
    ),
  );
}

export function renderProfileCard(viewer: AniListViewer | null): HTMLElement {
  if (!viewer) return renderSkeleton();

  return h(
    'a',
    {
      class: `${CARD_CLASS} group transition hover:bg-zinc-800/70 hover:ring-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400`,
      attrs: { href: viewer.siteUrl, target: '_blank', rel: 'noopener noreferrer', title: 'Ouvrir mon profil AniList' },
    },
    renderAvatar(viewer),
    h(
      'div',
      { class: 'min-w-0 flex-1' },
      h('p', { class: 'truncate text-sm font-semibold text-zinc-100' }, viewer.name),
      h('p', { class: 'text-[11px] text-zinc-500 group-hover:text-sky-400' }, 'Voir le profil AniList'),
    ),
    icon('external', 'h-3.5 w-3.5 text-zinc-500 group-hover:text-sky-400'),
  );
}
