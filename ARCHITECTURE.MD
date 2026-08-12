# 📦 Meta Capsule - Document d'Architecture Logicielle (SDD)

> Projet: Plateforme web client-side d'exploration conviviale et confidentielle d'archives Meta (Facebook et Instagram)
>
> Dépôt: meta-capsule
>
> Statut: Spécification technique et conception (v1.0)

> Ligne directrice: Minimalisme, transparence et confidentialité absolue

---

## 📄 Section 1 - Vision, Principes et Confidentialité

### 1.1 Vision et Mission

Les exports de données lifetime de Meta représentent souvent 10 à 20 ans de vie numérique, mais ils restent difficiles à lire pour la plupart des utilisateurs: arborescence complexe, JSON bruts, HTML fragmentés, médias éparpillés.

Mission du projet:

> Offrir une application web épurée qui transforme ces archives en expérience de consultation claire, locale et privée.

L'application vise la souveraineté numérique: redonner à l'utilisateur l'accès à ses propres données sans dépendre d'un service cloud tiers.

### 1.2 Principes Fondamentaux

1. Sobriété et neutralité 🧘
L'interface est un outil de consultation, pas un réseau social. Pas de mécaniques d'engagement, pas de notifications addictives.

2. Confidentialité by design 🔒
Traitement 100% local, sans envoi des archives vers un serveur applicatif.

3. Transparence 🔍
Code source auditable. Le comportement réseau doit être explicite et minimal.

4. Accessibilité 🤝
Expérience simple: glisser-déposer une archive puis explorer.

### 1.3 Garanties de Confidentialité (Zero-Knowledge et Air-Gapped)

- Exécution locale dans le navigateur (SPA).
- Aucune télémétrie tierce par défaut (pas d'analytics, pas de trackers).
- Données persistées uniquement localement (IndexedDB et potentiellement OPFS).
- Mode hors-ligne possible via PWA/service worker.
- Effacement intégral des données locales via action utilisateur dédiée.

Schéma de confiance:

```text
[Archive .zip utilisateur] -> [Traitement local navigateur] -> [Stockage local]
                                 X
                          [Aucun upload des données]
```

### 1.4 Périmètre

Dans le périmètre (v1):

- Plateformes: Facebook et Instagram.
- Formats: JSON prioritaire, HTML support complémentaire.
- Domaines: messagerie, publications, médias, données de profilage publicitaire.

Hors périmètre (v1):

- Connexion en direct aux APIs Meta.
- Édition/suppression sur comptes Meta.
- Synchronisation cloud des archives utilisateur.

---

## ⚙️ Section 2 - Pipeline d'Ingestion, Web Worker et Normalisation

### 2.1 Pipeline Global

Le pipeline d'import est exécuté en arrière-plan pour garder une interface fluide:

```text
[Drop ZIP] -> [Worker] -> [Scan des entrées] -> [Parsing/normalisation] -> [Batch DB] -> [Indexation terminée]
```

Étapes:

1. Dépôt de l'archive `.zip`.
2. Initialisation du worker et transmission du handle de fichier.
3. Détection des répertoires et formats (JSON/HTML).
4. Parsing progressif fichier par fichier.
5. Normalisation vers modèle unifié.
6. Écriture par lots dans IndexedDB (Dexie).
7. Émission de progression vers le thread UI.

### 2.2 Worker d'Ingestion

Principes:

- Ne pas bloquer le thread principal.
- Utiliser un batch d'écriture (p.ex. 500-1000 objets).
- Remonter un état précis: fichier courant, progression globale, erreurs récupérables.

Exemple simplifié:

```typescript
self.onmessage = async (event) => {
  const { zipFile } = event.data;
  // 1) Scanner les entrées
  // 2) Filtrer les fichiers utiles
  // 3) Parser + normaliser
  // 4) bulkPut par lots
  // 5) postMessage(PROGRESS/COMPLETE)
};
```

### 2.3 Normalisation des Encodages

Problème connu: mojibake et variations d'encodage sur certaines chaînes exportées.

Règles:

- Toutes les chaînes passent par une fonction de nettoyage UTF-8.
- Les timestamps sont convertis en epoch millisecondes.
- Les champs absents ou ambigus sont normalisés selon un schéma unique.

### 2.4 Stratégie Mémoire pour Gros Volumes

Règle critique:

> Ne jamais charger tous les médias en mémoire.

Approche:

- Stocker surtout des métadonnées et `relativePath` en base.
- Extraire les médias à la demande.
- Produire des Blob URLs temporaires et les révoquer après usage.
- Utiliser virtualisation dans les vues longues (messages, galeries).

---

## 🗄️ Section 3 - Architecture IndexedDB avec Dexie.js

### 3.1 Principes de Schéma

- Indexer seulement les champs nécessaires aux tris et filtres.
- Utiliser des clés primaires déterministes pour éviter les doublons.
- Favoriser les index composés pour les parcours chronologiques.

Exemples d'identifiants:

- `facebook:thread_123`
- `instagram:post_456`

### 3.2 Schéma Dexie (Proposition)

```typescript
import Dexie, { type Table } from 'dexie';
import type {
  UserProfile,
  Conversation,
  Message,
  Post,
  MediaAttachment,
  AdTargeting
} from './models';

export class MetaArchiveDatabase extends Dexie {
  profiles!: Table<UserProfile, string>;
  conversations!: Table<Conversation, string>;
  messages!: Table<Message, string>;
  posts!: Table<Post, string>;
  media!: Table<MediaAttachment, string>;
  adTargeting!: Table<AdTargeting, string>;

  constructor() {
    super('MetaArchiveViewerDB');

    this.version(1).stores({
      profiles: 'id, platform',
      conversations: 'id, platform, lastMessageTimestamp, *participants',
      messages: 'id, conversationId, timestamp, [conversationId+timestamp], platform, isFromUser',
      posts: 'id, platform, type, timestamp, [platform+type]',
      media: 'id, platform, relativePath, type, timestamp',
      adTargeting: 'id, platform'
    });
  }
}

export const db = new MetaArchiveDatabase();
```

### 3.3 Tables et Index

| Table         | Clé primaire | Index principaux                              | Usage                                         |
| ------------- | ------------ | --------------------------------------------- | --------------------------------------------- |
| conversations | id           | platform, lastMessageTimestamp, *participants | Liste des discussions et filtres participants |
| messages      | id           | [conversationId+timestamp], isFromUser        | Pagination chronologique d'un chat            |
| posts         | id           | timestamp, [platform+type]                    | Timeline globale et filtres de type           |
| media         | id           | relativePath, type, timestamp                 | Résolution rapide des médias                  |
| adTargeting   | id           | platform                                      | Consultation du profilage publicitaire        |

### 3.4 Stratégie de Requêtes

- Chargement messages récents par conversation via `[conversationId+timestamp]` en ordre inverse.
- Recherche locale conversationnelle immédiate.
- Recherche globale asynchrone (worker) pour les archives lourdes.

Exemple:

```typescript
export async function getLatestMessages(conversationId: string, limit = 50) {
  return db.messages
    .where('[conversationId+timestamp]')
    .between([conversationId, Dexie.minKey], [conversationId, Dexie.maxKey])
    .reverse()
    .limit(limit)
    .toArray();
}
```

---

## 🚀 Section 4 - Catalogue des Fonctionnalités MVP

### 4.1 Vue d'Ensemble

Le MVP est composé de 4 modules:

1. 📊 Dashboard
2. 💬 Messagerie
3. 🖼️ Galerie médias
4. 🎯 Transparence publicitaire

### 4.2 Module Dashboard 📊

Objectif: donner une vue de synthèse neutre et immédiate.

Fonctionnalités:

- KPIs globaux (taille archive, nombre messages, nombre médias, période couverte).
- Frise/graphique d'activité par année et mois.
- Indicateur de statut local/hors-ligne visible en permanence.

### 4.3 Module Messagerie 💬

Objectif: relire les conversations Messenger et IG Direct de manière fluide.

Fonctionnalités:

- Liste des conversations triées par dernier message.
- Recherche par participant.
- Vue chat en lecture seule avec pagination infinie.
- Recherche textuelle dans la conversation active.

### 4.4 Module Galerie Médias 🖼️

Objectif: retrouver photos/vidéos/stories par chronologie.

Fonctionnalités:

- Grille adaptive regroupée par mois/année.
- Filtres de types (photos, vidéos, stories, médias de chat).
- Lightbox avec métadonnées essentielles.
- Export individuel d'un média.

### 4.5 Module Transparence Publicitaire 🎯

Objectif: rendre visibles les signaux de profilage contenus dans l'archive.

Fonctionnalités:

- Liste des centres d'intérêt associés.
- Liste des annonceurs ayant importé les coordonnées.
- Historique des interactions pub lorsque disponible.

### 4.6 Scope MVP vs Évolutions

| Domaine    | MVP v1                     | Évolutions v2+                         |
| ---------- | -------------------------- | -------------------------------------- |
| Ingestion  | 1 archive ZIP              | Fusion multi-archives                  |
| Messagerie | Recherche par conversation | Full-text global multi-conversations   |
| Stats      | Courbes d'activité de base | Analyses sémantiques avancées          |
| Export     | Export média unitaire      | Exports structurés (Markdown/PDF/CSV) |

---

## 🎨 Section 5 - Ergonomie UI/UX et Maquettes Textuelles

### 5.1 Principes UX

- Minimalisme intentionnel: peu d'éléments, hiérarchie claire.
- Lisibilité d'abord: textes compréhensibles et actions évidentes.
- Feedback immédiat: progression d'import, états clairs, erreurs actionnables.
- Lecture seule explicite pour éviter toute ambiguïté.

### 5.2 Navigation Générale

Desktop:

- Barre latérale gauche (Dashboard, Messages, Galerie, Publicité, Paramètres).
- En-tête global (état local/hors-ligne, archive active, recherche contextuelle).
- Zone de contenu principale.

Mobile:

- Navigation simplifiée en barre basse.
- Priorité aux vues liste/detail.

### 5.3 Maquettes Textuelles

#### Écran Importation

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                          📂 Meta Capsule                               │
│              Redécouvrez vos données Meta en 100% local                │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                 Glissez votre archive .zip ici                 │   │
│   │                               ou                               │   │
│   │                   [ 📁 Choisir un fichier ]                    │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│   🔒 État: Données locales uniquement - Aucun envoi serveur             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Écran Dashboard

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ 📊 Synthèse                                                            │
├─────────────────────────────────────────────────────────────────────────┤
│ [Taille] [Messages] [Médias] [Période]                                 │
│                                                                         │
│ 📈 Activité dans le temps                                               │
│  20K ┤            ▄▄                                                    │
│  10K ┤      ▄▄   ████  ▄▄                                               │
│   0  ┼───┬────┬────┬────┬────┬───                                       │
│      '12 '15  '18  '21  '24  '26                                        │
│                                                                         │
│ Raccourcis: Messages | Galerie | Transparence                           │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Écran Messagerie

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ 💬 Messagerie                                                          │
├────────────────────────────┬────────────────────────────────────────────┤
│ 🔍 Rechercher un contact    │ Conversation: Alex                         │
│                            │ 🔍 Recherche dans le chat                  │
│ • Alex                     │                                            │
│ • Sophie                   │ Alex: Tu as vu les photos de 2018 ?        │
│ • Groupe Projet            │ Moi : Oui, elles sont toutes là.           │
│                            │ [📷 media_2018_04.jpg]                      │
│                            │                                            │
│                            │ ... pagination infinie ...                 │
├────────────────────────────┴────────────────────────────────────────────┤
│ Mode lecture seule de l'archive                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Écran Galerie

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ 🖼️ Galerie Médias                     [Tous] [Photos] [Vidéos] [Stories] │
├─────────────────────────────────────────────────────────────────────────┤
│ Août 2026                                                               │
│ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐                                 │
│ │Photo  │ │Photo  │ │Vidéo▶ │ │Photo  │                                 │
│ └───────┘ └───────┘ └───────┘ └───────┘                                 │
│                                                                         │
│ Juillet 2026                                                            │
│ ┌───────┐ ┌───────┐ ┌───────┐                                           │
│ │Photo  │ │Photo  │ │Photo  │                                           │
│ └───────┘ └───────┘ └───────┘                                           │
│                                                                         │
│ Clic média -> visionneuse + métadonnées + export                        │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Écran Publicité

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ 🎯 Transparence Publicitaire                                           │
├─────────────────────────────────────────────────────────────────────────┤
│ Centres d'intérêt associés                                              │
│ [Technologie] [Musique] [Plein air] [Photo]                            │
│                                                                         │
│ Annonceurs ayant importé vos coordonnées                                │
│ • Entreprise A                                                          │
│ • Entreprise B                                                          │
│                                                                         │
│ Interactions publicitaires disponibles dans l'archive                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.4 Design System (Base)

- Couleurs sobres et contraste élevé.
- Typographie claire sans surcharge décorative.
- États UI normalisés (succès, info, avertissement, erreur).
- Composants utilitaires réutilisables: cartes KPI, tableaux, timeline, listes virtuelles, barres de progression.

---

## 🗺️ Feuille de Route de Réalisation

Ordre recommandé:

1. Finaliser le schéma de données et la DB Dexie.
2. Implémenter l'ingestion worker + normalisation.
3. Créer l'ossature UI (navigation + layouts).
4. Livrer les 4 modules MVP.
5. Ajouter PWA/offline et tests de robustesse gros volumes.

## ✅ Critères d'Acceptation (v1)

- Import d'une archive représentative sans blocage UI.
- Navigation fluide dans les conversations volumineuses.
- Consultation des médias sans explosion mémoire.
- Affichage des données de transparence publicitaire disponibles.
- Aucune exfiltration de données utilisateur.
