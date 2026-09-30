# Changelog

Toutes les évolutions notables de SyncKai sont documentées ici.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions selon [SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

- **Adapter ADN** (animationdigitalnetwork.com) : détection des épisodes (JSON-LD, repli sur le lecteur video.js), navigation entre épisodes sans rechargement, complétion au pourcentage réglé (ADN ne fournit pas le début du générique).
- Correspondance AniList via les liens ADN des fiches (`/video/{id}-{slug}`, ancien format par slug).

### Modifié

- Helpers de lecture (JSON-LD, texte, garde-fou anti-données périmées) partagés entre les adapters.

## [1.1.0] - 2026-09-30

### Ajouté

- **Icônes de l'extension** (16 à 128 px), générées par `npm run icons`.
- **Page d'options** (lien « Options » dans le popup) :
  - pause de la synchronisation automatique ;
  - déclenchement au générique de fin ou à un pourcentage réglable (70–98 %) ;
  - activation des toasts de confirmation (les alertes restent affichées) ;
  - liste des correspondances mémorisées, avec « Oublier » par saison et réinitialisation complète.
- **Bouton « Réessayer »** dans le toast quand une synchronisation échoue (réseau, AniList indisponible) : l'épisode n'est plus perdu.

### Modifié

- Limite de requêtes AniList (429) : nouvelle tentative automatique si AniList demande une attente courte (≤ 20 s).
- Version minimale de Chrome : 116.

### Corrigé

- L'épisode suivant pouvait être marqué comme vu dès la navigation (derniers instants de l'épisode précédent pris en compte).
- Une correction sur la même fiche AniList ne pouvait pas faire baisser la progression.
- Une vérification arrivée pendant l'affichage d'un résultat n'apparaissait qu'à la réouverture du popup.
- Écritures concurrentes du stockage (popup, options, synchronisation) pouvant s'écraser mutuellement.
- Les alertes n'apparaissaient plus si le toast « Synchronisation… » avait été fermé.
- Le lecteur Crunchyroll n'était pas prioritaire sur une autre balise `<video>` de la page.
- Erreurs silencieuses : réponse de secours du service worker, échec d'enregistrement des réglages ou de « Ignorer » désormais affichés.

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

[1.1.0]: https://github.com/QuentinGeerts/SyncKai/releases/tag/v1.1.0
[1.0.0]: https://github.com/QuentinGeerts/SyncKai/releases/tag/v1.0.0
