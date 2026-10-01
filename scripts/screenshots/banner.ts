// Composition d'une capture 1280×800 : légende + vraie UI (popup ou bulle sur lecteur) dans des iframes.
import kaiIcon from '../../assets/brand/kai-icon-32.svg?url';
import lockup from '../../assets/brand/kai-lockup-dark.svg?url';
import { CAPTIONS, type ShotId } from './captions';
import { localeParam, markReady, param, waitFor } from './params';

const SHOTS: readonly ShotId[] = [1, 2, 3, 4, 5];
const shot: ShotId = SHOTS.find((s) => String(s) === param('shot')) ?? 1;
const locale = localeParam();
const caption = CAPTIONS[locale][shot];
const canvas = document.querySelector<HTMLElement>('#canvas');
if (!canvas) throw new Error('#canvas introuvable');
document.documentElement.lang = locale;

const POPUP = { width: 400, height: 580, zoom: 1.2 };
/** En-tête (56) + navigation (44) du popup, masqués dans l'encart de détail */
const POPUP_CHROME = 100;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, style: Partial<CSSStyleDeclaration> = {}): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  Object.assign(node.style, style);
  return node;
}

const px = (n: number): string => `${n}px`;

/** Titre avec mot(s) mis en valeur entre astérisques */
function headline(text: string): HTMLElement {
  const h1 = el('h1', 'headline');
  text.split(/(\*[^*]+\*)/).forEach((part) => {
    if (!part) return;
    if (part.startsWith('*')) {
      const span = el('span', 'accent');
      span.textContent = part.slice(1, -1);
      h1.append(span);
    } else h1.append(part);
  });
  return h1;
}

function copy(width: number, top: number | null, compact = false): HTMLElement {
  const box = el('div', compact ? 'copy compact' : 'copy', { width: px(width) });
  if (top !== null) Object.assign(box.style, { justifyContent: 'flex-start', top: px(top), bottom: 'auto' });
  const eyebrow = el('span', 'eyebrow');
  eyebrow.textContent = caption.eyebrow;
  const sub = el('p', 'sub');
  sub.textContent = caption.sub;
  box.append(eyebrow, headline(caption.title), sub);
  return box;
}

function frame(src: string, width: number, height: number): HTMLIFrameElement {
  const iframe = el('iframe', 'frame', { width: px(width), height: px(height) });
  iframe.src = src;
  return iframe;
}

const popupSrc = (scenario: string, extra = '', zoom = POPUP.zoom): string => `./popup.html?locale=${locale}&scenario=${scenario}&zoom=${zoom}${extra}`;

/** Barre d'outils minimale : icône Kai mise en avant (le popup en descend) */
function toolbar(left: number, top: number, width: number, badge: string | null): { node: HTMLElement; kaiCenter: number } {
  const bar = el('div', 'toolbar', { left: px(left), top: px(top), width: px(width) });
  const dots = el('div', 'dots');
  dots.append(el('i', ''), el('i', ''), el('i', ''));
  const omni = el('div', 'omnibox');
  omni.append(el('b', '', { width: '34%' }));
  const puzzle = el('span', 'ext');
  puzzle.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M10 4a2 2 0 1 1 4 0v2h4v4h-2a2 2 0 1 0 0 4h2v4h-4v-2a2 2 0 1 0-4 0v2H6v-4h2a2 2 0 1 0 0-4H6V6h4z"/></svg>';
  const kai = el('span', 'ext kai');
  const img = el('img', '');
  img.src = kaiIcon;
  img.alt = '';
  kai.append(img);
  if (badge) {
    const b = el('span', 'badge');
    b.textContent = badge;
    kai.append(b);
  }
  bar.append(dots, omni, puzzle, kai);
  // Icône Kai : dernier élément, padding droit 14 px, 34 px de large
  return { node: bar, kaiCenter: left + width - 14 - 17 };
}

function popupWindow(scenario: string, right: number, top: number, badge: string | null): HTMLElement[] {
  const w = POPUP.width * POPUP.zoom;
  const h = POPUP.height * POPUP.zoom;
  const bar = toolbar(600, 22, 1240 - 600, badge);
  const win = el('div', 'window', { left: px(right - w), top: px(top), width: px(w), height: px(h) });
  win.append(frame(popupSrc(scenario), w, h));
  return [bar.node, win];
}

function player(kind: 'sync' | 'rate'): HTMLElement {
  const width = 680;
  const height = Math.round((width * 9) / 16);
  const box = el('div', 'player', { left: px(1232 - width), top: px((800 - height) / 2), width: px(width), height: px(height) });
  box.append(frame(`./player.html?locale=${locale}&kind=${kind}&toastZoom=1.5`, width, height));
  return box;
}

/** Encart de détail : même popup, défilé jusqu'à « Nouveaux épisodes » et rogné sous l'en-tête */
function settingsCallout(left: number, top: number, visibleHeight: number): HTMLElement {
  // Échelle 1 : « Nouveaux épisodes » et « Langue » tiennent ensemble dans l'encart
  const w = POPUP.width;
  const h = POPUP.height;
  const box = el('div', 'window', { left: px(left), top: px(top), width: px(w), height: px(visibleHeight) });
  const iframe = frame(popupSrc('settings', '&scrollTo=%23sk-airing', 1), w, h);
  iframe.style.marginTop = px(-POPUP_CHROME);
  box.append(iframe);
  box.dataset.callout = '';
  return box;
}

/** Encart rogné juste sous la section « Langue » (hauteur variable selon la langue) */
function fitCallout(): void {
  const box = document.querySelector<HTMLElement>('[data-callout]');
  const section = box?.querySelector('iframe')?.contentDocument?.querySelector('#sk-language-label')?.closest('section');
  if (!box || !section) return;
  box.style.height = px(Math.round(section.getBoundingClientRect().bottom) - POPUP_CHROME + 14);
}

const logo = el('img', 'lockup');
logo.src = lockup;
logo.alt = 'SyncKai';

const parts: HTMLElement[] = [logo];
switch (shot) {
  case 1:
    parts.push(copy(440, null, true), player('sync'));
    break;
  case 2:
    parts.push(copy(600, null), ...popupWindow('watching', 1232, 80, null));
    break;
  case 3:
    parts.push(copy(600, null), ...popupWindow('activity', 1232, 80, '1'));
    break;
  case 4:
    parts.push(copy(440, null, true), player('rate'));
    break;
  case 5:
    parts.push(copy(600, 136), settingsCallout(72, 416, 352), ...popupWindow('settings', 1232, 80, null));
    break;
}
canvas.append(...parts);

// Prêt quand chaque iframe a terminé son rendu
await Promise.all(
  [...document.querySelectorAll('iframe')].map((iframe) =>
    waitFor(() => iframe.contentDocument?.documentElement.dataset.ready === '1', 20_000),
  ),
);
fitCallout();
await markReady();
