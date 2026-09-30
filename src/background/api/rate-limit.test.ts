import { describe, expect, it } from 'vitest';
import { retryDelayMs } from './rate-limit';

describe('retryDelayMs', () => {
  it('lit un délai en secondes', () => {
    expect(retryDelayMs('3')).toBe(3000);
    expect(retryDelayMs('0')).toBe(0);
  });

  it('lit une date HTTP', () => {
    const now = Date.parse('2026-09-30T20:00:00Z');
    expect(retryDelayMs('Wed, 30 Sep 2026 20:00:10 GMT', now)).toBe(10_000);
  });

  it('utilise un délai par défaut sans en-tête exploitable', () => {
    expect(retryDelayMs(null)).toBe(5000);
    expect(retryDelayMs('')).toBe(5000);
    expect(retryDelayMs('n’importe quoi')).toBe(5000);
  });

  it('abandonne si l’attente demandée est trop longue', () => {
    expect(retryDelayMs('60')).toBeNull();
  });
});
