import { isSyncQueueItem, type SyncQueueItem } from './queue.types';
import { withStorageLock } from './storage';

// Accès au stockage de la file de synchro (popup + service worker).
// Écritures sous `withStorageLock` (src/shared/storage.ts), clé de stockage `syncQueue`.

export const SYNC_QUEUE_KEY = 'syncQueue';

/** Lecture brute, entrées invalides ignorées */
async function readQueue(): Promise<SyncQueueItem[]> {
  const stored = await chrome.storage.local.get(SYNC_QUEUE_KEY);
  const value: unknown = stored[SYNC_QUEUE_KEY];
  return Array.isArray(value) ? value.filter(isSyncQueueItem) : [];
}

/** Pending par prochaine tentative, puis failed du plus récent au plus ancien */
function compareQueueItems(a: SyncQueueItem, b: SyncQueueItem): number {
  if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
  return a.status === 'pending' ? a.nextAttemptAt - b.nextAttemptAt : b.firstFailedAt - a.firstFailedAt;
}

/** File complète, triée par prochaine tentative (pending d'abord, puis failed). */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  return (await readQueue()).sort(compareQueueItems);
}

/** Ajoute ou remplace l'entrée de même `id`. */
export function saveQueueItem(item: SyncQueueItem): Promise<void> {
  return withStorageLock(async () => {
    const others = (await readQueue()).filter((i) => i.id !== item.id);
    await chrome.storage.local.set({ [SYNC_QUEUE_KEY]: [...others, item] });
  });
}

export function removeQueueItem(id: string): Promise<void> {
  return withStorageLock(async () => {
    const queue = await readQueue();
    const remaining = queue.filter((i) => i.id !== id);
    if (remaining.length === queue.length) return;
    if (remaining.length === 0) await chrome.storage.local.remove(SYNC_QUEUE_KEY);
    else await chrome.storage.local.set({ [SYNC_QUEUE_KEY]: remaining });
  });
}
