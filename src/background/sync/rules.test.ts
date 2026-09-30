import { describe, expect, it } from 'vitest';
import { decideListUpdate } from './rules';

describe('decideListUpdate', () => {
  it('ajoute un anime absent de la liste en CURRENT', () => {
    expect(decideListUpdate(null, 1, 12)).toEqual({ action: 'update', progress: 1, status: 'CURRENT' });
  });

  it('reprend un anime PLANNING / PAUSED / DROPPED en CURRENT', () => {
    for (const status of ['PLANNING', 'PAUSED', 'DROPPED'] as const) {
      expect(decideListUpdate({ status, progress: 2 }, 3, 12)).toEqual({ action: 'update', progress: 3, status: 'CURRENT' });
    }
  });

  it('passe en COMPLETED au dernier épisode', () => {
    expect(decideListUpdate({ status: 'CURRENT', progress: 11 }, 12, 12)).toEqual({ action: 'update', progress: 12, status: 'COMPLETED' });
  });

  it('reste en CURRENT si le nombre total d’épisodes est inconnu (série en cours)', () => {
    expect(decideListUpdate({ status: 'CURRENT', progress: 1179 }, 1180, null)).toEqual({ action: 'update', progress: 1180, status: 'CURRENT' });
  });

  it('ne fait jamais reculer la progression', () => {
    expect(decideListUpdate({ status: 'CURRENT', progress: 10 }, 10, 12)).toEqual({ action: 'skip', reason: 'up-to-date' });
    expect(decideListUpdate({ status: 'CURRENT', progress: 10 }, 4, 12)).toEqual({ action: 'skip', reason: 'up-to-date' });
  });

  it('ne touche ni à un anime terminé ni à un revisionnage', () => {
    expect(decideListUpdate({ status: 'COMPLETED', progress: 12 }, 3, 12)).toEqual({ action: 'skip', reason: 'already-completed' });
    expect(decideListUpdate({ status: 'REPEATING', progress: 2 }, 3, 12)).toEqual({ action: 'skip', reason: 'repeating' });
  });
});

describe('decideListUpdate — correction manuelle sur la même fiche', () => {
  it('autorise un recul de progression (régression)', () => {
    expect(decideListUpdate({ status: 'CURRENT', progress: 15 }, 3, 24, true)).toEqual({ action: 'update', progress: 3, status: 'CURRENT' });
  });

  it('corrige une fiche marquée terminée à tort', () => {
    expect(decideListUpdate({ status: 'COMPLETED', progress: 12 }, 5, 12, true)).toEqual({ action: 'update', progress: 5, status: 'CURRENT' });
  });

  it('ne réécrit pas une valeur identique', () => {
    expect(decideListUpdate({ status: 'CURRENT', progress: 4 }, 4, 12, true)).toEqual({ action: 'skip', reason: 'up-to-date' });
  });
});
