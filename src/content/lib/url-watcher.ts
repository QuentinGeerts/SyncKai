const FALLBACK_POLL_MS = 1000;

/**
 * Appelle `onChange` à chaque changement d'URL d'une SPA. Retourne une fonction de nettoyage.
 *
 * Un content script vit dans un "isolated world" : surcharger history.pushState ici n'intercepterait
 * pas les appels de la page. On utilise donc la Navigation API (Chrome 102+), dont les événements
 * sont visibles depuis le content script, avec un polling léger en repli.
 */
export function watchUrl(onChange: (url: URL) => void): () => void {
  let lastHref = location.href;

  const check = (): void => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    onChange(new URL(lastHref));
  };

  // Typé comme toujours présent par lib.dom, mais absent des navigateurs plus anciens
  const navigation: Navigation | undefined = window.navigation;
  if (navigation) {
    navigation.addEventListener('currententrychange', check);
    return () => navigation.removeEventListener('currententrychange', check);
  }

  const interval = setInterval(check, FALLBACK_POLL_MS);
  window.addEventListener('popstate', check);
  return () => {
    clearInterval(interval);
    window.removeEventListener('popstate', check);
  };
}
