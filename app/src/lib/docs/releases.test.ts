import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHANGE_CLASSES, EDIT, SECTIONS, checkNote, draftNote, lead, parseChangelog } from './releasenotes.ts';
import { NOTES } from '../whatsnew.ts';

/**
 * Holds `docs/releases/` — the release procedure, the change-communication
 * matrix and every note under `docs/releases/notes/` — to the repository.
 *
 * A note is a claim about what changed, so the check that matters is the one
 * against `CHANGELOG.md`: a note may only name a change the changelog holds,
 * and may not be published with its drafting marks still in it. The channels
 * the procedure lists are checked to exist, because "announce it on the status
 * page" is worthless advice if there is no status page.
 */

const root = join(import.meta.dirname, '../../../..');
const at = (p: string) => join(root, p);
const read = (p: string) => readFileSync(at(p), 'utf8');

const changelog = parseChangelog(read('CHANGELOG.md'));
const headings = new Set(changelog.map((e) => e.heading));

describe('the changelog parser — the control for everything below', () => {
  it('finds the entries the changelog holds, in the sections it holds them', () => {
    const unreleased = changelog.filter((e) => e.section === 'Unreleased');
    expect(unreleased.length).toBeGreaterThanOrEqual(40);
    expect(changelog.some((e) => e.section === '2026-09-17')).toBe(true);
    for (const e of unreleased) expect(e.heading.length).toBeGreaterThan(5);
  });

  it('reads a made-up changelog exactly', () => {
    const got = parseChangelog('# What changed\n\n## Unreleased\n\n### One\n\nFirst para\nstill first.\n\nSecond.\n### Two\nBody two.\n\n## 2026-01-01\n\n### Old\n\nx\n');
    expect(got.map((e) => [e.section, e.heading])).toEqual([['Unreleased', 'One'], ['Unreleased', 'Two'], ['2026-01-01', 'Old']]);
    expect(lead(got[0].body)).toBe('First para still first.');
  });
});

describe('a drafted note', () => {
  const entries = changelog.filter((e) => e.section === 'Unreleased').slice(0, 3);
  const draft = draftNote({ date: '2026-10-04', commit: 'abc1234def56', entries });

  it('copies each heading from the changelog and cannot be published as it stands', () => {
    for (const e of entries) expect(draft).toContain(`### ${e.heading}\n`);
    const problems = checkNote(draft, headings);
    expect(problems.join(' | ')).toContain(EDIT);
    expect(draft.split(EDIT).length - 1).toBeGreaterThanOrEqual(entries.length + 4);
  });

  it('passes once every drafting mark is replaced — the control that the checker can say yes', () => {
    const finished = draft.split('\n').map((l) => (l.includes(EDIT) ? l.replace(/TODO\(edit\).*$/, 'Nothing.') : l)).join('\n');
    expect(checkNote(finished, headings)).toEqual([]);
  });

  it('is refused for each way a note can lie or be unfinished', () => {
    const finished = draft.split('\n').map((l) => (l.includes(EDIT) ? l.replace(/TODO\(edit\).*$/, 'Nothing.') : l)).join('\n');
    const bad: [string, string, string][] = [
      ['a change the changelog never held', finished.replace(`### ${entries[0].heading}`, '### A change nobody wrote down'), 'is not a heading in CHANGELOG.md'],
      ['no commit', finished.replace(/\*\*Cut from:\*\* `[^`]+`/, '**Cut from:** the latest'), 'Cut from'],
      ['a section removed', finished.replace('## Known problems', '## Notes'), 'no "## Known problems"'],
      ['sections out of order', finished.replace('## Known problems', '## X').replace('## Who to ask', '## Known problems').replace('## X', '## Who to ask'), 'out of order'],
      ['an empty "What you need to do"', finished.replace(/## What you need to do\n\nNothing\./, '## What you need to do\n\n'), 'is empty'],
      ['no changes listed', finished.replace(/### [\s\S]*?(?=\n## Known problems)/, ''), 'lists no change'],
    ];
    for (const [what, text, want] of bad) expect(checkNote(text, headings).join(' | '), what).toContain(want);
    for (const s of SECTIONS) expect(finished).toContain(`## ${s}`);
  });
});

describe('docs/releases/', () => {
  const dir = 'docs/releases/notes';
  const notes = existsSync(at(dir)) ? readdirSync(at(dir)).filter((f) => f.endsWith('.md') && f !== 'README.md').sort() : [];
  const readme = read('docs/releases/README.md');

  it('has only notes that pass, and lists each one', () => {
    for (const f of notes) {
      expect(f, 'notes are named for the day they were cut').toMatch(/^\d{4}-\d{2}-\d{2}\.md$/);
      expect(checkNote(read(`${dir}/${f}`), headings), f).toEqual([]);
      expect(readme, `${f} is not listed in docs/releases/README.md`).toContain(`(notes/${f})`);
    }
    // With no note cut, the table says so rather than being silently empty.
    if (notes.length === 0) expect(readme).toContain('None yet');
  });

  it('names a channel only if it exists', () => {
    for (const p of ['CHANGELOG.md', 'app/src/lib/whatsnew.ts', 'app/src/lib/whatsnew.test.ts', 'app/public/status.html', 'app/public/status-feed.xml', 'app/src/lib/statushistory.test.ts', 'docs/operating-model/INCIDENT-COMMUNICATIONS.md', 'app/src/lib/governance/config-tiers.ts', 'app/scripts/release-draft.mjs']) {
      expect(existsSync(at(p)), p).toBe(true);
    }
    expect(NOTES.length, 'the in-app What changed list has entries').toBeGreaterThan(0);
    const pkg = JSON.parse(read('app/package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['release:draft']).toContain('release-draft.mjs');
    expect(readme).toContain('npm run release:draft');
  });

  it('puts every class of change in both of its tables, and no class the code does not know', () => {
    const matrix = read('docs/releases/CHANGE-COMMUNICATION.md');
    for (const c of CHANGE_CLASSES) {
      expect(matrix.match(new RegExp(`^\\| \`${c}\` \\|`, 'gm')), `class ${c} needs a row in the classes table and in the who-is-told table`).toHaveLength(2);
    }
    const rowClasses = [...matrix.matchAll(/^\| `([a-z]+)` \|/gm)].map((m) => m[1]);
    for (const c of rowClasses) expect(CHANGE_CLASSES as readonly string[], c).toContain(c);
  });

  it('keeps the lead times honest: proposed, and named as proposed', () => {
    const matrix = read('docs/releases/CHANGE-COMMUNICATION.md');
    expect(matrix).toContain('proposed starting points');
    expect(matrix).toMatch(/no contract, order form or policy in the repository sets one/);
  });

  it('asks the pull-request template question the matrix is built on', () => {
    const tpl = read('.github/pull_request_template.md');
    expect(tpl).toContain('Change advisory');
    const tiers = read('app/src/lib/governance/config-tiers.ts');
    expect(tiers).toContain('Policy and governance');
  });
});
