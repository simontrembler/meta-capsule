# Roadmap Meta Capsule

Produit : SPA **client-only**. ZIP / dossier restent dans le navigateur. Pas de compte, pas d’upload, pas de Node en prod.

## Fait (P0) — branche `feature/p0-usable-archive`

- Import **dossier** (export Meta dézippé) : `showDirectoryPicker`, drop de dossier, `webkitdirectory` en repli
- Médias depuis ZIP **ou** dossier (FSA persisté sur Chrome/Edge)
- Copy **honnête** Safari/Firefox : l’index reste local ; les images exigent de resélectionner le fichier
- Recherche **dans** un thread (mobile inclus) + surlignage
- Saut **année / mois** dans une conversation

## P1 — souvenirs (prochaine branche)

Toujours 100 % local, fichiers générés dans le navigateur.

| Feature | Pourquoi |
|---------|----------|
| **Ce jour-là** | Photos + messages du même jour/mois, années passées |
| Timeline unique FB+IG | Un axe temps, badges plateforme |
| Top conversations | Classement par volume / années actives |
| Export local d’un souvenir | Un thread ou un mois → HTML/ZIP téléchargé, jamais uploadé |

## P2 — confort

- PWA (installable, cache app)
- Mode sombre
- Virtualisation des threads longs
- Recherche globale (messages + légendes) si la recherche in-thread tient la route
- Extraire 1 photo / 1 conv depuis l’archive (download)

## Plus tard, ou jamais

- Sync cloud, login, analytics, LLM serveur
- Amis / followers dump, check-ins carte, comments/likes bruyants
- Parsers TikTok / WhatsApp (autre produit)
- Chiffrement IndexedDB par mot de passe (seulement si PC partagé)

## Garde-fous

Ne pas ajouter d’onglet sans que ça serve à *rouvrir* la capsule. Le serveur de prod ne voit jamais les archives.
