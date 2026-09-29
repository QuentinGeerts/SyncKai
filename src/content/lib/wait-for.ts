interface WaitForOptions {
  signal: AbortSignal;
  timeoutMs: number;
  /** Intervalle minimal entre deux vérifications : le lecteur modifie le DOM en continu */
  throttleMs?: number;
}

/**
 * Attend qu'une valeur soit disponible dans le DOM (SPA : le contenu arrive après la navigation).
 * Résout avec null en cas de timeout ou d'annulation. L'observer est toujours déconnecté.
 */
export function waitFor<T>(
  find: () => T | null,
  { signal, timeoutMs, throttleMs = 200 }: WaitForOptions,
): Promise<T | null> {
  const immediate = find();
  if (immediate !== null || signal.aborted) return Promise.resolve(immediate);

  return new Promise((resolve) => {
    let pendingCheck: ReturnType<typeof setTimeout> | null = null;

    const finish = (value: T | null): void => {
      observer.disconnect();
      clearTimeout(timer);
      if (pendingCheck !== null) clearTimeout(pendingCheck);
      signal.removeEventListener('abort', onAbort);
      resolve(value);
    };
    const onAbort = (): void => finish(null);

    // Regroupe les rafales de mutations en une seule vérification toutes les `throttleMs`
    const observer = new MutationObserver(() => {
      if (pendingCheck !== null) return;
      pendingCheck = setTimeout(() => {
        pendingCheck = null;
        const found = find();
        if (found !== null) finish(found);
      }, throttleMs);
    });
    const timer = setTimeout(() => finish(null), timeoutMs);

    signal.addEventListener('abort', onAbort, { once: true });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  });
}
