import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APPROVAL_AREAS, CLASSIFICATIONS, DOMAINS, DUPLICATE_RULES, GATE_TEXT, RUN_KINDS, STAGES, STAGE_DOES, STAGE_LABEL, STAGE_RUN, TRANSFORMS,
  canGoBack, gateFailures, mapsEditable, nextStage, parseTable, passes, preview, reconcile, sha256, transform,
  type FieldMap, type MigrationApproval, type MigrationProject, type MigrationRun, type RunCounts,
} from './center';

/**
 * Holds the Migration Center's rules to the migration that enforces them —
 * every vocabulary word for word, every gate code the screen can show to the
 * one the database raises — and its arithmetic to cases worked by hand.
 */

const root = join(import.meta.dirname, '../../../..');
const SQL = readFileSync(join(root, 'supabase/migrations/20260929200000_migration_center.sql'), 'utf8');

/** The quoted words in the first `in (...)` or `array[...]` after a marker. */
function words(after: string, open: '(' | '['): string[] {
  const at = SQL.indexOf(after);
  if (at < 0) throw new Error(`no ${after}`);
  const start = SQL.indexOf(open, at + after.length - 1);
  const end = SQL.indexOf(open === '(' ? ')' : ']', start);
  return [...SQL.slice(start, end).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

const T0 = '2026-10-01T00:00:00.000Z';
const at = (min: number) => new Date(Date.parse(T0) + min * 60_000).toISOString();

function project(over: Partial<MigrationProject> = {}): MigrationProject {
  return {
    id: 'p1', tenant_id: 'u', name: 'Retire the legacy gradebook', domain: 'lms',
    source_platform: '', source_version: '', data_owner: '', classifications: [], retention: '', historical_cutoff: null,
    duplicate_rule: null, cutover_date: null, rollback_plan: '', archive_location: '', required_approvals: ['data_owner', 'it'],
    parallel_runs_required: 2, stage: 'inventory', stage_entered_at: T0, created_by: 'lead', created_at: T0, ...over,
  };
}

const counts = (c: Partial<RunCounts>): RunCounts => ({ rows_in: 0, rows_ok: 0, rows_failed: 0, rows_missing: 0, rows_extra: 0, rows_differing: 0, ...c });
function run(kind: MigrationRun['kind'], stage: MigrationRun['stage'], minute: number, c: Partial<RunCounts>, period = ''): MigrationRun {
  const k = counts(c);
  return { ...k, kind, stage, period_label: period, sample_sha256: 'a'.repeat(64), passed: passes(kind, k), recorded_by: 'lead', recorded_at: at(minute) };
}
const approval = (area: MigrationApproval['area'], decision: MigrationApproval['decision'], minute: number): MigrationApproval =>
  ({ area, decision, approver_id: 'reg', note: '', recorded_at: at(minute) });

const MAPS: FieldMap[] = [
  { source_field: 'Student ID', target_field: 'student_ref', transform: 'trim', required: true, is_key: true },
  { source_field: 'Email', target_field: 'email', transform: 'email', required: false, is_key: false },
  { source_field: 'Final Grade', target_field: 'final_grade', transform: 'uppercase', required: true, is_key: false },
  { source_field: 'Posted', target_field: 'posted_on', transform: 'date_iso', required: false, is_key: false },
];

describe('the Migration Center, held to its migration', () => {
  it('has every vocabulary the database checks, word for word', () => {
    expect(words('stage                  text        not null default', '(')).toEqual([...STAGES]);
    expect(words("select array_position(array[", '[')).toEqual([...STAGES]);
    expect(words('domain                 text        not null check (domain in', '(')).toEqual([...DOMAINS]);
    expect(words('classifications <@ array', '[')).toEqual([...CLASSIFICATIONS]);
    expect(words('required_approvals <@ array', '[')).toEqual([...APPROVAL_AREAS]);
    expect(words("area         text        not null check (area in", '(')).toEqual([...APPROVAL_AREAS]);
    expect(words("kind            text        not null check (kind in", '(')).toEqual([...RUN_KINDS]);
    expect(words("transform     text        not null default 'trim' check (transform in", '(')).toEqual([...TRANSFORMS]);
    expect(words('duplicate_rule         text        check (duplicate_rule in', '(')).toEqual([...DUPLICATE_RULES]);
  });

  it('names and explains every stage, and every gate code the database can raise is one the screen can say', () => {
    for (const s of STAGES) {
      expect(STAGE_LABEL[s], s).toBeTruthy();
      expect(STAGE_DOES[s], s).toMatch(/\.$/);
    }
    const raised = [...SQL.matchAll(/array_append\(out, '([a-z_]+)'\)/g)].map((m) => m[1]);
    expect(new Set(raised)).toEqual(new Set(Object.keys(GATE_TEXT)));
    // The stages whose gate is a run of their own name, in both places.
    for (const [stage, kind] of Object.entries(STAGE_RUN)) expect(kind, stage).toBe(stage);
    expect(SQL).toMatch(/r\.kind = p\.stage/);
  });

  it('moves forward one stage at a time, back only until cutover, and fixes the mapping after cleaning', () => {
    expect(nextStage('inventory')).toBe('classification');
    expect(nextStage('monitoring')).toBeNull();
    expect(canGoBack('inventory')).toBe(false);
    expect(canGoBack('cutover')).toBe(true);
    expect(canGoBack('archive')).toBe(false);
    expect(mapsEditable('cleaning')).toBe(true);
    expect(mapsEditable('preview')).toBe(false);
    expect(SQL).toMatch(/if from_i > private\.migration_stage_index\('cutover'\) then/);
    expect(SQL).toMatch(/private\.migration_stage_index\(s\) > private\.migration_stage_index\('cleaning'\)/);
  });
});

describe('the gates', () => {
  it('asks inventory, classification, mapping and cleaning for what the brief says each migration records', () => {
    expect(gateFailures(project(), [], [], [])).toEqual(['source_platform', 'source_version', 'data_owner']);
    expect(gateFailures(project({ source_platform: 'Legacy', source_version: '1', data_owner: 'Registrar' }), [], [], [])).toEqual([]);
    expect(gateFailures(project({ stage: 'classification' }), [], [], [])).toEqual(['classifications', 'retention', 'historical_cutoff']);
    expect(gateFailures(project({ stage: 'mapping' }), [], [], [])).toEqual(['field_map', 'key_field']);
    expect(gateFailures(project({ stage: 'mapping' }), [{ ...MAPS[1] }], [], [])).toEqual(['key_field']);
    expect(gateFailures(project({ stage: 'mapping' }), MAPS, [], [])).toEqual([]);
    expect(gateFailures(project({ stage: 'cleaning' }), MAPS, [], [])).toEqual(['duplicate_rule']);
    expect(gateFailures(project({ stage: 'cleaning', duplicate_rule: 'keep_first' }), MAPS, [], [])).toEqual([]);
  });

  it('counts only evidence recorded in this stage since the migration last entered it', () => {
    const p = project({ stage: 'validation', stage_entered_at: at(10) });
    const before = run('validation', 'validation', 5, { rows_in: 100, rows_ok: 100 });
    const elsewhere = run('validation', 'reconciliation', 12, { rows_in: 100, rows_ok: 100 });
    expect(gateFailures(p, MAPS, [before, elsewhere], [])).toEqual(['validation_passed']);
    const now = run('validation', 'validation', 11, { rows_in: 100, rows_ok: 100 });
    expect(gateFailures(p, MAPS, [before, now], [])).toEqual([]);
    const worse = run('validation', 'validation', 12, { rows_in: 100, rows_ok: 97, rows_failed: 3 });
    expect(gateFailures(p, MAPS, [now, worse], []), 'the latest run decides').toEqual(['validation_passed']);
  });

  it('needs enough distinct passing parallel-run periods, the latest passing', () => {
    const p = project({ stage: 'parallel_run' });
    const w1 = run('parallel_run', 'parallel_run', 1, { rows_in: 50, rows_ok: 50 }, 'Week 1');
    const w1again = run('parallel_run', 'parallel_run', 2, { rows_in: 50, rows_ok: 50 }, ' week 1');
    expect(gateFailures(p, MAPS, [w1, w1again], [])).toEqual(['parallel_runs']);
    const w2 = run('parallel_run', 'parallel_run', 3, { rows_in: 50, rows_ok: 50 }, 'Week 2');
    expect(gateFailures(p, MAPS, [w1, w1again, w2], [])).toEqual([]);
    const w3 = run('parallel_run', 'parallel_run', 4, { rows_in: 50, rows_ok: 46, rows_differing: 4 }, 'Week 3');
    expect(gateFailures(p, MAPS, [w1, w2, w3], [])).toEqual(['parallel_runs']);
  });

  it('holds cutover to a date, a rollback plan and the latest decision in every required area', () => {
    const p = project({ stage: 'cutover', stage_entered_at: at(0) });
    expect(gateFailures(p, MAPS, [], [])).toEqual(['cutover_date', 'rollback_plan', 'approvals']);
    const ready = { ...p, cutover_date: '2027-01-04', rollback_plan: 'Re-enable the legacy system.' };
    expect(gateFailures(ready, MAPS, [], [approval('data_owner', 'approved', 1)])).toEqual(['approvals']);
    expect(gateFailures(ready, MAPS, [], [approval('data_owner', 'approved', 1), approval('it', 'rejected', 2)])).toEqual(['approvals', 'rejected']);
    expect(gateFailures(ready, MAPS, [], [approval('data_owner', 'approved', 1), approval('it', 'rejected', 2), approval('it', 'approved', 3)])).toEqual([]);
    expect(gateFailures(ready, MAPS, [], [approval('data_owner', 'approved', 1), approval('it', 'approved', 2), approval('it', 'rejected', 3)]), 'a later rejection wins').toEqual(['approvals', 'rejected']);
    const reentered = { ...ready, stage_entered_at: at(10) };
    expect(gateFailures(reentered, MAPS, [], [approval('data_owner', 'approved', 1), approval('it', 'approved', 2)]), 'approvals from before re-entering do not count').toEqual(['approvals']);
  });

  it('ends at monitoring', () => {
    expect(gateFailures(project({ stage: 'archive' }), MAPS, [], [])).toEqual(['archive_location']);
    expect(gateFailures(project({ stage: 'monitoring' }), MAPS, [], [])).toEqual(['terminal']);
  });

  it('computes passed the way the generated column does', () => {
    expect(passes('preview', counts({}))).toBe(false);
    expect(passes('sample_import', counts({ rows_in: 10, rows_failed: 4 }))).toBe(true);
    expect(passes('validation', counts({ rows_in: 10, rows_failed: 1 }))).toBe(false);
    expect(passes('reconciliation', counts({ rows_in: 10, rows_extra: 1 }))).toBe(false);
    expect(passes('parallel_run', counts({ rows_in: 10, rows_ok: 10 }))).toBe(true);
    expect(SQL).toMatch(/when kind = 'validation' then rows_failed = 0/);
    expect(SQL).toMatch(/when kind in \('reconciliation', 'parallel_run', 'monitoring'\) then rows_missing \+ rows_extra \+ rows_differing = 0/);
  });
});

describe('cleaning, preview and validation', () => {
  it('cleans values and refuses the ones a rule cannot read', () => {
    expect(transform('  Ada  Lovelace ', 'collapse_spaces').value).toBe('Ada Lovelace');
    expect(transform(' Ada@Example.EDU ', 'email')).toEqual({ value: 'ada@example.edu' });
    expect(transform('ada at example', 'email').error).toBe('not an email address');
    expect(transform('2026-3-7', 'date_iso')).toEqual({ value: '2026-03-07' });
    expect(transform('7 Mar 2026', 'date_iso')).toEqual({ value: '2026-03-07' });
    expect(transform('2026-02-30', 'date_iso').error, 'no 30 February').toBe('not a date');
    expect(transform('1,204', 'integer')).toEqual({ value: '1204' });
    expect(transform('12.5', 'integer').error).toBe('not a whole number');
    expect(transform('3.50', 'decimal')).toEqual({ value: '3.5' });
    expect(transform('', 'email'), 'empty is never a transform error').toEqual({ value: '' });
    expect(transform(' x ', 'none').value).toBe(' x ');
  });

  const FILE = [
    'Student ID,Email,Final Grade,Posted',
    '900001,ada@example.edu,a,2026-12-18',
    '900002,grace@example.edu,b+,12/18/2026',
    '900003,not-an-email,b,2026-12-18',
    '900004,,,2026-12-18',
    '900001,ada2@example.edu,a-,2026-12-19',
    '"900005","kat@example.edu","A","18 Dec 2026"',
  ].join('\n');

  it('maps a file row by row, counting what fails and why', () => {
    const p = preview(parseTable(FILE), MAPS, 'reject');
    expect(p.counts).toMatchObject({ rows_in: 6, rows_ok: 3, rows_failed: 3 });
    expect(p.issues).toEqual([
      { row: 3, field: 'email', problem: 'not an email address' },
      { row: 4, field: 'final_grade', problem: 'required and empty' },
      { row: 5, field: 'student_ref', problem: 'repeats a record already in the file' },
    ]);
    expect(p.duplicates).toBe(1);
    expect(p.rows[0]).toEqual({ student_ref: '900001', email: 'ada@example.edu', final_grade: 'A', posted_on: '2026-12-18' });
    expect(p.rows.map((r) => r.posted_on)).toEqual(['2026-12-18', '2026-12-18', '2026-12-18']);
  });

  it('keeps the first or the last duplicate instead of failing it, when told to', () => {
    const first = preview(parseTable(FILE), MAPS, 'keep_first');
    // Rows 1, 2 and 6 map; 3 and 4 fail; 5 repeats row 1 and is dropped, not failed.
    expect(first.counts).toMatchObject({ rows_in: 6, rows_ok: 3, rows_failed: 2 });
    expect(first.rows.find((r) => r.student_ref === '900001')?.final_grade).toBe('A');
    const last = preview(parseTable(FILE), MAPS, 'keep_last');
    expect(last.rows.find((r) => r.student_ref === '900001')?.final_grade).toBe('A-');
    expect(last.duplicates).toBe(1);
  });

  it('fails every row when the file lacks a mapped column, and names it', () => {
    const p = preview(parseTable('Student ID,Email\n900001,a@example.edu\n'), MAPS, 'reject');
    expect(p.missingColumns).toEqual(['Final Grade', 'Posted']);
    expect(p.counts).toMatchObject({ rows_in: 1, rows_ok: 0, rows_failed: 1 });
  });
});

describe('reconciliation and parallel run', () => {
  const legacy = preview(parseTable('Student ID,Email,Final Grade,Posted\n1,a@x.edu,A,2026-12-18\n2,b@x.edu,B,2026-12-18\n3,c@x.edu,C,2026-12-18\n'), MAPS, 'reject').rows;

  it('matches on the key, and names what is missing, extra and different', () => {
    const semester = parseTable('student_ref,email,final_grade,posted_on\n1,a@x.edu,A,2026-12-18\n2,b@x.edu,B+,2026-12-18\n4,d@x.edu,D,2026-12-18\n');
    const r = reconcile(legacy, semester, MAPS);
    expect(r.counts).toEqual({ rows_in: 3, rows_ok: 1, rows_failed: 0, rows_missing: 1, rows_extra: 1, rows_differing: 1 });
    expect(r.missing).toEqual(['3']);
    expect(r.extra).toEqual(['4']);
    expect(r.differences).toEqual([{ key: '2', field: 'final_grade', legacy: 'B', semester: 'B+' }]);
    expect(passes('reconciliation', r.counts)).toBe(false);
  });

  it('passes only when every record matches, whatever the column order', () => {
    const semester = parseTable('posted_on,final_grade,email,student_ref\n2026-12-18,C,c@x.edu,3\n2026-12-18,B,b@x.edu,2\n2026-12-18,A,a@x.edu,1\n');
    const r = reconcile(legacy, semester, MAPS);
    expect(r.counts).toMatchObject({ rows_in: 3, rows_ok: 3, rows_missing: 0, rows_extra: 0, rows_differing: 0 });
    expect(passes('parallel_run', r.counts)).toBe(true);
  });
});

describe('the evidence', () => {
  it('is a SHA-256 of the file, and the known digest proves the function', async () => {
    expect(await sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(await sha256(FILE_FOR_HASH)).toMatch(/^[0-9a-f]{64}$/);
  });
});

const FILE_FOR_HASH = 'Student ID\n900001\n';

describe('slash dates', () => {
  const AMBIGUOUS = 'could be day-first or month-first; say which, or use YYYY-MM-DD';

  it('refuses a slash date that could be either order unless the order is given', () => {
    expect(transform('3/7/2026', 'date_iso').error).toBe(AMBIGUOUS);
    expect(transform('03/04/2025', 'date_iso').error).toBe(AMBIGUOUS);
  });

  it('reads it the way it is told, and the two readings are different days', () => {
    expect(transform('3/7/2026', 'date_iso', 'month_first')).toEqual({ value: '2026-03-07' });
    expect(transform('3/7/2026', 'date_iso', 'day_first')).toEqual({ value: '2026-07-03' });
  });

  it('reads a slash date that cannot mean the other thing, and a day that equals its month', () => {
    expect(transform('13/4/2026', 'date_iso')).toEqual({ value: '2026-04-13' });
    expect(transform('4/13/2026', 'date_iso')).toEqual({ value: '2026-04-13' });
    expect(transform('5/5/2026', 'date_iso')).toEqual({ value: '2026-05-05' });
  });

  it('holds a declared order to it: a date that does not exist that way is not a date', () => {
    expect(transform('13/4/2026', 'date_iso', 'month_first').error).toBe('not a date');
    expect(transform('4/13/2026', 'date_iso', 'day_first').error).toBe('not a date');
    expect(transform('2/30/2026', 'date_iso').error).toBe('not a date');
  });

  it('does not touch the other date forms, whatever the order', () => {
    for (const order of [undefined, 'month_first', 'day_first'] as const) {
      expect(transform('2026-3-7', 'date_iso', order)).toEqual({ value: '2026-03-07' });
      expect(transform('7 Mar 2026', 'date_iso', order)).toEqual({ value: '2026-03-07' });
    }
  });

  it('fails the row in a preview, and the order the user gives fixes it', () => {
    const maps: FieldMap[] = [
      { source_field: 'Id', target_field: 'ref', transform: 'trim', required: true, is_key: true },
      { source_field: 'Posted', target_field: 'posted_on', transform: 'date_iso', required: false, is_key: false },
    ];
    const file = parseTable('Id,Posted\n1,3/7/2026\n2,2026-01-05\n3,13/7/2026');
    const without = preview(file, maps, 'reject');
    expect(without.counts).toMatchObject({ rows_in: 3, rows_ok: 2, rows_failed: 1 });
    expect(without.issues).toEqual([{ row: 1, field: 'posted_on', problem: AMBIGUOUS }]);
    const dayFirst = preview(file, maps, 'reject', 'day_first');
    expect(dayFirst.counts).toMatchObject({ rows_ok: 3, rows_failed: 0 });
    expect(dayFirst.rows.map((r) => r.posted_on)).toEqual(['2026-07-03', '2026-01-05', '2026-07-13']);
    const monthFirst = preview(file, maps, 'reject', 'month_first');
    expect(monthFirst.counts).toMatchObject({ rows_ok: 2, rows_failed: 1 });
  });
});
