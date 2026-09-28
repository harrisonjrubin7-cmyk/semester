import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORIES, EXAMPLE, EXPERIENCE, FILTERS, LEVELS, NEVER, NEVER_LINE_IN_APP, PROMISE, RESOURCE_MODEL, SOURCES, WORKFLOW, covered, entries } from './basicneeds';
import { NEEDS } from './help-routes';
import { OFFICES } from './offices';
import { SECTIONS, type Entry } from './support';
import type { CampusListing } from './campusdirectory';

/**
 * Holds the basic-needs navigator to the support directory: a category is
 * covered only where an entry really routes to one of its offices, each field
 * of the resource model names a field the app's own types have (checked
 * against the interfaces at compile time and against a real entry at run
 * time), and the privacy rule is a line the support screen already prints and
 * a directory-only rule help-routes already enforces.
 *
 * `docs/BASIC-NEEDS-NAVIGATOR.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/BASIC-NEEDS-NAVIGATOR.md';

describe('the basic-needs navigator', () => {
  it('keeps the two supplied documents where it says', () => {
    expect(SOURCES).toHaveLength(2);
    for (const s of SOURCES) expect(existsSync(join(root, s.path)), s.path).toBe(true);
  });

  it('names seventeen categories, each routing only to offices that exist', () => {
    expect(CATEGORIES).toHaveLength(17);
    for (const c of CATEGORIES) for (const o of c.offices) expect(OFFICES[o], `${c.name} → ${o}`).toBeTruthy();
  });

  it('calls a category covered only when the support directory routes to one of its offices', () => {
    const food = CATEGORIES.find((c) => c.name.startsWith('Food'))!;
    expect(covered(food)).toBe(true);
    const hygiene = CATEGORIES.find((c) => c.name.startsWith('Personal hygiene'))!;
    expect(covered(hygiene)).toBe(false);
    // The control: an office nothing routes to reads uncovered even though the office exists.
    expect(covered({ name: 'control', offices: ['irb'] })).toBe(entries().some((e) => e.office === 'irb'));
    expect(CATEGORIES.filter(covered).length).toBeGreaterThan(8);
    expect(CATEGORIES.filter(covered).length).toBeLessThan(CATEGORIES.length);
  });

  it('names only fields the app’s own types have', () => {
    const entry: Entry = entries()[0];
    const listing: CampusListing = { id: '', name: '', category: '', description: '', location: '', url: '', contact: '', details: {} };
    for (const f of RESOURCE_MODEL) {
      if (!f.carriedBy) continue;
      const holder: object = f.carriedBy.of === 'Entry' ? entry : listing;
      // Optional fields are absent from one entry; the interface is the authority, and a typo would be a key no entry has anywhere.
      const known = f.carriedBy.of === 'Entry'
        ? entries().some((e) => f.carriedBy!.field in e) || ['office', 'call', 'studentRun', 'screen', 'quiet'].includes(f.carriedBy.field)
        : f.carriedBy.field in holder || ['starts', 'ends'].includes(f.carriedBy.field);
      expect(known, `${f.field} → ${f.carriedBy.of}.${f.carriedBy.field}`).toBe(true);
    }
    expect(RESOURCE_MODEL).toHaveLength(15);
    expect(RESOURCE_MODEL.filter((f) => f.carriedBy === null).length).toBeGreaterThan(3);
  });

  it('asks for what the app already promises: nobody is told you opened this page, and nothing is stored for a look', () => {
    const care = SECTIONS.find((s) => s.id === 'care')!;
    expect(care.never).toContain(NEVER_LINE_IN_APP);
    const wellbeing = NEEDS.find((n) => n.id === 'wellbeing')!;
    expect(wellbeing.directoryOnly).toBe(true);
    expect(wellbeing.kinds).toEqual([]);
    expect(NEVER).toMatch(/browsed/);
  });

  it('keeps the lists whole', () => {
    expect(EXPERIENCE).toHaveLength(7);
    expect(EXAMPLE).toHaveLength(20);
    expect(FILTERS).toHaveLength(12);
    expect(WORKFLOW.map((w) => w.step)).toEqual(['Browse', 'Save', 'Prepare', 'Request', 'Refer', 'Close']);
    expect(LEVELS.map((l) => l.level)).toEqual([0, 1, 2, 3, 4]);
    expect(PROMISE).toMatch(/privacy for help/);
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function render(): string {
  const have = CATEGORIES.filter(covered).length;
  const carried = RESOURCE_MODEL.filter((f) => f.carriedBy).length;
  return [
    '# Basic-Needs Navigator',
    '',
    '<!-- Rendered from app/src/lib/basicneeds.ts by basicneeds.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).',
    '',
    'A private, nonjudgmental, one-stop resource and action layer. The Hope Center',
    'describes comprehensive approaches as including central resource hubs, awareness',
    'of public benefits and regular assessment of needs; basic needs span more than',
    'food and housing — health care, technology, transportation, hygiene and child',
    'care. A filterable directory is a content and routing system, not a central',
    'database of student hardship.',
    '',
    `**${PROMISE}**`,
    '',
    '| Supplied document | What it holds |',
    '| --- | --- |',
    ...SOURCES.map((s) => `| [${s.title}](${s.path.replace(/^docs\//, '')}) | ${cell(s.what)} |`),
    '',
    '## What the app has today',
    '',
    '`app/src/lib/support.ts` is the map: care, basic needs, access, safety and the',
    'campus, every entry routing to an office, a national line or a screen, with its',
    'privacy level drawn before the link. `app/src/lib/help-routes.ts` sends a',
    'previewed request to an office and refuses to store one for wellbeing, money or',
    'accessibility. `app/src/lib/campusdirectory.ts` holds a school-imported',
    'departments-and-offices directory with hours and appointment details. Held by',
    '`app/src/lib/journey.guards.test.ts` and `app/src/lib/help-routes.test.ts`. What',
    'is missing is the resource object: an entry is an office pointer, not an',
    'institution-verified resource with eligibility, documents, cost, hours, language,',
    'accessibility, an owner and a review date.',
    '',
    '## Student experience',
    '',
    ...EXPERIENCE.map((e, i) => `${i + 1}. ${e}`),
    '',
    '## Categories',
    '',
    `${have} of ${CATEGORIES.length} route somewhere in the support directory today; the test reads the directory to say which.`,
    '',
    '| Category | Offices it routes to | In the directory |',
    '| --- | --- | --- |',
    ...CATEGORIES.map((c) => `| ${cell(c.name)} | ${c.offices.length ? c.offices.map((o) => `\`${o}\``).join(', ') : '—'} | ${covered(c) ? 'yes' : 'no'} |`),
    '',
    '## Resource object model',
    '',
    `Every resource needs an accountable owner and freshness controls. ${carried} of ${RESOURCE_MODEL.length} fields have somewhere to live on the app’s own types; the rest are the object model the navigator needs.`,
    '',
    '| Field | Carried by | Note |',
    '| --- | --- | --- |',
    ...RESOURCE_MODEL.map((f) => `| ${cell(f.field)} | ${f.carriedBy ? `\`${f.carriedBy.of}.${f.carriedBy.field}\`` : '**none**'} | ${cell(f.note)} |`),
    '',
    '### Directory schema, by example',
    '',
    '| Field | Example |',
    '| --- | --- |',
    ...EXAMPLE.map((e) => `| ${cell(e.field)} | ${cell(e.example)} |`),
    '',
    '### Student filters',
    '',
    ...FILTERS.map((f) => `- ${f}`),
    '',
    '## Privacy-preserving intake',
    '',
    'Default to resource discovery without personal disclosure. If a student wants a',
    'referral or an appointment, collect only what the designated owner needs.',
    '',
    ...LEVELS.map((l) => `- **Level ${l.level}.** ${l.what}`),
    '',
    `**${NEVER}** The support screen already prints “${NEVER_LINE_IN_APP}” and help-routes stores nothing for a wellbeing, money or accessibility look; the test holds both.`,
    '',
    '### Access workflow',
    '',
    '| Step | What it keeps private |',
    '| --- | --- |',
    ...WORKFLOW.map((w) => `| ${w.step} | ${cell(w.keeps)} |`),
    '',
    'Who may see what, module by module, is [`MODULE-PRIVACY-MODEL.md`](MODULE-PRIVACY-MODEL.md);',
    'the module’s place among the twenty-six services is',
    '[`SERVICE-EXPANSION-REGISTER.md`](SERVICE-EXPANSION-REGISTER.md#s01).',
    '',
  ].join('\n');
}
