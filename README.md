# SyncKai

Extension de navigateur (Manifest V3) qui détecte les épisodes regardés sur Crunchyroll et ADN, et met à jour automatiquement tes listes **AniList** et/ou **MyAnimeList**, sans action manuelle.

## Fonctionnalités

- Connexion à AniList et/ou MyAnimeList en un clic depuis le popup (chaque compte est facultatif).
- Détection de l'épisode en cours sur Crunchyroll et ADN (Animation Digital Network), y compris lors du passage à l'épisode suivant.
- Synchronisation au début du générique de fin quand la plateforme le fournit (Crunchyroll), sinon à un pourcentage réglable (85 % par défaut).
- Toast de confirmation directement sur la page, même en plein écran.
- Choix manuel de la fiche AniList quand la correspondance est incertaine, et correction des dernières synchros.
- Popup en trois écrans : **En cours** (séries en cours, prochain épisode, bouton « Ouvrir » vers Crunchyroll/ADN), **Activité** (vérifications et dernières synchros) et **Réglages** (comptes, lecteur préféré, pause, mode de déclenchement, notifications, correspondances mémorisées).

Plateformes prises en charge : Crunchyroll, ADN. Services de suivi : AniList, MyAnimeList.

## Installation (développement)

Prérequis : Node.js 20+ et Chrome (ou un navigateur Chromium).

```bash
npm install
npm run build
```

Puis dans `chrome://extensions` : activer le **mode développeur**, cliquer sur **Charger l'extension non empaquetée** et sélectionner le dossier `dist/`.

### Configuration AniList

L'extension utilise un client OAuth AniList (Implicit Grant). Sa **Redirect URL** doit être exactement :

```
https://pchgepnbifepbhcjhkaflnjnejodlneh.chromiumapp.org/
```

### Configuration MyAnimeList

Client MAL de type **other** (client public : Authorization Code + PKCE, aucun secret embarqué), avec la même **App Redirect URL** que ci-dessus.

La correspondance des fiches passe toujours par le catalogue AniList (API publique, sans compte), puis par l'identifiant MAL de la fiche (`idMal`).

Cet identifiant d'extension est fixé par la clé publique `key` du `manifest.json` : il est identique sur toutes les machines.

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run build` | Vérification TypeScript puis build de l'extension dans `dist/` |
| `npm run dev` | Build en mode développement (Vite + `@crxjs/vite-plugin`) |
| `npm test` | Tests unitaires (Vitest) |
| `npm run icons` | Régénère les icônes PNG dans `public/icons/` |

## Architecture

```
src/
  background/   Service worker : OAuth (AniList, MAL), API, résolution des correspondances, synchronisation
                (trackers/ : un adapter par service de suivi)
  content/      Content script : adapters par plateforme, suivi de la vidéo, toast
  popup/        Popup (TypeScript + Tailwind CSS) : En cours, Activité (vérifications, dernières synchros), Réglages
  ui/           Helpers DOM et icônes du popup
  shared/       Types, messages typés, réglages et accès au stockage communs
scripts/        Outils de développement (génération des icônes)
```

- **Pattern Adapter** : chaque plateforme implémente `StreamingAdapter` (`src/content/adapters/`).
- Le service worker ne se réveille que pour l'authentification et les requêtes réseau vers AniList.
- Les messages entre contextes sont typés et validés (`src/shared/messages.ts`).

## Débogage

- Console de la page Crunchyroll : logs `[SyncKai:…]`, dont l'horodatage du build au chargement.
- Console du service worker (`chrome://extensions` → « service worker ») : logs `[SyncKai:sync]` avec les fiches candidates et le choix effectué.
- Après un rechargement de l'extension, recharger l'onglet Crunchyroll : l'ancien script reste sinon actif.
