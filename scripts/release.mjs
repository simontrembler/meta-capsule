#!/usr/bin/env node
/**
 * Bump semver, fold CHANGELOG [Unreleased] into a dated release, commit, tag.
 * Does not push. Usage: npm run release -- patch|minor|major
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bump = process.argv[2];

if (!['patch', 'minor', 'major'].includes(bump)) {
  console.error('Usage: npm run release -- patch|minor|major');
  process.exit(1);
}

function run(cmd) {
  return execSync(cmd, { cwd: root, encoding: 'utf-8' }).replace(/\n$/, '');
}

const dirty = run('git status --porcelain');
const dirtyFiles = dirty
  ? dirty
      .split('\n')
      .filter(Boolean)
      .map((line) => line.slice(3).trim())
  : [];
const allowedDirty = new Set(['CHANGELOG.md']);
const unexpected = dirtyFiles.filter((file) => !allowedDirty.has(file));
if (unexpected.length) {
  console.error('Working tree has unrelated changes. Commit or stash them first:');
  for (const file of unexpected) console.error(`  ${file}`);
  process.exit(1);
}

const pkgPath = join(root, 'package.json');
const changelogPath = join(root, 'CHANGELOG.md');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
const [maj, min, pat] = pkg.version.split('.').map(Number);
const next =
  bump === 'major' ? `${maj + 1}.0.0` : bump === 'minor' ? `${maj}.${min + 1}.0` : `${maj}.${min}.${pat + 1}`;

const changelog = readFileSync(changelogPath, 'utf-8');
const unreleasedRe = /## \[Unreleased\]\n([\s\S]*?)\n(?=## \[)/;
const match = changelog.match(unreleasedRe);
if (!match) {
  console.error('CHANGELOG.md must contain ## [Unreleased] followed by a dated ## [x.y.z] section.');
  process.exit(1);
}

const notes = match[1].trim();
if (!notes) {
  console.error('Nothing under ## [Unreleased]. Add release notes before running this script.');
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const nextChangelog = changelog.replace(
  unreleasedRe,
  `## [Unreleased]\n\n## [${next}] - ${today}\n\n${notes}\n\n`
);
writeFileSync(changelogPath, nextChangelog);

run(`npm version ${bump} --no-git-tag-version`);
run('git add package.json package-lock.json CHANGELOG.md');
run(`git commit -m "chore: release v${next}"`);
run(`git tag v${next}`);

console.log(`Released v${next}. Push with: git push --follow-tags`);
