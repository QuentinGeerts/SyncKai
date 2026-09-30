import { describe, expect, it } from 'vitest';
import { fromMalStatus, parseMalListStatus, toMalStatus } from './mal';

describe('statuts MyAnimeList', () => {
  it('convertit les statuts MAL vers les statuts communs', () => {
    expect(fromMalStatus('watching', false)).toBe('CURRENT');
    expect(fromMalStatus('completed', false)).toBe('COMPLETED');
    expect(fromMalStatus('on_hold', false)).toBe('PAUSED');
    expect(fromMalStatus('dropped', false)).toBe('DROPPED');
    expect(fromMalStatus('plan_to_watch', undefined)).toBe('PLANNING');
    expect(fromMalStatus('inconnu', false)).toBeNull();
  });

  it('traite un revisionnage MAL comme REPEATING (non modifié par SyncKai)', () => {
    expect(fromMalStatus('completed', true)).toBe('REPEATING');
  });

  it('convertit les statuts écrits par SyncKai', () => {
    expect(toMalStatus('CURRENT')).toBe('watching');
    expect(toMalStatus('COMPLETED')).toBe('completed');
  });

  it('lit my_list_status (absent = anime hors liste)', () => {
    expect(parseMalListStatus({ status: 'watching', num_episodes_watched: 4, is_rewatching: false })).toEqual({ status: 'CURRENT', progress: 4 });
    expect(parseMalListStatus(undefined)).toBeNull();
    expect(parseMalListStatus({ status: 'plan_to_watch' })).toEqual({ status: 'PLANNING', progress: 0 });
  });
});
