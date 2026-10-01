// Monte le VRAI popup (src/popup/popup.ts) avec l'API chrome simulée et les données de démo.
import '../../src/popup/popup.css';
import { demoChrome, type Scenario } from './demo-data';
import { installChromeMock } from './mock-chrome';
import { localeParam, markReady, param, waitFor } from './params';

const SCENARIOS: readonly Scenario[] = ['watching', 'activity', 'settings'];
const scenario = SCENARIOS.find((s) => s === param('scenario')) ?? 'watching';

installChromeMock(demoChrome(localeParam(), scenario));
await import('../../src/popup/popup.ts');

const click = async (selector: string): Promise<void> => (await waitFor(() => document.querySelector<HTMLElement>(selector))).click();

// Navigation par les vrais boutons, une fois les comptes chargés
await waitFor(() => document.querySelector('[data-focus="nav-activity"]') && document.querySelector('main section'));
if (scenario === 'activity') {
  await click('[data-focus="nav-activity"]');
  await waitFor(() => document.querySelector('main article button[aria-pressed="true"]'));
}
if (scenario === 'settings') {
  await click('[data-focus="gear"]');
  await waitFor(() => document.querySelector('#sk-airing') && [...document.querySelectorAll('main a')].some((a) => a.textContent === 'Kai_fan'));
}
// Pas de focus visible sur le bouton cliqué
(document.activeElement as HTMLElement | null)?.blur();

const zoom = Number(param('zoom') ?? '1');
if (zoom !== 1) document.documentElement.style.zoom = String(zoom);

// Section à amener en haut de la zone défilante (encart « détail » des réglages)
const anchor = param('scrollTo');
if (anchor) {
  document.querySelector(anchor)?.closest('section')?.scrollIntoView({ block: 'start' });
  const main = document.querySelector('main');
  if (main) main.scrollTop -= 12;
}

await markReady();
