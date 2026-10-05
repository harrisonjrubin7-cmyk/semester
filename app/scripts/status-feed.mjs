#!/usr/bin/env node
/**
 * Render `public/status-feed.xml` from `public/status-incidents.json`.
 * `src/lib/statushistory.test.ts` fails while the two disagree, and
 * `REGISTERS=write` (as `npm run registers` sets it) rewrites the feed.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { incidentFeed, incidentProblems } from './status-history.mjs';

const SITE = 'https://harrisonjrubin7-cmyk.github.io/semester/status.html';
const FEED = 'https://harrisonjrubin7-cmyk.github.io/semester/status-feed.xml';

const data = JSON.parse(await readFile(new URL('../public/status-incidents.json', import.meta.url), 'utf8'));
const problems = incidentProblems(data);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
await writeFile(new URL('../public/status-feed.xml', import.meta.url), incidentFeed(data, { site: SITE, feedUrl: FEED }));
