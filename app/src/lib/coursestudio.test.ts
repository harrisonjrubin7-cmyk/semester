import { describe, expect, it, vi } from 'vitest';

/**
 * The faculty side of Course Studio (D-100 slice 3). The server re-checks all
 * of this, and who may publish at all (coursestudio.check.sql); this is the
 * screen naming a mistake before the publish rather than after it.
 */

const mock = vi.hoisted(() => {
  const rows: Record<string, Record<string, unknown>[]> = { course_ai_rules: [], course_guidance: [], study_packs: [] };
  const eqs: [string, unknown][] = [];
  const chain = (table: string) => {
    const q = {
      select: () => q,
      eq: (col: string, v: unknown) => {
        eqs.push([col, v]);
        return q;
      },
      then: (ok: (r: unknown) => unknown) => Promise.resolve({ data: rows[table], error: null }).then(ok),
    };
    return q;
  };
  return { rpc: vi.fn(), from: vi.fn(chain), rows, eqs };
});
vi.mock('./cloud', () => ({ cloudConfigured: true, cloud: () => Promise.resolve({ rpc: mock.rpc, from: mock.from }) }));
const { EMPTY_RULES, asPublished, draftOf, history, myCourses, packProblems, publishPack, publishRules, rulesProblems } = await import('./coursestudio');

describe('rules before they are published', () => {
  it('need a real link and a real date, and words within the limit', () => {
    expect(rulesProblems({ ...EMPTY_RULES, link: 'javascript:alert(1)', effective: 'soon', words: 'x'.repeat(4001) }, false)).toEqual([
      'Your words are longer than 4,000 characters.',
      'The syllabus link must start with http:// or https://.',
      'The effective date is not a date.',
    ]);
    expect(rulesProblems({ ...EMPTY_RULES, link: 'https://example.edu/syllabus', effective: '2026-08-24' }, false)).toEqual([]);
  });

  it('never permit final answers without the instructor confirming it by name (F3)', () => {
    for (const state of ['allowed', 'limited', 'required'] as const) {
      const d = { ...EMPTY_RULES, uses: { 'final-answers': state } };
      expect(rulesProblems(d, false)).toEqual(['Confirm that AI may produce final answers for assessments in this course.']);
      expect(rulesProblems(d, true)).toEqual([]);
    }
    expect(rulesProblems({ ...EMPTY_RULES, uses: { 'final-answers': 'prohibited' } }, false)).toEqual([]);
    // A blanket "allowed" does not ask, because it does not permit them.
    expect(rulesProblems({ ...EMPTY_RULES, blanket: 'allowed' }, false)).toEqual([]);
  });

  it('round-trip between a published version and a draft', () => {
    const d = { blanket: 'limited' as const, uses: { practice: 'allowed' as const }, words: ' Disclose it. ', link: ' https://x.edu ', effective: '2026-08-24' };
    const p = asPublished(d, '2026-09-01');
    expect(p).toEqual({ blanket: 'limited', uses: { practice: 'allowed' }, words: 'Disclose it.', link: 'https://x.edu', effective: '2026-08-24', published: '2026-09-01' });
    expect(draftOf(p)).toMatchObject({ blanket: 'limited', uses: { practice: 'allowed' } });
    expect(draftOf(undefined)).toEqual(EMPTY_RULES);
  });
});

describe('packs before they are published', () => {
  const item = { title: 'Week 4 slides', citation: '', link: '', authority: 'authoritative' as const };
  it('need a name, titled references and http links', () => {
    expect(packProblems({ id: null, title: ' ', note: '', items: [{ ...item, title: '' }, { ...item, link: 'file:///x' }] })).toEqual([
      'Name the pack.',
      'Reference 1 needs a title.',
      "Reference 2's link must start with http:// or https://.",
    ]);
    expect(packProblems({ id: null, title: 'Midterm 1', note: '', items: [item] })).toEqual([]);
  });

  it('hold at most fifty references', () => {
    expect(packProblems({ id: null, title: 'Big', note: '', items: Array.from({ length: 51 }, () => item) })).toContain('A pack holds at most 50 references.');
  });
});

describe('the calls', () => {
  it('publishes exactly the draft, trimmed, and a missing date as none', async () => {
    mock.rpc.mockResolvedValue({ data: 3, error: null });
    await expect(publishRules('ECON 1020', '2026FA', { blanket: null, uses: { practice: 'allowed' }, words: ' w ', link: '', effective: '' })).resolves.toBe(3);
    expect(mock.rpc).toHaveBeenCalledWith('publish_course_rules', {
      want_course: 'ECON 1020',
      want_term: '2026FA',
      want_blanket: null,
      want_uses: { practice: 'allowed' },
      want_words: 'w',
      want_link: '',
      want_effective: null,
    });
  });

  it('sends a pack’s references with only the four fields the server accepts', async () => {
    mock.rpc.mockResolvedValue({ data: 'pack-id', error: null });
    const extra = { title: ' Slides ', citation: '', link: '', authority: 'supplemental' as const, secret: 'x' };
    await publishPack('ECON 1020', '2026FA', { id: null, title: ' P ', note: '', items: [extra] });
    const [, args] = mock.rpc.mock.calls.at(-1)!;
    expect(args.want_items).toEqual([{ title: 'Slides', citation: '', link: '', authority: 'supplemental' }]);
    expect(args.want_pack).toBeNull();
    expect(args.want_retired).toBe(false);
  });

  it('says what the server refused', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { message: 'semester: you do not teach that course here' } });
    await expect(publishRules('HIST 2100', '2026FA', EMPTY_RULES)).rejects.toThrow('you do not teach that course here');
  });

  it('lists only real course codes as teachable', async () => {
    mock.rpc.mockResolvedValue({ data: [{ course_code: 'ECON 1020' }, { course_code: 'junk' }, null], error: null });
    await expect(myCourses()).resolves.toEqual(['ECON 1020']);
  });

  it('reads the history of one course and term, newest first', async () => {
    mock.rows.course_ai_rules = [
      { version: 1, blanket: 'prohibited', uses: {}, published_at: '2026-09-01T10:00:00Z' },
      { version: 2, blanket: 'allowed', uses: { practice: 'allowed' }, published_at: '2026-09-03T10:00:00Z' },
    ];
    mock.rows.course_guidance = [{ version: 1, body: '', published_at: '2026-09-02T10:00:00Z' }];
    mock.rows.study_packs = [{ version: 1, title: 'Midterm 1', items: [], retired: true, published_at: '2026-09-04T10:00:00Z' }];
    const got = await history('ECON 1020', '2026FA');
    expect(got.map((v) => [v.label, v.version, v.summary])).toEqual([
      ['Pack: Midterm 1', 1, 'Retired'],
      ['AI rules', 2, 'Everything else: allowed · 1 named use'],
      ['Guidance', 1, 'Withdrawn'],
      ['AI rules', 1, 'Everything else: prohibited · 0 named uses'],
    ]);
    expect(mock.eqs).toContainEqual(['course_code', 'ECON 1020']);
    expect(mock.eqs).toContainEqual(['term', '2026FA']);
  });
});
