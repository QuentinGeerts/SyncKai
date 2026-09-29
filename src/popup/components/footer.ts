import { h } from '../lib/dom';
import { icon } from './icons';

interface FooterProps {
  version: string;
  /** Affiche le bouton de déconnexion si défini */
  onLogout?: () => void;
}

export function renderFooter({ version, onLogout }: FooterProps): HTMLElement {
  return h(
    'footer',
    { class: 'flex h-9 items-center justify-between border-t border-zinc-800 px-4 text-[10px] text-zinc-600' },
    h('span', {}, `v${version}`),
    onLogout &&
      h(
        'button',
        {
          class: 'flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 font-medium text-zinc-400 transition hover:bg-zinc-900 hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400',
          attrs: { type: 'button' },
          on: { click: onLogout },
        },
        icon('logout', 'h-3 w-3'),
        'Se déconnecter',
      ),
  );
}
