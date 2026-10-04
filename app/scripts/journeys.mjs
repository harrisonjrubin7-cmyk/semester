#!/usr/bin/env node
/*
 * Print, check or rewrite the generated regions of
 * docs/quality-system/02-JOURNEYS.md from the journey catalog.
 *
 *   npm run journeys             print what the regions should say
 *   npm run journeys -- --write  rewrite them in the document
 *
 * The document and the catalog are held together by
 * src/lib/governance/journey-catalog.test.ts, which fails when a region differs
 * from what this renders; this is how to bring them back into step.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { renderDebtTable, renderJourneyTables, summaryLine } from '../src/lib/governance/journey-catalog.ts';

const doc = new URL('../../docs/quality-system/02-JOURNEYS.md', import.meta.url);
const regions = { summary: summaryLine(), debt: renderDebtTable(), table: renderJourneyTables() };

if (!process.argv.includes('--write')) {
  for (const [name, text] of Object.entries(regions)) console.log(`<!-- journeys:${name} -->\n${text}\n`);
  process.exit(0);
}

let text = await readFile(doc, 'utf8');
for (const [name, body] of Object.entries(regions)) {
  const start = `<!-- journeys:${name}:start -->`;
  const end = `<!-- journeys:${name}:end -->`;
  const from = text.indexOf(start);
  const to = text.indexOf(end);
  if (from < 0 || to < from) {
    console.error(`02-JOURNEYS.md has no ${start} … ${end} region.`);
    process.exit(1);
  }
  text = `${text.slice(0, from + start.length)}\n${body}\n${text.slice(to)}`;
}
await writeFile(doc, text);
console.log('02-JOURNEYS.md regions rewritten from the catalog.');
