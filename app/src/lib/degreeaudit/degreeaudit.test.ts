/// <reference types="node" />
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CORE_MODULES } from '@semester/contract';
import type { LedgerEntry } from '../record/ledger';
import { accepts, audit, inputsText, linesAsOf, tidy, type AuditResult, type Line, type ProgramInput } from './audit';
import { LIMITS, PROGRAM_STATES } from './model';
import {
  VERDICT_LABEL,
  VERDICT_TEXT,
  acceptsLine,
  asOfProblem,
  countedNowhere,
  courseLine,
  doubleCounted,
  fingerprint,
  notCounted,
  requirementLine,
  studentRefProblem,
  todayIso,
  unmetLine,
} from './views';

/**
 * The degree audit's rules, worked out from rows, and held to the migration.
 *
 * `20260930250000_degree_audit.sql` is the authority. Three kinds of test here:
 * the shared fixtures, which this file and `supabase/degree-audit.check.sql`
 * must both reproduce exactly, so the TypeScript twin and the SQL function
 * cannot drift apart; a parity block that reads the migration's text and holds
 * every limit, state and argument name in `model.ts` and `client.ts` equal to
 * it; and the pure functions on hand-built cases.
 */

const ROOT = join(__dirname, '..', '..', '..', '..');
const SQL = readFileSync(join(ROOT, 'supabase', 'migrations', '20260930250000_degree_audit.sql'), 'utf8');

interface Fixture {
  name: string;
  program: ProgramInput;
  lines: Line[];
  expected: { inputs_text: string; result: AuditResult };
}
const FIXTURES = JSON.parse(readFileSync(join(__dirname, 'fixtures.json'), 'utf8')) as Fixture[];

// ── The twin, held to the shared fixtures ───────────────────────────────

describe('the TypeScript audit and the SQL audit run the same fixtures', () => {
  // The control: the probe must be able to read the fixtures at all, and find
  // enough of them to be a test.
  it('reads the fixtures file and finds the cases the SQL suite also reads', () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(8);
    expect(new Set(FIXTURES.map((f) => f.name)).size).toBe(FIXTURES.length);
    expect(readFileSync(join(ROOT, 'supabase', 'degree-audit.check.sql'), 'utf8')).toContain('degreeaudit/fixtures.json');
  });

  it.each(FIXTURES.map((f) => [f.name, f] as const))('reproduces: %s', (_name, f) => {
    expect(audit(f.program, f.lines)).toEqual(f.expected.result);
    expect(inputsText(f.lines)).toBe(f.expected.inputs_text);
  });

  // The control: the comparison above is able to fail, so a pass is not vacuous.
  it('would notice a wrong answer', () => {
    const f = FIXTURES[1];
    const wrong = structuredClone(f.expected.result);
    wrong.requirements[0].have += 1;
    expect(audit(f.program, f.lines)).not.toEqual(wrong);
    const swapped = { ...f.program, passing_grades: ['A'] };
    expect(audit(swapped, f.lines)).not.toEqual(f.expected.result);
  });

  it('covers every state and reason the audit can give', () => {
    const states = new Set<string>();
    const reasons = new Set<string>();
    const verdicts = new Set<string>();
    const whys = new Set<string>();
    for (const f of FIXTURES) {
      verdicts.add(f.expected.result.verdict);
      for (const c of f.expected.result.courses) {
        states.add(c.state);
        if (c.reason) reasons.add(c.reason);
      }
      for (const q of f.expected.result.requirements) for (const u of q.unmet_grade) whys.add(u.why);
    }
    expect([...states].sort()).toEqual(['done', 'in_progress', 'not_counted']);
    expect([...reasons].sort()).toEqual(['grade_not_passing', 'hours_unreadable', 'no_course_code', 'no_grade_or_enrollment']);
    expect([...verdicts].sort()).toEqual(['complete', 'complete_if_in_progress_passes', 'incomplete']);
    expect([...whys].sort()).toEqual(['below_minimum', 'no_grade']);
  });

  it('digests the inputs the way the database does: SHA-256 of the canonical text', () => {
    const f = FIXTURES[1];
    const sha = createHash('sha256').update(inputsText(f.lines), 'utf8').digest('hex');
    expect(sha).toMatch(/^[0-9a-f]{64}$/);
    // Order of the lines given does not change the digest; a changed value does.
    expect(createHash('sha256').update(inputsText([...f.lines].reverse()), 'utf8').digest('hex')).toBe(sha);
    const edited = f.lines.map((l, i) => (i === 0 ? { ...l, value: l.value + 'x' } : l));
    expect(createHash('sha256').update(inputsText(edited), 'utf8').digest('hex')).not.toBe(sha);
  });
});

// ── Parity with the migration ──────────────────────────────────────────

describe('the migration and the client say the same thing', () => {
  // The control: the probe must be able to read this file at all.
  it('can read the migration and find what it is looking for', () => {
    expect(SQL.length).toBeGreaterThan(10000);
    expect(SQL).toContain('create table if not exists public.degree_programs');
    expect(SQL).not.toContain('create table if not exists public.no_such_table_zz');
  });

  it('holds every limit equal', () => {
    expect(SQL).toContain(`length(btrim(title)) between 1 and ${LIMITS.title}`);
    expect(SQL).toContain(`length(btrim(name)) between 1 and ${LIMITS.requirementName}`);
    expect(SQL).toContain(`{0,${LIMITS.code - 1}}$'`);
    expect(SQL).toContain(`cardinality(passing_grades) between 1 and ${LIMITS.passingGradesMax}`);
    expect(SQL).toContain(`{1,${LIMITS.gradeLength}}$'`);
    expect(SQL).toContain(`>= ${LIMITS.requirementsMax} then`);
    expect(SQL).toContain(`cardinality(accepts) <= ${LIMITS.acceptsMax}`);
  });

  it('holds the states and the operation kinds equal', () => {
    expect(SQL).toContain(`state in (${PROGRAM_STATES.map((s) => `'${s}'`).join(', ')})`);
    expect(SQL).toContain("kind in ('create_program', 'add_requirement', 'publish', 'retire', 'run_audit')");
    expect(SQL).toContain("verdict in ('complete', 'complete_if_in_progress_passes', 'incomplete')");
    expect(SQL).toContain("need in ('courses', 'hours')");
  });

  it('is the module the registry calls degree_audit, and the kinds of ledger entry the twin reads', () => {
    expect(CORE_MODULES).toContain('degree_audit');
    expect(SQL).toContain("e.module = 'degree_audit'");
    expect(SQL).toContain("e.kind in ('enrollment', 'grade', 'credit', 'transfer_credit')");
  });

  it('names the two capabilities and who holds them', () => {
    expect(SQL).toContain("('registrar',        'degree:author')");
    expect(SQL).toContain("('dean',             'degree:author')");
    expect(SQL).toContain("('registrar',        'degree:audit')");
    expect(SQL).toContain("('dean',             'degree:audit')");
    expect(SQL).toContain("('academic_advisor', 'degree:audit')");
  });

  // Every RPC's argument names, read out of the function signature.
  const signature = (name: string): string[] => {
    const m = new RegExp(`create or replace function public\\.${name}\\(([^)]*)\\)`, 's').exec(SQL);
    if (!m) throw new Error(`no function ${name}`);
    return [...m[1].matchAll(/want_[a-z_]+/g)].map((x) => x[0]);
  };

  it('has the RPCs the client calls, with the arguments it sends', () => {
    expect(signature('degree_program_create')).toEqual(['want_code', 'want_title', 'want_catalog_year', 'want_passing', 'want_copy_from', 'want_key']);
    expect(signature('degree_requirement_add')).toEqual(['want_program', 'want_name', 'want_need', 'want_count', 'want_accepts', 'want_min_grade', 'want_key']);
    expect(signature('degree_program_publish')).toEqual(['want_program', 'want_key']);
    expect(signature('degree_program_retire')).toEqual(['want_program', 'want_key']);
    expect(signature('degree_audit_run')).toEqual(['want_program', 'want_student_ref', 'want_as_of', 'want_key']);
  });

  it('reads every kept column the client selects', () => {
    for (const col of ['student_ref', 'program_id', 'program_code', 'program_title', 'catalog_year', 'program_version', 'as_of', 'requested_by', 'requested_at', 'inputs_sha256', 'inputs_count', 'verdict', 'result']) {
      expect(SQL, col).toMatch(new RegExp(`^  ${col}\\s`, 'm'));
    }
  });
});

// ── The rules, worked by hand ─────────────────────────────────────────

describe('which course a requirement accepts', () => {
  it('takes anything when it lists nothing', () => {
    expect(accepts([], 'ECON 1010')).toBe(true);
  });
  it('takes an exact code, and a bare uppercase prefix only at a word boundary', () => {
    expect(accepts(['ECON'], 'ECON 1010')).toBe(true);
    expect(accepts(['ECON'], 'ECONOMICS 1000')).toBe(false);
    expect(accepts(['ECON 1010'], 'ECON 1010')).toBe(true);
    expect(accepts(['ECON 1010'], 'ECON 10101')).toBe(false);
    // A code with digits is not a prefix: "ECON 10" does not take "ECON 1010".
    expect(accepts(['ECON 10'], 'ECON 1010')).toBe(false);
  });
  it('tidies a code the way the database does', () => {
    expect(tidy('  econ   1010 ')).toBe('ECON 1010');
  });
});

describe('what the audit does with a record', () => {
  const PASS = ['A', 'B', 'C'];
  const line = (kind: Line['kind'], key: string, value: string, id: string): Line => ({ kind, key, value, effective_on: '2026-01-01', id });
  const one = (reqs: ProgramInput['requirements'], lines: Line[]): AuditResult => audit({ passing_grades: PASS, requirements: reqs }, lines);
  const req = (over: Partial<ProgramInput['requirements'][number]> = {}): ProgramInput['requirements'][number] => ({
    sort: 1, name: 'R', need: 'courses', count: 1, accepts: [], min_grade: null, ...over,
  });

  it('never counts work in progress as done, and reports the two apart', () => {
    const r = one([req({ count: 2 })], [line('grade', 'ECON 1 · F', 'A', 'a'), line('enrollment', 'ECON 2 · F', 'Enrolled', 'b')]).requirements[0];
    expect([r.have, r.will_have, r.left, r.met, r.meets_after]).toEqual([1, 2, 0, false, true]);
  });

  it('needs the school’s own list to say a grade passes: an unlisted grade is not counted', () => {
    const r = one([req()], [line('grade', 'ECON 1 · F', 'D', 'a')]);
    expect(r.requirements[0].have).toBe(0);
    expect(r.courses[0]).toMatchObject({ state: 'not_counted', reason: 'grade_not_passing' });
  });

  it('keeps hours exact where a double would not', () => {
    const lines = [0.1, 0.2, 0.7].flatMap((h, i) => [line('grade', `X ${i} · F`, 'A', `g${i}`), line('credit', `X ${i} · F`, String(h), `c${i}`)]);
    expect(one([req({ need: 'hours', count: 1 })], lines).requirements[0]).toMatchObject({ have: 1, met: true, left: 0 });
  });

  it('refuses two lines for one kind and key rather than choose between them', () => {
    expect(() => one([req()], [line('grade', 'X 1 · F', 'A', 'a'), line('grade', 'X 1 · F', 'B', 'b')])).toThrow(/one ledger line/);
  });

  it('refuses a minimum grade the program does not list rather than ignore it', () => {
    expect(() => one([req({ min_grade: 'A+' })], [])).toThrow(/passing grades/);
  });

  it('gives no verdict of complete to a program with no requirements', () => {
    expect(one([], [line('grade', 'X 1 · F', 'A', 'a')]).verdict).toBe('incomplete');
  });

  it('counts a course taken twice twice, which is the school’s rule to change and is listed so it can be seen', () => {
    const r = one([req({ count: 2, accepts: ['X 1'] })], [line('grade', 'X 1 · F25', 'A', 'a'), line('grade', 'X 1 · S26', 'B', 'b')]);
    expect(r.requirements[0].done.map((i) => i.key)).toEqual(['X 1 · F25', 'X 1 · S26']);
  });
});

// ── The ledger, read as of a date ────────────────────────────────────

let seq = 0;
const entry = (kind: LedgerEntry['kind'], key: string, value: string, eff: string, over: Partial<LedgerEntry> = {}): LedgerEntry => ({
  id: `e${String(++seq).padStart(4, '0')}`, tenant_id: 't', student_ref: 'S1', kind, subject_key: key,
  action: 'set', value, previous_value: null, previous_entry_id: null, effective_on: eff, reason: 'x'.repeat(10), source: 'registrar',
  change_id: `c${seq}`, proposed_by: null, approved_by: null, override: false, recorded_at: `2026-01-01T00:00:${String(seq % 60).padStart(2, '0')}Z`, ...over,
});

describe('the record as the audit reads it on a date', () => {
  const ledger: LedgerEntry[] = [
    entry('grade', 'ECON 2010 · S26', 'B', '2026-05-15'),
    entry('grade', 'ECON 2010 · S26', 'A-', '2026-06-01'),
    entry('grade', 'PSCI 2100 · F25', 'A', '2025-12-18'),
    entry('grade', 'PSCI 2100 · F25', '', '2026-01-10', { action: 'void' }),
    entry('enrollment', 'HIST 1100 · F26', 'Enrolled', '2026-08-20'),
    entry('grade', 'ECON 3000 · F27', 'A', '2999-01-01'),
    // Kinds the audit does not read.
    entry('standing', 'Fall 2026', 'Good standing', '2026-08-20'),
    entry('conferral', 'B.A. Economics', 'Conferred', '2026-05-30'),
    entry('requirement', 'Writing-intensive', 'Met', '2026-05-30'),
  ];
  const keys = (on: string): string[] => linesAsOf(ledger, on).map((l) => `${l.kind}|${l.key}|${l.value}`);

  it('takes the latest entry in effect for each key, a correction counting from its own date', () => {
    expect(keys('2026-05-20')).toContain('grade|ECON 2010 · S26|B');
    expect(keys('2026-09-01')).toContain('grade|ECON 2010 · S26|A-');
  });
  it('drops a key whose latest entry in effect is a removal', () => {
    expect(keys('2025-12-31')).toContain('grade|PSCI 2100 · F25|A');
    expect(keys('2026-09-01').some((k) => k.includes('PSCI 2100'))).toBe(false);
  });
  it('does not read an entry that is not yet effective', () => {
    expect(keys('2026-09-01').some((k) => k.includes('ECON 3000'))).toBe(false);
  });
  it('reads only the four kinds: standing, conferral and requirement entries are not audit inputs', () => {
    expect(keys('2026-09-01').filter((k) => /^(standing|conferral|requirement)\|/.test(k))).toEqual([]);
    expect(keys('2026-09-01')).toEqual(['enrollment|HIST 1100 · F26|Enrolled', 'grade|ECON 2010 · S26|A-']);
  });
  // The control: the probe sees lines at all, so an empty answer above means something.
  it('does find lines on a date that has some', () => {
    expect(linesAsOf(ledger, '2999-12-31').length).toBe(3);
  });
});

// ── What a screen says ─────────────────────────────────────────────

describe('what a kept audit is said as', () => {
  const r = FIXTURES[2].expected.result;

  it('says finished and in progress apart, with the unit agreeing with what is needed', () => {
    expect(requirementLine(r.requirements[0])).toBe('1 of 2 courses finished, and 1 in progress would cover the rest.');
    expect(requirementLine(r.requirements[1])).toBe('3 of 6 hours finished, and 3 in progress would cover the rest.');
    expect(requirementLine({ ...r.requirements[0], met: true, have: 2 })).toBe('Met: 2 of 2 courses finished.');
    expect(requirementLine({ ...r.requirements[0], count: 1, have: 0, will_have: 0, left: 1, meets_after: false })).toBe('0 of 1 course finished. 1 still to find.');
  });

  it('never rolls the in-progress work into the finished figure', () => {
    expect(requirementLine(r.requirements[0])).not.toMatch(/2 of 2/);
  });

  it('says what a requirement accepts and the minimum grade', () => {
    expect(acceptsLine({ ...r.requirements[0], accepts: [], min_grade: null })).toBe('Any course');
    expect(acceptsLine({ ...r.requirements[0], accepts: ['ECON'], min_grade: 'C' })).toBe('ECON, with a grade of C or better');
  });

  it('describes a course by its key, grade and hours, and says when hours are not on the record', () => {
    expect(courseLine({ key: 'ECON 1010 · F25', code: 'ECON 1010', term: 'F25', source: 'course', grade: 'B+', hours: 3 })).toBe('ECON 1010 · F25: grade B+, 3 hours');
    expect(courseLine({ key: 'ECON 1010 · F25', code: 'ECON 1010', term: 'F25', source: 'course', grade: 'B+', hours: null })).toBe('ECON 1010 · F25: grade B+, hours not on the record');
    expect(courseLine({ key: 'X 1 · Y', code: 'X 1', term: 'Y', source: 'transfer', grade: null, hours: 1 })).toBe('X 1 · Y: transfer credit, 1 hour');
  });

  it('states double counting and the courses that counted nowhere, from the kept result', () => {
    const four = FIXTURES[3].expected.result;
    expect(doubleCounted(four.courses).map((c) => c.key)).toContain('ECON 2010 · Spring 2026');
    expect(countedNowhere(four.courses).map((c) => c.key)).toEqual([]);
    expect(notCounted(four.courses).map((c) => c.key)).toEqual(['ART 1000 · Fall 2024', 'MATH 1000 · Fall 2024']);
    expect(unmetLine({ ...four.requirements[0].unmet_grade[0] }, 'C')).toContain('transfer credit has no grade');
  });

  it('keeps the three verdicts distinct, and never says a degree is conferred', () => {
    expect(new Set(Object.values(VERDICT_TEXT)).size).toBe(3);
    expect(new Set(Object.values(VERDICT_LABEL)).size).toBe(3);
    for (const t of Object.values(VERDICT_TEXT)) expect(t).not.toMatch(/conferred|awarded|graduat/i);
  });

  it('shortens the digest for a person to compare', () => {
    expect(fingerprint('0123456789abcdef'.repeat(4))).toBe('0123456789ab');
  });
});

describe('what a form asks before it asks the database', () => {
  it('refuses a date after today, as the database does, and a malformed one', () => {
    expect(asOfProblem('2026-10-02', '2026-10-01')).toMatch(/never a later one/);
    expect(asOfProblem('2026-10-01', '2026-10-01')).toBeNull();
    expect(asOfProblem('2026-09-30', '2026-10-01')).toBeNull();
    expect(asOfProblem('', '2026-10-01')).toMatch(/Give the date/);
    expect(asOfProblem('2026-13-45', '2026-10-01')).toMatch(/Give the date/);
    expect(asOfProblem('1850-01-01', '2026-10-01')).toMatch(/not a date/);
  });
  it('holds a student reference to the ledger’s own pattern', () => {
    expect(studentRefProblem('S100')).toBeNull();
    expect(studentRefProblem('  ')).toMatch(/Give the student/);
    expect(studentRefProblem('S1 00')).toMatch(/letters, digits/);
    expect(studentRefProblem('x'.repeat(65))).toMatch(/letters, digits/);
  });
  it('writes today in the caller’s own calendar', () => {
    expect(todayIso(new Date(2026, 9, 1, 23, 59))).toBe('2026-10-01');
    expect(todayIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
