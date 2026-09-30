import { describe, expect, it } from 'vitest';
import { canComplete, formatTimecode, resolveCompletionPoint } from './completion';

describe('resolveCompletionPoint', () => {
  const duration = 1440; // 24 min

  it('utilise le début du générique de fin quand il est connu', () => {
    expect(resolveCompletionPoint(duration, 1344, 0.85)).toEqual({ seconds: 1344, source: 'credits' });
  });

  it('se replie sur le pourcentage sans données de générique', () => {
    expect(resolveCompletionPoint(duration, null, 0.85)).toEqual({ seconds: 1224, source: 'ratio' });
  });

  it('ignore un générique trop tôt (ex : générique d’ouverture mal étiqueté)', () => {
    expect(resolveCompletionPoint(duration, 111, 0.85)).toEqual({ seconds: 1224, source: 'ratio' });
  });

  it('ignore un générique au-delà de la durée de la vidéo', () => {
    expect(resolveCompletionPoint(duration, 1500, 0.85)).toEqual({ seconds: 1224, source: 'ratio' });
  });
});

describe('formatTimecode', () => {
  it('formate en minutes:secondes', () => {
    expect(formatTimecode(1344)).toBe('22:24');
    expect(formatTimecode(65.9)).toBe('1:05');
    expect(formatTimecode(-3)).toBe('0:00');
  });
});

describe('canComplete', () => {
  it('complète au-delà du point si la lecture a été vue avant', () => {
    expect(canComplete(1350, 1344, true, false)).toBe(true);
    expect(canComplete(1300, 1344, true, false)).toBe(false);
  });

  it('ignore les ticks de l’épisode précédent après une navigation SPA (régression)', () => {
    expect(canComplete(1400, 1224, false, false)).toBe(false);
  });

  it('accepte une reprise au-delà du point sur une source chargée pour cet épisode', () => {
    expect(canComplete(1400, 1224, false, true)).toBe(true);
  });
});
