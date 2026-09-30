import { h } from '../../ui/dom';
import { icon } from '../../ui/icons';

interface LoginCardProps {
  pending: boolean;
  onLogin: () => void;
}

export function renderLoginCard({ pending, onLogin }: LoginCardProps): HTMLElement {
  const button = h(
    'button',
    {
      class:
        'flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white shadow-lg shadow-sky-900/30 transition hover:bg-sky-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60',
      attrs: { type: 'button' },
      on: { click: onLogin },
    },
    pending && icon('spinner', 'h-4 w-4 animate-spin'),
    pending ? 'Connexion…' : 'Se connecter à AniList',
  );
  button.disabled = pending;

  return h(
    'section',
    { class: 'flex flex-col gap-3' },
    h(
      'p',
      { class: 'text-xs leading-relaxed text-zinc-400' },
      'Connecte ton compte AniList pour synchroniser automatiquement tes épisodes regardés.',
    ),
    button,
  );
}
