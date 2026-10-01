# Changelog

Toutes les évolutions notables de SyncKai sont documentées ici.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions selon [SemVer](https://semver.org/lang/fr/).

## [1.5.0] - 2026-10-01

Fiabilité et contrôle manuel.

### Ajouté

- **File de synchro hors ligne** : une synchro en échec passager (réseau, limite de requêtes, erreur serveur) est mise en file et relancée automatiquement (1 min, 5 min, 15 min, 1 h, 6 h), abandonnée après ~24 h. Section « Synchros en attente » dans Activité avec « Réessayer » / « Abandonner ».
- **+1 / −1** sur chaque série de « En cours », écrit sur tous les services connectés.
- **Raccourci clavier** `Alt+Maj+S` : valide immédiatement l’épisode en cours (modifiable dans `chrome://extensions/shortcuts`).
- **Exclusion par série** (« Ne plus synchroniser cette série ») depuis En cours, les cartes À vérifier et les dernières synchros ; gestion dans Réglages › Séries exclues.

### Modifié

- Barre d’état : synchros en échec ou en attente signalées en priorité.
- Le badge de l’icône compte aussi les synchros abandonnées.

## [1.4.0] - 2026-10-01

Refonte complète du popup (direction « Yoru Mochi · Kotatsu ») : tout se gère désormais depuis le popup.

### Ajouté

- **En cours** : liste des animes en cours (AniList ou MyAnimeList, sélecteur si les deux sont connectés), avec carte « Reprendre » pour la dernière série synchronisée.
- **Prochain épisode** : « Ép. 3 disponible », « Ép. 5 dans 18 h », « Prochain épisode bientôt » ou « Série terminée » (catalogue AniList, y compris pour MyAnimeList).
- **Tri** de la liste : prochaine sortie (par défaut), dernière mise à jour, titre, épisodes restants — choix mémorisé.
- **Ouvrir** chaque anime sur sa plateforme (Crunchyroll, ADN), avec un réglage **Lecteur préféré** quand il est disponible sur les deux.
- **Barre d'état** : « Tout est synchronisé · il y a … », éléments à vérifier, session expirée avec « Reconnecter ».
- **Notifications sur la page** à 3 niveaux : *Discrètes* (par défaut : petite pastille, rien en plein écran), *Détaillées*, *Alertes seulement*. Les alertes restent toujours affichées.
- Coche sur l'icône de l'extension après chaque synchronisation réussie.
- Écrans de premier lancement et de liste vide avec la mascotte Mochi.

### Modifié

- La page d'options est supprimée : ses réglages sont dans l'onglet Réglages du popup (comptes, lecture, synchronisation, notifications, correspondances).
- Nouveau style visuel : thème sombre chaleureux, polices M PLUS Rounded 1c et Nunito embarquées (sous-ensembles latins), toasts en bulle.
- L'ancien réglage « toasts activés / désactivés » est migré vers le niveau de notification équivalent.

### Corrigé

- La liste « En cours » se met à jour après une synchronisation même si le popup est ouvert.
- MyAnimeList : les séries classées adultes et les listes de plus de 100 séries sont incluses.
- Le cache d'une liste est effacé à la déconnexion du compte correspondant.

## [1.3.0] - 2026-09-30

### Ajouté

- **MyAnimeList** : connexion (OAuth2 + PKCE, sans secret, renouvellement automatique du token), carte de compte dans le popup, synchronisation de la progression en parallèle d'AniList.
- Chaque compte est facultatif : MyAnimeList fonctionne sans compte AniList (catalogue AniList public pour la correspondance, puis `idMal`).
- Résultat par service dans le toast, et « Réessayer » limité aux services en échec.

### Modifié

- Déconnexion par service depuis sa carte ; les vérifications et l'historique ne sont effacés qu'à la déconnexion du dernier compte.
- Services de suivi derrière une interface commune (pattern Adapter, `src/background/trackers/`).

## [1.2.0] - 2026-09-30

### Ajouté

- **Adapter ADN** (animationdigitalnetwork.com) : détection des épisodes (JSON-LD, repli sur le lecteur video.js), navigation entre épisodes sans rechargement, complétion au pourcentage réglé (ADN ne fournit pas le début du générique).
- Correspondance AniList via les liens ADN des fiches (`/video/{id}-{slug}`, ancien format par slug).
- Correspondance automatique par titre quand une seule fiche AniList (série) porte exactement ce titre et qu'il s'agit de la saison 1 ; les autres cas sans lien plateforme restent à vérifier.

### Modifié

- Helpers de lecture (JSON-LD, texte, garde-fou anti-données périmées) partagés entre les adapters.
- Raison « à vérifier » explicite quand la fiche AniList n'a été trouvée que par son titre (aucun lien vers la plateforme).

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

[1.5.0]: https://github.com/QuentinGeerts/SyncKai/releases/tag/v1.5.0
[1.4.0]: https://github.com/QuentinGeerts/SyncKai/releases/tag/v1.4.0
[1.3.0]: https://github.com/QuentinGeerts/SyncKai/releases/tag/v1.3.0
[1.2.0]: https://github.com/QuentinGeerts/SyncKai/releases/tag/v1.2.0
[1.1.0]: https://github.com/QuentinGeerts/SyncKai/releases/tag/v1.1.0
[1.0.0]: https://github.com/QuentinGeerts/SyncKai/releases/tag/v1.0.0
