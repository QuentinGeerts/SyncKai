import { describe, expect, it } from 'vitest';
import { ratingFeedback } from './feedback';
import { setLocale } from '../i18n';

// Textes attendus en français
setLocale('fr');

describe('ratingFeedback', () => {
  it('succès sur tous les services', () => {
    const result = ratingFeedback({ status: 'synced', mediaTitle: 'Frieren', results: [{ service: 'anilist', outcome: { status: 'up-to-date', progress: 28 } }] }, '8,5', 'Frieren');
    expect(result.ok).toBe(true);
    expect(result.text).toBe('Note 8,5/10 enregistrée · Frieren');
  });

  it('échec partiel : le service est nommé', () => {
    const result = ratingFeedback(
      {
        status: 'synced',
        mediaTitle: 'Frieren',
        results: [
          { service: 'anilist', outcome: { status: 'updated', progress: 28, completed: true } },
          { service: 'mal', outcome: { status: 'error', message: 'Réseau' } },
        ],
      },
      '3',
      'Frieren',
    );
    expect(result).toMatchObject({ ok: false, tone: 'error', text: 'Échec sur MyAnimeList, réessaie' });
  });

  it('erreur globale : message du service worker', () => {
    expect(ratingFeedback({ status: 'error', message: 'Hors ligne' }, '3', 'Frieren')).toMatchObject({ ok: false, text: 'Hors ligne' });
  });
});
