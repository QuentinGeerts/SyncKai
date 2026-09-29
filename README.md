# SyncKai

Extension de navigateur (Manifest V3) qui détecte les épisodes regardés sur Crunchyroll et met à jour automatiquement ta liste **AniList**, sans action manuelle.

## Fonctionnalités

- Connexion à AniList en un clic depuis le popup.
- Détection de l'épisode en cours sur Crunchyroll, y compris lors du passage à l'épisode suivant.
- Synchronisation au début du générique de fin (ou à 85 % si l'information n'est pas disponible).
- Toast de confirmation directement sur la page, même en plein écran.
- Choix manuel de la fiche AniList quand la correspondance est incertaine, et correction des dernières synchros.

Plateformes prises en charge : Crunchyroll. Service de suivi : AniList.

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

Cet identifiant d'extension est fixé par la clé publique `key` du `manifest.json` : il est identique sur toutes les machines.

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run build` | Vérification TypeScript puis build de l'extension dans `dist/` |
| `npm run dev` | Build en mode développement (Vite + `@crxjs/vite-plugin`) |
| `npm test` | Tests unitaires (Vitest) |

## Architecture

```
src/
  background/   Service worker : OAuth, API AniList, résolution des correspondances, synchronisation
  content/      Content script : adapters par plateforme, suivi de la vidéo, toast
  popup/        Popup (TypeScript + Tailwind CSS) : connexion, profil, vérifications, dernières synchros
  shared/       Types, messages typés et accès au stockage communs
```

- **Pattern Adapter** : chaque plateforme implémente `StreamingAdapter` (`src/content/adapters/`).
- Le service worker ne se réveille que pour l'authentification et les requêtes réseau vers AniList.
- Les messages entre contextes sont typés et validés (`src/shared/messages.ts`).

## Débogage

- Console de la page Crunchyroll : logs `[SyncKai:…]`, dont l'horodatage du build au chargement.
- Console du service worker (`chrome://extensions` → « service worker ») : logs `[SyncKai:sync]` avec les fiches candidates et le choix effectué.
- Après un rechargement de l'extension, recharger l'onglet Crunchyroll : l'ancien script reste sinon actif.
