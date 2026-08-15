# Changelog

Toutes les versions notables de Meta Capsule. Format [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), semver.

Les notes sous **Unreleased** sont déplacées vers une version datée par `npm run release`.

## [Unreleased]

## [1.3.2] - 2026-08-15

### Changé
- Galerie mobile (mode Carte) : filtres en overlay et lieux visités en bandeau bas pour laisser la carte utilisable

### Sécurité
- Exemple nginx : les sondes `/.env` / WordPress reçoivent un 404 au lieu du catch-all SPA

## [1.3.1] - 2026-08-14

### Ajouté
- Carte synthèse « Lieux visités » (nombre de clusters GPS)
- Ce jour-là : nom de l’expéditeur, plus photos / vidéos / vocaux du calendrier

### Changé
- Vérification du service worker quand l’onglet redevient visible

### Corrigé
- Galerie : plus de relance d’extraction du ZIP à chaque tuile (spinners infinis / crash Chrome)

## [1.3.0] - 2026-08-14

### Ajouté
- Liste des lieux visités (points GPS regroupés, noms Nominatim) sur la synthèse et la carte galerie

### Changé
- Copy confidentialité / réseau : les centroïdes GPS agrégés partent vers Nominatim pour nommer les lieux (les photos restent locales)

### Corrigé
- Clic d’un pin : la lightbox galerie passait derrière la carte Leaflet

## [1.2.0] - 2026-08-13

### Ajouté
- Navigation mobile en barre du bas (Synthèse, Messagerie, Galerie, Archives, Paramètres)
- Onglet Archives dédié (ajouter / remplacer / fermer)
- Liens GitHub et Buy Me a Coffee dans le header de l’app

### Changé
- Plus de menu hamburger mobile ; la sidebar reste sur desktop (y compris Publicité)
- Publicité accessible sur mobile via un lien dans Paramètres

## [1.1.0] - 2026-08-13

### Ajouté
- Ingest Messenger Facebook : `archived_threads`, `filtered_threads`, `e2ee_cutover`
- Albums / photos non classées / vidéos Facebook
- Annonceurs `advertisers_using_your_activity_or_information`
- GPS depuis EXIF JSON export (`media.latitude` / `longitude`)
- Posts Instagram sauvegardés (`saved_posts`)
- Carte Leaflet (OSM) dans la galerie + widget synthèse « J’y étais »

### Changé
- Un ZIP Facebook sans JSON cœur est refusé avant d’effacer l’index (piège multi-parties)
- Hint import / archives : extraire toutes les parties localement (PeaZip / 7-Zip) puis ouvrir le dossier — pas d’upload vers un merger en ligne

## [1.0.2] - 2026-08-13

### Ajouté
- Animation d’anneaux en orbite sur la capsule pendant l’ouverture d’une archive (landing)
- Cartographies des exports Instagram et Facebook (`docs/*-export-map.md`)

## [1.0.1] - 2026-08-13

### Ajouté
- Version d’app lue depuis `package.json` (sidebar)
- `CHANGELOG.md` et `npm run release` (patch / minor / major + tag)
- Déploiement tower-server collé à un tag (`--tag vX.Y.Z`)

## [1.0.0] - 2026-08-13

Première version publique (metacapsule.my).

### Ajouté
- Consultation locale des archives Facebook et Instagram (ZIP ou dossier)
- Synthèse, messagerie, galerie, transparence publicitaire
- PWA, thème clair/sombre, FR/EN, recherche globale
- Export local d’un fil HTML et d’une photo

### Sécurité
- Traitement 100 % navigateur, zéro télémétrie
- Captures README anonymisées ; CSP / headers de déploiement documentés
- Les photos de messagerie ne s’ouvrent plus comme document `blob:`
