import { describe, expect, it } from 'vitest';
import { extractReleaseNotes, formatReleaseNotes } from './changelog-notes.ts';

const CHANGELOG = `# Changelog

## [Unreleased]

### Modifié

- En cours.

## [1.2.0] - 2026-10-02

### Ajouté

- Nouveauté.

## [1.1.0] - 2026-10-01

### Corrigé

- Correctif.

## [1.0.0] - 2026-09-01

Première version.

## [0.9.0] - 2026-08-01

[1.2.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.2.0
[1.1.0]: https://github.com/Sync-Kai/SyncKai/releases/tag/v1.1.0
`;

describe('extractReleaseNotes', () => {
  it('extrait le corps de la section et la version précédente', () => {
    expect(extractReleaseNotes(CHANGELOG, '1.2.0')).toEqual({
      body: '### Ajouté\n\n- Nouveauté.',
      previousVersion: '1.1.0',
    });
  });

  it('accepte les fins de ligne CRLF', () => {
    const notes = extractReleaseNotes(CHANGELOG.replace(/\n/g, '\r\n'), '1.1.0');
    expect(notes).toEqual({ body: '### Corrigé\n\n- Correctif.', previousVersion: '1.0.0' });
  });

  it('ignore les définitions de liens après la dernière section', () => {
    const changelog = '## [1.0.0] - 2026-09-01\n\n- Init.\n\n[1.0.0]: https://example.com\n';
    expect(extractReleaseNotes(changelog, '1.0.0')).toEqual({ body: '- Init.', previousVersion: null });
  });

  it('ne confond pas une version avec un préfixe commun', () => {
    expect(() => extractReleaseNotes(CHANGELOG, '1.2')).toThrow(/introuvable/);
  });

  it('échoue si la section est absente', () => {
    expect(() => extractReleaseNotes(CHANGELOG, '9.9.9')).toThrow(/introuvable/);
  });

  it('échoue si la section est vide', () => {
    expect(() => extractReleaseNotes(CHANGELOG, '0.9.0')).toThrow(/vide/);
  });
});

describe('formatReleaseNotes', () => {
  it('ajoute le lien de comparaison avec la version précédente', () => {
    expect(formatReleaseNotes({ body: '- A.', previousVersion: '1.1.0' }, '1.2.0')).toBe(
      '- A.\n\n**Changelog complet** : https://github.com/Sync-Kai/SyncKai/compare/v1.1.0...v1.2.0\n',
    );
  });

  it("omet le lien s'il n'y a pas de version précédente", () => {
    expect(formatReleaseNotes({ body: '- A.', previousVersion: null }, '1.0.0')).toBe('- A.\n');
  });
});
