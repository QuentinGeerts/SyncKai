import type { AniListViewer } from '../../shared/anilist.types';
import { h } from '../../ui/dom';
import { icon } from '../../ui/icons';

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

export function renderProfileCard(viewer: AniListViewer | null, onLogout: () => void): HTMLElement {
  if (!viewer) return renderSkeleton();

  // Lien et bouton côte à côte : un bouton ne peut pas être imbriqué dans un <a>
  return h(
    'div',
    { class: 'flex items-center rounded-xl bg-zinc-900 ring-1 ring-zinc-800' },
    h(
      'a',
      {
        class: 'group flex min-w-0 flex-1 items-center gap-3 rounded-xl p-3 transition hover:bg-zinc-800/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
        attrs: { href: viewer.siteUrl, target: '_blank', rel: 'noopener noreferrer', title: 'Ouvrir mon profil AniList' },
      },
      renderAvatar(viewer),
      h(
        'div',
        { class: 'min-w-0 flex-1' },
        h('p', { class: 'truncate text-sm font-semibold text-zinc-100' }, viewer.name),
        h('p', { class: 'text-[11px] text-zinc-500 group-hover:text-sky-400' }, 'AniList · voir le profil'),
      ),
      icon('external', 'h-3.5 w-3.5 text-zinc-500 group-hover:text-sky-400'),
    ),
    renderLogoutButton('Déconnecter AniList', onLogout),
  );
}

/** Bouton icône de déconnexion d'un service (partagé avec la carte MyAnimeList) */
export function renderLogoutButton(label: string, onLogout: () => void): HTMLElement {
  return h(
    'button',
    {
      class: 'mr-2 shrink-0 cursor-pointer rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400',
      attrs: { type: 'button', title: label, 'aria-label': label },
      on: { click: onLogout },
    },
    icon('logout', 'h-3.5 w-3.5'),
  );
}
