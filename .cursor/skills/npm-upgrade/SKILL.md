---
name: npm-upgrade
description: >-
  Upgrades npm dependencies safely: majors one-by-one (peer-coupled as one unit),
  then all minors, then all patches — each wave validated with the project build.
  Use when the user asks to upgrade packages, bump majors/minors/patches, run ncu,
  or modernize dependencies without breaking the app.
---

# npm upgrade (safe waves)

Automate dependency upgrades the Meta Capsule way. **Never** run `ncu -u` without a target filter that dumps every major at once.

## Defaults

- Branch: `cursor/npm-upgrade-<short-topic>` (or reuse current `cursor/…` if user already started one)
- Commits after each successful wave / major unit
- **No** PR creation unless the user asks
- Validate with `npm run build` (project script). If no `build` script, use the repo’s documented check
- Prefer `npm-check-updates` (`ncu`) when available; otherwise inspect `npm outdated`

## Progress checklist

Copy and update:

```
- [ ] Inventory (ncu, no write)
- [ ] Majors — each unit install + build + commit
- [ ] Minors — batch install + build + commit
- [ ] Patches — batch install + build + commit
- [ ] Final status for user (what bumped, what failed/skipped)
```

## 1. Inventory

Clean or stash unrelated dirty files first. Then list only (do not write yet):

```bash
ncu                 # or: ncu -t minor / ncu -t patch / ncu -t major
```

Group into:

1. **Major units** — one package, or a **coupled set** (see below)
2. **Minors** — all remaining minor bumps
3. **Patches** — all remaining patch bumps

Skip packages the user excluded, or that Dependabot `ignore`s for majors unless they explicitly want them.

## 2. Coupled majors (one unit)

Upgrade these **together** when any one moves major:

- `react`, `react-dom`, `@types/react`, `@types/react-dom`
- Plus ecosystem peers that require the new React (e.g. `react-leaflet` 5 ↔ React 19)

Same idea for other stacks: if peerDeps demand a sibling bump, treat them as **one major unit**, not separate steps.

Vite / plugin / PWA: prefer one **vite** unit (`vite`, `@vitejs/plugin-react`, `vite-plugin-pwa` as needed).

## 3. Majors — one unit at a time

For each major unit, in a sensible order (framework → UI libs → tooling):

```bash
ncu -u <pkg-or-pkgs-in-unit>
npm install
npm run build
```

On build failure:

1. Read the error; fix **minimal** code/config for that upgrade (e.g. Lucide brand icons removed → local SVG; Tailwind 4 → `@tailwindcss/vite` + `@import "tailwindcss"`)
2. Re-run `npm run build`
3. Do **not** start the next major until this unit is green

If blocked (unknown migration, security/privacy ambiguity), stop and ask the user; leave the tree in a clear state.

After green:

```bash
git add package.json package-lock.json <files you fixed>
git commit -m "…"   # why: which major unit, any migration notes
```

Then next major unit.

## 4. Minors — one batch

After all intended majors are done (or user said skip remaining majors):

```bash
ncu -u -t minor
npm install
npm run build
```

Fix only if build breaks; then commit the minor batch.

## 5. Patches — one batch

```bash
ncu -u -t patch
npm install
npm run build
```

Commit when green.

## 6. Report

Summarize:

- Branch name
- Majors completed (units) and commits
- Minors / patches commits
- Skipped / blocked items
- Remind: no PR opened (user can push / open when ready)

## Anti-patterns

- `ncu -u` with no filter when majors are pending
- Mixing several unrelated majors in one `npm install`
- Continuing after a red build
- Changing CI workflows just to silence upgrade failures
- Force-pushing

## Meta Capsule notes

- Build gate: `npm run build` (`tsc && vite build`)
- Tailwind v4: use `@tailwindcss/vite`, drop PostCSS `tailwindcss` plugin; keep theme via `@config` or `@theme`
- Lucide v1: brand icons (e.g. `Github`) removed — replace with local SVG or another source
- Security scan is separate (`npm run security:scan` / Trivy); do not confuse CVE fixes with this upgrade skill
