import { describe, expect, it } from 'vitest';
import type { SyncOutcome } from '../../shared/sync.types';
import { ALERT_TOAST_MS, PILL_TOAST_MS, SUCCESS_TOAST_MS, pillForOutcome, toastForOutcome } from './sync-toast';

const synced: SyncOutcome = {
  status: 'synced',
  mediaTitle: 'Tougen Anki',
  results: [
    { service: 'anilist', outcome: { status: 'updated', progress: 2, completed: false } },
    { service: 'mal', outcome: { status: 'up-to-date', progress: 2 } },
  ],
};

describe('toastForOutcome', () => {
  it('discreet : pastille 3 s avec le numéro et le titre', () => {
    expect(toastForOutcome(synced, 'discreet', false)).toEqual({
      content: { tone: 'success', title: 'Ép. 2 enregistré', message: 'Tougen Anki' },
      variant: 'pill',
      autoHideMs: PILL_TOAST_MS,
    });
  });

  it('discreet en plein écran : rien', () => {
    expect(toastForOutcome(synced, 'discreet', true)).toBeNull();
  });

  it('detailed : bulle 5 s avec une ligne par service', () => {
    expect(toastForOutcome(synced, 'detailed', false)).toEqual({
      content: {
        tone: 'success',
        title: 'Tougen Anki',
        lines: [
          { label: 'AniList', text: 'épisode 2 enregistré', tone: 'ok' },
          { label: 'MyAnimeList', text: 'déjà à jour (épisode 2)', tone: 'neutral' },
        ],
      },
      variant: 'bubble',
      autoHideMs: SUCCESS_TOAST_MS,
    });
  });

  it('alerts-only : rien pour un succès, bulle 9 s pour une vérification', () => {
    expect(toastForOutcome(synced, 'alerts-only', false)).toBeNull();
    const review = toastForOutcome({ status: 'needs-review', reason: 'Fiche incertaine' }, 'alerts-only', true);
    expect(review?.variant).toBe('bubble');
    expect(review?.autoHideMs).toBe(ALERT_TOAST_MS);
    expect(review?.content.title).toBe('À vérifier dans SyncKai');
  });
});

describe('pillForOutcome', () => {
  it('aucun service modifié : "déjà à jour"', () => {
    const outcome: SyncOutcome = { status: 'synced', mediaTitle: 'Frieren', results: [{ service: 'anilist', outcome: { status: 'up-to-date', progress: 7 } }] };
    expect(pillForOutcome(outcome)).toEqual({ tone: 'success', title: 'Ép. 7 déjà à jour', message: 'Frieren' });
  });
});
