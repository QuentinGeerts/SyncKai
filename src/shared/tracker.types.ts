/** Services de suivi sur lesquels SyncKai écrit la progression */
export type TrackerId = 'anilist' | 'mal';

export const TRACKER_IDS: readonly TrackerId[] = ['anilist', 'mal'];

export const TRACKER_LABELS: Record<TrackerId, string> = {
  anilist: 'AniList',
  mal: 'MyAnimeList',
};

export function isTrackerId(value: unknown): value is TrackerId {
  return typeof value === 'string' && (TRACKER_IDS as readonly string[]).includes(value);
}
