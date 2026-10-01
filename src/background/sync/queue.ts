import { t } from '../../i18n';
import { refreshReviewBadge } from '../../shared/badge';
import type { EpisodeInfo } from '../../shared/episode.types';
import { queueItemId, type SyncQueueItem } from '../../shared/queue.types';
import { getSyncQueue, removeQueueItem, saveQueueItem } from '../../shared/sync-queue-store';
import type { SyncOutcome } from '../../shared/sync.types';
import type { TrackerId } from '../../shared/tracker.types';
import { classifyOutcome, decideAfterRetry, dueItems, nextAlarmTime, upsertFailure, withoutServices } from './queue-policy';
import { syncEpisode } from './sync-service';

// File de synchro hors ligne (service worker).

/** Nom de l'alarme chrome.alarms qui relance la file (n'existe que si la file contient un élément pending) */
export const QUEUE_ALARM = 'synckai:sync-queue';

const LOG_PREFIX = '[SyncKai:queue]';
const RUN_LOCK = 'synckai:sync-queue-run';
/** Pause entre deux relances : évite de solliciter les API en rafale */
const ITEM_DELAY_MS = 1_000;

/** Sérialise les opérations sur UNE entrée (alarme, « Réessayer », nouvelle synchro du même épisode) */
function withItemLock<T>(id: string, task: () => Promise<T>): Promise<T> {
  return navigator.locks.request(`synckai:sync-queue-item:${id}`, task);
}

async function findItem(id: string): Promise<SyncQueueItem | null> {
  return (await getSyncQueue()).find((i) => i.id === id) ?? null;
}

function markQueued(outcome: SyncOutcome): SyncOutcome {
  return outcome.status === 'synced' || outcome.status === 'error' ? { ...outcome, queued: true } : outcome;
}

/** Recalcule l'alarme : prochaine tentative pending, supprimée si aucune */
async function scheduleAlarm(): Promise<void> {
  const when = nextAlarmTime(await getSyncQueue(), Date.now());
  if (when === null) await chrome.alarms.clear(QUEUE_ALARM);
  else await chrome.alarms.create(QUEUE_ALARM, { when });
}

async function refreshBadgeSafely(): Promise<void> {
  try {
    await refreshReviewBadge();
  } catch (error: unknown) {
    console.warn(LOG_PREFIX, 'Badge non mis à jour :', error);
  }
}

/**
 * Après une synchro : met en file l'épisode si l'échec est passager (erreur globale réseau/limite/serveur,
 * ou services en erreur dans un résultat `synced`), et retourne le résultat avec `queued: true` le cas échéant.
 * Retire l'éventuelle entrée existante si la synchro a réussi pour tous les services demandés.
 */
export async function recordSyncOutcome(
  episode: EpisodeInfo,
  services: TrackerId[] | null,
  outcome: SyncOutcome,
): Promise<SyncOutcome> {
  try {
    const id = queueItemId(episode);
    const result = classifyOutcome(outcome, services);
    if (result.kind === 'final') return outcome;

    const queued = await withItemLock(id, async (): Promise<boolean> => {
      const existing = await findItem(id);
      if (result.kind === 'retry') {
        await saveQueueItem(upsertFailure(existing, episode, result.services, result.message, Date.now()));
        return true;
      }
      // Succès (ou plus rien à relancer) : retire les services concernés de l'entrée existante
      if (existing !== null) {
        const rest = result.kind === 'resolved' ? null : withoutServices(existing, services);
        if (rest === null) await removeQueueItem(id);
        else await saveQueueItem(rest);
      }
      return false;
    });

    await scheduleAlarm();
    await refreshBadgeSafely();
    return queued ? markQueued(outcome) : outcome;
  } catch (error: unknown) {
    console.error(LOG_PREFIX, 'Mise en file impossible :', error);
    return outcome;
  }
}

/** Relance une entrée et applique la décision ; null si l'entrée a disparu ou n'est plus due */
async function retryItem(id: string, manual: boolean): Promise<SyncOutcome | null> {
  return withItemLock(id, async (): Promise<SyncOutcome | null> => {
    const item = await findItem(id);
    if (item === null) return null;
    // Relue sous verrou : un « Réessayer » concurrent a pu la replanifier
    if (!manual && (item.status !== 'pending' || item.nextAttemptAt > Date.now())) return null;

    const outcome = await syncEpisode(item.episode, item.services);
    const decision = decideAfterRetry(item, outcome, Date.now(), manual);
    if (decision.action === 'remove') {
      await removeQueueItem(id);
      return outcome;
    }
    await saveQueueItem(decision.item);
    if (decision.item.status === 'failed') console.warn(LOG_PREFIX, 'Synchro abandonnée :', id, decision.item.lastError);
    return decision.item.status === 'pending' ? markQueued(outcome) : outcome;
  });
}

/** Handler de l'alarme : relance les éléments dus, replanifie l'alarme ou la supprime si la file est vide. */
export async function processSyncQueue(): Promise<void> {
  try {
    // ifAvailable : une exécution déjà en cours suffit (alarme et démarrage simultanés)
    await navigator.locks.request(RUN_LOCK, { ifAvailable: true }, async (lock): Promise<void> => {
      if (lock === null) return;
      const due = dueItems(await getSyncQueue(), Date.now());
      for (const [index, item] of due.entries()) {
        if (index > 0) await new Promise<void>((resolve) => setTimeout(resolve, ITEM_DELAY_MS));
        try {
          await retryItem(item.id, false);
        } catch (error: unknown) {
          console.error(LOG_PREFIX, 'Relance en échec :', item.id, error);
        }
      }
    });
  } catch (error: unknown) {
    console.error(LOG_PREFIX, 'Traitement de la file impossible :', error);
  }
  try {
    await scheduleAlarm();
  } catch (error: unknown) {
    console.error(LOG_PREFIX, 'Alarme non replanifiée :', error);
  }
  await refreshBadgeSafely();
}

/** « Réessayer » depuis le popup (élément pending ou failed) : relance immédiate et retour du résultat. */
export async function retryQueued(id: string): Promise<SyncOutcome> {
  let outcome: SyncOutcome;
  try {
    outcome = (await retryItem(id, true)) ?? { status: 'error', message: t('queue.gone') };
  } catch (error: unknown) {
    console.error(LOG_PREFIX, 'Réessai impossible :', id, error);
    outcome = { status: 'error', message: t('queue.retryFailed') };
  }
  try {
    await scheduleAlarm();
  } catch (error: unknown) {
    console.error(LOG_PREFIX, 'Alarme non replanifiée :', error);
  }
  await refreshBadgeSafely();
  return outcome;
}

/** Au démarrage du navigateur / à l'installation : recrée l'alarme si la file contient des éléments pending. */
export async function ensureQueueAlarm(): Promise<void> {
  try {
    await scheduleAlarm();
  } catch (error: unknown) {
    console.error(LOG_PREFIX, 'Alarme non recréée :', error);
  }
  await refreshBadgeSafely();
}
