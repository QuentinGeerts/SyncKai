import { describe, expect, it } from 'vitest';
import { isPendingRating, parsePendingRatings } from './pending-ratings';

const valid = { id: 'anilist:1', mediaId: 1, malId: null, title: 'Frieren', coverUrl: null, completedAt: 10 };

describe('isPendingRating', () => {
  it('accepte une carte valide', () => {
    expect(isPendingRating(valid)).toBe(true);
    expect(isPendingRating({ ...valid, coverUrl: 'https://s4.anilist.co/x.jpg' })).toBe(true);
  });

  it('refuse les entrées incomplètes ou suspectes', () => {
    expect(isPendingRating({ ...valid, id: '' })).toBe(false);
    expect(isPendingRating({ ...valid, mediaId: null, malId: null })).toBe(false);
    expect(isPendingRating({ ...valid, coverUrl: 'javascript:alert(1)' })).toBe(false);
    expect(isPendingRating({ ...valid, completedAt: '10' })).toBe(false);
    expect(isPendingRating(null)).toBe(false);
  });
});

describe('parsePendingRatings', () => {
  it('ignore les entrées invalides et trie par date décroissante', () => {
    const older = { ...valid, id: 'mal:5', mediaId: null, malId: 5, completedAt: 1 };
    expect(parsePendingRatings([older, { bad: true }, valid])).toEqual([valid, older]);
    expect(parsePendingRatings(undefined)).toEqual([]);
  });
});
