import { describe, expect, it, vi } from 'vitest';
import { isQuotaError, save, shed, trouble, weigh } from './keep';

/** The error a browser actually throws when the budget is gone. */
const quota = () => {
  const e = new Error('exceeded the quota');
  e.name = 'QuotaExceededError';
  return e;
};

const store = (over: Record<string, unknown> = {}) => ({
  courses: [{ id: 'econ' }],
  done: { a: true },
  sittings: Array.from({ length: 20 }, (_, i) => ({ id: `s${i}`, pct: 50 })),
  notes: [
    { id: 'n1', updated: 1, body: 'x'.repeat(900) },
    { id: 'n2', updated: 2, body: 'short' },
  ],
  ...over,
});

describe('isQuotaError', () => {
  it('recognises the name every engine spells differently', () => {
    expect(isQuotaError(quota())).toBe(true);
    const firefox = new Error('');
    firefox.name = 'NS_ERROR_DOM_QUOTA_REACHED';
    expect(isQuotaError(firefox)).toBe(true);
  });

  it('recognises the numeric codes that predate the name', () => {
    const old = new Error('');
    (old as unknown as { code: number }).code = 22;
    expect(isQuotaError(old)).toBe(true);
  });

  it('does not mistake storage being switched off for storage being full', () => {
    // These need opposite responses: one sheds data, the other must not.
    const blocked = new Error('The operation is insecure.');
    blocked.name = 'SecurityError';
    expect(isQuotaError(blocked)).toBe(false);
    expect(isQuotaError('nope')).toBe(false);
  });
});

describe('shed', () => {
  it('drops half the old practice papers first', () => {
    const out = shed(store());
    expect((out?.next.sittings as unknown[]).length).toBe(10);
    expect(out?.said).toContain('practice papers');
  });

  it('keeps a floor of recent papers rather than emptying the list', () => {
    const out = shed(store({ sittings: Array.from({ length: 6 }, (_, i) => ({ id: `s${i}` })) }));
    expect((out?.next.sittings as unknown[]).length).toBe(5);
  });

  it('moves on to note bodies once the papers are down to the floor', () => {
    const out = shed(store({ sittings: [] }));
    expect(out?.said).toContain('one old note');
    const notes = out?.next.notes as { id: string; body: string }[];
    // The oldest fat one, and its title and files stay.
    expect(notes.find((n) => n.id === 'n1')?.body).toContain('cleared to make room');
    expect(notes.find((n) => n.id === 'n2')?.body).toBe('short');
  });

  it('never touches a tick, a course or a source', () => {
    const out = shed(store({ sources: [{ id: 'x' }] }));
    expect(out?.next.done).toEqual({ a: true });
    expect(out?.next.courses).toEqual([{ id: 'econ' }]);
    expect(out?.next.sources).toEqual([{ id: 'x' }]);
  });

  it('gives up rather than starting on data somebody would miss', () => {
    expect(shed({ courses: [{ id: 'econ' }], done: { a: true }, sittings: [], notes: [] })).toBe(
      null,
    );
  });
});

describe('save', () => {
  it('writes and says nothing when there is room', () => {
    const put = vi.fn();
    expect(save('{"a":1}', put)).toEqual({ ok: true, shed: [] });
    expect(put).toHaveBeenCalledOnce();
  });

  it('sheds and retries until it fits, and reports what went', () => {
    let calls = 0;
    const put = vi.fn(() => {
      calls++;
      if (calls === 1) throw quota();
    });
    const out = save(JSON.stringify(store()), put);
    expect(out.ok).toBe(true);
    expect(out.shed).toEqual(['10 old practice papers']);
    expect(put).toHaveBeenCalledTimes(2);
  });

  it('reports failure rather than looping forever when nothing helps', () => {
    const put = vi.fn(() => {
      throw quota();
    });
    const out = save(JSON.stringify(store()), put);
    expect(out).toMatchObject({ ok: false, reason: 'full' });
    // Bounded: an unbounded retry against a quota error is a frozen tab.
    expect(put.mock.calls.length).toBeLessThanOrEqual(7);
  });

  it('does not shed anything when storage is off rather than full', () => {
    const put = vi.fn(() => {
      const e = new Error('denied');
      e.name = 'SecurityError';
      throw e;
    });
    expect(save(JSON.stringify(store()), put)).toEqual({
      ok: false,
      reason: 'unavailable',
      shed: [],
    });
    expect(put).toHaveBeenCalledOnce();
  });

  it('fails cleanly rather than throwing when the payload is not JSON', () => {
    const put = vi.fn(() => {
      throw quota();
    });
    expect(save('not json', put)).toMatchObject({ ok: false, reason: 'full' });
  });
});

describe('trouble', () => {
  it('says nothing when a save simply worked', () => {
    expect(trouble({ ok: true, shed: [] })).toBe('');
  });

  it('names what was shed rather than dropping it silently', () => {
    // A save that quietly threw away last month's papers is the same betrayal
    // in a smaller coat.
    const said = trouble({ ok: true, shed: ['10 old practice papers'] });
    expect(said).toContain('10 old practice papers');
    expect(said).toContain('Everything else is saved');
  });

  it('tells the two failures apart, because the fixes differ', () => {
    expect(trouble({ ok: false, reason: 'unavailable', shed: [] })).toContain('private window');
    expect(trouble({ ok: false, reason: 'full', shed: [] })).toContain('free some space');
  });

  it('points at a backup before anything is deleted', () => {
    expect(trouble({ ok: false, reason: 'full', shed: [] })).toContain('Take it with you');
  });
});

describe('weigh', () => {
  it('counts the code units a browser charges for', () => {
    expect(weigh('abc')).toBe(6);
    expect(weigh('é')).toBe(2);
  });
});
