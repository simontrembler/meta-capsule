# Changelog

Toutes les versions notables de Meta Capsule. Format [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), semver.

Les notes sous **Unreleased** sont déplacées vers une version datée par `npm run release`.

## [Unreleased]

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
