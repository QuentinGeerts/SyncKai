import { t } from '../i18n';
import type { ContentMessage } from '../shared/content-messages';
import type { AdjustProgressPayload } from '../shared/messages';
import type { ServiceOutcome, ServiceResult, SyncOutcome } from '../shared/sync.types';
import { TRACKER_LABELS } from '../shared/tracker.types';
import { ApiError } from './api/errors';
import type { ListEntryState, WriteStatus } from './sync/rules';
import { getCatalogMedia } from './sync/sync-service';
import { getConnectedTrackers } from './trackers';
import type { CatalogMedia, TrackerService } from './trackers/tracker';
import { createLogger } from '../shared/logger';

// Contrôles manuels (service worker) : +1 / −1 depuis le popup et raccourci « valider l'épisode ».

const log = createLogger('controls');

/** Identifiant de la commande déclarée dans manifest.json (`commands`) */
export const COMPLETE_EPISODE_COMMAND = 'complete-episode';

export type AdjustDecision =
  | { action: 'write'; progress: number; status: WriteStatus }
  | { action: 'skip'; reason: string };

/**
 * Nouvelle progression après un ajustement manuel (pur, testable).
 * −1 contourne volontairement « jamais de recul » ; +1 au-delà du total est refusé.
 */
export function decideAdjustment(entry: ListEntryState | null, total: number | null, delta: 1 | -1): AdjustDecision {
  const current = entry?.progress ?? 0;
  if (delta === -1 && current <= 0) return { action: 'skip', reason: t('controls.nothingToRemove') };
  if (delta === 1 && total !== null && current >= total) return { action: 'skip', reason: t('controls.alreadyLast') };
  const progress = Math.max(0, current + delta);
  if (total !== null && progress >= total) return { action: 'write', progress, status: 'COMPLETED' };
  // Revisionnage en cours : il continue ; −1 sur une entrée terminée la repasse « en cours »
  return { action: 'write', progress, status: entry?.status === 'REPEATING' ? 'REPEATING' : 'CURRENT' };
}

/** Ajuste UN service. Ne lève jamais : l'échec est un résultat. */
async function adjustOnService(tracker: TrackerService, id: number, fallbackTotal: number | null, delta: 1 | -1): Promise<{ result: ServiceResult; title: string | null }> {
  const label = TRACKER_LABELS[tracker.id];
  try {
    // Lecture fraîche : la progression de référence est celle de CE service
    const current = await tracker.getEntry(id);
    const decision = decideAdjustment(current.entry, current.episodes ?? fallbackTotal, delta);
    if (decision.action === 'skip') {
      return { result: { service: tracker.id, outcome: { status: 'skipped', reason: decision.reason } }, title: current.title };
    }
    const saved = await tracker.saveProgress(id, decision.progress, decision.status);
    log.info(`${label} : ${current.title} → épisode ${saved.progress} (${saved.status}, ajustement ${delta > 0 ? '+1' : '−1'})`);
    const outcome: ServiceOutcome = { status: 'updated', progress: saved.progress, completed: saved.status === 'COMPLETED' };
    return { result: { service: tracker.id, outcome }, title: current.title };
  } catch (error: unknown) {
    log.error(`${label} : échec de l’ajustement`, error);
    const outcome: ServiceOutcome =
      error instanceof ApiError ? { status: 'error', message: error.message, code: error.code } : { status: 'error', message: t('error.unexpected') };
    return { result: { service: tracker.id, outcome }, title: null };
  }
}

/**
 * +1 / −1 manuel : écrit sur tous les services connectés où la série existe.
 * N'alimente pas les « dernières synchros » (action manuelle, le popup affiche le résultat).
 */
export async function adjustProgress(payload: AdjustProgressPayload): Promise<SyncOutcome> {
  try {
    const trackers = await getConnectedTrackers();
    if (trackers.length === 0) return { status: 'not-connected' };

    // Catalogue AniList si connu (idMal, total) ; sinon MAL seul avec son propre identifiant
    const catalog: CatalogMedia | null = payload.mediaId !== null ? await getCatalogMedia(payload.mediaId) : null;
    const targets = trackers.flatMap((tracker) => {
      const id = catalog ? tracker.resolveId(catalog) : tracker.id === 'mal' ? payload.malId : null;
      return id !== null ? [{ tracker, id }] : [];
    });
    if (targets.length === 0) return { status: 'error', message: t('sync.noServiceFollows') };

    const adjusted = await Promise.all(targets.map(({ tracker, id }) => adjustOnService(tracker, id, catalog?.episodes ?? null, payload.delta)));
    const mediaTitle = catalog?.title ?? adjusted.find((a) => a.title !== null)?.title ?? t('sync.seriesFallback');
    return { status: 'synced', mediaTitle, results: adjusted.map((a) => a.result) };
  } catch (error: unknown) {
    if (error instanceof ApiError) return { status: 'error', message: error.message, code: error.code };
    log.error('Erreur inattendue :', error);
    return { status: 'error', message: t('error.unexpectedAdjust') };
  }
}

/** Onglet hors Crunchyroll/ADN : aucun content script pour répondre */
function isNoReceiverError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Receiving end does not exist');
}

/** chrome.commands : « valider l'épisode en cours » → FORCE_COMPLETE au content script de l'onglet actif. */
export async function handleCommand(command: string): Promise<void> {
  if (command !== COMPLETE_EPISODE_COMMAND) return;
  try {
    // L'id de l'onglet ne requiert pas la permission "tabs"
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id === undefined) return;
    const message: ContentMessage = { type: 'FORCE_COMPLETE' };
    await chrome.tabs.sendMessage(tab.id, message);
  } catch (error: unknown) {
    if (!isNoReceiverError(error)) log.warn('Raccourci « valider l’épisode » :', error);
  }
}
