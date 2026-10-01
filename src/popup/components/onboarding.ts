import { TRACKER_LABELS, type TrackerId } from '../../shared/tracker.types';
import { h, nodes } from '../../ui/dom';
import { icon, mochi } from '../../ui/icons';
import type { AccountState } from '../state';
import { renderAlert } from './alert';
import { kanaLabel, serviceAvatar } from './ui';

interface OnboardingProps {
  anilist: AccountState<unknown>;
  mal: AccountState<unknown>;
  onLogin: (service: TrackerId) => void;
}

const COPY: Record<TrackerId, { title: string; hint: string }> = {
  anilist: { title: 'Connecter AniList', hint: 'Recommandé pour les correspondances' },
  mal: { title: 'Connecter MyAnimeList', hint: 'Utilisable seul ou avec AniList' },
};

function renderConnect(service: TrackerId, state: AccountState<unknown>, onLogin: (service: TrackerId) => void): HTMLElement[] {
  const pending = state.status === 'logged-out' && state.pending;
  const expired = state.status === 'logged-out' && state.expired;
  const button = h(
    'button',
    {
      class:
        'flex h-14 w-full cursor-pointer items-center gap-3 rounded-card border border-line bg-surface px-3 text-left text-ink transition hover:bg-raised hover:shadow-pop motion-safe:hover:-translate-px disabled:cursor-wait disabled:opacity-70',
      attrs: { type: 'button', 'data-focus': `connect-${service}`, ...(pending ? { disabled: '', 'aria-busy': 'true' } : {}) },
      on: { click: () => onLogin(service) },
    },
    serviceAvatar(service, expired ? 'expired' : null),
    h(
      'span',
      { class: 'flex min-w-0 flex-1 flex-col' },
      h('span', { class: 'text-[14px] leading-[18px] font-bold' }, pending ? 'Connexion…' : expired ? `Reconnecter ${TRACKER_LABELS[service]}` : COPY[service].title),
      h('span', { class: `text-[11px] leading-[15px] font-semibold ${expired ? 'text-danger' : 'text-muted'}` }, expired ? 'Session expirée' : COPY[service].hint),
    ),
    pending ? icon('spinner', 'h-4 w-4 text-muted motion-safe:animate-spin') : icon('chevronRight', 'h-4 w-4 text-muted', '2.4'),
  );
  const error = state.status === 'logged-out' && state.error;
  return nodes([button, error && renderAlert({ message: error })]).filter((n): n is HTMLElement => n instanceof HTMLElement);
}

/** Écran d'accueil : aucun compte connecté */
export function renderOnboarding({ anilist, mal, onLogin }: OnboardingProps): HTMLElement {
  const step = (n: number, text: string): HTMLElement =>
    h(
      'li',
      { class: 'flex flex-1 flex-col items-center gap-1 text-center' },
      h('span', { class: 'flex h-5 w-5 items-center justify-center rounded-full bg-sakura text-[11px] font-bold text-on-fill', attrs: { 'aria-hidden': 'true' } }, String(n)),
      h('span', { class: 'text-[11px] leading-[14px] font-semibold text-muted' }, text),
    );

  return h(
    'div',
    { class: 'flex min-h-full flex-col gap-4 pt-1' },
    h(
      'section',
      { class: 'flex flex-col items-center gap-1 pt-2 text-center', attrs: { 'aria-labelledby': 'sk-welcome-title' } },
      mochi('h-16 w-16', 'awake', true),
      h('span', { class: 'mt-2' }, kanaLabel('ヨウコソ', 'text-sakura')),
      h('h1', { class: 'm-0 font-display text-[20px] leading-[26px] font-extrabold', attrs: { id: 'sk-welcome-title' } }, 'Bienvenue !'),
      h(
        'p',
        { class: 'm-0 mt-1 max-w-[320px] text-[13px] leading-[19px] font-semibold text-muted' },
        'Regarde tes animes sur Crunchyroll ou ADN : SyncKai met ta liste à jour à la fin de chaque épisode.',
      ),
    ),
    h('div', { class: 'flex flex-col gap-2' }, ...renderConnect('anilist', anilist, onLogin), ...renderConnect('mal', mal, onLogin)),
    h(
      'ol',
      { class: 'm-0 mt-auto flex list-none gap-2 border-t border-dotted border-line px-2 py-3', attrs: { 'aria-label': 'Comment ça marche' } },
      step(1, 'Lance un épisode'),
      step(2, 'SyncKai reconnaît la série'),
      step(3, 'Ta liste est à jour au générique'),
    ),
  );
}
