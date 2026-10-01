import type { Locale } from '../../src/i18n';

// Légendes des captures (docs/store/screenshots.md). `*mot*` = mot mis en valeur (dégradé Kai).

export interface Caption {
  eyebrow: string;
  title: string;
  sub: string;
}

export type ShotId = 1 | 2 | 3 | 4 | 5;

export const SHOT_FILES: Record<ShotId, string> = {
  1: '01-sync-at-credits',
  2: '02-watching',
  3: '03-review',
  4: '04-rating',
  5: '05-settings',
};

export const CAPTIONS: Record<Locale, Record<ShotId, Caption>> = {
  fr: {
    1: { eyebrow: 'Synchro automatique', title: 'Ta liste à jour dès le *générique*', sub: 'Regarde sur Crunchyroll ou ADN : l’épisode est enregistré sur AniList et MyAnimeList, sans un clic.' },
    2: { eyebrow: 'Mes séries', title: 'Tes séries et le *prochain épisode*', sub: 'Reprends là où tu t’es arrêté et vois d’un coup d’œil ce qui sort ensuite.' },
    3: { eyebrow: 'Vérification', title: 'Correspondance incertaine ? *Tu choisis*', sub: 'Au moindre doute, SyncKai te propose les fiches probables au lieu de deviner.' },
    4: { eyebrow: 'Fin de série', title: '*Note* la série dès qu’elle est finie', sub: 'Dernier épisode vu : ta note sur 10 part vers AniList et MyAnimeList.' },
    5: { eyebrow: 'Réglages', title: 'AniList, MAL, alertes, *3 langues*', sub: 'Deux comptes, une alerte à chaque nouvel épisode et une interface en français, anglais ou allemand.' },
  },
  en: {
    1: { eyebrow: 'Automatic sync', title: 'Your list updated by the *credits*', sub: 'Watch on Crunchyroll or ADN: the episode is saved to AniList and MyAnimeList, no click needed.' },
    2: { eyebrow: 'My series', title: 'Your series and the *next episode*', sub: 'Pick up where you left off and see what airs next at a glance.' },
    3: { eyebrow: 'Review', title: 'Unsure match? *You choose*', sub: 'When in doubt, SyncKai suggests the likely entries instead of guessing.' },
    4: { eyebrow: 'Series finale', title: '*Rate* the series once it’s finished', sub: 'Last episode watched: your score out of 10 goes to AniList and MyAnimeList.' },
    5: { eyebrow: 'Settings', title: 'AniList, MAL, alerts, *3 languages*', sub: 'Two accounts, an alert for every new episode and an interface in English, French or German.' },
  },
  de: {
    1: { eyebrow: 'Automatische Synchro', title: 'Liste aktuell schon zum *Abspann*', sub: 'Auf Crunchyroll oder ADN schauen: Die Folge landet ohne Klick auf AniList und MyAnimeList.' },
    2: { eyebrow: 'Meine Serien', title: 'Deine Serien und die *nächste Folge*', sub: 'Mach dort weiter, wo du aufgehört hast, und sieh sofort, was als Nächstes kommt.' },
    3: { eyebrow: 'Prüfen', title: 'Unsichere Zuordnung? *Du wählst*', sub: 'Im Zweifel schlägt SyncKai die passenden Einträge vor, statt zu raten.' },
    4: { eyebrow: 'Serienfinale', title: '*Bewerte* die Serie zum Schluss', sub: 'Letzte Folge gesehen: Deine Note von 10 geht an AniList und MyAnimeList.' },
    5: { eyebrow: 'Einstellungen', title: 'AniList, MAL, Alerts, *3 Sprachen*', sub: 'Zwei Konten, ein Hinweis bei jeder neuen Folge und die Oberfläche auf Deutsch, Englisch oder Französisch.' },
  },
};
