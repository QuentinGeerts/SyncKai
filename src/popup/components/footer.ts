import { h } from '../../ui/dom';
import { icon } from '../../ui/icons';

interface FooterProps {
  version: string;
}

// La déconnexion se fait par service, depuis la carte de chaque compte
export function renderFooter({ version }: FooterProps): HTMLElement {
  return h(
    'footer',
    { class: 'flex h-9 items-center justify-between border-t border-zinc-800 px-4 text-[10px] text-zinc-600' },
    h('span', {}, `v${version}`),
    h(
      'button',
      {
        class:
          'flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 font-medium text-zinc-400 transition hover:bg-zinc-900 hover:text-sky-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
        attrs: { type: 'button' },
        on: { click: () => void chrome.runtime.openOptionsPage() },
      },
      icon('sliders', 'h-3 w-3'),
      'Options',
    ),
  );
}
