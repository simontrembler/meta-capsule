---
name: release
description: >-
  Ships a Meta Capsule version (patch/minor/major), updates CHANGELOG.md, and
  tags from package.json. Use when the user asks to release, bump the version,
  ship to metacapsule.my, update the changelog, or create a new app version.
---

# Release Meta Capsule

Single source of truth: `package.json` `version`. The sidebar reads `__APP_VERSION__` (injected by Vite). Never hardcode `v1.0.0` in UI.

Do not bump on every PR. Release only when shipping to production (metacapsule.my).

## Semver

- **patch** — fix, hardening, copy, chore visible in prod
- **minor** — new user-facing capability
- **major** — breaking change to import / existing archive workflow

## Before the script

1. Feature work is already merged (or committed). Working tree clean except maybe `CHANGELOG.md`.
2. Under `## [Unreleased]` in `CHANGELOG.md`, write French notes using `### Ajouté` / `### Changé` / `### Corrigé` / `### Sécurité` / `### Retiré`. No empty Unreleased.
3. Confirm bump type with the user if they did not say patch/minor/major.

## Run

```bash
npm run release -- patch
```

Replace `patch` with `minor` or `major` when that is the bump.

The script folds Unreleased into `## [x.y.z] - YYYY-MM-DD`, bumps `package.json` + lockfile, commits `chore: release vX.Y.Z`, and tags `vX.Y.Z`. It does **not** push.

## After

1. `git push --follow-tags` (only if the user asked to push).
2. Deploy: `npm run build`, publish `dist/` to nginx (see `deploy/nginx.conf.example`).
3. Smoke: sidebar shows `vX.Y.Z` on https://metacapsule.my.

## Do not

- Edit `src/components/Sidebar.tsx` to change the version string
- Run `npm version` or create tags by hand
- Push or deploy unless the user asked
- Invent Unreleased notes — derive them from the commits since the last `v*` tag
