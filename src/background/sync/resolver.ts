import type { EpisodeInfo } from '../../shared/episode.types';
import { deleteMediaMapping, getMediaMapping, saveMediaMapping } from '../../shared/storage';
import { getAnimeByIds, searchAnime, type AniListMedia } from '../api/media';
import {
  applyMapping,
  mappingKey,
  matchCrunchyrollLink,
  normalizeTitle,
  resolveTarget,
  SERIES_FORMATS,
  toSortableDate,
  type LinkKind,
  type MediaCandidate,
  type ResolveResult,
} from './matching';

const FRANCHISE_RELATIONS: ReadonlySet<string> = new Set(['SEQUEL', 'PREQUEL']);
/** Limite les requêtes supplémentaires pour récupérer les saisons absentes de la recherche */
const MAX_FETCH_ROUNDS = 2;

/**
 * Recherche les fiches AniList de la franchise et détermine le lien de chacune avec la série.
 * Les suites/préquelles d'une fiche liée sont ajoutées (et récupérées si besoin) : AniList ne lie
 * pas toujours chaque saison à la plateforme.
 */
async function collectCandidates(episode: EpisodeInfo): Promise<MediaCandidate[]> {
  const mediaById = new Map<number, AniListMedia>();
  const links = new Map<number, LinkKind>();

  const linkOf = (media: AniListMedia): LinkKind =>
    media.externalLinkUrls.map((url) => matchCrunchyrollLink(url, episode.seriesId, episode.seriesSlug)).find((k) => k !== null) ?? null;
  const add = (list: AniListMedia[], fallback: LinkKind = null): void => {
    for (const media of list) {
      mediaById.set(media.id, media);
      links.set(media.id, linkOf(media) ?? fallback);
    }
  };

  add(await searchAnime(episode.animeTitle));

  // Aucun résultat lié : le titre de saison est parfois le titre AniList (ex : "… Season 2")
  const hasLinked = [...links.values()].some((l) => l !== null);
  if (!hasLinked && episode.seasonTitle && normalizeTitle(episode.seasonTitle) !== normalizeTitle(episode.animeTitle)) {
    add(await searchAnime(episode.seasonTitle));
  }

  // Propagation du lien le long des relations SEQUEL/PREQUEL jusqu'à stabilisation
  let fetchRounds = 0;
  for (;;) {
    let changed = false;
    const missing = new Set<number>();

    for (const media of mediaById.values()) {
      if (links.get(media.id) === null) continue;
      for (const rel of media.relations) {
        if (rel.type !== 'ANIME' || !FRANCHISE_RELATIONS.has(rel.relationType ?? '')) continue;
        if (mediaById.has(rel.id)) {
          if (links.get(rel.id) === null) {
            links.set(rel.id, 'relation');
            changed = true;
          }
        } else if (rel.format !== null && SERIES_FORMATS.has(rel.format)) {
          missing.add(rel.id);
        }
      }
    }

    if (missing.size > 0 && fetchRounds < MAX_FETCH_ROUNDS) {
      fetchRounds++;
      add(await getAnimeByIds([...missing]), 'relation');
      changed = true;
    }
    if (!changed) break;
  }

  return [...mediaById.values()].map((media) => ({
    id: media.id,
    format: media.format,
    episodes: media.episodes,
    startDate: toSortableDate(media.startDate),
    titles: media.titles,
    link: links.get(media.id) ?? null,
  }));
}

/** Résout la fiche AniList d'un épisode : cache d'abord, recherche sinon (et mise en cache si fiable). */
export async function resolveEpisode(episode: EpisodeInfo): Promise<ResolveResult> {
  const key = mappingKey(episode);

  const cached = await getMediaMapping(key);
  if (cached) {
    const progress = applyMapping(episode, cached);
    if (progress !== null) {
      return { ok: true, target: { ...cached, progress, confidence: 'high', reason: 'Correspondance en cache' } };
    }
    // Ex : numérotation absolue passée à la fiche suivante → nouvelle résolution
    await deleteMediaMapping(key);
  }

  const result = resolveTarget(episode, await collectCandidates(episode));
  if (result.ok && result.target.confidence === 'high') {
    const { mediaId, numbering, offset, episodes } = result.target;
    await saveMediaMapping(key, { mediaId, numbering, offset, episodes });
  }
  return result;
}
