import { describe, expect, it } from 'vitest';
import { isScore10 } from '../shared/engagement.types';
import { formatScoreLabel, formatStarValue, halfValue, isStarValue, rateAriaLabel, STAR_COUNT, STAR_VALUES, starFill, stepStarValue } from './rating';
import { setLocale } from '../i18n';

// Textes attendus en français
setLocale('fr');

describe('STAR_VALUES', () => {
  it('20 valeurs de 0,5 à 10, toutes des notes sur 10 valides (envoyées sans conversion)', () => {
    expect(STAR_COUNT).toBe(10);
    expect(STAR_VALUES).toHaveLength(20);
    expect(STAR_VALUES[0]).toBe(0.5);
    expect(STAR_VALUES[16]).toBe(8.5);
    expect(STAR_VALUES[19]).toBe(10);
    expect(STAR_VALUES.every((v) => isStarValue(v) && isScore10(v))).toBe(true);
  });
});

describe('libellés', () => {
  it('virgule décimale française', () => {
    expect(formatStarValue(8.5)).toBe('8,5');
    expect(formatStarValue(4)).toBe('4');
    expect(rateAriaLabel(8.5)).toBe('Noter 8,5 sur 10');
    expect(rateAriaLabel(0.5)).toBe('Noter 0,5 sur 10');
    expect(rateAriaLabel(10)).toBe('Noter 10 sur 10');
  });

  it('libellé visible "8,5/10", tiret sans valeur', () => {
    expect(formatScoreLabel(8.5)).toBe('8,5/10');
    expect(formatScoreLabel(10)).toBe('10/10');
    expect(formatScoreLabel(0)).toBe('–/10');
  });
});

describe('isStarValue', () => {
  it('valeurs hors grille refusées', () => {
    expect(isStarValue(0)).toBe(false);
    expect(isStarValue(10.5)).toBe(false);
    expect(isStarValue(2.25)).toBe(false);
    expect(isStarValue(7.5)).toBe(true);
  });
});

describe('starFill / halfValue', () => {
  it('remplissage par étoile', () => {
    const indexes = Array.from({ length: STAR_COUNT }, (_, i) => i + 1);
    expect(indexes.map((i) => starFill(i, 8.5))).toEqual(['full', 'full', 'full', 'full', 'full', 'full', 'full', 'full', 'half', 'empty']);
    expect(indexes.every((i) => starFill(i, 0) === 'empty')).toBe(true);
    expect(starFill(10, 10)).toBe('full');
  });

  it('moitié gauche = demi-étoile, moitié droite = étoile entière', () => {
    expect(halfValue(9, 'left')).toBe(8.5);
    expect(halfValue(9, 'right')).toBe(9);
    expect(halfValue(1, 'left')).toBe(0.5);
    expect(halfValue(10, 'right')).toBe(10);
  });
});

describe('stepStarValue', () => {
  it('flèches : pas de 0,5, bornées à [0,5 ; 10]', () => {
    expect(stepStarValue(0, 'ArrowRight')).toBe(0.5);
    expect(stepStarValue(8, 'ArrowUp')).toBe(8.5);
    expect(stepStarValue(8, 'ArrowLeft')).toBe(7.5);
    expect(stepStarValue(5, 'ArrowRight')).toBe(5.5);
    expect(stepStarValue(10, 'ArrowRight')).toBe(10);
    expect(stepStarValue(0.5, 'ArrowDown')).toBe(0.5);
  });

  it('Début / Fin, et autres touches ignorées', () => {
    expect(stepStarValue(3, 'Home')).toBe(0.5);
    expect(stepStarValue(3, 'End')).toBe(10);
    expect(stepStarValue(3, 'Enter')).toBeNull();
    expect(stepStarValue(3, 'a')).toBeNull();
  });
});
