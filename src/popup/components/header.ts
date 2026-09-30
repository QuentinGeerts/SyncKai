import { h } from '../../ui/dom';
import type { PopupState } from '../state';

const STATUS_BADGE: Record<PopupState['status'], { label: string; dot: string }> = {
  loading: { label: 'Chargement…', dot: 'bg-zinc-500 animate-pulse' },
  'logged-out': { label: 'Déconnecté', dot: 'bg-red-500' },
  'logged-in': { label: 'Connecté', dot: 'bg-emerald-500' },
};

export function renderHeader(state: PopupState): HTMLElement {
  const badge = STATUS_BADGE[state.status];

  return h(
    'header',
    { class: 'flex items-center justify-between border-b border-zinc-800 px-4 py-3' },
    h(
      'div',
      { class: 'flex items-center gap-2' },
      h(
        'div',
        { class: 'flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-sky-500 to-indigo-600 text-xs font-bold' },
        'SK',
      ),
      h('h1', { class: 'text-sm font-semibold tracking-tight' }, 'SyncKai'),
    ),
    h(
      'span',
      { class: 'flex items-center gap-1.5 rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-zinc-400 ring-1 ring-zinc-800' },
      h('span', { class: `h-1.5 w-1.5 rounded-full ${badge.dot}` }),
      badge.label,
    ),
  );
}
