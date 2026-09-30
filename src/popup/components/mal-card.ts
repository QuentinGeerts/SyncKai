import { h, nodes } from '../../ui/dom';
import { icon } from '../../ui/icons';
import type { MalState } from '../state';
import { renderAlert } from './alert';
import { renderLogoutButton } from './profile-card';

interface MalCardProps {
  state: MalState;
  onLogin: () => void;
  onLogout: () => void;
  onRetry: () => void;
}

const CARD_CLASS = 'flex items-center gap-3 rounded-xl bg-zinc-900 p-3 ring-1 ring-zinc-800';

/** Pastille "MAL" aux couleurs du service (repli sans photo de profil) */
function renderBadge(): HTMLElement {
  return h('div', { class: 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2e51a2] text-[11px] font-bold text-white' }, 'MAL');
}

function renderAvatar(pictureUrl: string | null): HTMLElement {
  if (!pictureUrl) return renderBadge();
  const img = h('img', {
    class: 'h-10 w-10 shrink-0 rounded-full bg-zinc-800 object-cover ring-1 ring-zinc-700',
    attrs: { src: pictureUrl, alt: '', referrerpolicy: 'no-referrer' },
  });
  img.addEventListener('error', () => img.replaceWith(renderBadge()), { once: true });
  return img;
}

/** Carte compacte du compte MyAnimeList : connexion, profil et déconnexion. */
export function renderMalCard({ state, onLogin, onLogout, onRetry }: MalCardProps): HTMLElement {
  if (state.status === 'loading' || (state.status === 'logged-in' && !state.viewer)) {
    return h(
      'div',
      { class: `${CARD_CLASS} animate-pulse`, attrs: { 'aria-busy': 'true', 'aria-label': 'Chargement du compte MyAnimeList' } },
      h('div', { class: 'h-10 w-10 rounded-full bg-zinc-800' }),
      h('div', { class: 'flex flex-1 flex-col gap-1.5' }, h('div', { class: 'h-3 w-24 rounded bg-zinc-800' }), h('div', { class: 'h-2.5 w-20 rounded bg-zinc-800' })),
    );
  }

  if (state.status === 'logged-out') {
    const button = h(
      'button',
      {
        class:
          'flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-[#2e51a2] px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-[#3a62c0] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-60',
        attrs: { type: 'button' },
        on: { click: onLogin },
      },
      state.pending && icon('spinner', 'h-3.5 w-3.5 animate-spin'),
      state.pending ? 'Connexion…' : 'Connecter',
    );
    button.disabled = state.pending;

    return h(
      'div',
      { class: 'flex flex-col gap-2' },
      ...nodes([
        h(
          'div',
          { class: CARD_CLASS },
          renderBadge(),
          h(
            'div',
            { class: 'min-w-0 flex-1' },
            h('p', { class: 'text-sm font-semibold text-zinc-100' }, 'MyAnimeList'),
            h('p', { class: 'text-[11px] text-zinc-500' }, 'Synchronise aussi ta liste MAL'),
          ),
          button,
        ),
        state.error && renderAlert({ message: state.error }),
      ]),
    );
  }

  const { viewer } = state;
  if (!viewer) return h('div'); // Cas couvert par le skeleton ci-dessus (garde de type)

  return h(
    'div',
    { class: 'flex flex-col gap-2' },
    ...nodes([
      h(
        'div',
        { class: 'flex items-center rounded-xl bg-zinc-900 ring-1 ring-zinc-800' },
        h(
          'a',
          {
            class: 'group flex min-w-0 flex-1 items-center gap-3 rounded-xl p-3 transition hover:bg-zinc-800/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
            attrs: {
              href: `https://myanimelist.net/profile/${encodeURIComponent(viewer.name)}`,
              target: '_blank',
              rel: 'noopener noreferrer',
              title: 'Ouvrir mon profil MyAnimeList',
            },
          },
          renderAvatar(viewer.pictureUrl),
          h(
            'div',
            { class: 'min-w-0 flex-1' },
            h('p', { class: 'truncate text-sm font-semibold text-zinc-100' }, viewer.name),
            h('p', { class: 'text-[11px] text-zinc-500 group-hover:text-sky-400' }, 'MyAnimeList · voir le profil'),
          ),
          icon('external', 'h-3.5 w-3.5 text-zinc-500 group-hover:text-sky-400'),
        ),
        renderLogoutButton('Déconnecter MyAnimeList', onLogout),
      ),
      state.error && renderAlert({ message: state.error, action: { label: 'Réessayer', onClick: onRetry } }),
    ]),
  );
}
