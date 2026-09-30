import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACTIONS, CHANGE_STATUSES, EIGHT, KINDS, KIND_LABEL, KEY_HINT, MIN_REASON, OVERRIDE_KINDS, SOURCES, SOURCE_LABEL, STUDENT_REF,
  asOf, explain, history, inEffect, isOverride, proposalProblems, toCsv,
  type LedgerEntry, type Proposal,
} from './ledger';

/**
 * Holds the ledger's vocabularies and rules to the migration that enforces
 * them, word for word, and its folding of the ledger to cases worked by hand.
 */

const root = join(import.meta.dirname, '../../../..');
const SQL = readFileSync(join(root, 'supabase/migrations/20260929210000_academic_record_ledger.sql'), 'utf8');

function words(after: string): string[] {
  const at = SQL.indexOf(after);
  if (at < 0) throw new Error(`no ${after}`);
  const start = SQL.indexOf('(', at + after.length - 1);
  return [...SQL.slice(start, SQL.indexOf(')', start)).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

let n = 0;
function entry(over: Partial<LedgerEntry>): LedgerEntry {
  n += 1;
  return {
    id: `e${String(n).padStart(3, '0')}`, tenant_id: 'u', student_ref: 'S100', kind: 'grade', subject_key: 'PSCI 2100 · Fall 2026',
    action: 'set', value: 'B+', previous_value: null, previous_entry_id: null, effective_on: '2026-12-18', reason: 'Posted from the roster.',
    source: 'faculty', change_id: `c${String(n).padStart(7, '0')}`, proposed_by: 'prof', approved_by: 'reg', override: false,
    recorded_at: `2026-12-${String(18 + n).padStart(2, '0')}T12:00:00Z`, ...over,
  };
}

describe('the ledger, held to its migration', () => {
  it('has every vocabulary the database checks, word for word', () => {
    expect(words("kind           text        not null check (kind in")).toEqual([...KINDS]);
    expect(words("source         text        not null check (source in")).toEqual([...SOURCES]);
    expect(words("action         text        not null default 'set' check (action in")).toEqual([...ACTIONS]);
    expect(words("status         text        not null default 'proposed' check (status in")).toEqual([...CHANGE_STATUSES]);
    expect(words('is_override := old.kind in')).toEqual([...OVERRIDE_KINDS]);
    expect(SQL).toContain(`student_ref ~ '${STUDENT_REF.source}'`);
    expect(SQL).toContain(`length(trim(reason)) >= ${MIN_REASON}`);
    for (const k of KINDS) {
      expect(KIND_LABEL[k], k).toBeTruthy();
      expect(KEY_HINT[k], k).toBeTruthy();
    }
    for (const s of SOURCES) expect(SOURCE_LABEL[s], s).toBeTruthy();
  });

  it('orders the ledger the same way in both places: effective date, then recorded, then id', () => {
    expect(SQL).toContain('order by e.effective_on desc, e.recorded_at desc, e.id desc');
  });

  it('writes the ledger only from the approval, by someone other than the proposer', () => {
    expect(SQL).toMatch(/grant select on table public\.academic_record_entries to authenticated;/);
    expect(SQL).not.toMatch(/grant [^;]*insert[^;]*on table public\.academic_record_entries/);
    expect(SQL).toMatch(/if old\.proposed_by = caller then\s+raise exception 'The person who proposed a change does not decide it\.'/);
  });
});

describe('folding the ledger', () => {
  const posted = entry({ value: 'B+', effective_on: '2026-12-18' });
  const regraded = entry({ value: 'A-', effective_on: '2027-01-15', previous_value: 'B+', previous_entry_id: posted.id, override: true, source: 'appeal', reason: 'Regrade after appeal, committee minute 14.' });
  const enrolled = entry({ kind: 'enrollment', subject_key: 'HIST 1100 · Fall 2026', value: 'Enrolled', effective_on: '2026-08-20' });
  const withdrew = entry({ kind: 'enrollment', subject_key: 'HIST 1100 · Fall 2026', action: 'void', value: '', effective_on: '2026-09-10', previous_value: 'Enrolled', previous_entry_id: enrolled.id });
  const conferred = entry({ kind: 'conferral', subject_key: 'B.A. Political Science', value: 'Conferred', effective_on: '2027-05-14' });
  const all = [regraded, conferred, withdrew, posted, enrolled];

  it('gives the record as it stood on any date', () => {
    expect(asOf(all, '2026-08-01')).toEqual([]);
    expect(asOf(all, '2026-09-01').map((l) => [l.kind, l.value])).toEqual([['enrollment', 'Enrolled']]);
    const dec = asOf(all, '2026-12-31');
    expect(dec.map((l) => [l.kind, l.subject_key, l.value])).toEqual([['grade', 'PSCI 2100 · Fall 2026', 'B+']]);
    const june = asOf(all, '2027-06-01');
    expect(june.map((l) => [l.kind, l.value, l.versions])).toEqual([['grade', 'A-', 2], ['conferral', 'Conferred', 1]]);
  });

  it('leaves a removed key off the record and keeps it in the history', () => {
    expect(asOf(all, '2026-12-31').some((l) => l.kind === 'enrollment')).toBe(false);
    expect(history(all, 'enrollment', 'HIST 1100 · Fall 2026').map((e) => e.action)).toEqual(['set', 'void']);
  });

  it('finds what a new entry would replace on its own date, including a backdated one', () => {
    expect(inEffect(all, 'grade', 'PSCI 2100 · Fall 2026', '2026-12-17')).toBeNull();
    expect(inEffect(all, 'grade', 'PSCI 2100 · Fall 2026', '2026-12-31')?.id).toBe(posted.id);
    expect(inEffect(all, 'grade', 'PSCI 2100 · Fall 2026', '2027-02-01')?.id).toBe(regraded.id);
    // Two entries on one effective date: the later recorded wins, as in SQL.
    const sameDay = entry({ value: 'A', effective_on: '2027-01-15', recorded_at: '2027-02-01T00:00:00Z' });
    expect(inEffect([...all, sameDay], 'grade', 'PSCI 2100 · Fall 2026', '2027-01-15')?.id).toBe(sameDay.id);
  });

  it('calls a correction of a grade, standing or conferral an override, and a first entry not', () => {
    expect(isOverride(all, { kind: 'grade', subject_key: 'PSCI 2100 · Fall 2026', effective_on: '2027-03-01' })).toBe(true);
    expect(isOverride(all, { kind: 'grade', subject_key: 'ECON 1010 · Fall 2026', effective_on: '2027-03-01' })).toBe(false);
    expect(isOverride(all, { kind: 'grade', subject_key: 'PSCI 2100 · Fall 2026', effective_on: '2026-12-01' }), 'before anything was in effect').toBe(false);
    expect(isOverride(all, { kind: 'enrollment', subject_key: 'HIST 1100 · Fall 2026', effective_on: '2026-12-01' }), 'enrollment is not an override kind').toBe(false);
    expect(isOverride(all, { kind: 'conferral', subject_key: 'B.A. Political Science', effective_on: '2027-06-01' })).toBe(true);
  });
});

describe('the eight questions', () => {
  it('answers every one, in the brief’s order, for any entry', () => {
    const e = entry({ value: 'A-', previous_value: 'B+', override: true, source: 'appeal', reason: 'Regrade after appeal, committee minute 14.', effective_on: '2027-01-15', proposed_by: 'prof', approved_by: 'reg' });
    const names: Record<string, string> = { prof: 'Prof. Rivera', reg: 'The registrar' };
    const a = explain(e, (id) => (id ? names[id] : 'A person whose account was deleted'));
    expect(a.map(([q]) => q)).toEqual([...EIGHT]);
    expect(Object.fromEntries(a)).toEqual({
      'Who changed it?': 'Prof. Rivera',
      'What changed?': 'Grade, PSCI 2100 · Fall 2026: A-',
      'Why did it change?': 'Regrade after appeal, committee minute 14.',
      'Who approved it?': 'The registrar, as a registrar override',
      'When did it become effective?': '2027-01-15',
      'What was the previous value?': 'B+',
      'Which workflow or source caused it?': `Appeal or grade review (change ${e.change_id.slice(0, 8)})`,
      'Can it be corrected without deleting history?': 'Yes. A correction is a new entry; this one stays in the history.',
    });
    expect(Object.fromEntries(explain(entry({}), () => 'x'))['What was the previous value?']).toBe('None — this was the first entry');
    expect(Object.fromEntries(explain(entry({ action: 'void', value: '', previous_value: 'Enrolled' }), () => 'x'))['What changed?']).toMatch(/removed from the record$/);
  });
});

describe('proposals and export', () => {
  const ok: Proposal = { student_ref: 'S100', kind: 'grade', subject_key: 'PSCI 2100 · Fall 2026', action: 'set', value: 'A', effective_on: '2026-12-18', reason: 'Posted from the roster.', source: 'faculty' };

  it('says what is wrong with a proposal before the database is asked', () => {
    expect(proposalProblems(ok, [])).toEqual([]);
    expect(proposalProblems({ ...ok, student_ref: 'S 100' }, [])).toHaveLength(1);
    expect(proposalProblems({ ...ok, reason: 'because' }, [])).toEqual([`Give the reason, in at least ${MIN_REASON} characters.`]);
    expect(proposalProblems({ ...ok, action: 'void', value: '' }, [])).toEqual(['There is nothing in effect on that date to remove.']);
    expect(proposalProblems({ ...ok, value: ' ' }, [])).toEqual(['Give the value, in 200 characters or fewer.']);
  });

  it('exports the record on a date, saying it is not an official transcript', () => {
    const lines = asOf([entry({ subject_key: 'PSCI 2100, "Politics" · Fall 2026', value: 'A' })], '2027-01-01');
    const csv = toCsv('S100', '2027-01-01', lines);
    const [head, cols, row] = csv.trim().split('\n');
    expect(head).toBe('Record of,S100,as of,2027-01-01,Not an official transcript');
    expect(cols).toBe('kind,about,value,effective,entry,versions');
    expect(row).toBe(`Grade,"PSCI 2100, ""Politics"" · Fall 2026",A,2026-12-18,${lines[0].entry.id},1`);
  });
});
