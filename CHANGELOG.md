# Changelog

Toutes les évolutions notables de SyncKai sont documentées ici.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions selon [SemVer](https://semver.org/lang/fr/).

## [1.0.0] - 2026-09-30

Première version : synchronisation automatique Crunchyroll → AniList.

### Ajouté

- **Connexion AniList** (OAuth2 Implicit Grant via `chrome.identity`), déconnexion et affichage du profil (avatar, pseudo, lien vers le profil).
- **Adapter Crunchyroll** : détection des pages de lecture (navigation SPA incluse), extraction de l'anime, de la saison et des numéros d'épisode (JSON-LD, repli DOM avec détection des données périmées).
- **Détection de fin d'épisode** au début du générique de fin (données « skip events » de Crunchyroll), avec repli à 85 % de la vidéo. Les publicités (vidéos de moins de 2 min) sont ignorées.
- **Synchronisation AniList** :
  - recherche de la fiche via les liens Crunchyroll des fiches AniList, puis ordre des saisons (suites/préquelles) ;
  - gestion de la numérotation absolue (ex : One Piece E1180) et relative par saison, y compris les saisons découpées en plusieurs fiches ;
  - règles de mise à jour : jamais de recul, passage en « En cours » puis « Terminé », fiches terminées et revisionnages laissés intacts ;
  - correspondances mémorisées par saison.
- **Toast dans la page** (compatible plein écran) indiquant le résultat de chaque synchronisation.
- **Vérification manuelle** des correspondances incertaines depuis le popup (fiches suggérées, recherche, numéro d'épisode), avec badge sur l'icône de l'extension.
- **Dernières synchros** dans le popup, avec correction a posteriori d'une correspondance.

[1.0.0]: https://github.com/QuentinGeerts/SyncKai/releases/tag/v1.0.0
