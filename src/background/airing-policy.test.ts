import { describe, expect, it } from 'vitest';
import { chunk, computeWindow, filterNewEpisodes, planNotifications, trimNotified, type AiringItem } from './airing-policy';
import { setLocale } from '../i18n';

// Textes attendus en français
setLocale('fr');

const NOW = 1_800_000_000;
const item = (scheduleId: number, mediaId: number, episode: number, title = `Série ${mediaId}`): AiringItem => ({
  scheduleId,
  mediaId,
  episode,
  airingAt: NOW - 600,
  title,
  coverUrl: null,
});

describe('computeWindow', () => {
  it('premier passage : 2 h en arrière', () => {
    expect(computeWindow(NOW, null, 0)).toEqual({ from: NOW - 7200, to: NOW });
  });

  it('reprend depuis la dernière vérification, décalée du délai', () => {
    expect(computeWindow(NOW, NOW - 3600, 3)).toEqual({ from: NOW - 3600 - 3 * 3600, to: NOW - 3 * 3600 });
  });

  it('rattrapage borné à 24 h', () => {
    expect(computeWindow(NOW, NOW - 10 * 86400, 0)).toEqual({ from: NOW - 86400, to: NOW });
  });

  it('dernière vérification dans le futur ramenée à maintenant', () => {
    expect(computeWindow(NOW, NOW + 500, 1)).toEqual({ from: NOW - 3600, to: NOW - 3600 });
  });
});

describe('chunk', () => {
  it('découpe par lots', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 50)).toEqual([]);
  });
});

describe('filterNewEpisodes', () => {
  const progress = new Map([
    [1, 3],
    [2, 10],
  ]);

  it('ignore les épisodes déjà vus, déjà notifiés, hors liste ou en double', () => {
    const items = [item(100, 1, 4), item(101, 1, 3), item(102, 2, 11), item(103, 9, 1), item(100, 1, 4)];
    expect(filterNewEpisodes(items, progress, [102]).map((i) => i.scheduleId)).toEqual([100]);
  });
});

describe('trimNotified', () => {
  it('ajoute sans doublon et garde les plus récents', () => {
    expect(trimNotified([1, 2, 3], [3, 4], 3)).toEqual([2, 3, 4]);
    expect(trimNotified([], [5])).toEqual([5]);
  });
});

describe('planNotifications', () => {
  it('une notification par sortie jusqu’à 3', () => {
    const plan = planNotifications([item(100, 1, 4, 'Frieren'), item(101, 2, 11)]);
    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({ id: 'synckai-airing:100', title: 'Ép. 4 de Frieren est sorti', mediaIds: [1] });
  });

  it('regroupe au-delà de 3', () => {
    const plan = planNotifications([item(1, 1, 2, 'A'), item(2, 2, 2, 'B'), item(3, 3, 2, 'C'), item(4, 3, 3, 'C')]);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ id: 'synckai-airing:group:4', title: '4 nouveaux épisodes : A, B, C', mediaIds: [1, 2, 3] });
  });

  it('rien à notifier', () => {
    expect(planNotifications([])).toEqual([]);
  });
});
