import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONTENT_READINESS,
  LAUNCH_PACKAGE,
  NOT_A_PERSON,
  namedPerson,
  packageProblems,
  readinessProblems,
  type ReadinessRecord,
} from './content';

/**
 * The launch content registers, held to the schema they borrow from and to
 * the documents that carry them. Each rule has a control beside it, because a
 * check that passes an empty register passes everything.
 */

const root = join(import.meta.dirname, '../../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const exists = (p: string) => existsSync(join(root, p));
const quoted = (s: string) => [...s.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

describe('content readiness', () => {
  it('has the thirteen items, each with a source, owner, review, visibility, expiry and correction', () => {
    expect(CONTENT_READINESS).toHaveLength(13);
    expect(new Set(CONTENT_READINESS.map((c) => c.id)).size).toBe(13);
    for (const c of CONTENT_READINESS) {
      expect(c.sources.length, c.id).toBeGreaterThan(0);
      expect(c.correction.length, c.id).toBeGreaterThan(0);
      expect(c.appearsOn.length, c.id).toBeGreaterThan(0);
      expect(c.reviewEveryDays, c.id).toBeGreaterThan(0);
      expect(c.expires.trim(), c.id).not.toBe('');
    }
  });

  it('lets only degree content go out as a labelled estimate — never safety, policy or contacts', () => {
    expect(CONTENT_READINESS.filter((c) => c.estimateAllowed).map((c) => c.id)).toEqual(['programs_degrees']);
  });

  it('names only source types the source_records table accepts', () => {
    const sql = read('supabase/migrations/20260927170000_integration_control_plane.sql');
    const accepted = quoted(/source_type\s+text\s+not null check \(source_type in \(([\s\S]*?)\)\)/.exec(sql)![1]);
    expect(accepted).toContain('manual_admin'); // the control: the parse found the list
    for (const c of CONTENT_READINESS) for (const s of c.sources) expect(accepted, c.id).toContain(s);
  });

  it('refuses the same non-people the steward table refuses in SQL', () => {
    const sql = read('supabase/migrations/20260927235000_governance_registries.sql');
    const pattern = /trim\(person_name\) !~\* '\^\(([^)]*)\)\$'/.exec(sql)![1];
    expect(NOT_A_PERSON.source.replaceAll('\\/', '/')).toBe(`^(${pattern})$`);
    expect(namedPerson('Maria Chen')).toBe(true);
    for (const bad of ['TBD', 'office', 'registrar@school.edu', ' n/a ', 'x']) expect(namedPerson(bad), bad).toBe(false);
  });

  const ready = (over: Partial<ReadinessRecord> = {}): ReadinessRecord => ({
    item: 'academic_calendar', status: 'READY', owner: 'Maria Chen',
    source: 'https://registrar.example.edu/calendar', reviewed: '2026-09-01', estimate: false, ...over,
  });

  it('calls a complete, current row ready, and holds an unfinished one to nothing', () => {
    expect(readinessProblems(ready(), '2026-09-27')).toEqual([]);
    expect(readinessProblems(ready({ status: 'NOT_STARTED', owner: '—', source: '—', reviewed: '—' }), '2026-09-27')).toEqual([]);
  });

  it('refuses a READY row with an inbox owner, a plain-http source, an old review or a forbidden estimate (controls)', () => {
    expect(readinessProblems(ready({ owner: 'Office' }), '2026-09-27').join()).toMatch(/named person/);
    expect(readinessProblems(ready({ source: 'http://registrar.example.edu' }), '2026-09-27').join()).toMatch(/https/);
    expect(readinessProblems(ready({ reviewed: '2026-01-01' }), '2026-09-27').join()).toMatch(/overdue/);
    expect(readinessProblems(ready({ item: 'emergency_safety', estimate: true }), '2026-09-27').join()).toMatch(/estimate/);
    expect(readinessProblems(ready({ item: 'programs_degrees', estimate: true }), '2026-09-27')).toEqual([]);
    expect(readinessProblems(ready({ reviewed: '2027-01-01' }), '2026-09-27').join()).toMatch(/after today/);
    expect(readinessProblems(ready({ source: 'docs/evidence/missing.md' }), '2026-09-27', () => false).join()).toMatch(/not filed/);
    expect(readinessProblems(ready({ source: 'docs/evidence/calendar.md' }), '2026-09-27', () => true)).toEqual([]);
  });

  it('has a register row for every item, and no READY row that fails its rules', () => {
    const rows = read('docs/launch/CONTENT-READINESS-REGISTER.md')
      .split('\n')
      .filter((l) => /^\| [a-z_]+ \| /.test(l))
      .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
      .map(([item, status, owner, source, reviewed, estimate]) => ({ item, status, owner, source, reviewed, estimate }));
    // The column is exactly yes or no. Anything else would read as "no" and
    // let a forbidden estimate through.
    for (const r of rows) expect(['yes', 'no'], `${r.item} estimate "${r.estimate}"`).toContain(r.estimate);
    expect(rows.map((r) => r.item)).toEqual(CONTENT_READINESS.map((c) => c.id));
    for (const r of rows) {
      expect(['NOT_STARTED', 'IN_PROGRESS', 'READY'], r.item).toContain(r.status);
      expect(readinessProblems({ ...r, status: r.status as ReadinessRecord['status'], estimate: r.estimate === 'yes' }, new Date().toISOString().slice(0, 10), exists), r.item).toEqual([]);
    }
  });
});

describe('the launch package', () => {
  it('has the seventeen items, and every status is honest about its file', () => {
    expect(LAUNCH_PACKAGE).toHaveLength(17);
    const problems = LAUNCH_PACKAGE.flatMap((p) => packageProblems(p, exists));
    expect(problems).toEqual([]);
  });

  it('would notice a READY item with no file, a missing file, and a NOT_STARTED stub (controls)', () => {
    const p = LAUNCH_PACKAGE[0];
    expect(packageProblems({ ...p, path: undefined }, exists).join()).toMatch(/no file/);
    expect(packageProblems({ ...p, path: 'docs/launch/NOPE.md' }, exists).join()).toMatch(/does not exist/);
    expect(packageProblems({ ...p, status: 'NOT_STARTED' }, exists).join()).toMatch(/NOT_STARTED but points/);
  });

  it('is listed in full in the index document, with the content items', () => {
    const index = read('docs/LAUNCH-CONTENT-AND-TRAINING.md');
    for (const p of LAUNCH_PACKAGE) expect(index, p.id).toContain(`| ${p.title} | ${p.status} |`);
    for (const c of CONTENT_READINESS) expect(index, c.id).toContain(`| ${c.id} | ${c.owner} |`);
  });
});

/**
 * The accessibility and claims checks every written launch guide passes. They
 * are structural — a person still has to read each one — but they are the
 * mistakes that reach a screen reader or a procurement office first.
 */
function guideProblems(text: string): string[] {
  const out: string[] = [];
  const lines = text.split('\n');
  const headings = lines.filter((l) => /^#{1,6} /.test(l)).map((l) => /^(#+)/.exec(l)![1].length);
  if (!/^# \S/.test(lines[0] ?? '')) out.push('does not open with its title');
  if (headings.filter((h) => h === 1).length !== 1) out.push('has more or fewer than one title');
  for (let i = 1; i < headings.length; i++) if (headings[i] > headings[i - 1] + 1) out.push(`skips a heading level (h${headings[i - 1]} to h${headings[i]})`);
  for (const m of text.matchAll(/(?<!!)\[([^\]]*)\]\(/g)) if (/^\s*(here|click here|this|link|more|read more)\s*$/i.test(m[1])) out.push(`link text "${m[1]}" says nothing on its own`);
  for (const m of text.matchAll(/!\[([^\]]*)\]\(/g)) if (!m[1].trim()) out.push('an image has no alt text');
  const claims = /\b(FERPA|COPPA|HIPAA|WCAG[\s\d.]*A{1,3}|Section 508|SOC ?2|HECVAT|VPAT|ISO ?27001|LTI)[- ](compliant|certified|conformant|approved)\b|\bfully (accessible|compliant|secure)\b|\b100% (secure|accurate|private)\b|\bguarantee/i;
  const hit = claims.exec(text);
  if (hit) out.push(`makes an unsupported claim: "${hit[0]}"`);
  return out;
}

describe('every written launch guide', () => {
  const written = LAUNCH_PACKAGE.filter((p) => p.path?.startsWith('docs/launch/')).map((p) => p.path!);
  const all = [...new Set([...written, 'docs/launch/CONTENT-READINESS-REGISTER.md', 'docs/LAUNCH-CONTENT-AND-TRAINING.md', 'docs/90-DAY-LAUNCH-PROGRAM.md'])];

  it('checks at least the six guides this phase wrote — the control for the loop below', () => {
    expect(written.length).toBeGreaterThanOrEqual(6);
  });

  it.each(all)('%s passes the accessibility and claims checks', (path) => {
    expect(guideProblems(read(path))).toEqual([]);
  });

  it('would catch a skipped level, empty alt text, "click here" and a compliance claim (controls)', () => {
    expect(guideProblems('# T\n\n### Skipped').join()).toMatch(/skips/);
    expect(guideProblems('# T\n\n![](x.png)').join()).toMatch(/alt text/);
    expect(guideProblems('# T\n\n[click here](x)').join()).toMatch(/says nothing/);
    expect(guideProblems('# T\n\nSemester is FERPA-compliant.').join()).toMatch(/unsupported claim/);
    expect(guideProblems('# T\n\n## A\n\n### B\n\n[the quick-start guide](x)')).toEqual([]);
  });
});

describe('the announcement templates', () => {
  const text = read('docs/launch/ANNOUNCEMENT-TEMPLATES.md');
  const declared = [...text.matchAll(/^\| `\{\{(\w+)\}\}` \|/gm)].map((m) => m[1]);
  const sections = text.split(/^## Template: /m).slice(1).map((s) => ({ name: s.split('\n')[0], body: s }));

  it('uses only the placeholders it declares, and declares none it does not use', () => {
    expect(declared.length).toBeGreaterThanOrEqual(5);
    const used = new Set(sections.flatMap((s) => [...s.body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])));
    expect([...used].sort()).toEqual([...declared].sort());
  });

  it('tells students, in every template they receive, that taking part is optional and grades are unaffected', () => {
    const toStudents = sections.filter((s) => !/faculty/i.test(s.name));
    expect(toStudents.length).toBeGreaterThanOrEqual(3);
    for (const s of toStudents) {
      if (/paused/i.test(s.name)) expect(s.body, s.name).toMatch(/grades or standing is affected/);
      else {
        expect(s.body, s.name).toMatch(/optional/);
        expect(s.body, s.name).toMatch(/no effect on (your )?grades/);
      }
    }
  });
});
