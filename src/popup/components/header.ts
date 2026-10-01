import { t, tp } from '../../i18n';
import { h } from '../../ui/dom';
import { icon, mochi } from '../../ui/icons';
import type { Screen } from '../state';
import { kanaLabel } from './ui';

interface HeaderProps {
  isSettings: boolean;
  onSettings: () => void;
}

export function renderHeader({ isSettings, onSettings }: HeaderProps): HTMLElement {
  return h(
    'header',
    { class: 'flex h-14 shrink-0 items-center justify-between px-4' },
    h(
      'div',
      { class: 'flex items-center gap-2' },
      mochi('h-6 w-6'),
      h(
        'div',
        { class: 'flex items-baseline gap-1.5' },
        h('span', { class: 'font-display text-[15px] font-extrabold tracking-[0.2px]' }, 'SyncKai'),
        kanaLabel('シンカイ'),
      ),
    ),
    h(
      'button',
      {
        class: `flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-raised ${isSettings ? 'bg-raised text-sakura' : 'bg-surface text-muted'}`,
        attrs: { type: 'button', 'aria-label': t('nav.settings'), 'aria-pressed': String(isSettings), 'data-focus': 'gear' },
        on: { click: onSettings },
      },
      icon('gear', 'h-[18px] w-[18px]'),
    ),
  );
}

interface NavProps {
  screen: Exclude<Screen, 'settings'>;
  /** Éléments à traiter : vérifications en attente + synchros abandonnées */
  pending: number;
  onNavigate: (screen: Exclude<Screen, 'settings'>) => void;
}

/** Navigation segmentée En cours / Activité (pastille beurre = vérifications + synchros en échec) */
export function renderNav({ screen, pending, onNavigate }: NavProps): HTMLElement {
  const tab = (target: Exclude<Screen, 'settings'>, label: string, aria: string | null, badge: HTMLElement | null): HTMLElement => {
    const on = screen === target;
    return h(
      'button',
      {
        class: `flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full text-[13px] transition-colors ${on ? 'bg-sakura font-bold text-on-fill' : 'font-semibold text-muted hover:text-ink'}`,
        attrs: { type: 'button', 'aria-pressed': String(on), 'data-focus': `nav-${target}`, ...(aria ? { 'aria-label': aria } : {}) },
        on: { click: () => onNavigate(target) },
      },
      h('span', {}, label),
      badge,
    );
  };

  const badge =
    pending > 0
      ? h(
          'span',
          {
            class: 'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-md bg-butter px-[5px] text-[11px] font-bold text-on-fill',
            attrs: { 'aria-hidden': 'true' },
          },
          String(pending),
        )
      : null;

  return h(
    'nav',
    { class: 'flex h-11 shrink-0 items-start px-4', attrs: { 'aria-label': t('nav.sections') } },
    h(
      'div',
      { class: 'flex flex-1 gap-1 rounded-full bg-surface p-0.5' },
      tab('watching', t('nav.watching'), null, null),
      tab('activity', t('nav.activity'), pending > 0 ? tp('nav.activityPending', pending) : null, badge),
    ),
  );
}

/** Barre de l'écran Réglages : retour + titre centré ; `status` = retour d'enregistrement */
export function renderSettingsBar(onBack: () => void, status: HTMLElement): HTMLElement {
  return h(
    'div',
    { class: 'flex h-11 shrink-0 items-start gap-2 px-4' },
    h(
      'button',
      {
        class: 'flex h-9 w-[76px] shrink-0 cursor-pointer items-center gap-1 rounded-full bg-surface pr-3 pl-2 text-[13px] font-bold text-ink transition-colors hover:bg-raised',
        attrs: { type: 'button', 'data-focus': 'back' },
        on: { click: onBack },
      },
      icon('back', 'h-4 w-4', '2.4'),
      t('nav.back'),
    ),
    h(
      'div',
      { class: 'flex h-9 flex-1 items-center justify-center gap-1.5' },
      h('h1', { class: 'm-0 font-display text-[15px] font-extrabold' }, t('nav.settings')),
      kanaLabel('セッテイ', 'text-sakura'),
    ),
    h('div', { class: 'flex h-9 w-[76px] shrink-0 items-center justify-end' }, status),
  );
}
