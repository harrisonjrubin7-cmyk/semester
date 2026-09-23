import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const ARRAY_NAMES = ['SHELL', 'FIRST_RUN', 'DETAIL', 'SETTINGS'];

function text(path) {
  return readFileSync(path, 'utf8');
}

function strings(source) {
  return [...source.matchAll(/'([a-zA-Z0-9_-]+)'/g)].map((match) => match[1]);
}

function screenUnion(source) {
  const union = /export type Screen =([\s\S]*?);\n/.exec(source);
  if (!union) throw new Error('app/src/lib/types.ts no longer declares `export type Screen =`');
  return strings(union[1]);
}

function destinations(source) {
  const registry = /export const DESTINATIONS:[\s\S]*?= \[([\s\S]*?)\n\];/.exec(source);
  if (!registry) throw new Error('app/src/lib/nav.ts no longer declares DESTINATIONS as an array');
  return [...registry[1].matchAll(/\bscreen:\s*'([a-zA-Z0-9_-]+)'/g)].map((match) => match[1]);
}

function exclusions(source) {
  const out = [];
  for (const name of ARRAY_NAMES) {
    const list = new RegExp(`const ${name} = \\[([\\s\\S]*?)\\] as const;`).exec(source);
    if (!list) throw new Error(`nav.registry.test.ts no longer declares ${name}`);
    out.push(...strings(list[1]));
  }
  return out;
}

function filesBelow(directory, accept = () => true) {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...filesBelow(path, accept));
    else if (entry.isFile() && accept(path)) found.push(path);
  }
  return found.sort();
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function repositoryRoot(srcUrl) {
  const src = fileURLToPath(srcUrl);
  if (basename(src.replace(/\/$/, '')) !== 'src') {
    throw new Error(`Expected an app/src URL, received ${src}`);
  }
  return resolve(src, '..', '..');
}

function evidencePaths(repo) {
  const fixed = [
    'app/src/lib/types.ts',
    'app/src/lib/nav.ts',
    'app/src/lib/nav.registry.test.ts',
  ];
  const institutional = filesBelow(join(repo, 'app/server/institution'), (path) => !/\.env(?:\.|$)/.test(basename(path)));
  const migrations = filesBelow(join(repo, 'supabase/migrations'), (path) => /\.sql$/.test(path));
  const rootDocs = readdirSync(repo)
    .filter((name) => /(?:AUDIT|REQUIREMENT|STATUS|READINESS|PLAN|MATRIX).*\.md$/i.test(name))
    .map((name) => join(repo, name));
  const docs = filesBelow(join(repo, 'docs'), (path) => /(?:AUDIT|REQUIREMENT|STATUS|READINESS|PLAN|MATRIX).*\.md$/i.test(basename(path)));
  return [...new Set([...fixed.map((path) => join(repo, path)), ...institutional, ...migrations, ...rootDocs, ...docs])]
    .filter((path) => statSync(path).isFile())
    .sort();
}

function git(repo, args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

export async function census(srcUrl) {
  const repo = repositoryRoot(srcUrl);
  const screens = screenUnion(text(join(repo, 'app/src/lib/types.ts'))).sort();
  const offered = destinations(text(join(repo, 'app/src/lib/nav.ts'))).sort();
  const accounted = exclusions(text(join(repo, 'app/src/lib/nav.registry.test.ts'))).sort();
  const migrationFiles = readdirSync(join(repo, 'supabase/migrations'))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();
  const versions = new Map();
  for (const name of migrationFiles) {
    const version = name.split('_', 1)[0];
    versions.set(version, [...(versions.get(version) ?? []), name]);
  }
  const duplicateVersions = [...versions.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([version, names]) => ({ version, files: names }))
    .sort((a, b) => a.version.localeCompare(b.version));
  const covered = new Set([...offered, ...accounted]);
  const evidence = evidencePaths(repo).map((path) => ({
    path: relative(repo, path).replaceAll('\\', '/'),
    sha256: sha256(path),
  }));
  const commit = git(repo, ['rev-parse', 'HEAD']);
  const generatedAt = new Date(git(repo, ['show', '-s', '--format=%cI', 'HEAD'])).toISOString();

  return {
    schemaVersion: 1,
    commit,
    generatedAt,
    destinations: { count: offered.length, ids: offered },
    screens: {
      count: screens.length,
      offered,
      accounted,
      unaccounted: screens.filter((screen) => !covered.has(screen)),
    },
    institutionServer: filesBelow(join(repo, 'app/server/institution'), (path) => /\.(?:ts|example)$/.test(path))
      .map((path) => relative(repo, path).replaceAll('\\', '/')),
    migrations: { count: migrationFiles.length, duplicateVersions, files: migrationFiles },
    evidence,
  };
}

function markdown(result) {
  const lines = [
    '# Semester institutional current-state census',
    '',
    `Commit: \`${result.commit}\``,
    '',
    `Generated from commit time: \`${result.generatedAt}\``,
    '',
    `- Registered destinations: ${result.destinations.count}`,
    `- Screen union members: ${result.screens.count}`,
    `- Accounted non-destinations: ${result.screens.accounted.length}`,
    `- Unaccounted screens: ${result.screens.unaccounted.length}`,
    `- Supabase migrations: ${result.migrations.count}`,
    `- Duplicate migration versions: ${result.migrations.duplicateVersions.length}`,
    `- Institution server files: ${result.institutionServer.length}`,
    '',
    '## Evidence',
    '',
    '| Repository path | SHA-256 |',
    '| --- | --- |',
  ];
  for (const row of result.evidence) {
    lines.push(`| [${row.path}](../../../${row.path}) | \`${row.sha256}\` |`);
  }
  lines.push('');
  return lines.join('\n');
}

export async function writeCensus(repoRoot, outputDir) {
  const repo = fileURLToPath(repoRoot);
  const result = await census(pathToFileURL(join(repo, 'app/src/')));
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, 'current-state.json'), `${JSON.stringify(result, null, 2)}\n`);
  writeFileSync(join(outputDir, 'current-state.md'), markdown(result));
  return result;
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) {
  const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const repo = resolve(app, '..');
  const output = resolve(repo, 'docs/institutional-rollout/generated');
  const result = await writeCensus(pathToFileURL(`${repo}/`), output);
  process.stdout.write(`Wrote institutional census for ${result.commit} to ${relative(repo, output)}\n`);
}
