# 📦 Meta-Capsule

> **Redécouvrez vos archives Meta (Facebook & Instagram) en toute sécurité, 100% hors-ligne.**

Meta-Capsule est une application web client-side (SPA) conçue pour transformer vos exports de données "lifetime" Meta en un espace de consultation fluide, épuré et chaleureux. Loin du bruit des algorithmes, explorez vos souvenirs numériques en gardant le contrôle absolu sur votre vie privée.

## ✨ Pourquoi Meta-Capsule ?

Les exports de données fournis par Meta peuvent peser plusieurs dizaines de gigaoctets et sont livrés sous forme de fichiers bruts (JSON/HTML) difficiles à lire. Meta-Capsule décode, unifie et présente ces données de manière visuelle et instantanée.

*   **🔒 Confidentialité Absolue (Zero-Server) :** Vos données ne quittent **jamais** votre navigateur. Tout le traitement du fichier `.zip` se fait localement. L'application fonctionne même si vous coupez votre connexion Internet (Air-Gapped).
*   **⚡ Ultra-Rapide (IndexedDB) :** Conçu pour supporter des archives massives (>20 Go) sans saturer la mémoire vive de votre appareil.
*   **💬 Visualiseur Nostalgique :** Relisez vos conversations Messenger et Instagram Direct dans une interface de tchat familière et fluide.
*   **🎯 Transparence Publicitaire :** Découvrez les centres d'intérêt et la liste des annonceurs que les algorithmes de Meta ont associés à votre profil.

## 🛠️ Stack Technique

*   **Frontend :** [À définir : SvelteKit / React] + Vite
*   **Base de données locale :** Dexie.js (IndexedDB)
*   **Traitement des archives :** `@zip.js/zip.js` (via Web Workers)

## 🚀 Démarrage Rapide

*(Instructions d'installation à venir)*

## 🤝 Contribuer

Ce projet est pensé pour le grand public. La simplicité, la performance et la sécurité sont nos priorités. Les PR et suggestions sont les bienvenues !

---
*Fait avec soin pour redonner à chacun la souveraineté sur ses souvenirs numériques.*