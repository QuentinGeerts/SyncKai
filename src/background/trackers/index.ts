import { getMalToken, getValidToken } from '../../shared/storage';
import type { TrackerId } from '../../shared/tracker.types';
import { getMediaListInfo, saveProgress } from '../api/list';
import { getMalAnime, saveMalProgress } from '../api/mal';
import type { TrackerService } from './tracker';

export const anilistTracker: TrackerService = {
  id: 'anilist',
  isConnected: async () => (await getValidToken()) !== null,
  resolveId: (media) => media.mediaId,
  async getEntry(id) {
    const { title, episodes, entry } = await getMediaListInfo(id);
    return { title, episodes, entry };
  },
  saveProgress: (id, progress, status) => saveProgress(id, progress, status),
};

export const malTracker: TrackerService = {
  id: 'mal',
  // Token présent (même expiré) : il sera renouvelé à la première requête
  isConnected: async () => (await getMalToken()) !== null,
  resolveId: (media) => media.idMal,
  getEntry: (id) => getMalAnime(id),
  saveProgress: (id, progress, status) => saveMalProgress(id, progress, status),
};

const TRACKERS: readonly TrackerService[] = [anilistTracker, malTracker];

/** Services connectés, éventuellement restreints à `only` (nouvelle tentative ciblée). */
export async function getConnectedTrackers(only: readonly TrackerId[] | null = null): Promise<TrackerService[]> {
  const candidates = only ? TRACKERS.filter((t) => only.includes(t.id)) : TRACKERS;
  const connected = await Promise.all(candidates.map((t) => t.isConnected()));
  return candidates.filter((_, i) => connected[i]);
}
