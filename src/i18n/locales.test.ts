import { afterEach, describe, expect, it } from 'vitest';
import { formatStarValue } from '../ui/rating';
import { describeOutcome } from '../shared/sync-feedback';
import { formatRelativeTime, nextEpisodeBadge } from '../shared/watching';
import type { SyncOutcome } from '../shared/sync.types';
import type { WatchingEntry } from '../shared/watching.types';
import { getLocale, lowerFirst, setLocale, t, tp, type Locale } from './index';
import de from './locales/de.json';
import en from './locales/en.json';
import fr from './locales/fr.json';

const CATALOGS: Record<Exclude<Locale, 'en'>, Record<string, string>> = { fr, de };
const reference: Record<string, string> = en;

/** Placeholders `{nom}` d'un texte, triés */
const placeholders = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').sort();

describe('catalogues de traduction', () => {
  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    it(`${locale} a exactement les clés de en`, () => {
      expect(Object.keys(catalog).sort()).toEqual(Object.keys(reference).sort());
    });

    it(`${locale} a les mêmes placeholders que en pour chaque clé`, () => {
      for (const [key, text] of Object.entries(reference)) {
        expect({ key, placeholders: placeholders(catalog[key] ?? '') }).toEqual({ key, placeholders: placeholders(text) });
      }
    });

    it(`${locale} n’a aucun texte vide`, () => {
      expect(Object.entries(catalog).filter(([, text]) => text.trim() === '')).toEqual([]);
    });
  }

  it('chaque clé plurielle a ses variantes _one et _other', () => {
    for (const key of Object.keys(reference)) {
      const base = key.replace(/_(one|other)$/, '');
      if (base === key) continue;
      expect(reference).toHaveProperty(`${base}_one`);
      expect(reference).toHaveProperty(`${base}_other`);
    }
  });
});

describe('t / tp', () => {
  const initial = getLocale();
  afterEach(() => setLocale(initial));

  it('remplace les placeholders et laisse les inconnus intacts', () => {
    setLocale('en');
    expect(t('common.connectService', { service: 'AniList' })).toBe('Connect AniList');
    expect(t('watching.tip')).toContain('{path}');
  });

  it('pluriels selon la langue (0 est singulier en français)', () => {
    setLocale('fr');
    expect(tp('footer.toRate', 0)).toBe('0 série à noter');
    expect(tp('footer.toRate', 2)).toBe('2 séries à noter');
    setLocale('en');
    expect(tp('footer.toReview', 1)).toBe('1 item to check');
    expect(tp('footer.toReview', 0)).toBe('0 items to check');
    setLocale('de');
    expect(tp('queue.until.days', 1)).toBe('in 1 Tag');
    expect(tp('queue.until.days', 3)).toBe('in 3 Tagen');
  });

  it('textes en anglais et en allemand', () => {
    const outcome: SyncOutcome = {
      status: 'synced',
      mediaTitle: 'Frieren',
      results: [{ service: 'anilist', outcome: { status: 'updated', progress: 2, completed: false } }],
    };
    setLocale('en');
    expect(describeOutcome(outcome).message).toBe('AniList: episode 2 saved');
    expect(formatStarValue(8.5)).toBe('8.5');
    setLocale('de');
    expect(describeOutcome(outcome).message).toBe('AniList: Folge 2 gespeichert');
    expect(formatStarValue(8.5)).toBe('8,5');
    expect(lowerFirst('Kein entsprechender Eintrag')).toBe('Kein entsprechender Eintrag');
  });

  it('pastille d’état en anglais et en allemand', () => {
    const now = Date.UTC(2026, 9, 1, 12);
    const entry: WatchingEntry = {
      mediaId: 1, malId: null, title: 'A', coverUrl: null, progress: 4, totalEpisodes: null, updatedAt: null,
      nextEpisode: { episode: 5, airingAt: now + 2 * 86_400_000 }, airingStatus: 'RELEASING', platforms: [], lastSync: null, siteUrl: 'https://anilist.co/anime/1',
    };
    setLocale('en');
    expect(nextEpisodeBadge(entry, now).label).toBe('Ep. 5 in 2 d');
    setLocale('de');
    expect(nextEpisodeBadge(entry, now).label).toBe('Folge 5 in 2 T.');
  });
});

describe('formatRelativeTime par langue', () => {
  const NOW = Date.UTC(2026, 9, 1, 12);
  const MIN = 60_000;
  const DAY = 24 * 60 * MIN;

  it.each([
    ['en', 0, 'just now'],
    ['en', 20 * MIN, '20 min ago'],
    ['en', 2 * 60 * MIN, '2 h ago'],
    ['en', DAY, 'yesterday'],
    ['en', 3 * DAY, '3 days ago'],
    ['de', 0, 'gerade eben'],
    ['de', 20 * MIN, 'vor 20 Min.'],
    ['de', 2 * 60 * MIN, 'vor 2 Std.'],
    ['de', DAY, 'gestern'],
    ['de', 3 * DAY, 'vor 3 Tagen'],
    ['fr', 20 * MIN, 'il y a 20 min'],
    ['fr', 3 * DAY, 'il y a 3 jours'],
  ] as const)('%s, %i ms → %s', (locale, elapsed, expected) => {
    expect(formatRelativeTime(NOW - elapsed, NOW, locale)).toBe(expected);
  });
});
