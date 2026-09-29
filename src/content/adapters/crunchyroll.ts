import type { EpisodeInfo } from '../../shared/episode.types';
import { isRecord } from '../../shared/guards';
import { createLogger } from '../lib/logger';
import type { StreamingAdapter } from './adapter';

const log = createLogger('crunchyroll');

/**
 * /watch/{episodeId}/{slug}, avec préfixe de langue optionnel (/fr/watch/…).
 * Le slug est le titre de l'ÉPISODE, pas celui de l'anime : il ne sert pas à l'identification.
 */
const WATCH_PATH_REGEX = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?watch\/([A-Z0-9]+)(?:\/|$)/i;

/** /series/{seriesId}/… (présent dans le JSON-LD et le lien vers la série) */
const SERIES_PATH_REGEX = /\/series\/([A-Z0-9]+)(?:\/|$)/i;

/**
 * Numéro + titre affichés par Crunchyroll, avec préfixe de saison optionnel :
 * - h1       : "E1180 - Le désespoir envahit Elbaph !"
 * - JSON-LD  : "Elbaph | E1180 - Le désespoir envahit Elbaph !"
 */
const EPISODE_LABEL_REGEX = /(?:^|\|)\s*E(\d+(?:\.\d+)?)\s*[-–—]\s*(.+)$/;

// ⚠️ Sélecteurs DOM (repli si le JSON-LD est absent) à valider sur le site réel :
// Crunchyroll modifie régulièrement ses classes CSS ; les attributs data-t sont plus stables.
const SELECTORS = {
  video: 'video[id^="bitmovinplayer-video"], video',
  seriesLink: '[data-t="show-title-link"], a.show-title-link',
  episodeHeading: 'h1.title, [data-t="episode-title"], h1',
  jsonLd: 'script[type="application/ld+json"]',
} as const;

type ExtractedFields = Omit<EpisodeInfo, 'platform' | 'episodeId' | 'url'>;

// ─── Helpers de parsing ────────────────────────────────────────────────────

function toNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  return text ? text : null;
}

function parseEpisodeLabel(label: string | null): { number: number | null; title: string | null } {
  const match = label ? EPISODE_LABEL_REGEX.exec(label) : null;
  return match ? { number: toNumber(match[1]), title: cleanText(match[2]) } : { number: null, title: label };
}

function parseSeriesId(url: unknown): string | null {
  return typeof url === 'string' ? (SERIES_PATH_REGEX.exec(url)?.[1] ?? null) : null;
}

/** Aplatit un bloc JSON-LD (objet, tableau ou @graph) en liste de nœuds. */
function flattenJsonLd(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.flatMap(flattenJsonLd);
  if (!isRecord(data)) return [];
  return Array.isArray(data['@graph']) ? [data, ...data['@graph'].flatMap(flattenJsonLd)] : [data];
}

// ─── Stratégies d'extraction (de la plus fiable à la moins fiable) ─────────

/**
 * 1. Données structurées schema.org (TVEpisode). Structure vérifiée le 2026-09-29 :
 *    { name: "Elbaph | E1180 - …", episodeNumber: 25,
 *      partOfSeason: { name: "Elbaph", seasonNumber: 24 },
 *      partOfSeries: { name: "One Piece", "@id": ".../series/GRMG8ZQZR/one-piece" } }
 */
function extractFromJsonLd(episodeId: string): ExtractedFields | null {
  for (const script of document.querySelectorAll<HTMLScriptElement>(SELECTORS.jsonLd)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(script.textContent ?? '');
    } catch {
      continue;
    }

    for (const node of flattenJsonLd(parsed)) {
      if (node['@type'] !== 'TVEpisode') continue;

      // En SPA, le JSON-LD peut rester celui de l'épisode précédent : on vérifie qu'il correspond
      const nodeUrl = cleanText(node.url) ?? cleanText(node['@id']);
      if (nodeUrl && !nodeUrl.includes(episodeId)) continue;

      const series = isRecord(node.partOfSeries) ? node.partOfSeries : {};
      const season = isRecord(node.partOfSeason) ? node.partOfSeason : {};
      const animeTitle = cleanText(series.name);
      if (!animeTitle) continue;

      const label = parseEpisodeLabel(cleanText(node.name));
      return {
        seriesId: parseSeriesId(series['@id']),
        animeTitle,
        seasonNumber: toNumber(season.seasonNumber),
        seasonTitle: cleanText(season.name),
        seasonEpisodeNumber: toNumber(node.episodeNumber),
        displayedEpisodeNumber: label.number,
        episodeTitle: label.title,
      };
    }
  }
  return null;
}

/**
 * Libellé d'épisode ("E1180|titre") → episodeId auquel il a été attribué.
 * Après une navigation SPA, le DOM affiche encore l'épisode précédent pendant un instant et,
 * contrairement au JSON-LD, ne contient pas d'episodeId permettant de vérifier sa fraîcheur.
 * Un libellé déjà vu pour un AUTRE épisode signale donc un DOM périmé.
 */
const labelOwners = new Map<string, string>();

function labelKey(displayedNumber: number | null, title: string | null): string | null {
  return title ? `${displayedNumber ?? '?'}|${title}` : null;
}

/** 2. DOM de la page de lecture (moins riche : pas de saison ni de numéro relatif). */
function extractFromDom(episodeId: string): ExtractedFields | null {
  const seriesLink = document.querySelector<HTMLElement>(SELECTORS.seriesLink);
  const animeTitle = cleanText(seriesLink?.textContent);
  if (!animeTitle) return null;

  const label = parseEpisodeLabel(cleanText(document.querySelector(SELECTORS.episodeHeading)?.textContent));
  const key = labelKey(label.number, label.title);
  const owner = key ? labelOwners.get(key) : undefined;
  if (owner !== undefined && owner !== episodeId) return null; // DOM de l'épisode précédent

  return {
    seriesId: parseSeriesId(seriesLink?.closest('a')?.href),
    animeTitle,
    seasonNumber: null,
    seasonTitle: null,
    seasonEpisodeNumber: null,
    displayedEpisodeNumber: label.number,
    episodeTitle: label.title,
  };
}

// document.title volontairement exclu : en FR il contient le nom de la saison ("Elbaph …"),
// pas celui de l'anime, ce qui produirait une correspondance AniList erronée.
const STRATEGIES = [
  { name: 'JSON-LD', run: extractFromJsonLd },
  { name: 'DOM', run: extractFromDom },
] as const;

// ─── Adapter ──────────────────────────────────────────────────────────────

export const crunchyrollAdapter: StreamingAdapter = {
  platform: 'crunchyroll',

  supportsHost(hostname) {
    return hostname === 'crunchyroll.com' || hostname.endsWith('.crunchyroll.com');
  },

  getEpisodeId(url) {
    return WATCH_PATH_REGEX.exec(url.pathname)?.[1] ?? null;
  },

  extractEpisodeInfo(url) {
    const episodeId = this.getEpisodeId(url);
    if (!episodeId) return null;

    for (const strategy of STRATEGIES) {
      const fields = strategy.run(episodeId);
      if (fields) {
        const key = labelKey(fields.displayedEpisodeNumber, fields.episodeTitle);
        if (key) labelOwners.set(key, episodeId);
        log.info(`Métadonnées extraites via ${strategy.name}`);
        return { platform: 'crunchyroll', episodeId, url: url.href, ...fields };
      }
    }
    return null;
  },

  findVideo() {
    return document.querySelector<HTMLVideoElement>(SELECTORS.video);
  },
};
