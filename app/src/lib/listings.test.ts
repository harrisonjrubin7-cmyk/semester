import { describe, expect, it } from 'vitest';
import { LISTING_COLUMNS, QUEUE_COLUMNS, QUEUE_LIMIT, arrange, deadlineForStorage, deadlineLabel, deadlinePassed, eligibilityLines, fromCareerFeed, loadReviewQueue, moderateListing, readModerated, trackId, trackerEntry, type Listing } from './listings';
import type { RecordRow } from './integration/school-records';

const NOW = new Date('2026-09-28T12:00:00Z');
const l = (id: string, deadline: string | null): Listing => ({ id, kind: 'job', title: id, from: 'x', body: '', url: null, deadline, eligibility: [], source: 'moderated' });

describe('verified listings', () => {
  it('shows eligibility as the office wrote it, and never judges it', () => {
    expect(eligibilityLines({ text: 'Juniors and seniors in economics', gpa_minimum: 3.2, majors: ['ECON', 'MATH'] })).toEqual([
      'Juniors and seniors in economics', 'gpa minimum: 3.2', 'majors: ECON, MATH',
    ]);
    // A sentence that sounds like a verdict is still just the office's text.
    expect(eligibilityLines({ text: 'You qualify if you are a first-year.' })).toEqual(['You qualify if you are a first-year.']);
    expect(eligibilityLines(null)).toEqual([]);
  });

  it('keeps only https links, from either source', () => {
    expect(readModerated({ id: '1', kind: 'job', title: 'T', url: 'http://x.example' })!.url).toBeNull();
    expect(readModerated({ id: '1', kind: 'job', title: 'T', url: 'https://x.example' })!.url).toBe('https://x.example');
    const row = { id: 'r', canonical_entity_type: 'internship', source_of_truth: 'Career office', source_url: 'javascript:alert(1)', display: { title: 'Intern', employer: 'Acme' } } as unknown as RecordRow;
    expect(fromCareerFeed([row])[0]).toMatchObject({ title: 'Intern', from: 'Acme', url: null, source: 'career_feed' });
  });

  it('drops kinds it does not show and rows without a title', () => {
    expect(readModerated({ id: '1', kind: 'deal', title: 'Pizza' })).toBeNull();
    expect(readModerated({ id: '1', kind: 'job', title: '  ' })).toBeNull();
  });

  it('never selects who submitted a listing', () => {
    expect(LISTING_COLUMNS).not.toContain('publisher_id');
  });

  it('orders by deadline, drops past ones, and keeps open-ended last', () => {
    expect(arrange([l('open', null), l('past', '2026-09-01'), l('late', '2026-11-01'), l('soon', '2026-10-01')], NOW).map((x) => x.id)).toEqual(['soon', 'late', 'open']);
  });

  it('tracks a listing with its link as the source, in the right tracker kind', () => {
    const t = trackerEntry({ id: 'x', kind: 'scholarship', title: 'Merit award', from: 'Aid office', body: '', url: 'https://aid.example/merit', deadline: new Date(2026, 10, 15, 23, 59, 59).toISOString(), eligibility: [], source: 'moderated' });
    expect(t).toMatchObject({ kind: 'funding', title: 'Merit award', org: 'Aid office', deadline: '2026-11-15', source: 'https://aid.example/merit' });
  });
});

describe('when a deadline has passed', () => {
  it('keeps a date-only deadline for the whole of that local day, and drops it the next', () => {
    const lateToday = new Date(2026, 9, 1, 23, 30);
    const earlyTomorrow = new Date(2026, 9, 2, 0, 30);
    expect(deadlinePassed('2026-10-01', lateToday)).toBe(false);
    expect(deadlinePassed('2026-10-01', earlyTomorrow)).toBe(true);
    expect(arrange([l('today', '2026-10-01')], lateToday).map((x) => x.id)).toEqual(['today']);
  });

  it('compares a timestamp as the instant it is — the control', () => {
    const at = '2026-10-01T12:00:00Z';
    expect(deadlinePassed(at, new Date('2026-10-01T11:59:00Z'))).toBe(false);
    expect(deadlinePassed(at, new Date('2026-10-01T12:01:00Z'))).toBe(true);
    expect(deadlinePassed(null, new Date())).toBe(false);
  });
});

describe('deadlines a moderator and a student read the same way', () => {
  it('stores a picked date as the end of that day, so it is still that day locally', () => {
    const stored = deadlineForStorage('2026-10-01')!;
    expect(new Date(stored).getDate()).toBe(1);
    expect(deadlinePassed(stored, new Date(2026, 9, 1, 22, 0))).toBe(false);
    expect(deadlinePassed(stored, new Date(2026, 9, 2, 0, 30))).toBe(true);
    expect(deadlineForStorage('')).toBeNull();
  });

  it('shows a bare date as that calendar day, never the day before', () => {
    expect(deadlineLabel('2026-10-01')).toBe(new Date(2026, 9, 1).toLocaleDateString());
  });
});

describe('tracking a listing', () => {
  it('gives the tracker entry an id from the listing, so one without a link is still recognised', () => {
    const noLink = l('career:abc', '2026-10-01');
    expect(trackerEntry(noLink).id).toBe(trackId(noLink));
    expect(trackerEntry(noLink).id).toBe(trackerEntry(noLink).id);
  });
});

/** Applies `eq`, `order` and `limit` the way PostgREST does, over chosen rows. */
function fakeOpportunities(rows: { id: string; status: string; created_at: string }[], seen: string[] = []) {
  const from = () => {
    let out = rows.map((r) => ({ ...r, kind: 'job', title: r.id, body: 'b', deadline: null, url: null, publisher_scope_id: 's', eligibility: {} }));
    const q = {
      select: (cols: string) => { seen.push(cols); return q; },
      eq: (_: string, v: string) => { out = out.filter((r) => r.status === v); return q; },
      in: (_: string, v: string[]) => { out = out.filter((r) => v.includes(r.status)); return q; },
      order: (_: string, o: { ascending: boolean }) => { out = [...out].sort((a, b) => (o.ascending ? 1 : -1) * a.created_at.localeCompare(b.created_at)); return q; },
      limit: async (n: number) => ({ data: out.slice(0, n), error: null }),
    };
    return q;
  };
  return { from } as never;
}

describe('the moderator review queue', () => {
  const at = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 60_000).toISOString();

  it('keeps an older pending listing when many newer drafts and published ones exist', async () => {
    const rows = [
      { id: 'old-pending', status: 'pending_review', created_at: at(0) },
      ...Array.from({ length: 150 }, (_, i) => ({ id: `d${i}`, status: 'draft', created_at: at(10 + i) })),
      ...Array.from({ length: 150 }, (_, i) => ({ id: `p${i}`, status: 'published', created_at: at(200 + i) })),
    ];
    const q = await loadReviewQueue(fakeOpportunities(rows));
    expect(q.rows.map((r) => r.id)).toEqual(['old-pending']);
    expect(q.more).toBe(false);
  });

  it('asks for the body and deadline, which students will see', async () => {
    const seen: string[] = [];
    await loadReviewQueue(fakeOpportunities([], seen));
    expect(seen[0]).toBe(QUEUE_COLUMNS);
    expect(QUEUE_COLUMNS).toContain('body');
    expect(QUEUE_COLUMNS).toContain('deadline');
  });

  it('says when more are waiting than one load holds — the control for the cap', async () => {
    const rows = Array.from({ length: QUEUE_LIMIT + 2 }, (_, i) => ({ id: `w${i}`, status: 'pending_review', created_at: at(i) }));
    const q = await loadReviewQueue(fakeOpportunities(rows));
    expect(q.rows).toHaveLength(QUEUE_LIMIT);
    expect(q.rows[0].id).toBe('w0');
    expect(q.more).toBe(true);
  });
});

describe('moderating a listing', () => {
  it('goes through moderate_opportunity with the status alone — never a table update', async () => {
    const calls: unknown[] = [];
    const db = {
      rpc: async (name: string, args: unknown) => { calls.push([name, args]); return { error: null }; },
      from: () => { throw new Error('a moderator does not update the table'); },
    } as never;
    await moderateListing('l1', 'published', db);
    expect(calls).toEqual([['moderate_opportunity', { want: 'l1', want_status: 'published' }]]);
  });

  it('says what the database refused', async () => {
    const db = { rpc: async () => ({ error: { message: 'Only a listings moderator can do that.' } }) } as never;
    await expect(moderateListing('l1', 'removed', db)).rejects.toThrow('Only a listings moderator');
  });
});
