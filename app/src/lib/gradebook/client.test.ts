import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The gradebook client's contract with `20260929310000_gradebook.sql`: which
 * RPC, which argument names, which columns become which fields; that the
 * whole course is read through row-level security in one place; that every
 * writer's refusal is thrown with the server's sentence; and that the export
 * file cannot carry a formula.
 */

interface Reply {
  data?: unknown;
  error?: { message: string; code?: string } | null;
}

const calls: { kind: 'rpc' | 'from'; name: string; args?: unknown; chain: string[] }[] = [];
const replies = new Map<string, Reply>();

function chain(kind: 'rpc' | 'from', name: string, args?: unknown) {
  const call = { kind, name, args, chain: [] as string[] };
  calls.push(call);
  const reply = () => replies.get(`${kind}:${name}`) ?? { data: kind === 'from' ? [] : null, error: null };
  const self: Record<string, unknown> = {
    then: (ok: (r: Reply) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(reply()).then(ok, bad),
  };
  for (const m of ['select', 'order', 'eq', 'limit']) {
    self[m] = (...a: unknown[]) => {
      call.chain.push(`${m}(${a.map((x) => JSON.stringify(x)).join(',')})`);
      return self;
    };
  }
  return self;
}

vi.mock('../cloud', () => ({
  cloudConfigured: true,
  cloud: async () => ({
    rpc: (name: string, args?: unknown) => chain('rpc', name, args),
    from: (name: string) => chain('from', name),
  }),
}));

import {
  addItem,
  asGradebook,
  authoredCourses,
  enterScore,
  exportCsv,
  exportRows,
  fileRegrade,
  gradedCourses,
  loadBook,
  moderate,
  passbackSaid,
  queuePassback,
  release,
  resolveRegrade,
  setScheme,
  termOf,
} from './client';
import { studentView } from './views';

beforeEach(() => {
  calls.length = 0;
  replies.clear();
});

describe('who is looking', () => {
  const grant = (capability: string, scopeId: string, scopeKind = 'course') => ({ capability, scopeKind, scopeId });

  it('finds the course-terms a person authors, with what they may do, at this school only', () => {
    const grants = [
      grant('grades:enter', 'vu/ECON 1020/2026FA'),
      grant('grades:release', 'vu/ECON 1020/2026FA'),
      grant('grades:export', 'vu/ECON 1020/2026FA'),
      grant('grades:enter', 'vu/ECON 1020/2027SP'),
      grant('grades:enter', 'other/ECON 1020/2026FA'),
      grant('grades:export', 'vu/HIST 1100/2026FA'),
      grant('grades:receive', 'vu/MATH 1300/2026FA'),
      grant('grades:export', 'vu', 'school'),
    ];
    // The latest term first; each term its own entry with its own capabilities.
    expect(authoredCourses(grants, 'vu')).toEqual([
      { course: 'ECON 1020', term: '2027SP', capabilities: ['grades:enter'] },
      { course: 'ECON 1020', term: '2026FA', capabilities: ['grades:enter', 'grades:export', 'grades:release'] },
    ]);
    expect(gradedCourses(grants, 'vu')).toEqual([{ course: 'MATH 1300', term: '2026FA' }]);
    expect(authoredCourses(grants, '')).toEqual([]);
  });

  it('reads nothing from a grant with no term, or a scope that is not a course and a term', () => {
    // The migration authorises nothing on these, so neither does the screen.
    const grants = [
      grant('grades:enter', 'vu/ECON 1020'),
      grant('grades:receive', 'vu/ECON 1020'),
      grant('grades:enter', 'vu/ECON 1020/2026'),
      grant('grades:enter', 'vu/ECON 1020/2026FA/extra'),
      grant('grades:enter', 'vu/econ 1020/2026FA'),
      grant('grades:receive', 'vu/MATH 1300/26FA'),
    ];
    expect(authoredCourses(grants, 'vu')).toEqual([]);
    expect(gradedCourses(grants, 'vu')).toEqual([]);
  });

  it('orders terms by year and season, not alphabetically', () => {
    const grants = ['2026FA', '2027SP', '2026SU', '2026SP', '2027SU'].map((t) => grant('grades:receive', `vu/ECON 1020/${t}`));
    expect(gradedCourses(grants, 'vu').map((o) => o.term)).toEqual(['2027SU', '2027SP', '2026FA', '2026SU', '2026SP']);
  });

  it('names the term a date falls in', () => {
    expect(termOf(new Date(2026, 8, 29))).toBe('2026FA');
    expect(termOf(new Date(2027, 1, 1))).toBe('2027SP');
    expect(termOf(new Date(2027, 5, 15))).toBe('2027SU');
  });
});

describe('reading one course', () => {
  it('reads the latest scheme, the items, every visible version and the requests with their answers', async () => {
    replies.set('from:gradebook_schemes', { data: [{ version: 3, categories: [{ key: 'exams', name: 'Exams', weight: 100, drop_lowest: 0 }], letters: [{ letter: 'A', min: 90 }, { letter: 'F', min: 0 }], moderation_required: true }] });
    replies.set('from:gradebook_items', { data: [{ id: 'mid', category_key: 'exams', title: 'Midterm', points_possible: '100.000', line_item: null }] });
    replies.set('from:grade_entries', {
      data: [
        { id: 'g1', item_id: 'mid', student_id: 'ana', version: 1, score: '88.000', mark: null, comment: '', status: 'draft', action: 'entered', graded_by: 'prof', actor: 'prof', reason: '', regrade_id: null, operation: 'k1', created_at: 't1' },
        { id: 'g2', item_id: 'mid', student_id: 'ana', version: 2, score: '88.000', mark: 'late', comment: '', status: 'released', action: 'released', graded_by: 'prof', actor: 'prof', reason: '', regrade_id: null, operation: 'k2', created_at: 't2' },
      ],
    });
    replies.set('from:regrade_requests', { data: [{ id: 'r1', item_id: 'mid', student_id: 'ana', contested_entry: 'g2', reason: 'Q3', filed_at: 't3' }] });
    replies.set('from:regrade_resolutions', { data: [{ request_id: 'r1', outcome: 'upheld', note: 'Stands.', entry_id: null, resolved_by: 'prof', resolved_at: 't4' }, { request_id: 'elsewhere', outcome: 'changed', note: 'x', entry_id: 'z' }] });

    const b = await loadBook('ECON 1020', '2026FA');
    expect(b.scheme).toEqual({ categories: [{ key: 'exams', name: 'Exams', weight: 100, dropLowest: 0 }], letters: [{ letter: 'A', min: 90 }, { letter: 'F', min: 0 }], moderationRequired: true });
    expect(b.schemeVersion).toBe(3);
    expect(b.items).toEqual([{ id: 'mid', categoryKey: 'exams', title: 'Midterm', pointsPossible: 100, lineItem: null }]);
    expect(b.entries.map((e) => [e.version, e.score, e.mark, e.status])).toEqual([[1, 88, null, 'draft'], [2, 88, 'late', 'released']]);
    expect(b.resolutions.map((r) => r.requestId)).toEqual(['r1']);
    for (const table of ['gradebook_schemes', 'gradebook_items', 'grade_entries', 'regrade_requests']) {
      expect(calls.find((c) => c.name === table)?.chain, table).toEqual(expect.arrayContaining(['eq("course_code","ECON 1020")', 'eq("term","2026FA")']));
    }

    const view = studentView(asGradebook(b), { id: 'ana', capabilities: [] });
    expect(view.lines).toEqual([{ itemId: 'mid', title: 'Midterm', pointsPossible: 100, score: 88, mark: 'late', comment: '', releasedAt: 't2' }]);
    expect(view.final.letter).toBe('F');
  });

  it('reads a course with no scheme yet as null, not as an error', async () => {
    const b = await loadBook('ECON 1020', '2026FA');
    expect(b.scheme).toBeNull();
    expect(b.schemeVersion).toBe(0);
  });

  it('throws when any of the reads fails', async () => {
    replies.set('from:grade_entries', { data: null, error: { code: '42501', message: 'permission denied' } });
    await expect(loadBook('ECON 1020', '2026FA')).rejects.toMatchObject({ answered: true });
  });
});

describe('the writers', () => {
  it('name their arguments as the migration does', async () => {
    replies.set('rpc:gradebook_set_scheme', { data: 2 });
    replies.set('rpc:gradebook_add_item', { data: 'item-1' });
    replies.set('rpc:gradebook_enter', { data: 1 });
    replies.set('rpc:gradebook_moderate', { data: 2 });
    replies.set('rpc:gradebook_release', { data: { released: 3, held: 1 } });
    replies.set('rpc:gradebook_resolve_regrade', { data: null });
    replies.set('rpc:gradebook_file_regrade', { data: 'req-1' });
    replies.set('rpc:gradebook_queue_passback', { data: { queued: 0, reason: 'flag-off' } });

    expect(await setScheme('ECON 1020', '2026FA', { categories: [{ key: 'exams', name: 'Exams', weight: 100, dropLowest: 1 }], letters: [{ letter: 'F', min: 0 }], moderationRequired: false }, 'sch-abcdefgh')).toBe(2);
    expect(await addItem('ECON 1020', '2026FA', { categoryKey: 'exams', title: 'Midterm', pointsPossible: 100, lineItem: null }, 'itm-abcdefgh')).toBe('item-1');
    expect(await enterScore({ itemId: 'item-1', studentId: 'ana', score: 9.5, mark: 'late', comment: 'ok', reason: '' }, 'ent-abcdefgh')).toBe(1);
    expect(await moderate('item-1', 'ana', 'mod-abcdefgh')).toBe(2);
    expect(await release('item-1', 'rel-abcdefgh')).toEqual({ released: 3, held: 1 });
    expect(await resolveRegrade({ requestId: 'req-1', outcome: 'upheld', score: null, mark: null, note: 'Stands.' }, 'res-abcdefgh')).toBeNull();
    expect(await fileRegrade('item-1', 'Q3 was marked wrong', 'reg-abcdefgh')).toBe('req-1');
    expect(await queuePassback('item-1', 'pb-abcdefgh')).toEqual({ queued: 0, reason: 'flag-off', said: 'Your school has not turned on grade passback. Nothing was queued.' });

    expect(calls.map((c) => [c.name, Object.keys(c.args as object).sort()])).toEqual([
      ['gradebook_set_scheme', ['want_categories', 'want_course', 'want_key', 'want_letters', 'want_moderation', 'want_term']],
      ['gradebook_add_item', ['want_category', 'want_course', 'want_key', 'want_line_item', 'want_points', 'want_term', 'want_title']],
      ['gradebook_enter', ['want_comment', 'want_item', 'want_key', 'want_mark', 'want_reason', 'want_score', 'want_student']],
      ['gradebook_moderate', ['want_item', 'want_key', 'want_student']],
      ['gradebook_release', ['want_item', 'want_key']],
      ['gradebook_resolve_regrade', ['want_key', 'want_mark', 'want_note', 'want_outcome', 'want_request', 'want_score']],
      ['gradebook_file_regrade', ['want_item', 'want_key', 'want_reason']],
      ['gradebook_queue_passback', ['want_item', 'want_key']],
    ]);
    // The scheme's categories go over in the migration's own shape.
    expect((calls[0].args as { want_categories: unknown }).want_categories).toEqual([{ key: 'exams', name: 'Exams', weight: 100, drop_lowest: 1 }]);
  });

  it('throw a refusal with the server’s sentence', async () => {
    replies.set('rpc:gradebook_enter', { data: null, error: { code: '23514', message: 'semester: this grade has been released; a change needs a reason' } });
    await expect(enterScore({ itemId: 'i', studentId: 's', score: 1, mark: null, comment: '', reason: '' }, 'k-abcdefgh')).rejects.toMatchObject({
      answered: true,
      message: 'This grade has been released; a change needs a reason.',
    });
  });

  it('say every passback answer in words', () => {
    const fallback = passbackSaid(1, 'a-reason-nobody-sends');
    for (const r of ['kill-switch', 'module-off', 'flag-off', 'no-line-item']) {
      expect(passbackSaid(1, r), r).not.toContain(r);
      expect(passbackSaid(1, r), r).not.toBe(fallback);
    }
    expect(passbackSaid(1, 'queued')).not.toBe(fallback);
    expect(passbackSaid(0, 'queued')).toMatch(/already queued/);
    expect(passbackSaid(2, 'queued')).toMatch(/^2 released scores are queued/);
  });
});

describe('the export', () => {
  it('reads gradebook_export and writes a CSV no spreadsheet will run', async () => {
    replies.set('rpc:gradebook_export', {
      data: [{ student_id: 'ana', item_id: 'mid', category_key: 'exams', title: '=HYPERLINK("http://x")', points_possible: 100, score: 88, mark: null, released_at: 't2' }],
    });
    const rows = await exportRows('ECON 1020', '2026FA');
    expect(calls[0]).toMatchObject({ name: 'gradebook_export', args: { want_course: 'ECON 1020', want_term: '2026FA' } });
    const csv = exportCsv('ECON 1020', '2026FA', rows);
    const [head, line] = csv.split('\r\n');
    expect(head).toBe('course,term,student_id,item_id,category,item,points_possible,score,mark,released_at');
    expect(line).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv.endsWith('\r\n')).toBe(true);
  });
});
