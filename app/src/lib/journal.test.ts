import { describe, expect, it } from 'vitest';
import { JOURNAL_KINDS, LIMIT, append, byDay, forObject, keyFor, line, provenanceLine, readEntries, readJournal, record, yours, type Entry } from './journal';
import { wellFormed } from './provenance';

/** A storage that remembers, and one that refuses, for `record`. */
function memory(): Storage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
}

const refusing: Pick<Storage, 'getItem' | 'setItem'> = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('SecurityError');
  },
};

const T = Date.UTC(2026, 8, 28, 14, 12);

const entry = (at: number, kind: Entry['kind'] = 'plan-saved', about?: Entry['about']): Entry => ({
  at,
  kind,
  detail: '',
  provenance: yours('Your planning workspace'),
  ...(about ? { about } : {}),
});

describe('the journal', () => {
  it('keys per account, so two people on one device do not read each other', () => {
    expect(keyFor('abc')).toBe('semester.journal.v1:abc');
    expect(keyFor(null)).toBe('semester.journal.v1:device');
  });

  it('appends newest first and holds the cap', () => {
    const many = Array.from({ length: LIMIT }, (_, i) => entry(i + 1));
    const next = append(many, entry(LIMIT + 1));
    expect(next).toHaveLength(LIMIT);
    expect(next[0].at).toBe(LIMIT + 1);
    expect(next.at(-1)!.at).toBe(2);
  });

  it('draws a timeline for one object and nothing else', () => {
    const plan = { type: 'plan', id: 'p1', label: 'Fall plan' };
    const entries = [entry(3, 'plan-saved', plan), entry(2, 'backup-added', { type: 'course', id: 'c1', label: 'MATH 150' }), entry(1, 'plan-saved', plan)];
    expect(forObject(entries, plan).map((e) => e.at)).toEqual([3, 1]);
    expect(forObject(entries, { type: 'plan', id: 'other' })).toEqual([]);
  });

  it('groups by local day, newest day first', () => {
    const day = 24 * 60 * 60 * 1000;
    const groups = byDay([entry(T), entry(T - 3 * day), entry(T + 60_000)]);
    expect(groups).toHaveLength(2);
    expect(groups[0].entries).toHaveLength(2);
    expect(groups[0].day > groups[1].day).toBe(true);
  });

  it('says the kind, with the detail when there is one', () => {
    expect(line(entry(T))).toBe('Plan saved');
    expect(line({ ...entry(T, 'agenda-shared'), detail: 'with Dr. Smith until 4 October' })).toBe('Advisor agenda shared — with Dr. Smith until 4 October');
    expect(provenanceLine(entry(T))).toBe('Source: You\nScope: Your planning workspace\nStatus: Active');
    expect(wellFormed(yours('Your planning workspace'))).toBe(true);
  });

  it('reads stored entries defensively: malformed rows are dropped, not repaired', () => {
    const good = entry(T, 'export-requested');
    expect(readEntries([good, { at: 'yesterday', kind: 'plan-saved' }, { at: T, kind: 'not-a-kind', provenance: good.provenance }, null, 7])).toEqual([good]);
    expect(readEntries('nonsense')).toEqual([]);
    expect(readEntries([{ at: T, kind: 'file-added', provenance: { source: 'You', scope: 'x', status: 'Done' }, about: { type: 'file', id: 'f' } }])[0].about).toBeUndefined();
  });

  it('records where it happens, and never throws when storage refuses', () => {
    const store = memory();
    const written = record('acct', { kind: 'support-granted', detail: 'for 7 days', provenance: yours('Semester support, 7 days') }, store);
    expect(written?.kind).toBe('support-granted');
    expect(readJournal('acct', store)).toHaveLength(1);
    expect(readJournal('other', store)).toEqual([]);
    expect(record('acct', { kind: 'plan-saved', detail: '', provenance: yours('x') }, refusing)).toBeNull();
    expect(readJournal('acct', refusing)).toEqual([]);
    expect(record('acct', { kind: 'plan-saved', detail: '', provenance: yours('x') }, null)).toBeNull();
  });

  it('names every kind the brief lists', () => {
    for (const k of ['plan-saved', 'backup-added', 'agenda-shared', 'support-granted', 'support-revoked', 'file-added', 'file-deleted', 'account-connected', 'ai-deleted', 'export-requested', 'credential-shared', 'profile-viewed']) {
      expect(JOURNAL_KINDS).toHaveProperty(k);
    }
  });
});
