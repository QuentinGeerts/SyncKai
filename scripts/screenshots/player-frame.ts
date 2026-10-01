// Lecteur simulé + VRAIE bulle de la page (src/content/ui) : résultat de synchro ou note de fin de série.
import { initI18n, type Locale } from '../../src/i18n';
import { showEngagementPrompt } from '../../src/content/ui/engagement-prompt';
import { bubbleForOutcome } from '../../src/content/ui/sync-toast';
import { showToast } from '../../src/content/ui/toast';
import type { SyncOutcome } from '../../src/shared/sync.types';
import { demoChrome } from './demo-data';
import { installChromeMock } from './mock-chrome';
import { localeParam, markReady, param, waitFor } from './params';

type Kind = 'sync' | 'rate';
const kind: Kind = param('kind') === 'rate' ? 'rate' : 'sync';
const locale: Locale = localeParam();

const CREDITS_TITLE: Record<Locale, string> = { fr: 'GÉNÉRIQUE DE FIN', en: 'ENDING', de: 'ABSPANN' };
const ROLES: Record<Locale, readonly string[]> = {
  fr: ['Œuvre originale', 'Réalisation', 'Musique', 'Animation'],
  en: ['Original work', 'Director', 'Music', 'Animation'],
  de: ['Original', 'Regie', 'Musik', 'Animation'],
};

// La racine fantôme du toast est fermée : ouverte ici pour pouvoir simuler le survol des étoiles
const attachShadow = Element.prototype.attachShadow;
Element.prototype.attachShadow = function (init: ShadowRootInit): ShadowRoot {
  return attachShadow.call(this, { ...init, mode: 'open' });
};

const options = demoChrome(locale, 'watching');
installChromeMock({
  ...options,
  handlers: { ...options.handlers, DEFER_RATING: () => ({ ok: true, data: null }) },
});
await initI18n();

function fillScene(): void {
  const ep = kind === 'sync' ? `Dandadan · S2 E8` : `Frieren · E28`;
  const epTitle = document.querySelector('#ep-title');
  if (epTitle) epTitle.textContent = ep;
  const title = document.querySelector('#credits-title');
  if (title) title.textContent = CREDITS_TITLE[locale];
  const widths = [['62%'], ['48%', '70%'], ['56%'], ['74%', '40%', '58%']];
  const list = document.querySelector('#credits-lines');
  list?.replaceChildren(
    ...ROLES[locale].map((role, i) => {
      const li = document.createElement('li');
      li.append(role, ...(widths[i] ?? []).map((w) => Object.assign(document.createElement('i'), { style: `width: ${w}` })));
      return li;
    }),
  );
  const time = document.querySelector('#time');
  if (time) time.textContent = kind === 'sync' ? '21:52 / 23:40' : '22:31 / 23:40';
  document.documentElement.style.setProperty('--progress', kind === 'sync' ? '92.4%' : '95.1%');
}

fillScene();

const outcome: SyncOutcome = {
  status: 'synced',
  mediaTitle: 'Dandadan Season 2',
  results: [
    { service: 'anilist', outcome: { status: 'updated', progress: 8, completed: false } },
    { service: 'mal', outcome: { status: 'updated', progress: 8, completed: false } },
  ],
};

if (kind === 'sync') showToast(bubbleForOutcome(outcome), { variant: 'bubble' });
else showEngagementPrompt({ kind: 'rate', media: { mediaId: 154587, malId: 52991, title: 'Frieren' } });

// Hôte du toast : dernier élément ajouté au <body> ; agrandi pour la lisibilité de la capture
const host = await waitFor(() => [...document.body.children].find((el) => el.shadowRoot !== null));
const zoom = Number(param('toastZoom') ?? '1.5');
(host as HTMLElement).style.zoom = String(zoom);
const shadow = host.shadowRoot;
await waitFor(() => shadow?.querySelector('.toast.visible'));

if (kind === 'rate' && shadow) {
  // Survol de la 9e étoile (moitié droite = 9/10) : aperçu de la note comme sous la souris
  const stars = shadow.querySelectorAll('.stars-row > .star');
  stars[8]?.querySelectorAll('button')[1]?.dispatchEvent(new MouseEvent('mouseenter'));
}
// Libellé lisible par la page parente pour vérifier la langue
document.documentElement.dataset.toastTitle = shadow?.querySelector('.title')?.textContent ?? '';
await markReady();
