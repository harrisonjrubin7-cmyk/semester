import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { incidentFeed, incidentProblems, type IncidentFile } from './status-history.mjs';

// Read the canonical type union, as nav.registry.test.ts does. A second
// manually maintained screen list would drift as new destinations arrive.
const types = readFileSync(new URL('../src/lib/types.ts', import.meta.url), 'utf8');
const union = /export type Screen =([\s\S]*?);\n/.exec(types);
if (!union) throw new Error('lib/types.ts no longer declares the Screen union.');
const screens = new Set([...union[1].matchAll(/\|\s*'([a-zA-Z0-9_-]+)'/g)].map((m) => m[1]));

const iso = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString().replace('.000Z', 'Z') === value;
};

/** The caller explicitly reviews protected windows, even when the list is empty. */
export function scheduleMaintenance(file: IncidentFile, input: unknown, now = new Date()): IncidentFile {
  const existing = incidentProblems(file);
  if (existing.length) throw new Error(existing.join('\n'));
  if (!input || typeof input !== 'object') throw new Error('A maintenance plan is required.');
  const p = input as Record<string, unknown>;
  for (const field of ['id', 'title', 'affects', 'still']) {
    if (typeof p[field] !== 'string' || !(p[field] as string).trim()) throw new Error(`${field} is required.`);
  }
  if (!iso(p.from) || !iso(p.until) || p.until <= p.from || Date.parse(p.from) <= now.getTime()) {
    throw new Error('Maintenance needs a future start and a later end, as real ISO UTC times.');
  }
  if (!Array.isArray(p.protectedWindows)) throw new Error('Review protectedWindows before scheduling maintenance.');
  for (const window of p.protectedWindows) {
    if (!window || !iso(window.from) || !iso(window.until) || window.until <= window.from || typeof window.name !== 'string' || !window.name.trim()) {
      throw new Error('Each protected window needs a name and valid start/end times.');
    }
    if (p.from < window.until && p.until > window.from) throw new Error(`Maintenance overlaps ${window.name}.`);
  }
  if (file.incidents.some((x) => x.id === p.id)) throw new Error(`${p.id} already exists.`);
  if (p.screens !== undefined && (!Array.isArray(p.screens) || p.screens.some((x) => typeof x !== 'string' || !screens.has(x)))) {
    throw new Error('screens must name supported application screens.');
  }
  const at = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  if (at < file.updated) throw new Error('The notice cannot precede the existing file update.');
  const notice = {
    id: p.id as string, title: p.title as string, components: p.components as string[],
    impact: 'maintenance' as const, started: p.from, resolved: null, until: p.until,
    screens: (p.screens ?? []) as string[], affects: p.affects as string, still: p.still as string,
    updates: [{ at, status: 'scheduled' as const, body: `${p.affects} Window: ${p.from} to ${p.until}. ${p.still}` }],
  };
  const result = { updated: at, incidents: [...file.incidents, notice] };
  const problems = incidentProblems(result);
  if (problems.length) throw new Error(problems.join('\n'));
  return result;
}

async function main() {
  const planPath = process.argv[2];
  if (!planPath) throw new Error('Usage: node scripts/maintenance.ts <plan.json>');
  const incidents = new URL('../public/status-incidents.json', import.meta.url);
  const feed = new URL('../public/status-feed.xml', import.meta.url);
  const result = scheduleMaintenance(JSON.parse(await readFile(incidents, 'utf8')), JSON.parse(await readFile(resolve(planPath), 'utf8')));
  const xml = incidentFeed(result, {
    site: 'https://harrisonjrubin7-cmyk.github.io/semester/status.html',
    feedUrl: 'https://harrisonjrubin7-cmyk.github.io/semester/status-feed.xml',
  });
  // Validate and render both before touching either tracked output. Deploy the
  // pair in one commit; the existing feed-drift guard refuses a partial pair.
  const temporary = new URL(`${incidents.href}.tmp`);
  const feedTemporary = new URL(`${feed.href}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify(result, null, 2) + '\n');
    await writeFile(feedTemporary, xml);
    await rename(temporary, incidents);
    await rename(feedTemporary, feed);
  } finally {
    await Promise.allSettled([unlink(temporary), unlink(feedTemporary)]);
  }
  console.log('Maintenance notice and subscriber feed prepared. Review and commit both files to publish.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : 'Maintenance scheduling failed.'); process.exitCode = 1; });
}
