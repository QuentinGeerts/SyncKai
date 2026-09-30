import { h } from '../../ui/dom';
import { icon } from '../../ui/icons';

interface FooterProps {
  version: string;
  /** Affiche le bouton de déconnexion si défini */
  onLogout?: () => void;
}

const LINK_CLASS =
  'flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 font-medium text-zinc-400 transition hover:bg-zinc-900 focus:outline-none focus-visible:ring-2';

export function renderFooter({ version, onLogout }: FooterProps): HTMLElement {
  return h(
    'footer',
    { class: 'flex h-9 items-center justify-between border-t border-zinc-800 px-4 text-[10px] text-zinc-600' },
    h(
      'div',
      { class: 'flex items-center gap-1' },
      h('span', { class: 'pr-1' }, `v${version}`),
      h(
        'button',
        {
          class: `${LINK_CLASS} hover:text-sky-300 focus-visible:ring-sky-400`,
          attrs: { type: 'button' },
          on: { click: () => void chrome.runtime.openOptionsPage() },
        },
        icon('sliders', 'h-3 w-3'),
        'Options',
      ),
    ),
    onLogout &&
      h(
        'button',
        {
          class: `${LINK_CLASS} hover:text-red-300 focus-visible:ring-red-400`,
          attrs: { type: 'button' },
          on: { click: onLogout },
        },
        icon('logout', 'h-3 w-3'),
        'Se déconnecter',
      ),
  );
}
