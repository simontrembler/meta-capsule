---
name: release
description: >-
  Ships a Meta Capsule version (patch/minor/major), updates CHANGELOG.md, and
  tags from package.json. Use when the user asks to release, bump the version,
  update the changelog, or create a new app version. Does not deploy — after
  the tag is pushed, publish from the sibling tower-server repo.
---

# Release Meta Capsule

Single source of truth: `package.json` `version`. The sidebar reads `__APP_VERSION__` (injected by Vite). Never hardcode `v1.0.0` in UI.

Do not bump on every PR. Release only when you intend to ship that version to production.

Production deploy is **not** this repo. After the tag exists on origin, switch to `../tower-server` and use skill `publish-metacapsule` (`./scripts/publish-metacapsule.sh --tag vX.Y.Z`).

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

1. `git push --follow-tags` (only if the user asked to push). The release commit must reach `origin/master` (merge the PR, or release on master).
2. Hand off deploy — do **not** `npm run build` or rsync from here. In `../tower-server`:

   ```bash
   ./scripts/publish-metacapsule.sh --tag vX.Y.Z
   ```

   That fetches the tag, builds `dist/` in Docker, rsyncs via `playbooks/deploy-metacapsule.yml`.
3. Smoke: sidebar on https://metacapsule.my shows `vX.Y.Z`. Hard-refresh if the PWA sticks.

If the user only asked to bump/tag, stop after step 1. If they asked to ship live, continue to tower-server (open that workspace or tell them to run the publish script).

## Do not

- Edit `src/components/Sidebar.tsx` to change the version string
- Run `npm version` or create tags by hand
- Push, or publish from tower-server, unless the user asked
- Invent Unreleased notes — derive them from the commits since the last `v*` tag
- Run `playbooks/apps.yml` or copy `dist/` onto nginx from this repo
