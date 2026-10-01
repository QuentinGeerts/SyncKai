import { refreshReviewBadge } from './badge';
import { BACKUP_STORAGE_KEYS, buildBackup, mergeBackup, sectionsFromStorage, type Backup, type BackupData, type ImportMode } from './backup';
import { withStorageLock } from './storage';

// Lecture / écriture des sauvegardes dans chrome.storage.local (popup et page d'import).

async function readCurrent(appVersion: string): Promise<Backup> {
  const stored = await chrome.storage.local.get(Object.values(BACKUP_STORAGE_KEYS));
  return buildBackup(sectionsFromStorage(stored), appVersion, new Date());
}

/** Sauvegarde des 7 clés exportables (jamais les tokens ni les caches). */
export function exportBackup(): Promise<Backup> {
  return readCurrent(chrome.runtime.getManifest().version);
}

/** Applique une sauvegarde importée sous verrou, puis met à jour le badge de l'icône. */
export async function applyBackup(incoming: BackupData, mode: ImportMode, includeSettings: boolean): Promise<void> {
  await withStorageLock(async () => {
    const current = await readCurrent(chrome.runtime.getManifest().version);
    const next = mergeBackup(current.data, incoming, mode, includeSettings);
    const k = BACKUP_STORAGE_KEYS;
    await chrome.storage.local.set({
      ...(next.settings !== null ? { [k.settings]: next.settings } : {}),
      [k.mediaMappings]: next.mediaMappings,
      [k.pendingReviews]: next.pendingReviews,
      [k.recentSyncs]: next.recentSyncs,
      [k.excludedSeries]: next.excludedSeries,
      [k.pendingRatings]: next.pendingRatings,
      [k.rewatchDeclined]: next.rewatchDeclined,
    });
  });
  // Badge décoratif : son échec ne remet pas l'import en cause
  await refreshReviewBadge().catch((error: unknown) => console.warn('[SyncKai] Badge non mis à jour après import :', error));
}
