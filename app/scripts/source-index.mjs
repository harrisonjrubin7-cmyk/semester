#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const output = join(repo, 'docs/institutional-rollout/source-index.json');
const { CAPABILITIES } = await import(pathToFileURL(join(repo, 'app/src/lib/rollout-capabilities.ts')).href);
const records = JSON.parse(readFileSync(output, 'utf8'));
const indexed = new Set(records.map((record) => record.ref));

for (const ref of new Set(CAPABILITIES.flatMap((capability) => capability.sources))) {
  if (!ref.startsWith('repo:') || indexed.has(ref)) continue;
  const relative = ref.slice('repo:'.length);
  const file = join(repo, relative);
  if (!existsSync(file)) throw new Error(`Capability evidence is missing: ${ref}`);
  const content = readFileSync(file);
  records.push({
    ref,
    title: `Capability evidence: ${basename(relative)}`,
    status: 'verified',
    checkedAt: '2026-09-30T00:00:00.000Z',
    sha256: createHash('sha256').update(content).digest('hex'),
    note: 'Focused repository evidence cited by the canonical capability registry.',
  });
  indexed.add(ref);
}

writeFileSync(output, `${JSON.stringify(records, null, 2)}\n`);
console.log(`Indexed ${records.length} rollout evidence sources.`);
