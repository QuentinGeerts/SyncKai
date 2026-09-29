import { h } from '../lib/dom';
import { icon } from './icons';

interface AlertProps {
  message: string;
  action?: { label: string; onClick: () => void };
}

export function renderAlert({ message, action }: AlertProps): HTMLElement {
  return h(
    'div',
    {
      class: 'flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/30',
      attrs: { role: 'alert' },
    },
    icon('alert', 'mt-px h-3.5 w-3.5'),
    h('p', { class: 'min-w-0 flex-1 break-words' }, message),
    action &&
      h(
        'button',
        {
          class: 'shrink-0 cursor-pointer font-medium text-red-200 underline-offset-2 hover:underline focus:outline-none focus-visible:underline',
          attrs: { type: 'button' },
          on: { click: action.onClick },
        },
        action.label,
      ),
  );
}
