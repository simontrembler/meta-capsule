# Meta Capsule

> Redécouvrez vos archives Facebook & Instagram — 100 % hors-ligne, dans votre navigateur.

Meta Capsule est une application web (SPA) qui transforme un export de données Meta (fichier `.zip`) en espace de consultation clair : messages, médias, publications et transparence publicitaire. Aucun serveur applicatif ne reçoit vos archives.

## Ce que c’est / n’est pas

| Oui | Non |
| --- | --- |
| Traitement local du ZIP dans le navigateur | Connexion aux API Meta |
| Persistance IndexedDB sur votre machine | Upload de vos données vers un backend |
| Facebook **et** Instagram (archives additives) | Édition ou suppression sur vos comptes Meta |
| Lecture seule de souvenirs déjà exportés | Réseau social, notifications, feed |

## Fonctionnalités

- **Import** — glisser-déposer ou sélecteur de fichier ; progression via Web Worker
- **Multi-archives** — ajouter Facebook et Instagram séparément ; remplacer une plateforme sans effacer l’autre
- **Synthèse** — volume de messages, médias, publications ; activité dans le temps ; profil de l’archive
- **Messagerie** — conversations Messenger / Instagram Direct, recherche, pièces jointes à la demande
- **Galerie** — grille chronologique, filtres origine (post / story / message), type, plateforme, mois
- **Publicité** — centres d’intérêt et annonceurs présents dans l’export
- **Médias** — métadonnées en base ; blobs extraits du ZIP à l’affichage (File System Access API sur Chrome/Edge pour survivre au F5)
- **i18n** — interface FR / EN
- **Souveraineté** — effacement intégral des données locales depuis les paramètres

## Confidentialité

- Les archives ne quittent pas votre navigateur.
- Pas de télémétrie, pas de trackers publicitaires.
- Stockage local uniquement (IndexedDB + handles de fichiers quand le navigateur le permet).
- Vous pouvez tout supprimer à tout moment.

Après le chargement des assets de l’app, la consultation peut se faire hors ligne (pas de PWA / service worker pour l’instant).

## Stack

- **UI** — React 18, TypeScript, Vite, Tailwind CSS, lucide-react
- **Base locale** — Dexie.js (IndexedDB)
- **Archives** — `@zip.js/zip.js` dans un Web Worker

Détail technique : [ARCHITECTURE.md](./ARCHITECTURE.md).

## Démarrage

```bash
npm install
npm run dev
```

Autres scripts : `npm run build`, `npm run preview`.

Navigateur recommandé : **Chrome** ou **Edge** (File System Access API pour réattacher le ZIP après refresh). Firefox / Safari fonctionnent pour l’import et le texte ; les médias peuvent exiger de resélectionner le ZIP après un rechargement.

## Obtenir une archive Meta

1. Demandez un export de vos données auprès de [Facebook](https://www.facebook.com/dyi) et/ou [Instagram](https://www.instagram.com/download/request/) (format JSON de préférence).
2. Téléchargez le `.zip` fourni par Meta.
3. Ouvrez Meta Capsule et déposez le fichier dans la capsule. Ajoutez la seconde plateforme depuis la barre latérale ou les paramètres.

## Contribuer

PR et retours bienvenus — priorité à la simplicité, la performance et la confidentialité.

---

*Fait pour redonner à chacun la souveraineté sur ses souvenirs numériques.*
