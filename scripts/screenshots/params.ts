import type { Locale } from '../../src/i18n';

export const LOCALE_LIST: readonly Locale[] = ['fr', 'en', 'de'];

const params = new URLSearchParams(location.search);

export function param(name: string): string | null {
  return params.get(name);
}

export function localeParam(): Locale {
  const value = params.get('locale');
  return LOCALE_LIST.find((l) => l === value) ?? 'en';
}

/** Signale à la page parente (ou au script de capture) que le rendu est stable */
export async function markReady(): Promise<void> {
  await document.fonts.ready;
  const images = [...document.images];
  await Promise.all(images.map((img) => img.decode().catch(() => undefined)));
  // Deux frames : dernières mises en page appliquées
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  document.documentElement.dataset.ready = '1';
}

export function waitFor<T>(probe: () => T | null | undefined | false, timeoutMs = 8_000): Promise<T> {
  const start = performance.now();
  return new Promise((resolve, reject) => {
    const tick = (): void => {
      const value = probe();
      if (value) resolve(value);
      else if (performance.now() - start > timeoutMs) reject(new Error('Délai dépassé en attendant le rendu'));
      else setTimeout(tick, 30);
    };
    tick();
  });
}
