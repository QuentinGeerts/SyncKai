# Publication sur le Chrome Web Store

Procédure pas à pas pour publier SyncKai (première soumission puis mises à jour).

## 1. Générer l'archive

```bash
npm run package
```

Produit `release/synckai-<version>.zip` (contenu de `dist/` à la racine). Le script :

- vérifie que la version de `dist/manifest.json` = version de `package.json` ;
- **retire le champ `key`** du manifest (le Web Store le refuse : l'ID est attribué par le store) ;
- refuse l'archive si `dist/` contient des source maps (`*.map`), un fichier > 10 Mo, ou s'il manque `_locales/{en,fr,de}/messages.json`.

## 2. Premier dépôt (brouillon non répertorié)

1. Ouvrir le [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) (frais d'inscription uniques de 5 $ si le compte n'est pas encore activé).
2. **New item** → déposer `release/synckai-<version>.zip`.
3. Onglet **Distribution** → visibilité **Unlisted** (non répertorié) pour la première version : l'extension n'est accessible que via son lien, le temps de valider OAuth en conditions réelles.
4. **Ne pas encore soumettre** : il faut d'abord mettre à jour les redirections OAuth (étape 4).

## 3. Fiche du store

Remplir les onglets **Store listing** et **Privacy** avec :

| Contenu | Fichier |
| --- | --- |
| Fiche française | [docs/store/listing-fr.md](store/listing-fr.md) |
| Fiche anglaise | [docs/store/listing-en.md](store/listing-en.md) |
| Fiche allemande | [docs/store/listing-de.md](store/listing-de.md) |
| Justification des permissions | [docs/store/permissions.md](store/permissions.md) |

- **Privacy policy URL** : `https://github.com/Sync-Kai/SyncKai/blob/main/PRIVACY.md`
- Déclarer les données traitées (onglet Privacy) conformément à `PRIVACY.md` et cocher les certifications d'usage (pas de vente de données, pas d'usage hors fonctionnalité).

## 4. Changement d'ID (OAuth AniList + MAL)

L'ID attribué par le store diffère de celui du build local : les redirections OAuth (`https://<ID>.chromiumapp.org/`) doivent suivre.

1. Après le premier dépôt, copier l'**Item ID** affiché dans le dashboard (32 lettres a–p).
2. **AniList** → [Developer settings](https://anilist.co/settings/developer) → client **52346** → remplacer le **Redirect URL** par `https://<ID>.chromiumapp.org/`.
3. **MyAnimeList** → [API config](https://myanimelist.net/apiconfig) → app (Client ID `84d05521…`) → remplacer l'**App Redirect URL** par la même URL `https://<ID>.chromiumapp.org/`.
4. Dashboard → onglet **Package** → **Public key** → copier la clé (sans les lignes `-----BEGIN/END PUBLIC KEY-----`, sur une seule ligne) dans le champ `key` de `manifest.json` du projet. Le build local aura ainsi le même ID que la version du store (le champ est retiré automatiquement par `npm run package`).
5. `npm run build`, puis `chrome://extensions` → **Recharger** l'extension non empaquetée ; vérifier que l'ID affiché correspond à l'Item ID.
6. Se **déconnecter puis reconnecter** AniList et MyAnimeList dans les options pour valider les nouvelles redirections.

## 5. Soumission

1. Dashboard → **Submit for review**.
2. Délai de revue typique : de quelques heures à **1–3 jours ouvrés** ; plus long (jusqu'à 1–2 semaines) pour une première soumission ou lorsque des permissions d'hôte larges sont demandées.
3. Une fois validée et testée en non répertorié, passer la visibilité à **Public** si souhaité.

## 6. Mises à jour

1. Incrémenter la version dans `package.json` **et** `manifest.json` (le script refuse si elles diffèrent).
2. `npm run package`.
3. Dashboard → **Package** → **Upload new package** → déposer le nouveau zip → **Submit for review**.

L'ID ne change plus : aucune modification OAuth n'est nécessaire pour les mises à jour.
