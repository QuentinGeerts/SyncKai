import { describe, expect, it } from 'vitest';
import { REWATCH_DECLINE_MS } from './engagement.types';
import { isDeclineActive, isPendingRating, purgeExpiredDeclines } from './engagement-store';

const NOW = 1_800_000_000_000;

describe('refus de revisionnage', () => {
  it('reste actif pendant 30 jours', () => {
    expect(isDeclineActive(NOW - 1000, NOW)).toBe(true);
    expect(isDeclineActive(NOW - REWATCH_DECLINE_MS, NOW)).toBe(false);
    expect(isDeclineActive(undefined, NOW)).toBe(false);
  });

  it('purge les refus expirés', () => {
    expect(purgeExpiredDeclines({ 'anilist:1': NOW - 10, 'mal:2': NOW - REWATCH_DECLINE_MS - 1 }, NOW)).toEqual({ 'anilist:1': NOW - 10 });
  });
});

describe('isPendingRating', () => {
  const rating = { id: 'anilist:21', mediaId: 21, malId: 21, title: 'One Piece', coverUrl: null, completedAt: NOW };

  it('accepte une note en attente valide', () => {
    expect(isPendingRating(rating)).toBe(true);
    expect(isPendingRating({ ...rating, id: 'mal:5', mediaId: null, malId: 5 })).toBe(true);
  });

  it('refuse un identifiant incohérent ou des champs invalides', () => {
    expect(isPendingRating({ ...rating, id: 'anilist:22' })).toBe(false);
    expect(isPendingRating({ ...rating, completedAt: 'hier' })).toBe(false);
    expect(isPendingRating({ ...rating, mediaId: null, malId: null })).toBe(false);
  });
});
