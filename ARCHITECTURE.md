# Meta Capsule — Architecture

> Architecture actuelle du MVP (SPA locale). Document vivant, aligné sur le code.

Dépôt : [meta-capsule](https://github.com/simontrembler/meta-capsule)

Ligne directrice : minimalisme, transparence, confidentialité — consultation en lecture seule, pas de réseau social.

---

## 1. Principes

1. **Local-first** — parsing et stockage dans le navigateur ; aucun upload des archives.
2. **Lecture seule** — l’app n’écrit rien sur Meta.
3. **Sobriété UI** — outil de consultation (shell Atelier / Archive graphite), pas de mécaniques d’engagement.
4. **Mémoire maîtrisée** — métadonnées en IndexedDB ; médias extraits à la demande depuis le ZIP.

Hors scope produit : API Meta live, sync cloud, édition de compte, télémétrie.

---

## 2. Carte du code

```text
src/
  components/     # Écrans et UI (Import, Sidebar, modules, slots archives)
  context/        # ArchiveContext, LanguageContext, ShellContext
  db/             # Dexie (db.ts) + modèles (models.ts)
  i18n/           # Dictionnaires FR / EN
  utils/          # FSA, session, zip médias, décodage Meta
  workers/        # ingestion.worker.ts
  App.tsx         # Landing vs shell + overlay d’ingest
```

Stack runtime : React 18 + Vite + TypeScript + Tailwind ; Dexie ; `@zip.js/zip.js` ; lucide-react.

---

## 3. Flux global

```text
[ZIP FB ou IG]
      │
      ▼
[ArchiveContext] ──startIngestion──► [ingestion.worker]
      │                                      │
      │                                      ▼
      │                               clearPlatformData(platform)
      │                                      │
      │                                      ▼
      │                               parse + normalize → Dexie batches
      │                                      │
      ├──── fileHandles (FSA, par plateforme)
      │
      ▼
[Dashboard | Messages | Gallery | Ads | Settings]
      │
      └── getZipFile(platform) → zipMediaResolver (Blob URL)
```

- **Premier import** : écran `ImportScreen` (drop / picker).
- **Archive déjà en session** : shell `Sidebar` + `Header` + module actif.
- **Second import / remplacement** : slots dans la sidebar et les paramètres ; overlay `IngestOverlay` sans renvoyer vers le landing.
- **Mobile** : drawer latéral (`ShellContext`), pas de barre de navigation basse.

---

## 4. Multi-archives (additif)

Facebook et Instagram coexistent dans la même base.

| Mécanisme | Rôle |
| --- | --- |
| `db.clearPlatformData(platform)` | Efface seulement FB **ou** IG avant réimport |
| Handles FSA `archive-zip-facebook` / `archive-zip-instagram` | Réattacher les médias après F5 (Chrome/Edge) |
| `rebuildSessionStats` / `meta_capsule_session` | Session agrégée + métadonnées par plateforme |
| `getZipFile(platform)` | Routage médias galerie / messages / avatar |
| `ArchivesSlots` | Ajouter, remplacer (confirm), retirer, recharger médias |

Remplacer une plateforme ne touche pas l’autre. Un ZIP manquant pour une plateforme n’empêche pas la consultation texte / l’autre ZIP.

Fichiers clés : [`src/context/ArchiveContext.tsx`](src/context/ArchiveContext.tsx), [`src/utils/sessionStats.ts`](src/utils/sessionStats.ts), [`src/utils/fileSystemAccess.ts`](src/utils/fileSystemAccess.ts), [`src/components/ArchivesSlots.tsx`](src/components/ArchivesSlots.tsx).

---

## 5. Pipeline d’ingestion

Exécuté dans [`src/workers/ingestion.worker.ts`](src/workers/ingestion.worker.ts) pour ne pas bloquer l’UI.

```text
[Drop ZIP] → [Worker] → [Détection plateforme] → [clearPlatformData]
         → [Scan entrées] → [Parse JSON + normalisation] → [bulkPut]
         → [PROGRESS / COMPLETE / ERROR]
```

Points importants :

- Détection rapide FB / IG (nom de fichier + chemins caractéristiques).
- Décodage des chaînes Meta (`metaDecoder`) ; timestamps en epoch ms.
- Indexation médias avec `relativePath` + `source` (`post` | `story` | `message` | `other`).
- Progression remontée au thread UI ; en multi-archives, `stats` UI sont reconstruites depuis Dexie après `COMPLETE` (agrégats globaux).

---

## 6. IndexedDB (Dexie)

Base : `MetaArchiveViewerDB` — voir [`src/db/db.ts`](src/db/db.ts) et [`src/db/models.ts`](src/db/models.ts).

| Table | Rôle |
| --- | --- |
| `profiles` | Profil par plateforme |
| `conversations` / `messages` | Messagerie |
| `posts` | Publications / stories |
| `media` | Métadonnées médias (+ `source`, index `[source+timestamp]`) |
| `adTargeting` | Intérêts / annonceurs |
| `fileHandles` | Handles File System Access (v2 du schéma) |

Identifiants déterministes du type `facebook:…` / `instagram:…`.

Stratégie requêtes : listes triées par timestamp ; messages d’une conversation via `[conversationId+timestamp]` ; filtres galerie côté UI sur le jeu de métadonnées chargé.

---

## 7. Médias

Règle : **ne jamais** charger tout le ZIP en mémoire.

1. L’ingestion enregistre chemin + type + source + timestamp.
2. À l’affichage, [`zipMediaResolver.ts`](src/utils/zipMediaResolver.ts) ouvre le `File` ZIP de la bonne plateforme, extrait l’entrée, met en cache une Blob URL.
3. `revokeAllMediaUrls` au reset / changement d’archive.

Sans handle FSA (ou permission refusée) : données texte OK ; pastille « ZIP manquant » / actions de rechargement dans le header et les slots.

---

## 8. Modules UI

| Module | Comportement actuel |
| --- | --- |
| **Synthèse** | KPIs, plage de dates, activité annuelle, carte profil |
| **Messagerie** | Liste + fil de discussion, recherche contact / dans le chat, pièces jointes via ZIP plateforme |
| **Galerie** | Groupement année-mois, filtres origine / type / plateforme / période, lightbox + export unitaire |
| **Publicité** | Intérêts et annonceurs issus de l’export, filtres texte |
| **Paramètres** | Langue, privacy copy, slots archives, purge totale, liens support |

i18n : [`src/i18n/fr.ts`](src/i18n/fr.ts) / [`en.ts`](src/i18n/en.ts) via `LanguageContext`.

---

## 9. Non livré (volontairement)

- PWA / service worker / OPFS dédié
- Virtualisation agressive de toutes les listes
- Full-text global multi-conversations
- Exports structurés (Markdown / PDF / CSV)
- Support HTML Meta en priorité (JSON d’abord)

---

## 10. Évolutions possibles

- Mode offline installable (PWA)
- Virtualisation galerie / messages pour très gros volumes
- Recherche plein texte asynchrone
- Exports structurés et packs de souvenirs
- Tests de charge sur exports multi-dizaines de Go

Cartographies exports (tiers S–C, couverture ingest, pièges multi-ZIP) :

- Instagram : [`docs/instagram-export-map.md`](docs/instagram-export-map.md)
- Facebook : [`docs/facebook-export-map.md`](docs/facebook-export-map.md)

---

## Critères de santé (MVP)

- Import d’une archive représentative sans figer l’UI
- FB + IG coexistants ; replace unilatéral
- Navigation messages / galerie sans explosion mémoire
- Transparence pub quand les fichiers sont présents dans l’export
- Aucune exfiltration des données utilisateur par l’application
