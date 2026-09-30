import { isRecord } from '../../shared/guards';

/** Helpers de lecture communs aux adapters (DOM, JSON-LD, texte). */

/** "12", 12, "12.5" → nombre ; "12,5" (virgule décimale) accepté aussi */
export function toNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number.parseFloat(value.replace(',', '.')) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** Espaces normalisés ; null pour une valeur absente ou vide */
export function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  return text ? text : null;
}

/** Aplatit un bloc JSON-LD (objet, tableau ou @graph) en liste de nœuds. */
export function flattenJsonLd(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.flatMap(flattenJsonLd);
  if (!isRecord(data)) return [];
  return Array.isArray(data['@graph']) ? [data, ...data['@graph'].flatMap(flattenJsonLd)] : [data];
}

/** Nœuds JSON-LD de la page ayant le type schema.org demandé (ex : "TVEpisode"). */
export function readJsonLdNodes(type: string): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  for (const script of document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')) {
    try {
      nodes.push(...flattenJsonLd(JSON.parse(script.textContent ?? '')).filter((n) => n['@type'] === type));
    } catch {
      // Bloc JSON-LD invalide : ignoré
    }
  }
  return nodes;
}

export interface LabelGuard {
  /** Vrai si ce libellé a déjà été attribué à un AUTRE épisode (DOM encore celui du précédent) */
  isStale(episodeId: string, key: string | null): boolean;
  remember(episodeId: string, key: string | null): void;
}

/**
 * Garde-fou pour les sources sans identifiant d'épisode (DOM) : après une navigation SPA, la page
 * affiche encore l'épisode précédent pendant un instant. Un libellé ("E1180|titre") déjà vu
 * pour un autre épisode signale donc des données périmées.
 */
export function createLabelGuard(): LabelGuard {
  const owners = new Map<string, string>();
  return {
    isStale(episodeId, key) {
      const owner = key ? owners.get(key) : undefined;
      return owner !== undefined && owner !== episodeId;
    },
    remember(episodeId, key) {
      if (key) owners.set(key, episodeId);
    },
  };
}

/** Clé de libellé d'épisode pour le garde-fou ("1180|Titre"), null sans titre */
export function labelKey(displayedNumber: number | null, title: string | null): string | null {
  return title ? `${displayedNumber ?? '?'}|${title}` : null;
}
