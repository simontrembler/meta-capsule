# Roadmap Meta Capsule

Produit : SPA **client-only**. ZIP / dossier restent dans le navigateur. Pas de compte, pas d’upload, pas de Node en prod.

## Fait (P0) — branche `feature/p0-usable-archive`

- Import **dossier** (export Meta dézippé) : `showDirectoryPicker`, drop de dossier, `webkitdirectory` en repli
- Médias depuis ZIP **ou** dossier (FSA persisté sur Chrome/Edge)
- Copy **honnête** Safari/Firefox : l’index reste local ; les images exigent de resélectionner le fichier
- Recherche **dans** un thread (mobile inclus) + surlignage
- Saut **année / mois** dans une conversation

## Fait (P1) — branche `feature/p1-capsule-memories`

- **Ce jour-là** sur la synthèse (messages de cette date, années passées)
- Top conversations (volume) → ouvre le fil
- Export HTML local d’un fil (téléchargement navigateur, pas d’upload)
- Timeline annuelle déjà sur la synthèse (volume cumulé FB+IG)

## Fait (P2) — branche `feature/p2-comfort`

- PWA (installable, cache de l’app seulement — pas des archives)
- Mode sombre (clair / sombre / système)
- Virtualisation des threads longs
- Recherche globale (messages + légendes)
- Télécharger 1 photo (galerie / fil) et 1 conversation (HTML local)

## Ensuite (docs / polish)

- Démo publique (hébergement static + archive **fictive** one-click) + lien dans le README
- Captures d’écran dans le README — **fait** (`docs/screenshots/`) ; recadrer si e-mail / téléphone / contacts réels ne doivent pas être publics

## Plus tard, ou jamais

- Sync cloud, login, analytics, LLM serveur
- Amis / followers dump, check-ins carte, comments/likes bruyants
- Parsers TikTok / WhatsApp (autre produit)
- Chiffrement IndexedDB par mot de passe (seulement si PC partagé)

## Garde-fous

Ne pas ajouter d’onglet sans que ça serve à *rouvrir* la capsule. Le serveur de prod ne voit jamais les archives.
