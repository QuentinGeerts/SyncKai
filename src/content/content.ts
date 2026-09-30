import type { StreamingAdapter } from './adapters/adapter';
import { adnAdapter } from './adapters/adn';
import { crunchyrollAdapter } from './adapters/crunchyroll';
import { createLogger } from './lib/logger';
import { watchUrl } from './lib/url-watcher';
import { startWatchSession, type WatchSession } from './lib/watch-session';

/** Adapters disponibles : ajouter ici les futures plateformes (ADN…) */
const ADAPTERS: readonly StreamingAdapter[] = [crunchyrollAdapter, adnAdapter];

const log = createLogger('content');

function main(): void {
  const adapter = ADAPTERS.find((a) => a.supportsHost(location.hostname));
  if (!adapter) {
    log.info(`Aucun adapter pour ${location.hostname}`);
    return;
  }
  log.info(`Adapter "${adapter.platform}" chargé (build ${__SYNCKAI_BUILD__})`);

  let session: WatchSession | null = null;

  // Crunchyroll est une SPA : chaque changement d'URL peut démarrer ou terminer une session
  const handleUrl = (url: URL): void => {
    const episodeId = adapter.getEpisodeId(url);
    if (episodeId !== null && episodeId === session?.episodeId) return; // Même épisode (query/hash modifiés)

    session?.destroy();
    session = episodeId ? startWatchSession(adapter, episodeId) : null;
  };

  handleUrl(new URL(location.href));
  watchUrl(handleUrl);
}

main();
