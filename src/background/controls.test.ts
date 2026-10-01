import { describe, expect, it } from 'vitest';
import { decideAdjustment } from './controls';

describe('decideAdjustment', () => {
  it('+1 avance et passe en cours', () => {
    expect(decideAdjustment({ status: 'CURRENT', progress: 3 }, 12, 1)).toEqual({ action: 'write', progress: 4, status: 'CURRENT' });
    expect(decideAdjustment(null, null, 1)).toEqual({ action: 'write', progress: 1, status: 'CURRENT' });
  });

  it('+1 sur le dernier épisode termine l’anime', () => {
    expect(decideAdjustment({ status: 'CURRENT', progress: 11 }, 12, 1)).toEqual({ action: 'write', progress: 12, status: 'COMPLETED' });
  });

  it('+1 au-delà du total est refusé', () => {
    expect(decideAdjustment({ status: 'COMPLETED', progress: 12 }, 12, 1)).toEqual({ action: 'skip', reason: 'Déjà au dernier épisode' });
  });

  it('−1 sur une entrée terminée la repasse en cours', () => {
    expect(decideAdjustment({ status: 'COMPLETED', progress: 12 }, 12, -1)).toEqual({ action: 'write', progress: 11, status: 'CURRENT' });
  });

  it('−1 à zéro (ou hors liste) ne fait rien', () => {
    expect(decideAdjustment({ status: 'CURRENT', progress: 0 }, 12, -1)).toEqual({ action: 'skip', reason: 'Aucun épisode à retirer' });
    expect(decideAdjustment(null, 12, -1)).toEqual({ action: 'skip', reason: 'Aucun épisode à retirer' });
  });

  it('total inconnu : jamais terminé automatiquement', () => {
    expect(decideAdjustment({ status: 'CURRENT', progress: 1100 }, null, 1)).toEqual({ action: 'write', progress: 1101, status: 'CURRENT' });
  });
});
