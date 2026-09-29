import { isRecord } from '../../shared/guards';
import { toSafeUrl } from '../../shared/url';
import { anilistQuery } from './client';

/** Fiche AniList normalisée (les champs absents de l'API deviennent null / []) */
export interface AniListMedia {
  id: number;
  format: string | null;
  episodes: number | null;
  startDate: { year: number | null; month: number | null; day: number | null } | null;
  /** Titre préféré de l'utilisateur (réglage AniList), pour l'affichage */
  displayTitle: string;
  titles: string[];
  year: number | null;
  coverUrl: string | null;
  externalLinkUrls: string[];
  relations: { relationType: string | null; id: number; type: string | null; format: string | null }[];
}

const MEDIA_FIELDS = /* GraphQL */ `
  id
  format
  episodes
  startDate { year month day }
  seasonYear
  coverImage { medium }
  title { romaji english native userPreferred }
  synonyms
  externalLinks { url }
  relations { edges { relationType node { id type format } } }
`;

const SEARCH_QUERY = /* GraphQL */ `
  query SearchAnime($search: String!) {
    Page(perPage: 20) {
      media(search: $search, type: ANIME) { ${MEDIA_FIELDS} }
    }
  }
`;

const BY_IDS_QUERY = /* GraphQL */ `
  query AnimeByIds($ids: [Int]) {
    Page(perPage: 50) {
      media(id_in: $ids, type: ANIME) { ${MEDIA_FIELDS} }
    }
  }
`;

// ─── Parsing défensif de la réponse brute ─────────────────────────────────

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function parseMedia(value: unknown): AniListMedia | null {
  if (!isRecord(value) || typeof value.id !== 'number') return null;

  const title = isRecord(value.title) ? value.title : {};
  const start = isRecord(value.startDate) ? value.startDate : null;
  const titles = [title.romaji, title.english, title.native, title.userPreferred, ...arr(value.synonyms)];
  const cover = isRecord(value.coverImage) ? value.coverImage : {};

  return {
    id: value.id,
    format: str(value.format),
    episodes: num(value.episodes),
    startDate: start ? { year: num(start.year), month: num(start.month), day: num(start.day) } : null,
    displayTitle: str(title.userPreferred) ?? str(title.romaji) ?? str(title.english) ?? `#${value.id}`,
    year: num(value.seasonYear) ?? (start ? num(start.year) : null),
    coverUrl: toSafeUrl(str(cover.medium)),
    titles: [...new Set(titles.filter((t): t is string => typeof t === 'string' && t.length > 0))],
    externalLinkUrls: arr(value.externalLinks).flatMap((l) => (isRecord(l) && typeof l.url === 'string' ? [l.url] : [])),
    relations: arr(isRecord(value.relations) ? value.relations.edges : []).flatMap((edge) => {
      if (!isRecord(edge) || !isRecord(edge.node) || typeof edge.node.id !== 'number') return [];
      return [{ relationType: str(edge.relationType), id: edge.node.id, type: str(edge.node.type), format: str(edge.node.format) }];
    }),
  };
}

interface PageData {
  Page: { media: unknown[] };
}

function isPageData(data: unknown): data is PageData {
  return isRecord(data) && isRecord(data.Page) && Array.isArray(data.Page.media);
}

function parsePage(data: PageData): AniListMedia[] {
  return data.Page.media.map(parseMedia).filter((m): m is AniListMedia => m !== null);
}

// ─── API ──────────────────────────────────────────────────────────────────

export async function searchAnime(search: string): Promise<AniListMedia[]> {
  return parsePage(await anilistQuery(SEARCH_QUERY, isPageData, { search }));
}

export async function getAnimeByIds(ids: readonly number[]): Promise<AniListMedia[]> {
  if (ids.length === 0) return [];
  return parsePage(await anilistQuery(BY_IDS_QUERY, isPageData, { ids }));
}
