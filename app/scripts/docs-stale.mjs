/**
 * Which governed pages are due for a read.
 *
 *     npm run docs:stale                 # report; exits 0
 *     npm run docs:stale -- --fail       # exit 1 if anything is overdue (for a scheduled job)
 *     npm run docs:stale -- --today 2026-12-01
 *
 * Cadence by page type is `REVIEW_DAYS` in `src/lib/docs/card.ts`. The
 * gate (`docsystem.test.ts`) never reads the clock; this does, so a calendar
 * moving past a review date is a report you ask for and not a red build nobody
 * caused.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const lib = join(here, '..', 'src', 'lib', 'docs');
const { governedPages, read } = await import(join(lib, 'card.ts'));
const { stale } = await import(join(lib, 'stale.ts'));

const i = process.argv.indexOf('--today');
const today = i >= 0 ? process.argv[i + 1] : new Date().toISOString().slice(0, 10);

const pages = new Map(governedPages(root).map((p) => [p, read(root, p)]));
const r = stale(pages, today);

const row = (d) => `  ${d.page}  (${d.type}, ${d.owner}, reviewed ${d.reviewed})`;
console.log(`docs:stale: ${pages.size} governed pages, as of ${today}`);
if (r.overdue.length) console.log(`\noverdue (${r.overdue.length})\n${r.overdue.map((d) => `${row(d)}  ${d.overdueDays} days late`).join('\n')}`);
if (r.dueSoon.length) console.log(`\ndue within 14 days (${r.dueSoon.length})\n${r.dueSoon.map((d) => `${row(d)}  in ${-d.overdueDays} days`).join('\n')}`);
if (r.future.length) console.log(`\nreviewed in the future — a typo or a wrong clock (${r.future.length})\n${r.future.map((f) => `  ${f.page}  ${f.reviewed}`).join('\n')}`);
if (r.unparsed.length) console.log(`\nno readable card (${r.unparsed.length})\n${r.unparsed.map((p) => `  ${p}`).join('\n')}`);
if (!r.overdue.length && !r.dueSoon.length && !r.future.length && !r.unparsed.length) console.log('nothing is due.');
console.log('\nA review is a person reading the page against the product or the code and either fixing it or confirming it stands. Then, and only then, change its Reviewed date.');
process.exit(process.argv.includes('--fail') && (r.overdue.length || r.future.length || r.unparsed.length) ? 1 : 0);
