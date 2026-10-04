/**
 * A draft release note, from the changelog.
 *
 *     npm run release:draft                          # the Unreleased entries, to stdout
 *     npm run release:draft -- --section 2026-09-17
 *     npm run release:draft -- --date 2026-10-04 --write   # docs/releases/notes/2026-10-04.md
 *
 * The headings are copied from CHANGELOG.md exactly, because a test
 * (`src/lib/docs/releases.test.ts`) fails a finished note that names a change
 * the changelog does not hold. The draft is full of `TODO(edit)` on purpose:
 * the same test fails a note that still has one, so a draft cannot be
 * published by accident. `docs/releases/README.md` is the procedure.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const { parseChangelog, draftNote } = await import(join(here, '..', 'src', 'lib', 'docs', 'releasenotes.ts'));

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const section = arg('--section', 'Unreleased');
const date = arg('--date', new Date().toISOString().slice(0, 10));
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { console.error('release:draft: --date must be YYYY-MM-DD'); process.exit(2); }

const entries = parseChangelog(readFileSync(join(root, 'CHANGELOG.md'), 'utf8')).filter((e) => e.section === section);
if (entries.length === 0) { console.error(`release:draft: CHANGELOG.md has no entries under "## ${section}".`); process.exit(2); }

const commit = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const note = draftNote({ date, commit, entries });

if (!process.argv.includes('--write')) { process.stdout.write(note); process.exit(0); }
const out = join(root, 'docs', 'releases', 'notes', `${date}.md`);
if (existsSync(out)) { console.error(`release:draft: ${out} exists; edit it, or choose another --date.`); process.exit(1); }
// The first note creates the folder: none has been cut yet, so it does not exist.
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, note);
console.log(`release:draft: wrote docs/releases/notes/${date}.md from ${entries.length} entries of "${section}", cut from ${commit}.`);
console.log('  Edit every TODO(edit), list the note in docs/releases/README.md, then run the docs tests.');
