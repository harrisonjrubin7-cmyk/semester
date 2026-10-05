#!/usr/bin/env node
/**
 * The hourly status check, written down.
 *
 *   node scripts/status-record.mjs <history.json>
 *
 * Probes every component once (`status-history.mjs`), adds the result to the
 * file, and prints what it recorded. It records failures as failures and exits
 * 0 for them — the job's point is the record. It exits non-zero only when it
 * cannot tell what to probe or cannot write, so a half-configured run fails
 * loudly instead of recording nothing and looking healthy.
 *
 * `production-smoke.yml` runs it against a checkout of the `status-data`
 * branch and commits the file back. Nothing before the first run is filled in.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { COMPONENTS, emptyHistory, probeAll, record, summarise } from './status-history.mjs';

const DEFAULT_APP = 'https://harrisonjrubin7-cmyk.github.io/semester';

async function committed() {
  const values = {};
  try {
    const text = await readFile(new URL('../.env.production', import.meta.url), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) values[m[1]] = m[2];
    }
  } catch {
    // A deployment may supply both values itself.
  }
  return values;
}

const path = process.argv[2];
if (!path) {
  console.error('Usage: node scripts/status-record.mjs <history.json>');
  process.exit(2);
}

const env = await committed();
const config = {
  app: (process.env.SEMESTER_PUBLIC_APP_URL || DEFAULT_APP).replace(/\/$/, ''),
  supabase: (process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, ''),
  key: process.env.VITE_SUPABASE_KEY || env.VITE_SUPABASE_KEY || '',
};
if (!config.app.startsWith('https://') || !config.supabase.startsWith('https://') || !config.key) {
  console.error('The public app URL, the Supabase URL and its publishable key must all be set, and be HTTPS.');
  process.exit(1);
}

let history = emptyHistory();
try {
  history = JSON.parse(await readFile(path, 'utf8'));
} catch (e) {
  if (e?.code !== 'ENOENT') throw e; // a first run has no file; a corrupt one must not be started over silently
}

const now = new Date();
const results = await probeAll(config);
history = record(history, results, now);
await writeFile(path, JSON.stringify(history) + '\n');

const summary = summarise(history, now);
for (const c of COMPONENTS) {
  const s = summary[c.id];
  console.log(`${results[c.id] ? '  ok  ' : '  DOWN'} ${c.name}${s.percent === null ? '' : ` (${s.percent}% of ${s.total} checks over ${s.daysWithData} days)`}`);
}
