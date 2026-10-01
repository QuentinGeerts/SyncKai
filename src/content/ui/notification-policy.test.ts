import { describe, expect, it } from 'vitest';
import type { FeedbackTone } from '../../shared/sync-feedback';
import type { NotificationLevel } from '../../shared/settings';
import type { SyncOutcome } from '../../shared/sync.types';
import { decideExcludedNotification, decideNotification, isAlertTone, promptForOutcome, showsProgress } from './notification-policy';

const LEVELS: NotificationLevel[] = ['discreet', 'detailed', 'alerts-only'];
const ALERTS: FeedbackTone[] = ['warning', 'error'];

describe('decideNotification', () => {
  it('discreet : pastille pour un succès, rien en plein écran', () => {
    expect(decideNotification('discreet', 'success', false)).toBe('pill');
    expect(decideNotification('discreet', 'success', true)).toBe('none');
  });

  it('detailed : bulle pour un succès, y compris en plein écran', () => {
    expect(decideNotification('detailed', 'success', false)).toBe('bubble');
    expect(decideNotification('detailed', 'success', true)).toBe('bubble');
  });

  it('alerts-only : rien pour un succès', () => {
    expect(decideNotification('alerts-only', 'success', false)).toBe('none');
    expect(decideNotification('alerts-only', 'success', true)).toBe('none');
  });

  it('les alertes sont toujours affichées en bulle, quel que soit le niveau ou le plein écran', () => {
    for (const level of LEVELS) {
      for (const tone of ALERTS) {
        expect(decideNotification(level, tone, false)).toBe('bubble');
        expect(decideNotification(level, tone, true)).toBe('bubble');
      }
    }
  });
});

describe('showsProgress', () => {
  it('seul le mode détaillé affiche "Synchronisation…"', () => {
    expect(showsProgress('detailed')).toBe(true);
    expect(showsProgress('discreet')).toBe(false);
    expect(showsProgress('alerts-only')).toBe(false);
  });
});

describe('isAlertTone', () => {
  it('warning et error sont des alertes', () => {
    expect(isAlertTone('warning')).toBe(true);
    expect(isAlertTone('error')).toBe(true);
    expect(isAlertTone('success')).toBe(false);
    expect(isAlertTone('info')).toBe(false);
  });
});

describe('decideExcludedNotification', () => {
  it('bulle en mode détaillé, rien sinon', () => {
    expect(decideExcludedNotification('detailed')).toBe('bubble');
    expect(decideExcludedNotification('discreet')).toBe('none');
    expect(decideExcludedNotification('alerts-only')).toBe('none');
  });
});

describe('promptForOutcome', () => {
  const media = { mediaId: 1, malId: 2, title: 'Frieren' };
  const synced: Extract<SyncOutcome, { status: 'synced' }> = { status: 'synced', mediaTitle: 'Frieren', results: [] };

  it('rien sans demande ni pour un autre statut', () => {
    expect(promptForOutcome(synced)).toBeNull();
    expect(promptForOutcome({ status: 'error', message: 'x' })).toBeNull();
  });

  it('la note passe avant le revisionnage', () => {
    expect(promptForOutcome({ ...synced, prompts: { rate: media, rewatch: { ...media, progress: 3 } } })).toEqual({ kind: 'rate', media });
  });

  it('revisionnage : progression séparée de la fiche', () => {
    expect(promptForOutcome({ ...synced, prompts: { rewatch: { ...media, progress: 3 } } })).toEqual({ kind: 'rewatch', media, progress: 3 });
  });
});
